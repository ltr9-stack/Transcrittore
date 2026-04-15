import { createClient } from '@/lib/supabase/server'
import { AssemblyAI } from 'assemblyai'
import { NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
}

async function deleteVideoFromR2(key: string) {
  try {
    await r2Client().send(new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
    }))
  } catch { /* non bloccante */ }
}

export async function GET(
  _request: Request,
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

  // Se già completato o in errore, restituisci direttamente
  if (job.status === 'completed' || job.status === 'error') {
    return NextResponse.json({ job })
  }

  // Se in fase di trascrizione, controlla AssemblyAI
  if (job.status === 'transcribing' && job.assemblyai_id) {
    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

    const transcript = await client.transcripts.get(job.assemblyai_id)

    if (transcript.status === 'error') {
      await supabase
        .from('jobs')
        .update({ status: 'error', error_message: transcript.error || 'Errore AssemblyAI' })
        .eq('id', id)
      await deleteVideoFromR2(job.video_path)
      return NextResponse.json({ job: { ...job, status: 'error', error_message: transcript.error } })
    }

    if (transcript.status === 'completed') {
      // Formatta la trascrizione con speaker label
      let formattedTranscript = ''
      if (transcript.utterances && transcript.utterances.length > 0) {
        formattedTranscript = transcript.utterances
          .map(u => `[Speaker ${u.speaker}]: ${u.text}`)
          .join('\n')
      } else {
        formattedTranscript = transcript.text || ''
      }

      // Salva il testo trascrizione su Supabase Storage
      const transcriptPath = `${user.id}/${id}.txt`
      await supabase.storage
        .from('transcripts')
        .upload(transcriptPath, formattedTranscript, {
          contentType: 'text/plain; charset=utf-8',
          upsert: true,
        })

      // Aggiorna job con trascrizione pronta ed elimina video da R2
      await supabase
        .from('jobs')
        .update({
          status: 'summarizing',
          transcript_text: formattedTranscript,
          transcript_path: transcriptPath,
        })
        .eq('id', id)
      await deleteVideoFromR2(job.video_path)

      return NextResponse.json({
        job: {
          ...job,
          status: 'summarizing',
          transcript_text: formattedTranscript,
          transcript_path: transcriptPath,
        },
      })
    }

    // Ancora in corso
    return NextResponse.json({ job: { ...job, assemblyaiStatus: transcript.status } })
  }

  return NextResponse.json({ job })
}
