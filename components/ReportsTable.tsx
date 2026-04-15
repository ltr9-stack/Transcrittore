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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  uploading:    { label: 'Caricamento',  className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  processing:   { label: 'Preparazione', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  transcribing: { label: 'Trascrizione', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  summarizing:  { label: 'Resoconto',    className: 'bg-gray-100 text-gray-700 border-gray-200' },
  completed:    { label: 'Completato',   className: 'bg-green-50 text-green-700 border-green-200' },
  error:        { label: 'Errore',       className: 'bg-red-50 text-red-700 border-red-200' },
}

export default function ReportsTable({ jobs }: { jobs: Job[] }) {
  const [previewJob, setPreviewJob] = useState<Job | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewType, setPreviewType] = useState<'transcript' | 'report'>('report')
  const [loadingPreview, setLoadingPreview] = useState(false)

  async function download(jobId: string, type: 'transcript' | 'report') {
    const res = await fetch(`/api/jobs/${jobId}/download?type=${type}`)
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
    setPreviewContent(await fileRes.text())
    setLoadingPreview(false)
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium text-sm">Nessun resoconto ancora</p>
        <p className="text-gray-400 text-xs mt-1">Carica il tuo primo video dalla home</p>
        <a href="/" className="mt-5 px-5 py-2 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors">
          Vai alla Home
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">File</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map(job => {
                const s = STATUS_CONFIG[job.status] ?? { label: job.status, className: 'bg-gray-100 text-gray-600 border-gray-200' }
                const done = job.status === 'completed'
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 truncate max-w-xs">{job.original_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${s.className}`}>
                        {s.label}
                      </span>
                      {job.status === 'error' && job.error_message && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{job.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">
                      <div>{new Date(job.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-gray-400">{new Date(job.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {done && (
                          <>
                            <button onClick={() => openPreview(job, 'transcript')} title="Anteprima trascrizione"
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                              </svg>
                            </button>
                            <button onClick={() => openPreview(job, 'report')} title="Anteprima resoconto"
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button onClick={() => download(job.id, 'transcript')} title="Scarica .txt"
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button onClick={() => download(job.id, 'report')} title="Scarica .html"
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
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

      {/* Modal */}
      {previewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewJob(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{previewJob.original_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{previewType === 'transcript' ? 'Trascrizione' : 'Resoconto HTML'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => download(previewJob.id, previewType)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs rounded-lg transition-colors font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Scarica
                </button>
                <button onClick={() => setPreviewJob(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : previewType === 'transcript' ? (
                <pre className="text-gray-700 text-sm whitespace-pre-wrap font-mono leading-relaxed">{previewContent}</pre>
              ) : (
                <div className="border border-gray-100 rounded-xl p-6 bg-gray-50">
                  <div className="bg-white rounded-lg p-5 text-sm" dangerouslySetInnerHTML={{ __html: previewContent }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
