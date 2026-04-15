import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
// @ts-expect-error no types
import HTMLtoDOCX from 'html-to-docx'
import JSZip from 'jszip'

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
    .select('transcript_path, report_path, original_name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job non trovato' }, { status: 404 })
  }

  const type = request.nextUrl.searchParams.get('type') as 'transcript' | 'report' | 'word' | 'all'

  // ── Trascrizione .txt ───────────────────────────────────────────────────────
  if (type === 'transcript') {
    const { data, error } = await supabase.storage
      .from('transcripts')
      .createSignedUrl(job.transcript_path, 300)
    if (error || !data) return NextResponse.json({ error: 'File non disponibile' }, { status: 404 })
    return NextResponse.json({ url: data.signedUrl })
  }

  // ── Report .html (legacy) ───────────────────────────────────────────────────
  if (type === 'report') {
    const { data, error } = await supabase.storage
      .from('reports')
      .createSignedUrl(job.report_path, 300)
    if (error || !data) return NextResponse.json({ error: 'File non disponibile' }, { status: 404 })
    return NextResponse.json({ url: data.signedUrl })
  }

  // ── Report .docx ────────────────────────────────────────────────────────────
  if (type === 'word') {
    const { data: signed } = await supabase.storage
      .from('reports')
      .createSignedUrl(job.report_path, 300)
    if (!signed) return NextResponse.json({ error: 'File non disponibile' }, { status: 404 })

    const html = await fetch(signed.signedUrl).then(r => r.text())
    const docxBuffer = await HTMLtoDOCX(html, null, {
      title: job.original_name,
      orientation: 'portrait',
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    })

    const baseName = job.original_name.replace(/\.[^.]+$/, '')
    return new Response(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${baseName}_resoconto.docx"`,
      },
    })
  }

  // ── ZIP con trascrizione + resoconto Word ───────────────────────────────────
  if (type === 'all') {
    const [{ data: txSigned }, { data: rpSigned }] = await Promise.all([
      supabase.storage.from('transcripts').createSignedUrl(job.transcript_path, 300),
      supabase.storage.from('reports').createSignedUrl(job.report_path, 300),
    ])
    if (!txSigned || !rpSigned) return NextResponse.json({ error: 'File non disponibili' }, { status: 404 })

    const [txtContent, htmlContent] = await Promise.all([
      fetch(txSigned.signedUrl).then(r => r.text()),
      fetch(rpSigned.signedUrl).then(r => r.text()),
    ])

    const docxBuffer = await HTMLtoDOCX(htmlContent, null, {
      title: job.original_name,
      orientation: 'portrait',
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    })

    const zip = new JSZip()
    const baseName = job.original_name.replace(/\.[^.]+$/, '')
    zip.file(`${baseName}_trascrizione.txt`, txtContent)
    zip.file(`${baseName}_resoconto.docx`, docxBuffer)
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

    return new Response(zipBuffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${baseName}.zip"`,
      },
    })
  }

  return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })
}
