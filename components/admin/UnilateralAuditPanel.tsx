'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Task 6, item 4: how big is the unilateral video problem?
 *
 * Many approved videos demonstrate both arms or both legs on an exercise whose
 * name says one side. This panel is READ ONLY. It counts and lists so the size
 * of the job is visible before anything is reset, which is what the spec asks
 * for. Requeueing is a separate action and is not built yet.
 */

const C = {
  surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Item = {
  id: string
  name: string
  legacyName: string | null
  videoUrl: string | null
  videoSource: string | null
  approvedAt: string | null
  trimmed: boolean
  renamedSince: boolean
}

type Audit = {
  library_total: number
  unilateral_total: number
  unilateral_with_video: number
  unilateral_without_video: number
  trimmed: number
  untrimmed: number
  renamed_since_approval: number
  items: Item[]
  error?: string
}

export default function UnilateralAuditPanel() {
  const [audit, setAudit] = useState<Audit | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'untrimmed' | 'renamed'>('all')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/unilateral-audit', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const d = await res.json() as Audit
      if (d.error) { setError(d.error); setAudit(null) }
      else setAudit(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load failed')
    }
    setLoading(false)
  }

  const visible = (audit?.items ?? []).filter(i =>
    filter === 'all' ? true : filter === 'untrimmed' ? !i.trimmed : i.renamedSince)

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(59,130,246,0.12)' : C.surface2,
    color: active ? C.accent : C.textMid,
  })

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
            🎥 Unilateral video audit
          </p>
          <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            Every exercise in the library whose name says one side at a time, and which already
            carries an approved video. Those videos were approved before the matcher checked for
            this, so some of them demonstrate both arms or both legs. Read only: nothing here
            resets anything.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontWeight: 800, fontSize: 13, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
        >
          {loading ? 'Counting…' : audit ? 'Recount' : 'Count them'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: C.red, background: 'rgba(239,68,68,0.08)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 12px' }}>
          {error}
        </p>
      )}

      {audit && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { n: audit.unilateral_with_video, l: 'to re-check', c: C.amber },
              { n: audit.untrimmed, l: 'never trimmed', c: C.red },
              { n: audit.trimmed, l: 'trimmed by hand', c: C.green },
              { n: audit.renamed_since_approval, l: 'renamed since approval', c: C.accent },
              { n: audit.unilateral_total, l: 'unilateral exercises', c: C.textMid },
              { n: audit.library_total, l: 'library total', c: C.textDim },
            ].map(s => (
              <div key={s.l} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 108 }}>
                <div style={{ fontSize: 21, fontWeight: 900, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6, marginBottom: 14, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
            <strong style={{ color: C.text }}>Reading this:</strong> the ones never trimmed are the
            riskiest, since nobody has watched them frame by frame. The trimmed ones had a human
            pick the exact rep, so they are far likelier to be right. Renamed since approval means
            the video was matched against the old abbreviated name and never re-checked.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>All ({audit.unilateral_with_video})</button>
            <button onClick={() => setFilter('untrimmed')} style={chip(filter === 'untrimmed')}>Never trimmed ({audit.untrimmed})</button>
            <button onClick={() => setFilter('renamed')} style={chip(filter === 'renamed')}>Renamed since ({audit.renamed_since_approval})</button>
          </div>

          <div style={{ maxHeight: 460, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
            {visible.map(i => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{i.name}</div>
                  {i.legacyName && (
                    <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>was: {i.legacyName}</div>
                  )}
                </div>
                {!i.trimmed && <span style={{ fontSize: 10, fontWeight: 800, color: C.red, background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>NEVER TRIMMED</span>}
                {i.videoUrl && (
                  <a href={i.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accent, fontWeight: 700, flexShrink: 0, textDecoration: 'none' }}>watch ↗</a>
                )}
              </div>
            ))}
            {!visible.length && (
              <p style={{ padding: 18, textAlign: 'center', fontSize: 12, color: C.textDim }}>Nothing in this filter.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
