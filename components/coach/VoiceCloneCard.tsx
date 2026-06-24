'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Coach Portal card: clone the coach's voice (ElevenLabs Instant Voice Cloning)
// so a coached client hears exercise cues in their actual coach's voice.
// Gated by the COACH_VOICE_CLONING flag at the dashboard level + the server's
// ELEVENLABS_API_KEY (reflected here as `configured`).

type VoiceStatus = 'none' | 'pending' | 'ready' | 'failed'

const SCRIPT =
  "Alright, let's get to work. Today we're building real strength, so move with control and own every rep. " +
  "Breathe out on the effort, keep your core braced, and don't rush the lowering phase. " +
  "Quality beats quantity — one clean rep is worth more than five sloppy ones. " +
  "You've got this. Stay focused, stay patient, and let's finish strong."

const PREVIEW_LINE =
  "Nice work — last set. Brace your core, drive through your heels, and give me everything you've got."

export default function VoiceCloneCard() {
  const { user } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [configured, setConfigured] = useState(true)
  const [status, setStatus]     = useState<VoiceStatus>('none')
  const [err, setErr]           = useState<string | null>(null)

  // recording state
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const [blob, setBlob]           = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl]     = useState<string | null>(null)
  const [consent, setConsent]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)

  // preview state
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/coach/voice', { headers: await authHeaders() })
      const data = await res.json()
      setConfigured(data.configured !== false)
      setStatus((data.status as VoiceStatus) ?? 'none')
      setErr(data.error ?? null)
    } catch {
      setStatus('none')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) loadStatus() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    if (audioRef.current) audioRef.current.pause()
  }, [blobUrl])

  async function startRecording() {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const b = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
        setBlob(b)
        if (blobUrl) URL.revokeObjectURL(blobUrl)
        setBlobUrl(URL.createObjectURL(b))
      }
      mr.start()
      recorderRef.current = mr
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } catch {
      setErr('Microphone access denied. Allow mic access, or upload an audio file instead.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setErr(null)
    setBlob(f)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    setBlobUrl(URL.createObjectURL(f))
    setElapsed(0)
  }

  function resetRecording() {
    setBlob(null)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    setBlobUrl(null)
    setElapsed(0)
  }

  async function submit() {
    if (!blob || !consent || submitting) return
    setSubmitting(true); setErr(null)
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'sample.webm')
      fd.append('consent', 'true')
      fd.append('name', (user?.user_metadata?.name as string) ?? 'Coach')
      fd.append('seconds', String(elapsed))
      const res = await fetch('/api/coach/voice', {
        method: 'POST', headers: await authHeaders(), body: fd,
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Voice cloning failed.'); setSubmitting(false); return }
      setStatus('ready')
      setShowRecorder(false)
      resetRecording()
      setConsent(false)
    } catch {
      setErr('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function preview() {
    if (previewLoading || previewing) {
      audioRef.current?.pause()
      setPreviewing(false)
      return
    }
    setPreviewLoading(true); setErr(null)
    try {
      const res = await fetch('/api/coach/voice/speak', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: PREVIEW_LINE, name_normalized: '__preview__', preview: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { setErr('Could not play preview.'); setPreviewLoading(false); return }
      const audio = new Audio(data.url)
      audioRef.current = audio
      audio.onplay = () => { setPreviewLoading(false); setPreviewing(true) }
      audio.onended = () => setPreviewing(false)
      audio.onerror = () => { setPreviewLoading(false); setPreviewing(false) }
      await audio.play()
    } catch {
      setErr('Could not play preview.')
      setPreviewLoading(false)
    }
  }

  async function remove() {
    if (!confirm('Remove your cloned voice? Clients will hear the default narrator again.')) return
    setSubmitting(true)
    try {
      await fetch('/api/coach/voice', { method: 'DELETE', headers: await authHeaders() })
      setStatus('none')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const eyebrow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        🎙 Your Coaching Voice
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 7px', letterSpacing: '0.05em' }}>
        PREMIUM
      </span>
    </div>
  )

  const shell = (inner: React.ReactNode) => (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 26 }}>
      {eyebrow}
      {inner}
    </div>
  )

  if (loading) return shell(<p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading…</p>)

  // Key present? If not, graceful "being set up" state (no errors thrown at the coach).
  if (!configured) {
    return shell(
      <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        Coaching-voice narration is being set up. Soon you&apos;ll be able to record a short sample and have your
        clients hear exercise cues in <strong style={{ color: 'var(--text-mid)' }}>your</strong> voice. Check back shortly.
      </p>
    )
  }

  // ── Voice is live ───────────────────────────────────────────────────────────
  if (status === 'ready') {
    return shell(
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Your voice is live</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
          When a client follows one of your programs and taps the 🔈 button on an exercise, they&apos;ll hear the
          coaching cues in your voice.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={preview} disabled={submitting}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {previewLoading ? 'Loading…' : previewing ? '⏸ Stop' : '▶ Preview my voice'}
          </button>
          <button onClick={() => { setStatus('none'); setShowRecorder(true) }} disabled={submitting}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↺ Re-record
          </button>
          <button onClick={remove} disabled={submitting}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Remove
          </button>
        </div>
        {err && <p style={{ fontSize: 12, color: '#ff3b30', marginTop: 12 }}>{err}</p>}
      </>
    )
  }

  // ── Pending (cloning in progress) ────────────────────────────────────────────
  if (status === 'pending') {
    return shell(
      <>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 12 }}>
          ⏳ Building your voice… this usually takes a few seconds. Refresh to check.
        </p>
        <button onClick={loadStatus}
          style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ Refresh status
        </button>
      </>
    )
  }

  // ── Setup / record (status none or failed, or re-recording) ──────────────────
  const intro = (
    <>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
        Record a short sample and your clients will hear exercise cues in <strong style={{ color: 'var(--text-mid)' }}>your</strong> voice
        instead of the default narrator. <em>Your coach, in their ear, every rep.</em>
      </p>
      {status === 'failed' && err && (
        <p style={{ fontSize: 12, color: '#ff3b30', marginBottom: 12 }}>Last attempt failed: {err}</p>
      )}
    </>
  )

  if (!showRecorder && (status === 'none' || status === 'failed')) {
    return shell(
      <>
        {intro}
        <button onClick={() => setShowRecorder(true)}
          style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          🎙 Set up my voice
        </button>
      </>
    )
  }

  return shell(
    <>
      {intro}

      {/* Script to read */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Read this aloud (≈30–60 sec, quiet room, phone ~6 inches away)
        </div>
        <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>{SCRIPT}</p>
      </div>

      {/* Recorder / upload */}
      {!blobUrl ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {!recording ? (
            <button onClick={startRecording}
              style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              ● Start recording
            </button>
          ) : (
            <button onClick={stopRecording}
              style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: '#ff3b30', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
              Stop · {fmt(elapsed)}
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>or</span>
          <label style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ⬆ Upload audio
            <input type="file" accept="audio/*" onChange={onUpload} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <audio src={blobUrl} controls style={{ width: '100%', marginBottom: 10 }} />
          <button onClick={resetRecording}
            style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            ↺ Record again
          </button>
        </div>
      )}

      {/* Consent */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6 }}>
          This is my own voice and I consent to Atlas Prime creating a synthetic clone of it to narrate exercise
          instructions for my clients. I can remove it at any time.
        </span>
      </label>

      {err && <p style={{ fontSize: 12, color: '#ff3b30', marginBottom: 12 }}>{err}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={submit} disabled={!blob || !consent || submitting}
          style={{ padding: '12px 22px', borderRadius: 10, border: 'none',
            background: (!blob || !consent || submitting) ? 'var(--surface)' : 'var(--accent)',
            color: (!blob || !consent || submitting) ? 'var(--text-dim)' : '#fff',
            fontWeight: 800, fontSize: 14, cursor: (!blob || !consent || submitting) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {submitting ? 'Creating your voice…' : 'Create my voice'}
        </button>
        <button onClick={() => { setShowRecorder(false); resetRecording(); setConsent(false); loadStatus() }} disabled={submitting}
          style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
    </>
  )
}
