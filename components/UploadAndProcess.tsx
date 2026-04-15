'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stage = 'idle' | 'uploading' | 'processing' | 'transcribing' | 'summarizing' | 'completed' | 'error'

interface JobResult {
  jobId: string
  transcriptText: string
  reportHtml: string
}

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  uploading: 'Caricamento video…',
  processing: 'Preparazione…',
  transcribing: 'Trascrizione in corso (qualche minuto)…',
  summarizing: 'Generazione resoconto con AI…',
  completed: 'Completato',
  error: 'Errore',
}

const STAGE_PROGRESS: Record<Stage, number> = {
  idle: 0, uploading: 20, processing: 35,
  transcribing: 55, summarizing: 80, completed: 100, error: 0,
}

export default function UploadAndProcess() {
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<JobResult | null>(null)
  const [streamingReport, setStreamingReport] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    if (pollRef.current) clearTimeout(pollRef.current)
    setStage('idle')
    setError(null)
    setResult(null)
    setStreamingReport('')
    setUploadProgress(0)
  }

  async function downloadFile(jobId: string, type: 'transcript' | 'report') {
    const res = await fetch(`/api/jobs/${jobId}/download?type=${type}`)
    const { url } = await res.json()
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'transcript' ? 'trascrizione.txt' : 'resoconto.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function processFile(file: File) {
    try {
      setError(null)
      setStreamingReport('')

      setStage('uploading')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessione non trovata')

      const ext = file.name.split('.').pop()
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/videos/${path}`

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload fallito: ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('Errore di rete durante upload'))
        xhr.send(file)
      })

      setStage('processing')
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: path.split('/').pop(), originalName: file.name, videoPath: path }),
      })
      if (!jobRes.ok) throw new Error('Impossibile creare job')
      const { job } = await jobRes.json()
      const jobId: string = job.id

      const startRes = await fetch(`/api/jobs/${jobId}/start`, { method: 'POST' })
      if (!startRes.ok) throw new Error('Impossibile avviare la trascrizione')

      setStage('transcribing')
      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          try {
            const statusRes = await fetch(`/api/jobs/${jobId}/status`)
            if (!statusRes.ok) throw new Error('Errore nel controllo stato')
            const { job: updatedJob } = await statusRes.json()
            if (updatedJob.status === 'error') { reject(new Error(updatedJob.error_message || 'Errore trascrizione')); return }
            if (updatedJob.status === 'summarizing') { resolve(); return }
            pollRef.current = setTimeout(poll, 5000)
          } catch (e) { reject(e) }
        }
        poll()
      })

      setStage('summarizing')
      const summarizeRes = await fetch(`/api/jobs/${jobId}/summarize`, { method: 'POST' })
      if (!summarizeRes.ok || !summarizeRes.body) throw new Error('Errore nella generazione resoconto')

      const reader = summarizeRes.body.getReader()
      const decoder = new TextDecoder()
      let fullReport = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullReport += chunk
        setStreamingReport(prev => prev + chunk)
      }

      const finalStatusRes = await fetch(`/api/jobs/${jobId}/status`)
      const { job: finalJob } = await finalStatusRes.json()

      setResult({ jobId, transcriptText: finalJob.transcript_text || '', reportHtml: fullReport })
      setStage('completed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto')
      setStage('error')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (stage === 'completed' && result) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-800">Elaborazione completata. File pronti per il download.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => downloadFile(result.jobId, 'transcript')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Trascrizione .txt
          </button>
          <button
            onClick={() => downloadFile(result.jobId, 'report')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Resoconto .html
          </button>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Anteprima resoconto</span>
          </div>
          <div className="p-4 max-h-80 overflow-auto">
            <div className="bg-white rounded-lg p-5 text-sm" dangerouslySetInnerHTML={{ __html: result.reportHtml }} />
          </div>
        </div>

        <button onClick={reset} className="w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-medium transition-colors">
          Trascrivi un altro file
        </button>
      </div>
    )
  }

  // ── IN PROGRESS ────────────────────────────────────────────────────────────
  if (stage !== 'idle' && stage !== 'error') {
    const progress = stage === 'uploading' ? uploadProgress : STAGE_PROGRESS[stage]
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">{STAGE_LABELS[stage]}</span>
            <span className="text-gray-400 font-mono text-xs">{progress}%</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {stage === 'summarizing' && streamingReport && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Resoconto in generazione…</span>
            </div>
            <div className="p-4 max-h-72 overflow-auto">
              <div className="bg-white rounded-lg p-5 text-sm" dangerouslySetInnerHTML={{ __html: streamingReport }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── IDLE ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragOver ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">Trascina il video qui</p>
          <p className="text-xs text-gray-400 mt-0.5">o clicca per selezionare</p>
          <p className="text-xs text-gray-300 mt-1">MP4, MOV, MKV, WebM — max 5 GB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/mpeg"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        />
      </div>

      {stage === 'error' && error && (
        <p className="text-sm text-red-600 flex items-start gap-1.5 px-1">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
