import { createClient } from '@/lib/supabase/server'
import { AssemblyAI } from 'assemblyai'
import { NextResponse } from 'next/server'
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job non trovato' }, { status: 404 })
  }

  // Genera URL firmato R2 per AssemblyAI (valido 2 ore)
  let audioUrl: string
  try {
    audioUrl = await getSignedUrl(
      r2Client(),
      new GetObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: job.video_path,
      }),
      { expiresIn: 7200 }
    )
  } catch (e) {
    return NextResponse.json({ error: `R2 signed URL error: ${(e as Error).message}` }, { status: 500 })
  }

  // Avvia trascrizione AssemblyAI
  const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

  let transcript: Awaited<ReturnType<typeof client.transcripts.submit>>
  try {
    transcript = await client.transcripts.submit({
      audio_url: audioUrl,
      speaker_labels: true,
      language_code: 'it',
      speech_model: 'universal' as unknown as 'best',
    })
  } catch (e) {
    return NextResponse.json({ error: `AssemblyAI error: ${(e as Error).message}` }, { status: 500 })
  }

  // Salva assemblyai_id e aggiorna stato
  const { error: updateError } = await supabase
    .from('jobs')
    .update({ assemblyai_id: transcript.id, status: 'transcribing' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Elimina il video da R2 — AssemblyAI ha già il job in coda
  try {
    await r2Client().send(new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: job.video_path,
    }))
  } catch {
    // non bloccante
  }

  return NextResponse.json({ assemblyaiId: transcript.id })
}
