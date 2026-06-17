'use client'
import { useEffect, useRef, useState } from 'react'
import { loadYouTubeAPI, type YTPlayer } from '@/lib/youtube-iframe'

/**
 * Admin loop trimmer for YouTube-hosted exercise videos.
 * Uses the YouTube IFrame Player API to expose a draggable in/out scrubber and a
 * live "preview just the loop" playback. Saves loop_start_sec / loop_end_sec only —
 * the original video is never altered. Self-hosted (native <video>) videos will get a
 * thumbnail-filmstrip variant in a later phase; exercise_library is YouTube-only today.
 */

function mmss(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

const C = {
  bg: '#0d1117', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.14)', accentBorder: 'rgba(59,130,246,0.4)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.12)', greenBorder: 'rgba(34,197,94,0.3)',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681', red: '#ef4444',
}

export default function YouTubeLoopTrimmer({
  videoId,
  isShort,
  initialStart,
  initialEnd,
  saving,
  hasSavedLoop,
  onSave,
  onClear,
}: {
  videoId: string
  isShort?: boolean
  initialStart: number | null
  initialEnd: number | null
  saving?: boolean
  hasSavedLoop?: boolean
  onSave: (start: number, end: number) => void
  onClear: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const pollRef = useRef<number | null>(null)
  const draggingRef = useRef<'start' | 'end' | null>(null)

  const [ready, setReady] = useState(false)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(initialStart ?? 0)
  const [end, setEnd] = useState(initialEnd ?? 0)
  const [current, setCurrent] = useState(initialStart ?? 0)
  const [looping, setLooping] = useState(false)

  // Refs mirror state so drag handlers never read stale closure values.
  const startRef = useRef(start); startRef.current = start
  const endRef = useRef(end); endRef.current = end
  const durRef = useRef(duration); durRef.current = duration
  const loopRef = useRef(looping); loopRef.current = looping

  // ── Create / destroy the player ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return
      const host = document.createElement('div')
      host.style.width = '100%'; host.style.height = '100%'
      containerRef.current.appendChild(host)
      const player = new window.YT.Player(host, {
        videoId,
        width: '100%', height: '100%',
        playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, disablekb: 1, mute: 1 },
        events: {
          onReady: (e) => {
            const d = e.target.getDuration()
            setDuration(d)
            const s = initialStart ?? 0
            const en = initialEnd ?? d
            setStart(s); setEnd(en); setCurrent(s)
            e.target.mute()
            e.target.seekTo(s, true)
            setReady(true)
          },
          onStateChange: (e) => {
            // If the clip runs to the natural end while looping, jump back to start.
            if (e.data === window.YT?.PlayerState.ENDED && loopRef.current) {
              e.target.seekTo(startRef.current, true)
              e.target.playVideo()
            }
          },
        },
      })
      playerRef.current = player
    })
    return () => {
      cancelled = true
      if (pollRef.current) window.clearInterval(pollRef.current)
      try { playerRef.current?.destroy() } catch { /* player already gone */ }
      playerRef.current = null
    }
    // videoId is stable per mounted exercise (keyed by video_url in the parent).
  }, [videoId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll playhead + enforce the loop window ─────────────────────────────────
  useEffect(() => {
    if (!ready) return
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      if (durRef.current === 0) { const d = p.getDuration(); if (d > 0) setDuration(d) }
      const t = p.getCurrentTime()
      setCurrent(t)
      if (loopRef.current && t >= endRef.current - 0.08) p.seekTo(startRef.current, true)
    }, 150)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [ready])

  const pct = (t: number) => (duration > 0 ? `${Math.min(100, Math.max(0, (t / duration) * 100))}%` : '0%')

  function timeFromClientX(clientX: number): number {
    const bar = barRef.current
    if (!bar || durRef.current === 0) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return ratio * durRef.current
  }

  function onHandleDown(which: 'start' | 'end') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      draggingRef.current = which
      setLooping(false)
      playerRef.current?.pauseVideo()
      const move = (ev: PointerEvent) => {
        const t = timeFromClientX(ev.clientX)
        if (draggingRef.current === 'start') setStart(Math.min(t, endRef.current - 0.2))
        else setEnd(Math.max(t, startRef.current + 0.2))
        playerRef.current?.seekTo(t, true)
      }
      const up = () => {
        draggingRef.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }

  function toggleLoop() {
    const p = playerRef.current
    if (!p) return
    if (looping) { p.pauseVideo(); setLooping(false) }
    else { p.seekTo(start, true); p.mute(); p.playVideo(); setLooping(true) }
  }

  const segLen = Math.max(0, end - start)
  const btn = (bg: string, brd: string, col: string): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 7, border: `1px solid ${brd}`, background: bg,
    color: col, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Player */}
      <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: isShort ? 220 : 480 }}>
        <div style={{ position: 'relative', paddingBottom: isShort ? '177.78%' : '56.25%', height: 0 }}>
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
          {!ready && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 12 }}>
              Loading player…
            </div>
          )}
        </div>
      </div>

      {/* Scrubber */}
      <div
        ref={barRef}
        style={{ position: 'relative', height: 40, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, touchAction: 'none', userSelect: 'none' }}
      >
        {/* selected region */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(start), width: `calc(${pct(end)} - ${pct(start)})`, background: C.accentDim, borderLeft: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` }} />
        {/* playhead */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(current), width: 2, background: C.green, pointerEvents: 'none' }} />
        {/* start handle */}
        <div
          onPointerDown={onHandleDown('start')}
          title="Drag to set loop start"
          style={{ position: 'absolute', top: -2, bottom: -2, left: pct(start), transform: 'translateX(-50%)', width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'ew-resize', color: C.accent, fontSize: 14, fontWeight: 900 }}
        >⟮</div>
        {/* end handle */}
        <div
          onPointerDown={onHandleDown('end')}
          title="Drag to set loop end"
          style={{ position: 'absolute', top: -2, bottom: -2, left: pct(end), transform: 'translateX(-50%)', width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'ew-resize', color: C.accent, fontSize: 14, fontWeight: 900 }}
        >⟯</div>
      </div>

      {/* Readouts */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.textMid, fontWeight: 700 }}>
        <span>In: <span style={{ color: C.accent }}>{mmss(start)}</span></span>
        <span>Out: <span style={{ color: C.accent }}>{mmss(end)}</span></span>
        <span style={{ color: C.textDim }}>Loop length: {segLen.toFixed(1)}s</span>
        <span style={{ marginLeft: 'auto', color: C.textDim }}>Playhead: {mmss(current)}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setStart(Math.min(current, end - 0.2))} disabled={!ready} style={btn(C.surface2, C.border, C.textMid)}>⟮ Set In to playhead</button>
        <button onClick={() => setEnd(Math.max(current, start + 0.2))} disabled={!ready} style={btn(C.surface2, C.border, C.textMid)}>Set Out to playhead ⟯</button>
        <button onClick={toggleLoop} disabled={!ready} style={btn(looping ? C.greenDim : C.accentDim, looping ? C.greenBorder : C.accentBorder, looping ? C.green : C.accent)}>
          {looping ? '⏸ Stop preview' : '▶ Preview loop'}
        </button>
        <button onClick={() => onSave(start, end)} disabled={!ready || !!saving || segLen < 0.2} style={btn(C.green, C.greenBorder, '#0d1117')}>
          {saving ? 'Saving…' : '💾 Save loop'}
        </button>
        {hasSavedLoop && (
          <button onClick={onClear} disabled={!!saving} style={btn('transparent', 'rgba(239,68,68,0.3)', C.red)}>Clear loop</button>
        )}
      </div>
    </div>
  )
}
