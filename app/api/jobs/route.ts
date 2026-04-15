import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/jobs — crea un nuovo job di trascrizione
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { filename, originalName, videoPath } = await request.json()
  if (!filename || !originalName || !videoPath) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      filename,
      original_name: originalName,
      video_path: videoPath,
      status: 'processing',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ job: data })
}

// GET /api/jobs — lista job dell'utente
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data })
}
