'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Coach starter library: what is ready and what is missing.
 *
 * READ ONLY. Scans the standard exercise list against the real library and
 * reports coverage. Seeds nothing to any coach and generates nothing.
 *
 * Self-hiding by design, per Will: once every standard movement has
 * instructions and audio there is nothing left to decide, so this collapses to
 * a single done line and stops competing for attention on the tab.
 */

const C = {
  surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type NearMatch = { libraryName: string; score: number; hasInstructions: boolean; hasTts: boolean; hasVideo: boolean }

type Ex = {
  name: string
  inLibrary: boolean
  nearMatch: NearMatch | null
  libraryName: string | null
  hasInstructions: boolean
  hasFullInstructions: boolean
  hasTts: boolean
  hasVideo: boolean
}

type Scan = {
  total: number
  in_library: number
  missing_entirely: number
  with_instructions: number
  with_full_instructions: number
  with_tts: number
  with_video: number
  probably_renames: number
  rename_candidates: { ours: string; library: string; score: number }[]
  needs_creating: string[]
  needs_instructions: string[]
  needs_tts: string[]
  groups: { key: string; label: string; exercises: Ex[] }[]
  workouts: { key: string; name: string; purpose: string; exercises: string[]; ready: boolean; missing: string[] }[]
  error?: string
}

export default function StarterLibraryPanel() {
  const [scan, setScan] = useState<Scan | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/starter-library', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const d = await res.json() as Scan
      if (d.error) { setError(d.error); setScan(null) } else setScan(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'scan failed')
    }
    setLoading(false)
  }

  const complete = scan
    && scan.needs_creating.length === 0
    && scan.needs_instructions.length === 0
    && scan.needs_tts.length === 0

  // Nothing left to do, so shrink out of the way instead of taking up the tab.
  if (complete && !expanded) {
    return (
      <div style={{ background: 'rgba(34,197,94,0.07)', border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: C.green, fontWeight: 800, fontSize: 13 }}>✓ Coach starter library ready</span>
        <span style={{ color: C.textDim, fontSize: 12 }}>
          all {scan.total} standard movements have instructions and audio
        </span>
        <button onClick={() => setExpanded(true)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>show</button>
      </div>
    )
  }

  const pct = scan ? Math.round((scan.with_tts / Math.max(scan.total, 1)) * 100) : 0

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
            🏋️ Coach starter library
          </p>
          <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            The standard movements every new coach should find already waiting in their library.
            This checks them against the real library and shows which already have written
            instructions and narration audio, so seeding a coach costs nothing. Read only:
            it scans, it does not seed or generate.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontWeight: 800, fontSize: 13, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
        >
          {loading ? 'Scanning…' : scan ? 'Rescan' : 'Scan coverage'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: C.red, background: 'rgba(239,68,68,0.08)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 12px' }}>{error}</p>
      )}

      {scan && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { n: scan.total, l: 'standard movements', c: C.textMid },
              { n: scan.in_library, l: 'already in library', c: C.green },
              { n: scan.needs_creating.length, l: 'genuinely missing', c: scan.needs_creating.length ? C.red : C.textDim },
              { n: scan.probably_renames, l: 'named differently', c: scan.probably_renames ? C.green : C.textDim },
              { n: scan.with_instructions, l: 'have instructions', c: C.green },
              { n: scan.with_tts, l: 'have audio', c: scan.with_tts === scan.total ? C.green : C.amber },
              { n: scan.with_video, l: 'have video', c: C.accent },
            ].map(s => (
              <div key={s.l} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 112 }}>
                <div style={{ fontSize: 21, fontWeight: 900, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.amber, borderRadius: 3 }} />
          </div>

          {(scan.needs_creating.length > 0 || scan.needs_instructions.length > 0 || scan.needs_tts.length > 0) && (
            <div style={{ background: 'rgba(245,158,11,0.07)', border: `1px solid ${C.amber}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>The gaps, in the order they need filling</p>
              {scan.rename_candidates.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.green, marginBottom: 3 }}>
                    {scan.rename_candidates.length} · Already in the library under a different name. Do NOT generate these.
                  </p>
                  {scan.rename_candidates.map(r => (
                    <p key={r.ours} style={{ fontSize: 11.5, color: C.textMid, lineHeight: 1.7 }}>
                      our list says <strong style={{ color: C.text }}>{r.ours}</strong>, the library calls it <strong style={{ color: C.green }}>{r.library}</strong>
                    </p>
                  ))}
                </div>
              )}
              {[
                { l: 'Genuinely not in the library, nothing close either', names: scan.needs_creating, c: C.red },
                { l: 'In the library but no written instructions', names: scan.needs_instructions, c: C.amber },
                { l: 'Have instructions but no narration audio', names: scan.needs_tts, c: C.accent },
              ].filter(b => b.names.length).map(b => (
                <div key={b.l} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: b.c, marginBottom: 3 }}>{b.names.length} · {b.l}</p>
                  <p style={{ fontSize: 11.5, color: C.textMid, lineHeight: 1.6 }}>{b.names.join(', ')}</p>
                </div>
              ))}
            </div>
          )}

          {scan.groups.map(g => (
            <div key={g.key} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{g.label}</p>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {g.exercises.map(e => (
                  <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
                    <span style={{ flex: 1, color: e.inLibrary ? C.text : C.textDim, fontWeight: 600 }}>
                      {e.name}
                      {e.libraryName && e.libraryName !== e.name && (
                        <span style={{ color: C.textDim, fontWeight: 400 }}> · library calls it &quot;{e.libraryName}&quot;</span>
                      )}
                    </span>
                    {!e.inLibrary
                      ? e.nearMatch
                        ? <span style={{ fontSize: 10, fontWeight: 800, color: C.green }}>IS &quot;{e.nearMatch.libraryName}&quot;</span>
                        : <span style={{ fontSize: 10, fontWeight: 800, color: C.red }}>NOT IN LIBRARY</span>
                      : <>
                          <span title="written instructions" style={{ fontSize: 11, color: e.hasInstructions ? C.green : C.red }}>{e.hasInstructions ? '✓ cues' : '✗ cues'}</span>
                          <span title="narration audio" style={{ fontSize: 11, color: e.hasTts ? C.green : C.amber }}>{e.hasTts ? '✓ audio' : '✗ audio'}</span>
                          <span title="curated video" style={{ fontSize: 11, color: e.hasVideo ? C.green : C.textDim }}>{e.hasVideo ? '✓ video' : '· video'}</span>
                        </>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p style={{ fontSize: 11, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 6px' }}>Standard workouts</p>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {scan.workouts.map(w => (
              <div key={w.key} style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>{w.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: w.ready ? C.green : C.amber }}>{w.ready ? 'READY' : `${w.missing.length} MISSING`}</span>
                </div>
                <p style={{ fontSize: 11, color: C.textDim, marginTop: 2, lineHeight: 1.5 }}>{w.purpose}</p>
                <p style={{ fontSize: 11, color: C.textMid, marginTop: 3 }}>{w.exercises.join(' · ')}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
