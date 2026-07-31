'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import YouTubeLoopTrimmer from './YouTubeLoopTrimmer'
import { extractYouTubeId } from '@/lib/youtube-iframe'

/**
 * Task 3: the trimming work queue.
 *
 * The trimmer itself already worked. What was missing was everything around
 * it: no way to see what is left, no counters, no way to work straight through
 * a queue, and no record of who trimmed what.
 *
 * The trim values live in loop_start_sec / loop_end_sec (unchanged). This tab
 * adds the workflow on top: trim_status, trimmed_at, trimmed_by.
 */

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)', greenBorder: 'rgba(34,197,94,0.25)',
  amber: '#f59e0b', amberBorder: 'rgba(245,158,11,0.25)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type TrimStatus = 'not_started' | 'in_progress' | 'trimmed' | 'needs_review'

type Row = {
  id: string
  name_display: string
  video_url: string | null
  video_source: string | null
  loop_start_sec: number | null
  loop_end_sec: number | null
  trim_status: TrimStatus | null
  trimmed_at: string | null
}

const PAGE = 1000

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

const STATUS_META: Record<TrimStatus, { label: string; color: string; bg: string }> = {
  not_started:  { label: 'Not trimmed', color: C.textDim, bg: C.surface2 },
  in_progress:  { label: 'In progress', color: C.accent,  bg: C.accentDim },
  trimmed:      { label: 'Trimmed',     color: C.green,   bg: C.greenDim },
  needs_review: { label: 'Needs review',color: C.amber,   bg: 'rgba(245,158,11,0.1)' },
}

export default function VideoTrimmingTab() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | TrimStatus>('not_started')
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [urlEdits, setUrlEdits] = useState<Record<string, string>>({})
  const openRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    const all: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('id, name_display, video_url, video_source, loop_start_sec, loop_end_sec, trim_status, trimmed_at')
        .not('video_url', 'is', null)
        .order('name_display')
        .range(from, from + PAGE - 1)
      if (error) {
        setError(/trim_status/.test(error.message)
          ? 'Run supabase/migrations/20260731b_trim_status.sql first.'
          : error.message)
        setLoading(false)
        return
      }
      const page = (data ?? []) as Row[]
      all.push(...page)
      if (page.length < PAGE) break
    }
    setRows(all)
    setLoading(false)
  }

  function statusOf(r: Row): TrimStatus {
    if (r.trim_status) return r.trim_status
    return (r.loop_start_sec != null && r.loop_end_sec != null) ? 'trimmed' : 'not_started'
  }

  async function patch(id: string, update: Record<string, unknown>) {
    setSaving(id)
    const { error } = await supabase.from('exercise_library').update(update).eq('id', id)
    if (error) setError(error.message)
    else setRows(prev => prev.map(r => r.id === id ? { ...r, ...update } as Row : r))
    setSaving(null)
  }

  const saveLoop = (id: string, start: number, end: number) =>
    patch(id, {
      loop_start_sec: start, loop_end_sec: end,
      trim_status: 'trimmed', trimmed_at: new Date().toISOString(), trimmed_by: user?.id ?? null,
    })

  const clearLoop = (id: string) =>
    patch(id, { loop_start_sec: null, loop_end_sec: null, trim_status: 'not_started', trimmed_at: null })

  const setStatus = (id: string, trim_status: TrimStatus) => patch(id, { trim_status })

  async function replaceUrl(id: string) {
    const url = (urlEdits[id] ?? '').trim()
    if (!url) return
    if (!extractYouTubeId(url)) { setError('That does not look like a YouTube URL.'); return }
    // A new video invalidates the old trim window entirely.
    await patch(id, {
      video_url: url, video_source: 'custom',
      loop_start_sec: null, loop_end_sec: null,
      trim_status: 'not_started', trimmed_at: null, trimmed_by: null,
    })
    setUrlEdits(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const counts = {
    all: rows.length,
    not_started:  rows.filter(r => statusOf(r) === 'not_started').length,
    in_progress:  rows.filter(r => statusOf(r) === 'in_progress').length,
    trimmed:      rows.filter(r => statusOf(r) === 'trimmed').length,
    needs_review: rows.filter(r => statusOf(r) === 'needs_review').length,
  }

  const visible = filter === 'all' ? rows : rows.filter(r => statusOf(r) === filter)

  function nextUntrimmed() {
    const next = rows.find(r => statusOf(r) === 'not_started')
    if (!next) return
    setFilter('not_started')
    setOpenId(next.id)
    setTimeout(() => openRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  const pct = counts.all ? Math.round((counts.trimmed / counts.all) * 100) : 0

  const chip = (active: boolean, color: string) => ({
    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${active ? color : C.border}`,
    background: active ? `${color}22` : 'transparent',
    color: active ? color : C.textMid,
  })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Video Trimming</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>
          Pick the few seconds of each video that show the movement. Athletes see that loop instead of the full video.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', background: C.surface, border: `1px solid ${C.red}`, borderRadius: 9, marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>{error}</p>
        </div>
      )}

      {/* Progress + counters */}
      <div style={{ padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {counts.trimmed} of {counts.all} trimmed ({pct}%)
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={nextUntrimmed} disabled={!counts.not_started}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: counts.not_started ? 'pointer' : 'not-allowed', background: counts.not_started ? C.accent : C.surface2, color: counts.not_started ? '#fff' : C.textDim, fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              ▶ Next untrimmed
            </button>
            <button onClick={load}
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              ↻
            </button>
          </div>
        </div>
        <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: C.green }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button onClick={() => setFilter('not_started')} style={chip(filter === 'not_started', C.textMid)}>Remaining ({counts.not_started})</button>
        <button onClick={() => setFilter('trimmed')}     style={chip(filter === 'trimmed', C.green)}>Trimmed ({counts.trimmed})</button>
        <button onClick={() => setFilter('needs_review')} style={chip(filter === 'needs_review', C.amber)}>Needs review ({counts.needs_review})</button>
        <button onClick={() => setFilter('all')}          style={chip(filter === 'all', C.accent)}>All ({counts.all})</button>
      </div>

      {loading && <p style={{ fontSize: 13, color: C.textDim }}>Loading…</p>}

      {!loading && visible.length === 0 && (
        <p style={{ fontSize: 13, color: C.textDim, padding: 24, textAlign: 'center' }}>
          {filter === 'not_started' ? '🎉 Everything with a video has been trimmed.' : 'Nothing in this filter.'}
        </p>
      )}

      {visible.map(r => {
        const st = statusOf(r)
        const meta = STATUS_META[st]
        const videoId = r.video_url ? extractYouTubeId(r.video_url) : null
        const isShort = !!r.video_url?.includes('/shorts/')
        const isOpen = openId === r.id
        return (
          <div key={r.id} ref={isOpen ? openRef : undefined}
            style={{ marginBottom: 8, borderRadius: 9, background: C.surface, border: `1px solid ${isOpen ? C.accent : C.border}` }}>
            <div
              onClick={() => setOpenId(isOpen ? null : r.id)}
              style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                {meta.label}
              </span>
              <span style={{ flex: 1, minWidth: 180, fontSize: 14, fontWeight: 600, color: C.text }}>{r.name_display}</span>
              {r.loop_start_sec != null && r.loop_end_sec != null && (
                <span style={{ fontSize: 11, color: C.green, fontFamily: 'monospace' }}>
                  {mmss(r.loop_start_sec)} → {mmss(r.loop_end_sec)} ({(r.loop_end_sec - r.loop_start_sec).toFixed(1)}s)
                </span>
              )}
              <span style={{ fontSize: 12, color: C.textDim }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                {videoId ? (
                  <>
                    <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5, marginBottom: 10 }}>
                      Drag the ⟮ ⟯ handles to pick the movement, preview it, then save. The original video is never changed.
                    </p>
                    <YouTubeLoopTrimmer
                      key={r.video_url ?? videoId}
                      videoId={videoId}
                      isShort={isShort}
                      initialStart={r.loop_start_sec}
                      initialEnd={r.loop_end_sec}
                      saving={saving === r.id}
                      hasSavedLoop={r.loop_start_sec != null || r.loop_end_sec != null}
                      onSave={(s, e) => saveLoop(r.id, s, e)}
                      onClear={() => clearLoop(r.id)}
                    />
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: C.amber }}>No usable YouTube id on this row. Paste a replacement below.</p>
                )}

                {/* Wrong video? Replace the link right here. */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 6 }}>Wrong video? Paste a new YouTube link</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      value={urlEdits[r.id] ?? ''}
                      onChange={e => setUrlEdits({ ...urlEdits, [r.id]: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=…"
                      style={{ flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit' }} />
                    <button onClick={() => replaceUrl(r.id)} disabled={!urlEdits[r.id]?.trim() || saving === r.id}
                      style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: urlEdits[r.id]?.trim() ? 'pointer' : 'not-allowed', background: urlEdits[r.id]?.trim() ? C.accent : C.surface2, color: urlEdits[r.id]?.trim() ? '#fff' : C.textDim, fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                      Replace
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: C.textDim, marginTop: 5 }}>
                    Replacing clears the saved trim, since the timings belong to the old video.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {st !== 'needs_review' && (
                    <button onClick={() => setStatus(r.id, 'needs_review')}
                      style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.amberBorder}`, background: 'transparent', color: C.amber, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                      ⚑ Flag for review
                    </button>
                  )}
                  {st === 'needs_review' && (
                    <button onClick={() => setStatus(r.id, r.loop_start_sec != null && r.loop_end_sec != null ? 'trimmed' : 'not_started')}
                      style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                      Clear flag
                    </button>
                  )}
                  {r.video_url && (
                    <a href={r.video_url} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`, color: C.textDim, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                      ↗ Open on YouTube
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
