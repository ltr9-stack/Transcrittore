import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
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
    .select('transcript_path, report_path, video_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job non trovato' }, { status: 404 })
  }

  const type = request.nextUrl.searchParams.get('type') as 'transcript' | 'report' | 'video'

  const bucketMap = {
    transcript: { bucket: 'transcripts', path: job.transcript_path },
    report: { bucket: 'reports', path: job.report_path },
    video: { bucket: 'videos', path: job.video_path },
  }

  const target = bucketMap[type]
  if (!target || !target.path) {
    return NextResponse.json({ error: 'File non disponibile' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(target.bucket)
    .createSignedUrl(target.path, 300) // 5 minuti

  if (error || !data) {
    return NextResponse.json({ error: 'Impossibile generare URL download' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
