'use client'
import { useEffect, useRef, useState } from 'react'
import { loadYouTubeAPI, extractYouTubeId, type YTPlayer } from '@/lib/youtube-iframe'

/**
 * User-facing exercise video. When the admin has defined a loop window
 * (loop_start_sec/loop_end_sec) it shows a muted, auto-looping "movement preview"
 * (GIF-like, but the real approved video) with a one-tap toggle to the full video.
 * Falls back to the standard full player when no loop is defined.
 *
 * Resilience baked in for Phase 3 reuse on the workout grid:
 *  - IntersectionObserver pauses off-screen previews, resumes on-screen
 *  - visibilitychange resumes playback when the tab/app returns to the foreground
 * exercise_library is YouTube-only today; the native <video> branch is for future
 * self-hosted uploads.
 */

// ── Auto-looping muted YouTube preview of [loopStart, loopEnd] ────────────────
function YouTubeLoopPlayer({ videoId, loopStart, loopEnd }: { videoId: string; loopStart: number; loopEnd: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const pollRef = useRef<number | null>(null)
  const visibleRef = useRef(true)
  const startRef = useRef(loopStart); startRef.current = loopStart
  const endRef = useRef(loopEnd); endRef.current = loopEnd
  const [ready, setReady] = useState(false)

  // Create / destroy the player.
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
        playerVars: {
          controls: 0, modestbranding: 1, rel: 0, playsinline: 1, fs: 0,
          disablekb: 1, mute: 1, autoplay: 1, start: Math.floor(loopStart),
        },
        events: {
          onReady: (e) => {
            e.target.mute()
            e.target.seekTo(startRef.current, true)
            e.target.playVideo()
            setReady(true)
          },
          onStateChange: (e) => {
            if (e.data === window.YT?.PlayerState.ENDED) {
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
      try { playerRef.current?.destroy() } catch { /* already gone */ }
      playerRef.current = null
    }
  }, [videoId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Enforce the loop window (only while on-screen).
  useEffect(() => {
    if (!ready) return
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current
      if (!p || !visibleRef.current) return
      const t = p.getCurrentTime()
      if (t >= endRef.current - 0.08 || t < startRef.current - 0.5) p.seekTo(startRef.current, true)
    }, 150)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [ready])

  // Pause off-screen, resume on-screen.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !ready) return
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0]
      visibleRef.current = entry.isIntersecting
      const p = playerRef.current
      if (!p) return
      if (entry.isIntersecting) { p.seekTo(startRef.current, true); p.playVideo() }
      else p.pauseVideo()
    }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [ready])

  // Resume when the tab/app returns to the foreground.
  useEffect(() => {
    function onVis() {
      const p = playerRef.current
      if (p && document.visibilityState === 'visible' && visibleRef.current) p.playVideo()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>Loading…</div>
      )}
    </div>
  )
}

export default function LoopPreview({
  url, source, name, loopStart, loopEnd, clipStart, clipEnd,
}: {
  url: string | null
  source: string | null
  name: string
  loopStart?: number | null
  loopEnd?: number | null
  clipStart?: number | null
  clipEnd?: number | null
}) {
  const [muted, setMuted] = useState(true)
  const [showFull, setShowFull] = useState(false)

  const isYouTube = !!url && (source === 'youtube' || source === 'custom')
  const videoId = url && isYouTube ? extractYouTubeId(url) : null
  const isShort = !!url && url.includes('/shorts/')
  const hasLoop = loopStart != null && loopEnd != null && loopEnd > loopStart && !!videoId && !isShort

  // No usable video → existing "coming soon" placeholder.
  if (!isYouTube || !videoId) {
    return (
      <div style={{ marginBottom: 14, padding: '14px 16px', background: 'rgba(59,130,246,0.05)', border: '1px dashed rgba(59,130,246,0.2)', borderRadius: 10, textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }}>🎬 Video Coming Soon</p>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>Your coach is reviewing the best demonstration for this exercise.</p>
      </div>
    )
  }

  // Standard full-video embed (clip range applied, audio toggle for shorts).
  let fullSrc = isShort
    ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&loop=1&playlist=${videoId}&playsinline=1&mute=${muted ? 1 : 0}&controls=1`
    : `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`
  if (!isShort) {
    if (clipStart != null && clipStart > 0) fullSrc += `&start=${clipStart}`
    if (clipEnd != null) fullSrc += `&end=${clipEnd}`
  }

  const showLoop = hasLoop && !showFull

  return (
    <div className="video-sticky" style={{ marginBottom: 14, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
      <div style={{ position: 'relative', paddingBottom: isShort ? '177.78%' : '56.25%', height: 0 }}>
        {showLoop ? (
          <YouTubeLoopPlayer videoId={videoId} loopStart={loopStart!} loopEnd={loopEnd!} />
        ) : (
          <iframe
            key={`${videoId}-${muted}`}
            src={fullSrc}
            title={name}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--surface2)' }}>
        <p style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
          {showLoop ? '🔁 Movement Preview · Coach Approved' : 'Video · Coach Approved'}
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!showLoop && isShort && (
            <button onClick={() => setMuted(m => !m)} style={{ fontSize: 11, color: muted ? 'var(--text-dim)' : '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
              {muted ? '🔇 Muted Loop' : '🔊 Audio On'}
            </button>
          )}
          {hasLoop && (
            <button onClick={() => setShowFull(f => !f)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0, whiteSpace: 'nowrap' }}>
              {showFull ? '↩ Back to preview' : '▶ Watch full video'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
