'use client'
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

// Admin "Library Builder" — preload the exercise library across every sport +
// training focus. One click generates real exercises WITH instructions, dedups
// against the library, and queues the new ones for the Video Curator (TTS picks
// them up automatically). Backed by /api/admin/seed-library.

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

const K = {
  card: '#161b22', input: '#0d1117', border: '#30363d', accent: '#3b82f6',
  green: '#22c55e', amber: '#f59e0b', text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Counts = { total: number; needVideo: number; needTts: number }
type RunResult = { category: string; added: number; skipped: number; queued: number; generated: number }

export default function LibrarySeedTab() {
  const [category, setCategory] = useState('')
  const [count, setCount] = useState(20)
  const [model, setModel] = useState<'haiku' | 'sonnet'>('haiku')
  const [busy, setBusy] = useState(false)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [log, setLog] = useState<RunResult[]>([])
  const [error, setError] = useState<string | null>(null)

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

  async function run() {
    const cat = category.trim()
    if (busy) return
    if (!cat) { setError('Pick a sport or category first.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/admin/seed-library', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ category: cat, count, model }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.') }
      else {
        setLog(l => [{ category: cat, added: data.added ?? 0, skipped: data.skipped ?? 0, queued: data.queued ?? 0, generated: data.generated ?? 0 }, ...l].slice(0, 15))
        loadCounts()
      }
    } catch { setError('Network error — try again.') }
    finally { setBusy(false) }
  }

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: K.text, marginBottom: 4 }}>🏗️ Library Builder</h2>
      <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.55, marginBottom: 20, maxWidth: 700 }}>
        Preload the exercise library across every sport. Each run generates real exercises{' '}
        <strong style={{ color: K.text }}>with full instructions</strong>, skips anything you already have,
        and queues the new ones for the Video Curator — TTS picks them up automatically. Cheap by design:
        Haiku ≈ <strong style={{ color: K.text }}>$0.001 / exercise</strong>. Run as many categories as you like.
      </p>

      {/* Live pipeline counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 22, maxWidth: 700 }}>
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
      <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 14, padding: 18, maxWidth: 700, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <FieldLabel>Sport or category</FieldLabel>
            <input
              list="seed-categories"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Skateboarding, Leg Hypertrophy…"
              style={inputStyle}
            />
            <datalist id="seed-categories">
              {[...SPORTS, ...FOCUS].map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div style={{ width: 100 }}>
            <FieldLabel>Count</FieldLabel>
            <select value={count} onChange={e => setCount(Number(e.target.value))} style={inputStyle}>
              {[10, 20, 30, 40].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ width: 170 }}>
            <FieldLabel>Model</FieldLabel>
            <select value={model} onChange={e => setModel(e.target.value as 'haiku' | 'sonnet')} style={inputStyle}>
              <option value="haiku">Haiku · cheapest</option>
              <option value="sonnet">Sonnet · higher quality</option>
            </select>
          </div>
          <button
            onClick={run}
            disabled={busy}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: K.accent, color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.8 : 1, whiteSpace: 'nowrap' }}
          >
            {busy ? 'Building…' : '✨ Generate'}
          </button>
        </div>
        {error && <p style={{ color: K.amber, fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}
      </div>

      {/* Quick-pick chips */}
      <div style={{ maxWidth: 700, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: K.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Quick pick</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...SPORTS.slice(0, 14), ...FOCUS.slice(0, 6)].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                fontSize: 12, padding: '5px 11px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${category === c ? K.accent : K.border}`,
                background: category === c ? 'rgba(59,130,246,0.14)' : K.input,
                color: category === c ? K.text : K.textMid, fontWeight: 600,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Run log (this session) */}
      {log.length > 0 && (
        <div style={{ maxWidth: 700 }}>
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
