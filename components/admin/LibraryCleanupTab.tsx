'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import UnilateralAuditPanel from '@/components/admin/UnilateralAuditPanel'

/**
 * Task 6 (naming slice): review and approve exercise renames.
 *
 * Abbreviated names ("1 DB Chest Fly") break video matching and get spoken
 * aloud by the TTS narration. This tab proposes full descriptive names and
 * shows what is already attached to each exercise BEFORE anything is applied,
 * so a rename never quietly strands a video or an audio file.
 *
 * Nothing is bulk-applied. Every row is approved individually.
 */

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)', amberBorder: 'rgba(245,158,11,0.25)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Proposal = {
  id: string
  current: string
  proposed: string
  reasons: string[]
  needsReview: boolean
  reviewNote?: string
  hasVideo: boolean
  hasTts: boolean
  unilateralRisk: boolean
  instructionsPreview: string
  alreadyRenamed: boolean
}

type Report = {
  library_total: number
  proposed_renames: number
  with_video: number
  with_tts: number
  needs_review: number
  unilateral_video_risk: number
  unilateral_video_risk_library_wide: number
  tts_total_in_library: number
  proposals: Proposal[]
  error?: string
  hint?: string
}

export default function LibraryCleanupTab() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [requeue, setRequeue] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'all' | 'review' | 'video' | 'tts'>('all')
  const [log, setLog] = useState<string[]>([])

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }

  async function load() {
    setLoading(true); setLog([])
    try {
      const res = await fetch('/api/admin/library-cleanup', { headers: await authHeaders() })
      setReport(await res.json() as Report)
      setApproved(new Set()); setRequeue(new Set()); setEdits({})
    } catch (err) {
      setLog([`Error: ${err instanceof Error ? err.message : 'load failed'}`])
    }
    setLoading(false)
  }

  async function apply() {
    if (!report || approved.size === 0) return
    const approvals = report.proposals
      .filter(p => approved.has(p.id))
      .map(p => ({ id: p.id, proposed: edits[p.id] ?? p.proposed, requeueVideo: requeue.has(p.id) }))

    setApplying(true)
    setLog([`Applying ${approvals.length} renames…`])
    try {
      const res = await fetch('/api/admin/library-cleanup', {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ approvals }),
      })
      const d = await res.json()
      if (d.error) { setLog([`Error: ${d.error}`]); setApplying(false); return }
      setLog([
        `✓ ${d.renamed} renamed`,
        d.tts_cleared ? `🔊 ${d.tts_cleared} audio files cleared — regenerate from the TTS Audio tab` : '',
        d.videos_requeued ? `🎥 ${d.videos_requeued} videos sent back to the curation queue` : '',
        ...(d.failed ?? []).map((f: { id: string; error: string }) => `⚠ ${f.id}: ${f.error}`),
      ].filter(Boolean))
      await load()
    } catch (err) {
      setLog([`Error: ${err instanceof Error ? err.message : 'apply failed'}`])
    }
    setApplying(false)
  }

  const visible = (report?.proposals ?? []).filter(p =>
    filter === 'all' ? true :
    filter === 'review' ? p.needsReview :
    filter === 'video' ? p.unilateralRisk :
    p.hasTts
  )

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    apply(next)
  }

  const btn = (active: boolean) => ({
    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
    color: active ? C.accent : C.textMid,
  })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Library Cleanup</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>
          Abbreviated names break video matching and get read aloud by the narration. Review the proposed full
          names, approve the ones you want, and nothing else changes.
        </p>
      </div>

      {/* Task 6 item 4. Separate from the rename list on purpose: this covers
          the WHOLE library, including exercises that were always named
          correctly and so never appear as a rename proposal. Their videos were
          the ones that could not be requeued from here at all. */}
      <UnilateralAuditPanel />

      {!report && (
        <button onClick={load} disabled={loading}
          style={{ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? C.surface2 : C.accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {loading ? '⏳ Scanning…' : '🔍 Scan library'}
        </button>
      )}

      {report?.error && (
        <div style={{ padding: '14px 16px', background: C.surface, border: `1px solid ${C.red}`, borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>{report.error}</p>
          {report.hint && <p style={{ fontSize: 12, color: C.textMid, marginTop: 6 }}>{report.hint}</p>}
        </div>
      )}

      {report && !report.error && (
        <>
          {/* Counts first, always */}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 16 }}>
            {[
              { n: report.library_total,                       l: 'exercises',            c: C.textMid },
              { n: report.proposed_renames,                    l: 'need renaming',        c: C.accent },
              { n: report.with_video,                          l: 'of those have video',  c: C.textMid },
              { n: report.with_tts,                            l: 'of those have audio',  c: C.purple },
              { n: report.needs_review,                        l: 'need your judgement',  c: C.amber },
              { n: report.unilateral_video_risk_library_wide,  l: 'unilateral video risk', c: C.red },
            ].map(s => (
              <div key={s.l}>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: 'monospace' }}>{s.n.toLocaleString()}</p>
                <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <button onClick={() => setFilter('all')}    style={btn(filter === 'all')}>All ({report.proposals.length})</button>
            <button onClick={() => setFilter('review')} style={btn(filter === 'review')}>⚠ Needs judgement ({report.needs_review})</button>
            <button onClick={() => setFilter('video')}  style={btn(filter === 'video')}>🎥 Unilateral risk ({report.unilateral_video_risk})</button>
            <button onClick={() => setFilter('tts')}    style={btn(filter === 'tts')}>🔊 Has audio ({report.with_tts})</button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setApproved(new Set(visible.filter(p => !p.needsReview).map(p => p.id)))}
              style={btn(false)}>
              Select all safe ({visible.filter(p => !p.needsReview).length})
            </button>
            <button onClick={() => setApproved(new Set())} style={btn(false)}>Clear</button>
            <button
              onClick={apply}
              disabled={applying || approved.size === 0}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: (applying || approved.size === 0) ? 'not-allowed' : 'pointer', background: approved.size === 0 ? C.surface2 : C.green, color: approved.size === 0 ? C.textDim : '#000', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              {applying ? '⏳ Applying…' : `✓ Apply ${approved.size} rename${approved.size === 1 ? '' : 's'}`}
            </button>
          </div>

          {log.length > 0 && (
            <div style={{ padding: '10px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14 }}>
              {log.map((l, i) => <p key={i} style={{ fontSize: 12, color: C.textMid, fontFamily: 'monospace', lineHeight: 1.7 }}>{l}</p>)}
            </div>
          )}

          {visible.map(p => {
            const isApproved = approved.has(p.id)
            return (
              <div key={p.id} style={{
                padding: '12px 14px', marginBottom: 8, borderRadius: 9,
                background: isApproved ? C.greenDim : C.surface,
                border: `1px solid ${isApproved ? C.green : p.needsReview ? C.amberBorder : C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={isApproved}
                    onChange={() => toggle(approved, p.id, setApproved)}
                    style={{ marginTop: 4, width: 16, height: 16, cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <p style={{ fontSize: 12, color: C.textDim, fontFamily: 'monospace', textDecoration: 'line-through' }}>{p.current}</p>
                    <input
                      value={edits[p.id] ?? p.proposed}
                      onChange={e => setEdits({ ...edits, [p.id]: e.target.value })}
                      style={{ width: '100%', marginTop: 3, padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }} />
                    <p style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{p.reasons.join(' · ')}</p>
                    {p.reviewNote && (
                      <p style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>⚠ {p.reviewNote}</p>
                    )}
                    {p.instructionsPreview && (
                      <p style={{ fontSize: 11, color: C.textDim, marginTop: 4, fontStyle: 'italic' }}>{p.instructionsPreview}…</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    {p.hasTts && <span style={{ fontSize: 10, color: C.purple, fontWeight: 700 }}>🔊 audio will be cleared</span>}
                    {p.hasVideo && <span style={{ fontSize: 10, color: C.textMid, fontWeight: 700 }}>🎥 has video</span>}
                    {p.unilateralRisk && (
                      <label style={{ fontSize: 10, color: C.red, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" checked={requeue.has(p.id)}
                          onChange={() => toggle(requeue, p.id, setRequeue)} style={{ cursor: 'pointer' }} />
                        ⚠ re-curate video
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {visible.length === 0 && (
            <p style={{ fontSize: 13, color: C.textDim, padding: 20, textAlign: 'center' }}>
              Nothing in this filter. {report.proposed_renames === 0 ? 'Every name in the library is already clean.' : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
