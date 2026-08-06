'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Name cleanup for coach libraries.
 *
 * Separate from the athlete list above because they are separate tables holding
 * separate copies: renaming the global library never reached a coach's rows.
 * Scanning is read only. Nothing is renamed without being ticked.
 */

const C = {
  surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Proposal = {
  id: string
  coachId: string
  current: string
  proposed: string
  source: 'library' | 'rules'
  hasVideo: boolean
}

type Report = {
  coach_rows_total: number
  coaches: number
  proposed: number
  from_library: number
  from_rules: number
  proposals: Proposal[]
  error?: string
}

export default function CoachLibraryCleanupPanel() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<string[]>([])

  async function headers() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }

  async function load() {
    setLoading(true); setLog([])
    try {
      const res = await fetch('/api/admin/coach-library-cleanup', { headers: await headers() })
      const d = await res.json() as Report
      if (d.error) setLog([`Error: ${d.error}`])
      else { setReport(d); setPicked(new Set()) }
    } catch (err) {
      setLog([`Error: ${err instanceof Error ? err.message : 'load failed'}`])
    }
    setLoading(false)
  }

  async function apply() {
    if (!report || !picked.size) return
    setApplying(true)
    try {
      const approvals = report.proposals.filter(p => picked.has(p.id)).map(p => ({ id: p.id, proposed: p.proposed }))
      const res = await fetch('/api/admin/coach-library-cleanup', {
        method: 'POST', headers: await headers(), body: JSON.stringify({ approvals }),
      })
      const d = await res.json()
      if (d.error) setLog([`Error: ${d.error}`])
      else {
        setLog([`✓ ${d.renamed} renamed`, ...(d.failed ?? []).map((f: { id: string; error: string }) => `⚠ ${f.id}: ${f.error}`)])
        await load()
      }
    } catch (err) {
      setLog([`Error: ${err instanceof Error ? err.message : 'apply failed'}`])
    }
    setApplying(false)
  }

  const toggle = (id: string) => setPicked(p => {
    const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n
  })

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>👥 Coach library names</p>
          <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            Each coach keeps their own copy of an exercise, so cleaning the athlete library above
            never reached them. A coach who imported a program before that cleanup still sees the
            old abbreviations. Where the movement exists in the athlete library, the proposal is
            simply that library&apos;s name, so coach and athlete see the same thing.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontWeight: 800, fontSize: 13, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {loading ? 'Scanning…' : report ? 'Rescan' : 'Scan coach libraries'}
        </button>
      </div>

      {report && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { n: report.coach_rows_total, l: 'coach exercises', c: C.textMid },
              { n: report.coaches, l: 'coaches', c: C.textMid },
              { n: report.proposed, l: 'need renaming', c: report.proposed ? C.amber : C.green },
              { n: report.from_library, l: 'match the athlete library', c: C.green },
              { n: report.from_rules, l: 'from naming rules', c: C.purple },
            ].map(s => (
              <div key={s.l} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 108 }}>
                <div style={{ fontSize: 21, fontWeight: 900, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {report.proposals.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setPicked(new Set(report.proposals.map(p => p.id)))}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.textMid, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Select all {report.proposals.length}
                </button>
                {picked.size > 0 && (
                  <button onClick={() => setPicked(new Set())}
                    style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.textMid, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Clear
                  </button>
                )}
                <span style={{ flex: 1 }} />
                <button onClick={apply} disabled={!picked.size || applying}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: picked.size ? C.green : C.surface2, color: picked.size ? '#0d1117' : C.textDim, fontWeight: 800, fontSize: 12.5, cursor: picked.size && !applying ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {applying ? 'Renaming…' : `Rename ${picked.size || ''}`.trim()}
                </button>
              </div>

              <div style={{ maxHeight: 420, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {report.proposals.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${C.border}`, background: picked.has(p.id) ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
                    <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)}
                      aria-label={`Rename ${p.current}`}
                      style={{ width: 15, height: 15, accentColor: C.green, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                      <span style={{ color: C.textDim, textDecoration: 'line-through' }}>{p.current}</span>
                      <span style={{ color: C.textDim }}> → </span>
                      <span style={{ color: C.text, fontWeight: 700 }}>{p.proposed}</span>
                    </span>
                    {p.hasVideo && <span title="this coach attached their own video" style={{ fontSize: 10, color: C.accent, flexShrink: 0 }}>🎥</span>}
                    <span style={{ fontSize: 10, fontWeight: 800, color: p.source === 'library' ? C.green : C.purple, flexShrink: 0 }}>
                      {p.source === 'library' ? 'MATCHES LIBRARY' : 'FROM RULES'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {report.proposals.length === 0 && (
            <p style={{ fontSize: 12.5, color: C.green, fontWeight: 700 }}>✓ Every coach exercise name is already clean.</p>
          )}
        </>
      )}

      {log.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {log.map((l, i) => <p key={i} style={{ fontSize: 12, lineHeight: 1.7, color: l.startsWith('✓') ? C.green : C.red }}>{l}</p>)}
        </div>
      )}
    </div>
  )
}
