'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

// Admin "Library Builder" — preload the exercise library across every sport +
// training focus. Generate one category at a time, "Fill Every Category" to loop
// the whole list hands-free, or "Upgrade" to regenerate the instructions on
// already-seeded exercises with a better model. Backed by /api/admin/seed-library.

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

const SAT_KEY = 'seed_saturated_v1'

const K = {
  card: '#161b22', input: '#0d1117', border: '#30363d', accent: '#3b82f6',
  green: '#22c55e', amber: '#f59e0b', purple: '#a78bfa', text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Model = 'haiku' | 'sonnet' | 'opus'
type Counts = { total: number; needVideo: number; needTts: number; seededTotal: number }
type RunResult = { category: string; added: number; skipped: number; queued: number; generated: number; voiced: number }

export default function LibrarySeedTab() {
  const [category, setCategory] = useState('')
  const [count, setCount] = useState(20)
  const [model, setModel] = useState<Model>('sonnet')
  const [autoAudio, setAutoAudio] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filling, setFilling] = useState(false)
  const [fillProg, setFillProg] = useState<{ done: number; total: number; added: number; voiced: number; skipped: number } | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [upProg, setUpProg] = useState<{ done: number; total: number } | null>(null)
  const [voicingAll, setVoicingAll] = useState(false)
  const [voiceProg, setVoiceProg] = useState<{ done: number; total: number } | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [log, setLog] = useState<RunResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)
  const upStopRef = useRef(false)
  const voiceStopRef = useRef(false)

  // Saturation memory (token guard): once a category yields 0 new exercises at a
  // given count, we remember it and skip it on future Fill runs WITHOUT calling
  // Claude — so re-running Fill on an already-full library costs $0. We store the
  // count it saturated at, so bumping the count higher re-probes it.
  const [saturated, setSaturated] = useState<Record<string, number>>({})
  useEffect(() => {
    try { const raw = localStorage.getItem(SAT_KEY); if (raw) setSaturated(JSON.parse(raw)) } catch { /* ignore */ }
  }, [])
  const markSaturated = useCallback((cat: string, atCount: number) => {
    setSaturated(prev => {
      if ((prev[cat] ?? 0) >= atCount) return prev
      const next = { ...prev, [cat]: atCount }
      try { localStorage.setItem(SAT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  const clearSaturated = useCallback(() => {
    setSaturated({})
    try { localStorage.removeItem(SAT_KEY) } catch { /* ignore */ }
  }, [])

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
    setLog(l => [{ category: cat, added: data.added ?? 0, skipped: data.skipped ?? 0, queued: data.queued ?? 0, generated: data.generated ?? 0, voiced: data.voiced ?? 0 }, ...l].slice(0, 40))
  }, [])

  // Hand freshly-seeded exercises to the TTS route in small chunks so each
  // serverless call stays under the Vercel 60s wall. Best-effort: audio failures
  // never block the seed loop (the TTS tab can always backfill later).
  const voiceNames = useCallback(async (names: string[]): Promise<number> => {
    const CHUNK = 10
    let voiced = 0
    for (let i = 0; i < names.length; i += CHUNK) {
      const targets = names.slice(i, i + CHUNK)
      try {
        const res = await fetch('/api/admin/generate-tts', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ targets }),
        })
        if (res.ok) { const d = await res.json(); voiced += d.generated ?? 0 }
      } catch { /* keep going — audio is best-effort */ }
    }
    return voiced
  }, [authHeaders])

  // Seed one category, then (if auto-audio is on) voice the exercises it just added.
  async function generateOne(cat: string): Promise<{ added: number; voiced: number }> {
    const res = await fetch('/api/admin/seed-library', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ category: cat, count, model }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed')
    const added = data.added ?? 0
    // Nothing new at this count → remember it so Fill skips it next time (no tokens).
    if (added === 0) markSaturated(cat, count)
    const names: string[] = Array.isArray(data.insertedNames) ? data.insertedNames : []
    let voiced = 0
    if (autoAudio && names.length) voiced = await voiceNames(names)
    pushLog(cat, { ...data, voiced })
    return { added, voiced }
  }

  async function run() {
    const cat = category.trim()
    if (busy || filling || upgrading || voicingAll) return
    if (!cat) { setError('Pick a sport or category first.'); return }
    setBusy(true); setError(null)
    try {
      await generateOne(cat)
      loadCounts()
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  async function runAll() {
    if (busy || filling || upgrading || voicingAll) return
    stopRef.current = false
    setFilling(true); setError(null)
    setFillProg({ done: 0, total: ALL_CATEGORIES.length, added: 0, voiced: 0, skipped: 0 })
    let added = 0, voiced = 0, skipped = 0
    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
      if (stopRef.current) break
      const cat = ALL_CATEGORIES[i]
      // Token guard: skip categories already proven full at this count — no server call.
      if ((saturated[cat] ?? 0) >= count) {
        skipped++
      } else {
        try { const r = await generateOne(cat); added += r.added; voiced += r.voiced } catch { /* skip, keep going */ }
      }
      setFillProg({ done: i + 1, total: ALL_CATEGORIES.length, added, voiced, skipped })
      if ((i + 1) % 3 === 0) loadCounts()
    }
    loadCounts()
    setFilling(false)
  }

  async function runUpgrade() {
    if (busy || filling || upgrading || voicingAll) return
    upStopRef.current = false
    setUpgrading(true); setError(null)
    const total = counts?.seededTotal ?? 0
    setUpProg({ done: 0, total })
    let done = 0
    let afterId: string | null = null
    let guard = 0
    while (guard++ < 400) {
      if (upStopRef.current) break
      try {
        const res: Response = await fetch('/api/admin/seed-library', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ mode: 'upgrade', model, afterId }),
        })
        const data: { upgraded?: number; lastId?: string | null; done?: boolean; error?: string } = await res.json()
        if (!res.ok) { setError(data.error ?? 'Upgrade failed.'); break }
        done += data.upgraded ?? 0
        afterId = data.lastId ?? afterId
        setUpProg({ done, total })
        if (data.done || !data.lastId) break
      } catch { setError('Network error during upgrade.'); break }
    }
    loadCounts()
    setUpgrading(false)
  }

  // Voice the whole audio backlog — loops the TTS route (10 at a time, it
  // auto-picks rows missing audio) until nothing's left. Covers exercises that
  // were seeded before auto-audio, or had their audio cleared by an Upgrade.
  async function runVoiceBacklog() {
    if (busy || filling || upgrading || voicingAll) return
    voiceStopRef.current = false
    setVoicingAll(true); setError(null)
    const total = counts?.needTts ?? 0
    setVoiceProg({ done: 0, total })
    let done = 0
    let guard = 0
    while (guard++ < 600) {
      if (voiceStopRef.current) break
      try {
        const res = await fetch('/api/admin/generate-tts', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Voicing failed.'); break }
        const generated = data.generated ?? 0
        done += generated
        setVoiceProg({ done, total: Math.max(total, done) })
        if ((data.remaining ?? 0) <= 0) break
        if (generated === 0) break // no voiceable rows progressing — stop, don't spin
      } catch { setError('Network error during voicing.'); break }
      if (guard % 3 === 0) loadCounts()
    }
    loadCounts()
    setVoicingAll(false)
  }

  const fmt = (n: number) => n.toLocaleString()
  const disabled = busy || filling || upgrading || voicingAll
  const modelLabel = model === 'haiku' ? 'Haiku' : model === 'opus' ? 'Opus' : 'Sonnet'

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: K.text, marginBottom: 4 }}>🏗️ Library Builder</h2>
      <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.55, marginBottom: 20, maxWidth: 720 }}>
        Preload the exercise library across every sport so any athlete in the world can generate a plan with
        <strong style={{ color: K.text }}> zero lag</strong> — the exercises, instructions, and video queue are already there.
        Each run generates real exercises <strong style={{ color: K.text }}>with full instructions</strong>, skips anything you
        already have, and queues the new ones for the Video Curator.
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
              <option value="sonnet">Sonnet · best value</option>
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
        {/* Auto-audio: hand every newly-seeded exercise straight to TTS (OpenAI) — one button, both steps. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: disabled ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={autoAudio} onChange={e => setAutoAudio(e.target.checked)} disabled={disabled} style={{ width: 16, height: 16, accentColor: K.green, cursor: disabled ? 'default' : 'pointer' }} />
          <span style={{ fontSize: 13, color: K.text, fontWeight: 700 }}>🔊 Auto-generate audio</span>
          <span style={{ fontSize: 12, color: K.textDim }}>Voice each new exercise (male + female) as it&apos;s added — no separate TTS run.</span>
        </label>
        {error && <p style={{ color: K.amber, fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}
      </div>

      {/* Fill everything */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: `1px solid rgba(59,130,246,0.35)`, borderRadius: 14, padding: 18, maxWidth: 720, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: K.text, marginBottom: 4 }}>🌍 Fill every category</div>
        <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.5, marginBottom: 14 }}>
          Loops through all <strong style={{ color: K.text }}>{ALL_CATEGORIES.length}</strong> sports + focuses, <strong style={{ color: K.text }}>{count}</strong> each on <strong style={{ color: K.text }}>{modelLabel}</strong>,
          skipping anything you already have{autoAudio ? <> and <strong style={{ color: K.text }}>voicing each new one</strong></> : ''}. Categories that already came up empty are
          skipped <strong style={{ color: K.text }}>with no token cost</strong> — so re-running is safe. Runs one at a time right here; leave the tab open, and stop anytime.
        </p>
        {filling && fillProg ? (
          <ProgressRow
            pct={Math.round((fillProg.done / fillProg.total) * 100)}
            label={`${fillProg.done}/${fillProg.total}${fillProg.skipped ? ` · ${fmt(fillProg.skipped)} skipped free` : ''} · `}
            strong={`+${fmt(fillProg.added)} added${autoAudio ? ` · 🔊 ${fmt(fillProg.voiced)} voiced` : ''}`}
            onStop={() => { stopRef.current = true }}
          />
        ) : (
          <button onClick={runAll} disabled={disabled} style={primaryBtn(disabled)}>
            🌍 Fill Every Category ({count} each)
          </button>
        )}
        {Object.keys(saturated).length > 0 && !filling && (
          <p style={{ fontSize: 12, color: K.textDim, marginTop: 12, marginBottom: 0 }}>
            {fmt(Object.keys(saturated).length)} categor{Object.keys(saturated).length === 1 ? 'y' : 'ies'} remembered as full (skipped free).{' '}
            <button onClick={clearSaturated} disabled={disabled} style={{ background: 'none', border: 'none', color: K.accent, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
              Reset & re-check all
            </button>
          </p>
        )}
      </div>

      {/* Upgrade existing */}
      <div style={{ background: 'rgba(167,139,250,0.06)', border: `1px solid rgba(167,139,250,0.35)`, borderRadius: 14, padding: 18, maxWidth: 720, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: K.text, marginBottom: 4 }}>⬆️ Upgrade seeded instructions</div>
        <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.5, marginBottom: 14 }}>
          Regenerates the how / breathing / core / tip on all{' '}
          <strong style={{ color: K.text }}>{counts ? fmt(counts.seededTotal) : '…'}</strong> exercises you seeded with{' '}
          <strong style={{ color: K.text }}>{modelLabel}</strong>, overwriting older cues and re-syncing audio (it clears TTS so
          it regenerates from the improved text). Use this to bring an earlier Haiku batch up to Sonnet quality.
        </p>
        {upgrading && upProg ? (
          <ProgressRow
            pct={upProg.total ? Math.round((upProg.done / upProg.total) * 100) : 0}
            label={`Upgrading… `}
            strong={`${fmt(upProg.done)}${upProg.total ? ` / ${fmt(upProg.total)}` : ''}`}
            onStop={() => { upStopRef.current = true }}
          />
        ) : (
          <button
            onClick={runUpgrade}
            disabled={disabled || !counts?.seededTotal}
            style={{ ...primaryBtn(disabled || !counts?.seededTotal), background: K.purple }}
          >
            ⬆️ Upgrade All Seeded to {modelLabel}
          </button>
        )}
      </div>

      {/* Voice the backlog */}
      <div style={{ background: 'rgba(34,197,94,0.06)', border: `1px solid rgba(34,197,94,0.35)`, borderRadius: 14, padding: 18, maxWidth: 720, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: K.text, marginBottom: 4 }}>🔊 Voice the backlog</div>
        <p style={{ fontSize: 13, color: K.textMid, lineHeight: 1.5, marginBottom: 14 }}>
          Generates male + female audio for all{' '}
          <strong style={{ color: K.text }}>{counts ? fmt(counts.needTts) : '…'}</strong> exercises that have instructions but no audio yet
          (OpenAI TTS). Auto-audio only voices brand-new exercises — use this for the existing library, or after an Upgrade clears audio.
          Runs 10 at a time until done; leave the tab open, stop anytime. One-time cost, tracked in the Spend Tracker.
        </p>
        {voicingAll && voiceProg ? (
          <ProgressRow
            pct={voiceProg.total ? Math.round((voiceProg.done / voiceProg.total) * 100) : 0}
            label={`Voicing… `}
            strong={`${fmt(voiceProg.done)}${voiceProg.total ? ` / ${fmt(voiceProg.total)}` : ''}`}
            onStop={() => { voiceStopRef.current = true }}
          />
        ) : (
          <button
            onClick={runVoiceBacklog}
            disabled={disabled || !counts?.needTts}
            style={{ ...primaryBtn(disabled || !counts?.needTts), background: K.green }}
          >
            🔊 Voice All Missing Audio{counts?.needTts ? ` (${fmt(counts.needTts)})` : ''}
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
                {r.voiced > 0 && <span style={{ color: K.purple }}>🔊 {r.voiced} voiced</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressRow({ pct, label, strong, onStop }: { pct: number; label: string; strong: string; onStop: () => void }) {
  return (
    <div>
      <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: K.accent, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: K.textMid }}>{label}<strong style={{ color: K.green }}>{strong}</strong></span>
        <button
          onClick={onStop}
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1px solid ${K.border}`, background: K.input, color: K.textMid, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Stop
        </button>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, color: K.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{children}</label>
}

function primaryBtn(disabled: boolean): CSSProperties {
  return { padding: '11px 22px', borderRadius: 10, border: 'none', background: K.accent, color: '#fff', fontWeight: 800, fontSize: 14, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.7 : 1 }
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, background: K.input,
  border: `1px solid ${K.border}`, color: K.text, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
}
