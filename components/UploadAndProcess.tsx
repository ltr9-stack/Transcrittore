'use client'

import { useState, useRef, useCallback } from 'react'

type Stage =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'transcribing'
  | 'summarizing'
  | 'completed'
  | 'error'

interface JobResult {
  jobId: string
  transcriptText: string
  reportHtml: string
}

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  uploading: 'Caricamento video...',
  processing: 'Preparazione job...',
  transcribing: 'Trascrizione in corso (potrebbe richiedere qualche minuto)...',
  summarizing: 'Generazione resoconto con Claude...',
  completed: 'Elaborazione completata!',
  error: 'Si è verificato un errore',
}

const STAGE_PROGRESS: Record<Stage, number> = {
  idle: 0,
  uploading: 20,
  processing: 35,
  transcribing: 55,
  summarizing: 80,
  completed: 100,
  error: 0,
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

  const acceptedTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/mpeg']

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

      // 1. Richiedi URL firmato per upload
      setStage('uploading')
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!urlRes.ok) throw new Error('Impossibile ottenere URL di upload')
      const { signedUrl, path } = await urlRes.json()

      // 2. Upload diretto su Supabase Storage con XMLHttpRequest per progresso
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload fallito: ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('Errore di rete durante upload'))
        xhr.send(file)
      })

      // 3. Crea job su DB
      setStage('processing')
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: path.split('/').pop(),
          originalName: file.name,
          videoPath: path,
        }),
      })
      if (!jobRes.ok) throw new Error('Impossibile creare job')
      const { job } = await jobRes.json()
      const jobId: string = job.id

      // 4. Avvia trascrizione AssemblyAI
      const startRes = await fetch(`/api/jobs/${jobId}/start`, { method: 'POST' })
      if (!startRes.ok) throw new Error('Impossibile avviare la trascrizione')

      // 5. Polling status fino a 'summarizing'
      setStage('transcribing')
      await new Promise<string>((resolve, reject) => {
        const poll = async () => {
          try {
            const statusRes = await fetch(`/api/jobs/${jobId}/status`)
            if (!statusRes.ok) throw new Error('Errore nel controllo stato')
            const { job: updatedJob } = await statusRes.json()

            if (updatedJob.status === 'error') {
              reject(new Error(updatedJob.error_message || 'Errore durante la trascrizione'))
              return
            }

            if (updatedJob.status === 'summarizing') {
              resolve(updatedJob.transcript_text)
              return
            }

            pollRef.current = setTimeout(poll, 5000)
          } catch (e) {
            reject(e)
          }
        }
        poll()
      })

      // 6. Genera resoconto con streaming
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

      // 7. Ottieni trascrizione finale
      const finalStatusRes = await fetch(`/api/jobs/${jobId}/status`)
      const { job: finalJob } = await finalStatusRes.json()

      setResult({
        jobId,
        transcriptText: finalJob.transcript_text || '',
        reportHtml: fullReport,
      })
      setStage('completed')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore sconosciuto'
      setError(msg)
      setStage('error')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && acceptedTypes.includes(file.type)) {
      processFile(file)
    } else {
      setError('Formato non supportato. Carica un file MP4, MOV, MKV o WebM.')
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  if (stage === 'completed' && result) {
    return (
      <div className="space-y-6">
        {/* Success banner */}
        <div className="flex items-center gap-3 px-5 py-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-green-400 font-semibold">Elaborazione completata!</p>
            <p className="text-slate-400 text-sm">Trascrizione e resoconto pronti per il download.</p>
          </div>
        </div>

        {/* Download buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => downloadFile(result.jobId, 'transcript')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Scarica Trascrizione (.txt)
          </button>
          <button
            onClick={() => downloadFile(result.jobId, 'report')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-xl font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Scarica Resoconto (.html)
          </button>
        </div>

        {/* Preview report */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Anteprima Resoconto</span>
            <span className="text-xs text-slate-500">HTML</span>
          </div>
          <div className="p-5 max-h-96 overflow-auto">
            <div
              className="bg-white rounded-xl p-6 text-sm"
              dangerouslySetInnerHTML={{ __html: result.reportHtml }}
            />
          </div>
        </div>

        <button
          onClick={reset}
          className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition-colors border border-white/10"
        >
          Trascrivi un altro file
        </button>
      </div>
    )
  }

  if (stage !== 'idle' && stage !== 'error') {
    const progress = stage === 'uploading' ? uploadProgress : STAGE_PROGRESS[stage]
    return (
      <div className="space-y-6">
        {/* Progress */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
              <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium text-sm">{STAGE_LABELS[stage]}</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Streaming preview */}
        {stage === 'summarizing' && streamingReport && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-slate-300">Resoconto in generazione...</span>
            </div>
            <div className="p-5 max-h-80 overflow-auto">
              <div
                className="bg-white rounded-xl p-6 text-sm"
                dangerouslySetInnerHTML={{ __html: streamingReport }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">Trascina il video qui</p>
          <p className="text-slate-400 text-sm mt-1">o clicca per selezionare un file</p>
          <p className="text-slate-500 text-xs mt-2">MP4, MOV, MKV, WebM — max 5 GB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/mpeg"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {stage === 'error' && error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
