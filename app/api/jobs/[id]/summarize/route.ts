import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Sei un consulente di alto livello incaricato di redigere il resoconto di una call con un cliente.
Restituisci SEMPRE e SOLO codice HTML completo e ben formattato, senza nessun testo prima o dopo, senza backtick, senza markdown.

Usa questo stile HTML professionale:
- Font: Arial, dimensione 12px
- Titolo principale in blu scuro (#1a3a5c), grassetto, 24px
- Titoli sezioni in blu (#2c5f8a), grassetto, 18px
- Testo normale nero, line-height 1.6
- Padding generale 40px
- Sezioni separate da una linea orizzontale grigia

Struttura il documento così:

<h1>Resoconto Call</h1>
Una o due frasi che contestualizzano la call.

<h2>Temi Trattati</h2>
Per ogni tema una sezione con titolo <h3> e paragrafo in prosa fluida e professionale.

<h2>Next Step</h2>
Lista ordinata <ol> con ogni azione, responsabile e scadenza.

Scrivi SEMPRE in italiano.
Cerca di dedurre i nomi reali degli speaker (Speaker A, B, ecc.) se vengono menzionati durante la call.
Estrai solo informazioni presenti nel testo, senza inventare nulla.`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job non trovato' }, { status: 404 })
  }

  if (!job.transcript_text) {
    return NextResponse.json({ error: 'Trascrizione non disponibile' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const encoder = new TextEncoder()
  const reportParts: string[] = []

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analizza la seguente trascrizione e genera il resoconto HTML.\n\nTRASCRIZIONE:\n${job.transcript_text}`,
            },
          ],
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            reportParts.push(chunk)
            controller.enqueue(encoder.encode(chunk))
          }
        }

        // Report completato — salva su DB e Storage
        const reportHtml = reportParts.join('')
        const reportPath = `${user.id}/${id}.html`

        await supabase.storage
          .from('reports')
          .upload(reportPath, reportHtml, {
            contentType: 'text/html; charset=utf-8',
            upsert: true,
          })

        await supabase
          .from('jobs')
          .update({
            status: 'completed',
            report_html: reportHtml,
            report_path: reportPath,
          })
          .eq('id', id)

        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto'
        await supabase
          .from('jobs')
          .update({ status: 'error', error_message: message })
          .eq('id', id)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  })
}
