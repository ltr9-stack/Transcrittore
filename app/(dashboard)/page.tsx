import { createClient } from '@/lib/supabase/server'
import UploadAndProcess from '@/components/UploadAndProcess'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user!.id)
    .single()

  const displayName = profile?.display_name ||
    user?.email?.replace('@traptranscriptor.local', '') ||
    'Utente'

  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('id, original_name, status, created_at')
    .eq('user_id', user!.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Ciao, {displayName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Carica una registrazione per ottenere trascrizione e resoconto.
        </p>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Nuova trascrizione
        </h2>
        <UploadAndProcess />
      </div>

      {/* Recent */}
      {recentJobs && recentJobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recenti</h2>
            <a href="/reports" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Vedi tutti →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentJobs.map(job => (
              <div key={job.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.original_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(job.created_at).toLocaleDateString('it-IT', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  completato
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
