'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

// Admin "Library Builder" — preload the exercise library across every sport +
// training focus. Generate one category at a time, or "Fill Every Category" to
// loop the whole list hands-free. Each run generates real exercises WITH
// instructions, dedups against the library, and queues the new ones for the
// Video Curator (TTS picks them up automatically). Backed by /api/admin/seed-library.

const SPORTS = [
  'Skateboarding', 'Snowboarding', 'Skiing', 'Surfing', 'BMX', 'Motocross', 'Parkour',
  'Basketball', 'Soccer', 'Football', 'Baseball', 'Hockey', 'Volleyball', 'Rugby',
  'Lacrosse', 'Cricket', 'Handball', 'Water Polo', 'Ultimate Frisbee',
  'Tennis', 'Pickleball', 'Badminton', 'Table Tennis', 'Squash', 'Golf', 'Fencing',
  'Boxing', 'MMA', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'Wrestling', 'Judo', 'Karate',
  'Rock Climbing', 'Bouldering', 'Gymnastics', 'Cheerleading', 'Dance', 'Figure Skating',
  'Running', 'Sprinting', 'Marathon', 'Track & Field', 'Cycling', 'Mountain Biking',
  'Swimming', 'Rowing', 'Triathlon', 'CrossFit', 'Olympic Weightlifting', 'Powerlifting', 'Strongman',
]

const FOCUS = [
  'Full-Body Strength', 'Chest Hypertrophy', 'Back Hypertrophy', 'Shoulder Hypertrophy',
  'Arm Hypertrophy', 'Leg Hypertrophy', 'Glute Development', 'Core & Abs',
  'Mobility & Flexibility', 'Prehab & Rehab', 'Conditioning & HIIT', 'Calisthenics',
  'Plyometrics & Power', 'Balance & Stability', 'Warm-Up Drills', 'Grip & Forearms',
  'Neck & Traps', 'Posture & Postural Health',
]

const ALL_CATEGORIES = [...SPORTS, ...FOCUS]

const K = {
  card: '#161b22', input: '#0d1117', border: '#30363d', accent: '#3b82f6',
  green: '#22c55e', amber: '#f59e0b', text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Model = 'haiku' | 'sonnet' | 'opus'
type Counts = { total: number; needVideo: number; needTts: number }
type RunResult = { category: string; added: number; skipped: number; queued: number; generated: number }

export default function LibrarySeedTab() {
  const [category, setCategory] = useState('')
  const [count, setCount] = useState(20)
  const [model, setModel] = useState<Model>('haiku')
  const [busy, setBusy] = useState(false)
  const [filling, setFilling] = useState(false)
  const [fillProg, setFillProg] = useState<{ done: number; total: number; added: number } | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [log, setLog] = useState<RunResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
  }, [])

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/seed-library', { headers: await authHeaders() })
      if (res.ok) setCounts(await res.json())
    } catch { /* ignore */ }
  }, [authHeaders])

  useEffect(() => { loadCounts() }, [loadCounts])

  const pushLog = useCallback((cat: string, data: Record<string, number>) => {
    setLog(l => [{ category: cat, added: data.added ?? 0, skipped: data.skipped ?? 0, queued: data.queued ?? 0, generated: data.generated ?? 0 }, ...l].slice(0, 40))
  }, [])

  async function generateOne(cat: string): Promise<number> {
    const res = await fetch('/api/admin/seed-library', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ category: cat, count, model }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed')
    pushLog(cat, data)
    return data.added ?? 0
  }

  async function run() {
    const cat = category.trim()
    if (busy || filling) return
    if (!cat) { setError('Pick a sport or category first.'); return }
    setBusy(true); setError(null)
    try {
      await generateOne(cat)
      loadCounts()
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  async function runAll() {
    if (busy || filling) return
    stopRef.current = false
    setFilling(true); setError(null)
    setFillProg({ done: 0, total: ALL_CATEGORIES.length, added: 0 })
    let added = 0
    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
      if (stopRef.current) break
      try { added += await generateOne(ALL_CATEGORIES[i]) } catch { /* skip, keep going */ }
      setFillProg({ done: i + 1, total: ALL_CATEGORIES.length, added })
      if ((i + 1) % 3 === 0) loadCounts()
    }
    loadCounts()
    setFilling(false)
  }

  const fmt = (n: number) => n.toLocaleString()
  const disabled = busy || filling

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: K.text, marginBottom: 4 }}>🏗️ Library Builder</h2>
      <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        Preload the exercise library across every sport so any athlete in the world can generate a plan with
        <strong style={{ color: K.text }}> zero lag</strong> — the exercises, instructions, and video queue are already there.
        Each run generates real exercises <strong style={{ color: K.text }}>with full instructions</strong>, skips anything you
        already have, and queues the new ones for the Video Curator. Haiku ≈ <strong style={{ color: K.text }}>$0.001 / exercise</strong>.
      </p>

      {/* Live pipeline counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 22, maxWidth: 720 }}>
        {[
          { label: 'Library total', value: counts?.total, color: K.accent },
          { label: 'Awaiting video', value: counts?.needVideo, color: K.amber },
          { label: 'Awaiting audio', value: counts?.needTts, color: K.green },
        ].map(s => (
          <div key={s.label} style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{counts ? fmt(s.value ?? 0) : '—'}</div>
            <div style={{ fontSize: 11, color: K.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 14, padding: 18, maxWidth: 720, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <FieldLabel>Sport or category</FieldLabel>
            <input
              list="seed-categories"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Skateboarding, Leg Hypertrophy…"
              disabled={disabled}
              style={inputStyle}
            />
            <datalist id="seed-categories">
              {ALL_CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div style={{ width: 90 }}>
            <FieldLabel>Count</FieldLabel>
            <select value={count} onChange={e => setCount(Number(e.target.value))} disabled={disabled} style={inputStyle}>
              {[10, 20, 30, 40].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ width: 180 }}>
            <FieldLabel>Model</FieldLabel>
            <select value={model} onChange={e => setModel(e.target.value as Model)} disabled={disabled} style={inputStyle}>
              <option value="haiku">Haiku · cheapest</option>
              <option value="sonnet">Sonnet · balanced</option>
              <option value="opus">Opus · top quality</option>
            </select>
          </div>
          <button
            onClick={run}
            disabled={disabled}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: K.accent, color: '#fff', fontWeight: 800, fontSize: 14, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            {busy ? 'Building…' : '✨ Generate'}
          </button>
        </div>
        {error && <p style={{ color: K.amber, fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}
      </div>

      {/* Fill everything */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: `1px solid rgba(59,130,246,0.35)`, borderRadius: 14, padding: 18, maxWidth: 720, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: K.text, marginBottom: 4 }}>🌍 Fill every category</div>
        <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.5, marginBottom: 14 }}>
          Loops through all <strong style={{ color: K.text }}>{ALL_CATEGORIES.length}</strong> sports + focuses, <strong style={{ color: K.text }}>{count}</strong> each,
          skipping anything you already have. Runs one category at a time right here — leave the tab open, and stop anytime.
        </p>
        {filling && fillProg ? (
          <div>
            <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${Math.round((fillProg.done / fillProg.total) * 100)}%`, height: '100%', background: K.accent, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: K.textMid }}>
                {fillProg.done}/{fillProg.total} categories · <strong style={{ color: K.green }}>+{fmt(fillProg.added)} added</strong>
              </span>
              <button
                onClick={() => { stopRef.current = true }}
                style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1px solid ${K.border}`, background: K.input, color: K.textMid, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Stop
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={runAll}
            disabled={disabled}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: K.accent, color: '#fff', fontWeight: 800, fontSize: 14, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.7 : 1 }}
          >
            🌍 Fill Every Category ({count} each)
          </button>
        )}
      </div>

      {/* Quick-pick chips */}
      <div style={{ maxWidth: 720, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: K.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Quick pick</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...SPORTS.slice(0, 14), ...FOCUS.slice(0, 6)].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              disabled={disabled}
              style={{
                fontSize: 12, padding: '5px 11px', borderRadius: 16, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                border: `1px solid ${category === c ? K.accent : K.border}`,
                background: category === c ? 'rgba(59,130,246,0.14)' : K.input,
                color: category === c ? K.text : K.textMid, fontWeight: 600, opacity: disabled ? 0.6 : 1,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Run log (this session) */}
      {log.length > 0 && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 11, color: K.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>This session</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {log.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: K.card, border: `1px solid ${K.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: K.text, flex: '1 1 140px' }}>{r.category}</span>
                <span style={{ color: K.green, fontWeight: 700 }}>+{r.added} added</span>
                {r.skipped > 0 && <span style={{ color: K.textDim }}>{r.skipped} dupe{r.skipped === 1 ? '' : 's'} skipped</span>}
                <span style={{ color: K.amber }}>{r.queued} queued for video</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, color: K.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{children}</label>
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, background: K.input,
  border: `1px solid ${K.border}`, color: K.text, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
}
