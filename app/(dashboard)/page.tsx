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

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Utente'

  // Ultimi 3 job completati
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('id, original_name, status, created_at')
    .eq('user_id', user!.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Ciao, <span className="text-blue-400">{displayName}</span> 👋
        </h1>
        <p className="text-slate-400 mt-1">
          Carica una registrazione e ottieni trascrizione e resoconto in pochi minuti.
        </p>
      </div>

      {/* Upload card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Nuova trascrizione
        </h2>
        <UploadAndProcess />
      </div>

      {/* Recent jobs */}
      {recentJobs && recentJobs.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recenti</h2>
            <a href="/reports" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              Vedi tutti →
            </a>
          </div>
          <div className="space-y-2">
            {recentJobs.map(job => (
              <div
                key={job.id}
                className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{job.original_name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(job.created_at).toLocaleDateString('it-IT', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
