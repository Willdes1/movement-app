'use client'
import { useTTS, useTTSProgress, TTS_SPEEDS } from '@/contexts/TTSContext'

// Playback controls for whatever the narrator is reading, anywhere in the app.
//
// The speaker buttons on /today and the coached card are play-only, so before
// this there was no way to pause a clip or change speed without opening an
// exercise modal. One element plays at a time, so one bar can drive all of it.

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TTSMiniPlayer() {
  const {
    activeKey, activeLabel, speaking, paused, loading,
    sectionIndex, queueLength, pause, resume, stop, seek,
    speed, setSpeed, gender, toggleGender,
  } = useTTS()
  const { progress, elapsed, duration } = useTTSProgress()

  if (!activeKey) return null

  const cycleSpeed = () => {
    const i = TTS_SPEEDS.indexOf(speed as typeof TTS_SPEEDS[number])
    setSpeed(TTS_SPEEDS[(i + 1) % TTS_SPEEDS.length])
  }

  const btn: React.CSSProperties = {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
    flexShrink: 0, lineHeight: 1,
  }

  return (
    <div className="tts-mini-player" role="region" aria-label="Audio playback">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={paused ? resume : pause}
          disabled={loading}
          aria-label={paused ? 'Resume' : 'Pause'}
          title={paused ? 'Resume' : 'Pause'}
          style={{ ...btn, padding: '7px 11px', fontSize: 14, opacity: loading ? 0.5 : 1, cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? '⏳' : paused ? '▶' : '⏸'}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeLabel ?? 'Reading aloud'}
            </span>
            {queueLength > 1 && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, flexShrink: 0 }}>
                {sectionIndex + 1} of {queueLength}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(elapsed)} / {fmt(duration)}
            </span>
          </div>

          <div
            onClick={e => {
              const box = e.currentTarget.getBoundingClientRect()
              seek((e.clientX - box.left) / box.width)
            }}
            style={{ marginTop: 6, height: 12, display: 'flex', alignItems: 'center', cursor: duration ? 'pointer' : 'default' }}
          >
            <div style={{ height: 4, width: '100%', background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(progress * 100)}%`,
                background: 'var(--accent)',
                borderRadius: 2,
                transition: speaking ? 'width 0.2s linear' : 'none',
              }} />
            </div>
          </div>
        </div>

        <button onClick={cycleSpeed} title="Playback speed" style={{ ...btn, padding: '6px 8px', fontSize: 11 }}>
          {speed}×
        </button>
        <button onClick={toggleGender} title={`Voice: ${gender}. Tap to switch.`} style={{ ...btn, padding: '6px 9px', fontSize: 12 }}>
          {gender === 'male' ? '♂' : '♀'}
        </button>
        <button onClick={stop} aria-label="Stop" title="Stop" style={{ ...btn, padding: '6px 9px', fontSize: 13 }}>
          ✕
        </button>
      </div>
    </div>
  )
}
