import { createClient } from '@/lib/supabase/server'
import ReportsTable from '@/components/ReportsTable'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, original_name, status, error_message, created_at, transcript_path, report_path, notes')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resoconti</h1>
        <p className="text-gray-500 text-sm mt-1">Storico trascrizioni e resoconti generati.</p>
      </div>
      <ReportsTable jobs={jobs ?? []} />
    </div>
  )
}
