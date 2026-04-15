'use client'

import { useState } from 'react'

interface Job {
  id: string
  original_name: string
  status: string
  error_message: string | null
  created_at: string
  transcript_path: string | null
  report_path: string | null
}

interface ReportsTableProps {
  jobs: Job[]
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  uploading:    { label: 'Caricamento',    className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  processing:   { label: 'Preparazione',   className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  transcribing: { label: 'Trascrizione',   className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  summarizing:  { label: 'Resoconto',      className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  completed:    { label: 'Completato',     className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  error:        { label: 'Errore',         className: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export default function ReportsTable({ jobs }: ReportsTableProps) {
  const [previewJob, setPreviewJob] = useState<Job | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewType, setPreviewType] = useState<'transcript' | 'report'>('report')
  const [loadingPreview, setLoadingPreview] = useState(false)

  async function download(jobId: string, type: 'transcript' | 'report') {
    const res = await fetch(`/api/jobs/${jobId}/download?type=${type}`)
    if (!res.ok) return
    const { url } = await res.json()
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'transcript' ? 'trascrizione.txt' : 'resoconto.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function openPreview(job: Job, type: 'transcript' | 'report') {
    setLoadingPreview(true)
    setPreviewJob(job)
    setPreviewType(type)
    setPreviewContent('')

    const res = await fetch(`/api/jobs/${job.id}/download?type=${type}`)
    if (!res.ok) { setLoadingPreview(false); return }
    const { url } = await res.json()

    const fileRes = await fetch(url)
    const text = await fileRes.text()
    setPreviewContent(text)
    setLoadingPreview(false)
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-slate-400 font-medium">Nessun resoconto ancora</p>
        <p className="text-slate-600 text-sm mt-1">Carica il tuo primo video dalla home</p>
        <a
          href="/"
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Vai alla Home
        </a>
      </div>
    )
  }

  return (
    <>
      {/* Tabella */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3.5 text-slate-400 font-medium">File</th>
                <th className="text-left px-4 py-3.5 text-slate-400 font-medium">Stato</th>
                <th className="text-left px-4 py-3.5 text-slate-400 font-medium">Data</th>
                <th className="text-right px-5 py-3.5 text-slate-400 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => {
                const statusCfg = STATUS_CONFIG[job.status] ?? { label: job.status, className: 'bg-slate-700 text-slate-400 border-slate-600' }
                const isCompleted = job.status === 'completed'
                return (
                  <tr
                    key={job.id}
                    className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                  >
                    {/* Nome file */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/15 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-white font-medium truncate max-w-xs">{job.original_name}</span>
                      </div>
                    </td>

                    {/* Stato */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                      {job.status === 'error' && job.error_message && (
                        <p className="text-xs text-red-400/70 mt-1 max-w-xs truncate">{job.error_message}</p>
                      )}
                    </td>

                    {/* Data */}
                    <td className="px-4 py-4 text-slate-400">
                      {new Date(job.created_at).toLocaleDateString('it-IT', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                      <div className="text-xs text-slate-600">
                        {new Date(job.created_at).toLocaleTimeString('it-IT', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>

                    {/* Azioni */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isCompleted && (
                          <>
                            <button
                              onClick={() => openPreview(job, 'transcript')}
                              title="Anteprima trascrizione"
                              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openPreview(job, 'report')}
                              title="Anteprima resoconto"
                              className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-600/10 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => download(job.id, 'transcript')}
                              title="Scarica trascrizione"
                              className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-600/10 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => download(job.id, 'report')}
                              title="Scarica resoconto HTML"
                              className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-600/10 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal anteprima */}
      {previewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewJob(null)} />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div>
                <p className="text-white font-semibold">{previewJob.original_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {previewType === 'transcript' ? 'Trascrizione' : 'Resoconto HTML'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => download(previewJob.id, previewType)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Scarica
                </button>
                <button
                  onClick={() => setPreviewJob(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-5">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : previewType === 'transcript' ? (
                <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {previewContent}
                </pre>
              ) : (
                <div className="bg-white rounded-xl p-6">
                  <div
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
