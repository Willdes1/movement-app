'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)', greenBorder: 'rgba(34,197,94,0.25)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)', amberBorder: 'rgba(245,158,11,0.25)',
  red: '#ef4444',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type LibRow = {
  name_normalized: string
  name_display: string
  how: string | null
  tts_url_male: string | null
  tts_url_female: string | null
}

export default function TTSCurationTab() {
  const [view, setView] = useState<'generate' | 'library'>('generate')

  // ── Generate tab state ─────────────────────────────────────────────────────
  const [total, setTotal]         = useState(0)
  const [withTTS, setWithTTS]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]       = useState<string | null>(null)

  // ── Library tab state ──────────────────────────────────────────────────────
  const [libRows, setLibRows]         = useState<LibRow[]>([])
  const [libLoading, setLibLoading]   = useState(false)
  const [libLoaded, setLibLoaded]     = useState(false)
  const [libSearch, setLibSearch]     = useState('')
  const [libFilter, setLibFilter]     = useState<'all' | 'generated' | 'missing'>('generated')
  const [playingId, setPlayingId]     = useState<string | null>(null)
  const [generatingRows, setGeneratingRows] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function loadStats() {
    setLoading(true)
    const [totalRes, withRes] = await Promise.all([
      supabase.from('exercise_library').select('id', { count: 'exact', head: true }),
      supabase.from('exercise_library').select('id', { count: 'exact', head: true }).not('tts_url_male', 'is', null),
    ])
    setTotal(totalRes.count ?? 0)
    setWithTTS(withRes.count ?? 0)
    setLoading(false)
  }

  async function loadLibrary() {
    setLibLoading(true)
    const { data } = await supabase
      .from('exercise_library')
      .select('name_normalized, name_display, how, tts_url_male, tts_url_female')
      .order('name_display')
    setLibRows(data ?? [])
    setLibLoaded(true)
    setLibLoading(false)
  }

  async function generateRow(name_normalized: string) {
    setGeneratingRows(prev => new Set(prev).add(name_normalized))
    try {
      await fetch('/api/admin/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: [name_normalized] }),
      })
      // Re-fetch just this row so Play buttons appear immediately
      const { data } = await supabase
        .from('exercise_library')
        .select('name_normalized, name_display, how, tts_url_male, tts_url_female')
        .eq('name_normalized', name_normalized)
        .single()
      if (data) {
        setLibRows(prev => prev.map(r => r.name_normalized === name_normalized ? data as LibRow : r))
      }
    } finally {
      setGeneratingRows(prev => { const s = new Set(prev); s.delete(name_normalized); return s })
    }
  }

  useEffect(() => { loadStats() }, [])

  useEffect(() => {
    if (view === 'library' && !libLoaded) loadLibrary()
  }, [view, libLoaded])  // eslint-disable-line react-hooks/exhaustive-deps

  function playAudio(url: string, id: string) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playingId === id) { setPlayingId(null); return }
    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingId(id)
    audio.play()
    audio.onended = () => setPlayingId(null)
  }

  async function runGeneration() {
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/generate-tts', { method: 'POST' })
      if (!res.ok) { setResult(`Error ${res.status}: ${res.statusText}`); return }
      const data = await res.json()
      setResult(data.message ?? data.error ?? 'Done')
      await loadStats()
      setLibLoaded(false) // force library refresh
    } catch (e) {
      setResult(String(e))
    } finally {
      setGenerating(false)
    }
  }

  const pct      = total > 0 ? Math.round((withTTS / total) * 100) : 0
  const remaining = total - withTTS
  const r = 42
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  // Library derived
  const libFiltered = libRows.filter(row => {
    const q = libSearch.toLowerCase()
    const matchSearch = !q || row.name_display.toLowerCase().includes(q)
    if (!matchSearch) return false
    if (libFilter === 'generated') return !!(row.tts_url_male || row.tts_url_female)
    if (libFilter === 'missing')   return !row.tts_url_male || !row.tts_url_female
    return true
  })
  const libGenerated = libRows.filter(r => r.tts_url_male).length
  const libBothDone  = libRows.filter(r => r.tts_url_male && r.tts_url_female).length

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>TTS Audio Library</h2>
        <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>
          Pre-generates OpenAI TTS audio (onyx male + nova female) for every exercise. Once generated,
          audio serves from CDN with zero lag.
        </p>
      </div>

      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
        {([['generate', '🎙 Generate'], ['library', '📚 Library']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding: '7px 16px', borderRadius: 8,
            border: `1px solid ${view === id ? C.accentBorder : C.border}`,
            background: view === id ? C.accentDim : 'transparent',
            color: view === id ? C.accent : C.textDim,
            fontSize: 13, fontWeight: view === id ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      {/* ── GENERATE TAB ──────────────────────────────────────────────────────── */}
      {view === 'generate' && (
        <>
          {/* Progress panel */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
              <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={50} cy={50} r={r} fill="none" stroke={C.surface2} strokeWidth={8} />
                <circle cx={50} cy={50} r={r} fill="none" stroke={C.accent} strokeWidth={8}
                  strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{loading ? '…' : `${pct}%`}</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>TTS Coverage</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, marginBottom: 4 }}>
                {loading ? '…' : withTTS}
                <span style={{ fontSize: 13, color: C.textDim, fontWeight: 600, marginLeft: 6 }}>of {total} exercises</span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim }}>
                {loading ? '' : `${remaining} remaining · ~${Math.ceil(remaining / 25)} runs at 25/batch`}
              </div>
            </div>

            <button
              onClick={runGeneration}
              disabled={generating || remaining === 0}
              style={{
                padding: '12px 20px', borderRadius: 10, border: 'none', fontFamily: 'inherit',
                background: generating || remaining === 0 ? C.surface2 : C.accent,
                color: generating || remaining === 0 ? C.textDim : '#fff',
                fontWeight: 700, fontSize: 13, cursor: generating || remaining === 0 ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.7 : 1, flexShrink: 0,
              }}
            >
              {generating ? 'Generating…' : remaining === 0 ? '✓ All Done' : '🎙 Generate 25'}
            </button>
          </div>

          {result && (
            <div style={{ padding: '12px 14px', background: result.startsWith('Error') ? 'rgba(239,68,68,0.08)' : C.greenDim, border: `1px solid ${result.startsWith('Error') ? 'rgba(239,68,68,0.25)' : C.greenBorder}`, borderRadius: 10, fontSize: 12, color: result.startsWith('Error') ? C.red : C.green, marginBottom: 20, lineHeight: 1.6 }}>
              {result}
            </div>
          )}

          {/* How it works */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>How It Works</div>
            {[
              { icon: '🎙', title: 'Pre-generate (admin)', desc: 'Click "Generate 25" daily to batch-process exercises. Each run generates both male (onyx) and female (nova) voices and uploads to Supabase Storage.' },
              { icon: '⚡', title: 'Instant playback', desc: 'When an exercise has a pre-generated URL, tapping the speaker plays instantly from CDN — zero API call, zero lag.' },
              { icon: '🔄', title: 'Auto-backfill by users', desc: 'If a user taps the speaker on an exercise not yet generated, the real-time API generates it, saves it to storage, and updates the library. The next listener gets it instantly.' },
              { icon: '💰', title: 'One-time cost', desc: 'Each exercise is generated once. Total cost for the full 752-exercise library: ~$7 for both voices. Storage: ~100MB, well within Supabase free tier.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── LIBRARY TAB ───────────────────────────────────────────────────────── */}
      {view === 'library' && (
        <>
          {/* Stats strip */}
          {!libLoading && libLoaded && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Total Exercises', value: libRows.length,   color: C.text },
                { label: 'Male Generated',  value: libGenerated,     color: C.accent },
                { label: 'Both Voices',     value: libBothDone,      color: C.green },
                { label: 'Still Missing',   value: libRows.length - libGenerated, color: libRows.length - libGenerated > 0 ? C.amber : C.green },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={libSearch}
              onChange={e => setLibSearch(e.target.value)}
              placeholder='Search exercises…'
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 7, border: `1px solid ${libSearch ? C.accentBorder : C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
            {([['all', 'All'], ['generated', 'Generated'], ['missing', 'Missing']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setLibFilter(id)} style={{
                padding: '7px 14px', borderRadius: 7, fontFamily: 'inherit',
                border: `1px solid ${libFilter === id ? C.accentBorder : C.border}`,
                background: libFilter === id ? C.accentDim : 'transparent',
                color: libFilter === id ? C.accent : C.textDim,
                fontSize: 12, fontWeight: libFilter === id ? 700 : 400, cursor: 'pointer',
              }}>{label}</button>
            ))}
            <button onClick={() => { setLibLoaded(false); loadLibrary() }} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}>↺</button>
          </div>

          {libLoading ? (
            <p style={{ fontSize: 13, color: C.textDim, padding: '40px 0', textAlign: 'center' }}>Loading library…</p>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', background: C.surface2, padding: '8px 16px', borderBottom: `1px solid ${C.border}` }}>
                {['EXERCISE', 'MALE (ONYX)', 'FEMALE (NOVA)'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>

              <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                {libFiltered.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textDim, padding: '32px 16px', textAlign: 'center' }}>No exercises match this filter.</p>
                ) : libFiltered.map(row => (
                  <div
                    key={row.name_normalized}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center', background: 'transparent' }}
                  >
                    {/* Name */}
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{row.name_display}</p>
                      <p style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{row.name_normalized}</p>
                    </div>

                    {/* Male voice */}
                    <div>
                      {row.tts_url_male ? (
                        <button
                          onClick={() => playAudio(row.tts_url_male!, `male-${row.name_normalized}`)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 6, border: `1px solid ${playingId === `male-${row.name_normalized}` ? C.accentBorder : C.greenBorder}`,
                            background: playingId === `male-${row.name_normalized}` ? C.accentDim : C.greenDim,
                            color: playingId === `male-${row.name_normalized}` ? C.accent : C.green,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {playingId === `male-${row.name_normalized}` ? '⏸ Playing' : '▶ Play'}
                        </button>
                      ) : generatingRows.has(row.name_normalized) ? (
                        <span style={{ fontSize: 11, color: C.textDim, padding: '4px 8px', borderRadius: 6, background: C.surface2, border: `1px solid ${C.border}` }}>Generating…</span>
                      ) : row.how ? (
                        <button
                          onClick={() => generateRow(row.name_normalized)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.amberBorder}`,
                            background: C.amberDim, color: C.amber,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >🎙 Generate</button>
                      ) : (
                        <span style={{ fontSize: 11, color: C.textDim, padding: '4px 8px', borderRadius: 6, background: C.surface2, border: `1px solid ${C.border}` }}>No cues</span>
                      )}
                    </div>

                    {/* Female voice */}
                    <div>
                      {row.tts_url_female ? (
                        <button
                          onClick={() => playAudio(row.tts_url_female!, `female-${row.name_normalized}`)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 6, border: `1px solid ${playingId === `female-${row.name_normalized}` ? C.accentBorder : C.greenBorder}`,
                            background: playingId === `female-${row.name_normalized}` ? C.accentDim : C.greenDim,
                            color: playingId === `female-${row.name_normalized}` ? C.accent : C.green,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {playingId === `female-${row.name_normalized}` ? '⏸ Playing' : '▶ Play'}
                        </button>
                      ) : generatingRows.has(row.name_normalized) ? (
                        <span style={{ fontSize: 11, color: C.textDim, padding: '4px 8px', borderRadius: 6, background: C.surface2, border: `1px solid ${C.border}` }}>Generating…</span>
                      ) : row.tts_url_male ? (
                        <button
                          onClick={() => generateRow(row.name_normalized)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.amberBorder}`,
                            background: C.amberDim, color: C.amber,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >🎙 Generate</button>
                      ) : (
                        <span style={{ fontSize: 11, color: C.textDim, padding: '4px 8px', borderRadius: 6, background: C.surface2, border: `1px solid ${C.border}` }}>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
