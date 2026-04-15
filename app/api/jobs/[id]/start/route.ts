import { createClient } from '@/lib/supabase/server'
import { AssemblyAI } from 'assemblyai'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  // Verifica ownership del job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job non trovato' }, { status: 404 })
  }

  // Avvia trascrizione AssemblyAI — video_path è un URL Vercel Blob pubblico
  const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

  const transcript = await client.transcripts.submit({
    audio_url: job.video_path,
    speaker_labels: true,
    language_code: 'it',
    speech_model: 'universal' as unknown as 'best',
  })

  // Salva assemblyai_id e aggiorna stato
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      assemblyai_id: transcript.id,
      status: 'transcribing',
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ assemblyaiId: transcript.id })
}
