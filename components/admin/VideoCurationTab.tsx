'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)', greenBorder: 'rgba(34,197,94,0.25)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)', amberBorder: 'rgba(245,158,11,0.25)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Channel = {
  channel_id: string; channel_name: string; audience_focus: string; priority: number
}
type Candidate = {
  id: string; exercise_id: string; youtube_video_id: string; url: string
  title: string; channel_title: string; thumbnail_url: string
  duration_seconds: number; view_count: number
  ai_relevance_score: number; ai_reasoning: string; status: string
}
type Exercise = {
  id: string; name_display: string; name_normalized: string
  video_url: string | null; video_source: string | null
  candidates: Candidate[]
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}
function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}
function scoreColor(s: number) {
  if (s >= 0.85) return C.green
  if (s >= 0.6)  return C.amber
  return C.red
}

// ─── Clip helpers ─────────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null
}
function parseMMSS(mmss: string): number | null {
  const t = mmss.trim()
  if (!t) return null
  const parts = t.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10), s = parseInt(parts[1], 10)
    if (isNaN(m) || isNaN(s)) return null
    return m * 60 + s
  }
  const n = parseInt(t, 10)
  return isNaN(n) ? null : n
}
function secondsToMMSS(sec: number | null | undefined): string {
  if (sec == null) return ''
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
function buildClipEmbedUrl(url: string, startSec: number | null, endSec: number | null): string {
  const id = extractYouTubeId(url)
  if (!id) return ''
  let src = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
  if (startSec != null && startSec > 0) src += `&start=${startSec}`
  if (endSec != null) src += `&end=${endSec}`
  return src
}

export default function VideoCurationTab() {
  const { user } = useAuth()

  // ── Channel state ──────────────────────────────────────────────────────────
  const [channels, setChannels]           = useState<Channel[]>([])
  const [channelsLoading, setChLoading]   = useState(true)
  const [discovering, setDiscovering]     = useState(false)
  const [discoverLog, setDiscoverLog]     = useState<string[]>([])

  // ── Priority queue (from client plan generation) ───────────────────────────
  const [queuedIds, setQueuedIds]         = useState<Set<string>>(new Set())

  // ── Program lanes ──────────────────────────────────────────────────────────
  type ProgramLane = { programId: string; name: string; exerciseIds: string[]; pendingCount: number }
  const [programLanes, setProgramLanes]   = useState<ProgramLane[]>([])
  const [planQueueIds, setPlanQueueIds]   = useState<string[]>([])

  // ── Exercise / candidate state ─────────────────────────────────────────────
  const [exercises, setExercises]   = useState<Exercise[]>([])
  const [loading, setLoading]       = useState(true)
  const [running, setRunning]       = useState(false)
  const [runLog, setRunLog]         = useState<string[]>([])
  const [runningLane, setRunningLane] = useState<string | null>(null)
  const [filter, setFilter]         = useState<'pending' | 'approved' | 'all'>('pending')
  const [search, setSearch]         = useState('')
  const [batchSize, setBatchSize]   = useState(10)
  const [pasteUrls, setPasteUrls]   = useState<Record<string, string>>({})
  const [pasteTimes, setPasteTimes] = useState<Record<string, { start: string; end: string }>>({})
  const [acting, setActing]         = useState<string | null>(null)

  useEffect(() => { loadChannels(); loadExercises() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Channel helpers ────────────────────────────────────────────────────────
  async function loadChannels() {
    setChLoading(true)
    const { data } = await supabase
      .from('approved_yt_channels')
      .select('channel_id, channel_name, audience_focus, priority')
      .eq('active', true)
      .order('priority')
    setChannels(data ?? [])
    setChLoading(false)
  }

  async function discoverChannels() {
    setDiscovering(true)
    setDiscoverLog(['Searching YouTube for certified fitness channels…'])
    try {
      const res = await fetch('/api/admin/discover-channels', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDiscoverLog([
        `✓ Discovered ${data.discovered} high-quality channels`,
        ...(data.channels ?? []).map((c: { channel_name: string; score: number; reasoning: string }) =>
          `  · ${c.channel_name} — ${Math.round(c.score * 100)}% quality — ${c.reasoning}`
        ),
      ])
      await loadChannels()
    } catch (err) {
      setDiscoverLog([`Error: ${err instanceof Error ? err.message : 'Discovery failed'}`])
    }
    setDiscovering(false)
  }

  // ── Exercise helpers ───────────────────────────────────────────────────────
  async function loadExercises() {
    setLoading(true)
    const { data: exList } = await supabase
      .from('exercise_library')
      .select('id, name_display, name_normalized, video_url, video_source')
      .order('name_display')

    // Collect ALL queued entries with source_label.
    // Try selecting source_label; if the column doesn't exist yet (migration not run),
    // fall back to a query without it so lanes still render with 0 program entries.
    let queuedRows: { exercise_id: string; source_label: string | null }[] | null = null
    const { data: qr, error: qrErr } = await supabase
      .from('exercise_video_candidates')
      .select('exercise_id, source_label')
      .eq('status', 'queued')
    if (!qrErr) {
      queuedRows = qr as { exercise_id: string; source_label: string | null }[]
    } else {
      // Column likely doesn't exist yet — fall back without source_label
      const { data: qrFallback } = await supabase
        .from('exercise_video_candidates')
        .select('exercise_id')
        .eq('status', 'queued')
      queuedRows = (qrFallback ?? []).map(r => ({ exercise_id: r.exercise_id, source_label: null }))
    }

    const allQueuedIds = new Set((queuedRows ?? []).map(r => r.exercise_id))
    setQueuedIds(allQueuedIds)

    // Plan queue: queued entries with no source_label or source_label='plan'
    const planIds = (queuedRows ?? [])
      .filter(r => !r.source_label || r.source_label === 'plan')
      .map(r => r.exercise_id)
    setPlanQueueIds(planIds)

    // Program lanes: read directly from exercise_library.source_program
    // This is stable regardless of pipeline stage (queued → proposed → approved)
    const { data: programExercises } = await supabase
      .from('exercise_library')
      .select('id, source_program, video_url')
      .not('source_program', 'is', null)

    // Group by program name
    const progMap: Record<string, { id: string; video_url: string | null }[]> = {}
    for (const ex of (programExercises ?? []) as { id: string; source_program: string; video_url: string | null }[]) {
      if (!progMap[ex.source_program]) progMap[ex.source_program] = []
      progMap[ex.source_program].push(ex)
    }

    const lanes: ProgramLane[] = Object.entries(progMap).map(([name, exs]) => {
      const pending = exs.filter(e => !e.video_url)
      return {
        programId: name,
        name,
        exerciseIds: pending.map(e => e.id),
        pendingCount: pending.length,
      }
    }).filter(l => l.pendingCount > 0) // only show programs that still need videos
    setProgramLanes(lanes)

    const { data: cands } = await supabase
      .from('exercise_video_candidates')
      .select('*')
      .in('status', ['proposed', 'approved'])
      .order('ai_relevance_score', { ascending: false })

    const candMap: Record<string, Candidate[]> = {}
    for (const c of (cands ?? [])) {
      if (!candMap[c.exercise_id]) candMap[c.exercise_id] = []
      candMap[c.exercise_id].push(c as Candidate)
    }

    setExercises((exList ?? []).map((e: Omit<Exercise, 'candidates'>) => ({
      ...e, candidates: candMap[e.id] ?? [],
    })))
    setLoading(false)
  }

  async function runPipeline() {
    setRunning(true)
    setRunLog(['Starting curation pipeline…'])
    try {
      const res = await fetch('/api/admin/curate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const lines = (data.results ?? []).map((r: { exercise: string; status: string; candidates?: number; error?: string }) =>
        `${r.status === 'proposed' ? '✓' : r.status === 'no_results' ? '○' : '⚠'} ${r.exercise}${r.candidates ? ` — ${r.candidates} candidates` : ` — ${r.status}${r.error ?? ''}`}`
      )
      setRunLog([`Done — ${data.processed} exercises processed`, ...lines])
      await loadExercises()
    } catch (err) {
      setRunLog(prev => [...prev, `Error: ${err instanceof Error ? err.message : 'Failed'}`])
    }
    setRunning(false)
  }

  async function runLane(laneId: string, exerciseIds: string[], n: number) {
    setRunningLane(laneId)
    setRunLog([`Running ${n} exercises from ${laneId} lane…`])
    try {
      const body = laneId === 'plans'
        ? { batchSize: n, lane: 'plans' }
        : laneId === 'backlog'
          ? { batchSize: n, lane: 'backlog' }
          : { exerciseIds: exerciseIds.slice(0, n), batchSize: n }
      const res = await fetch('/api/admin/curate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const lines = (data.results ?? []).map((r: { exercise: string; status: string; candidates?: number }) =>
        `${r.status === 'proposed' ? '✓' : r.status === 'no_results' ? '○' : '⚠'} ${r.exercise}${r.candidates ? ` — ${r.candidates} candidates` : ''}`
      )
      setRunLog([`Done — ${data.processed} processed`, ...lines])
      await loadExercises()
    } catch (err) {
      setRunLog(prev => [...prev, `Error: ${err instanceof Error ? err.message : 'Failed'}`])
    }
    setRunningLane(null)
  }

  async function runSingle(exerciseId: string, regenerate = false) {
    setActing(exerciseId)
    try {
      await fetch('/api/admin/curate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId, regenerate }),
      })
      await loadExercises()
    } catch { /* ignore */ }
    setActing(null)
  }

  async function approve(candidate: Candidate) {
    setActing(candidate.id)
    await supabase.from('exercise_video_candidates')
      .update({ status: 'superseded' })
      .eq('exercise_id', candidate.exercise_id)
      .neq('id', candidate.id)
    await supabase.from('exercise_video_candidates')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq('id', candidate.id)
    await supabase.from('exercise_library')
      .update({ video_url: candidate.url, video_source: 'youtube', video_approved_at: new Date().toISOString(), video_approved_by: user?.id })
      .eq('id', candidate.exercise_id)
    await loadExercises()
    setActing(null)
  }

  async function rejectAll(exerciseId: string) {
    setActing(exerciseId)
    await supabase.from('exercise_video_candidates')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq('exercise_id', exerciseId)
      .eq('status', 'proposed')
    await runSingle(exerciseId, true)  // regenerate=true: uses varied queries so results differ
    setActing(null)
  }

  async function pasteCustom(exerciseId: string) {
    const raw = pasteUrls[exerciseId]?.trim()
    if (!raw) return
    const match = raw.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)
    if (!match) { alert('Please paste a valid YouTube URL'); return }
    const isShortUrl = raw.includes('/shorts/')
    const savedUrl = isShortUrl
      ? `https://www.youtube.com/shorts/${match[1]}`
      : `https://www.youtube.com/watch?v=${match[1]}`

    const times = pasteTimes[exerciseId]
    const startSec = times ? parseMMSS(times.start) : null
    const endSec   = times ? parseMMSS(times.end)   : null

    setActing(exerciseId)
    await supabase.from('exercise_library')
      .update({
        video_url: savedUrl,
        video_source: 'custom',
        video_approved_at: new Date().toISOString(),
        video_approved_by: user?.id,
        youtube_start_sec: startSec,
        youtube_end_sec: endSec,
      })
      .eq('id', exerciseId)
    // Supersede candidates so they don't linger or get overwritten by "Approve All"
    await supabase.from('exercise_video_candidates')
      .update({ status: 'superseded' })
      .eq('exercise_id', exerciseId)
      .in('status', ['proposed', 'queued'])
    setPasteUrls(prev => { const n = { ...prev }; delete n[exerciseId]; return n })
    setPasteTimes(prev => { const n = { ...prev }; delete n[exerciseId]; return n })
    await loadExercises()
    setActing(null)
  }

  async function bulkApproveHighScore() {
    // Skip exercises that already have a video_url (manual or previously approved)
    const toApprove = exercises
      .filter(e => !e.video_url)
      .flatMap(e => e.candidates.filter(c => c.status === 'proposed' && c.ai_relevance_score >= 0.85).slice(0, 1))
    if (toApprove.length === 0) { alert('No candidates with score ≥ 0.85 to approve'); return }
    if (!confirm(`Approve ${toApprove.length} exercises with AI score ≥ 0.85?`)) return
    setRunning(true)
    for (const c of toApprove) await approve(c)
    setRunning(false)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total    = exercises.length
  const approved = exercises.filter(e => e.video_url).length
  const pending  = exercises.filter(e => !e.video_url && e.candidates.some(c => c.status === 'proposed')).length
  const noProps  = exercises.filter(e => !e.video_url && e.candidates.filter(c => c.status === 'proposed').length === 0).length

  const filtered = exercises.filter(e => {
    const matchSearch = !search || e.name_display.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    // When searching by name, bypass the tab filter so any exercise is findable
    if (search.trim()) return true
    if (filter === 'approved') return !!e.video_url
    if (filter === 'pending')  return !e.video_url && e.candidates.some(c => c.status === 'proposed')
    return true
  })

  const hasChannels = channels.length > 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Exercise Video Curation</h2>
        <p style={{ fontSize: 13, color: C.textDim }}>AI discovers certified fitness channels, proposes the best video per exercise. You review and approve.</p>
      </div>

      {/* ── Channel Discovery Panel ─────────────────────────────────────────── */}
      <div style={{
        padding: '16px 18px',
        background: C.surface,
        border: `1px solid ${hasChannels ? C.greenBorder : C.amberBorder}`,
        borderRadius: 10,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: hasChannels ? 12 : 0 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: hasChannels ? C.green : C.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
              {channelsLoading ? 'Loading channels…' : hasChannels ? `✓ ${channels.length} Approved Channels` : '⚠ No Channels Configured'}
            </p>
            {!hasChannels && !channelsLoading && (
              <p style={{ fontSize: 12, color: C.textDim }}>
                AI will search YouTube for certified fitness channels with 100K+ subscribers, score them for quality, and auto-populate the list.
              </p>
            )}
          </div>
          <button
            onClick={discoverChannels}
            disabled={discovering}
            style={{
              padding: '8px 18px', borderRadius: 8, border: hasChannels ? `1px solid ${C.border}` : 'none', cursor: discovering ? 'not-allowed' : 'pointer',
              background: discovering ? C.surface2 : hasChannels ? 'transparent' : C.amber,
              color: discovering ? C.textDim : hasChannels ? C.textMid : '#000',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
            {discovering ? '⏳ Discovering…' : hasChannels ? '↺ Re-discover Channels' : '🔍 Auto-Discover Channels'}
          </button>
        </div>

        {/* Channel chips */}
        {hasChannels && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {channels.map(ch => (
              <div key={ch.channel_id} style={{
                padding: '4px 10px', borderRadius: 20,
                background: C.greenDim, border: `1px solid ${C.greenBorder}`,
                fontSize: 11, color: C.green, fontWeight: 600,
              }}>
                {ch.channel_name}
                {ch.audience_focus && (
                  <span style={{ color: C.textDim, fontWeight: 400, marginLeft: 4 }}>· {ch.audience_focus.split(',')[0].trim()}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Discovery log */}
        {discoverLog.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, maxHeight: 180, overflowY: 'auto' }}>
            {discoverLog.map((l, i) => (
              <p key={i} style={{ fontSize: 11, color: i === 0 ? C.green : C.textMid, fontFamily: 'monospace', lineHeight: 1.7 }}>{l}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Exercises', value: total,    color: C.text },
          { label: 'Approved',        value: approved, color: C.green },
          { label: 'Pending Review',  value: pending,  color: C.amber },
          { label: 'No Proposals',    value: noProps,  color: C.textDim },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9 }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</p>
            <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</p>
          </div>
        ))}
      </div>


      {/* ── Priority Lanes ──────────────────────────────────────────────────── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Curation Queue — Priority Lanes</p>
            <p style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Run specific lanes to stay organized. Program exercises run first.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textMid }}>Batch:</span>
            <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
              style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12 }}>
              {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={bulkApproveHighScore} disabled={running || !!runningLane}
              style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.greenBorder}`, background: C.greenDim, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              ✓ Approve All ≥ 0.85
            </button>
          </div>
        </div>

        {!hasChannels && !channelsLoading ? (
          <div style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 12, color: C.amber }}>⚠ Auto-Discover Channels first — the pipeline needs approved channels.</p>
          </div>
        ) : (
          <div>
            {/* Lane rows */}
            {[
              // User plans lane
              {
                id: 'plans',
                label: '🔴 User Plans Queue',
                desc: 'Exercises from generated training plans — highest priority',
                count: planQueueIds.filter(id => !exercises.find(e => e.id === id)?.video_url).length,
                ids: planQueueIds,
                borderColor: 'rgba(239,68,68,0.25)',
                labelColor: C.red,
              },
              // One row per seeded program
              ...programLanes.map(lane => ({
                id: `program:${lane.name}`,
                label: `🔵 ${lane.name}`,
                desc: `Seeded program — ${lane.pendingCount} exercises need videos`,
                count: lane.pendingCount,
                ids: lane.exerciseIds,
                borderColor: C.accentBorder,
                labelColor: C.accent,
              })),
              // Backlog lane
              {
                id: 'backlog',
                label: '⬜ Full Library Backlog',
                desc: 'All remaining exercises without videos (alphabetical)',
                count: exercises.filter(e => !e.video_url && !e.candidates.some(c => c.status === 'proposed') && !queuedIds.has(e.id)).length,
                ids: [] as string[],
                borderColor: C.border,
                labelColor: C.textDim,
              },
            ].map(lane => (
              <div key={lane.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{lane.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                      background: `${lane.labelColor}18`, color: lane.labelColor,
                      border: `1px solid ${lane.borderColor}`,
                    }}>
                      {lane.count} pending
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: C.textDim }}>{lane.desc}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {[10, 25].map(n => (
                    <button
                      key={n}
                      onClick={() => runLane(lane.id, lane.ids, n)}
                      disabled={running || !!runningLane || !hasChannels || lane.count === 0}
                      style={{
                        padding: '6px 14px', borderRadius: 7, border: `1px solid ${lane.borderColor}`,
                        background: runningLane === lane.id ? C.surface2 : `${lane.labelColor}12`,
                        color: (running || !!runningLane || lane.count === 0) ? C.textDim : lane.labelColor,
                        fontSize: 12, fontWeight: 700, cursor: (running || !!runningLane || lane.count === 0) ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      {runningLane === lane.id ? '⏳…' : `▶ Run ${n}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Run log */}
            {runLog.length > 0 && (
              <div style={{ padding: '12px 18px', background: C.bg, borderTop: `1px solid ${C.border}`, maxHeight: 160, overflowY: 'auto' }}>
                {runLog.map((l, i) => <p key={i} style={{ fontSize: 11, color: i === 0 ? C.green : C.textMid, fontFamily: 'monospace', lineHeight: 1.7 }}>{l}</p>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Quick Search — find any exercise and run curation on it directly
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search any exercise… e.g. "Chest Press", "Squat"'
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 7, border: `1px solid ${search ? C.accentBorder : C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        {(['pending', 'approved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${filter === f ? C.accentBorder : C.border}`, background: filter === f ? C.accentDim : 'transparent', color: filter === f ? C.accent : C.textDim, fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit' }}>
            {f === 'pending' ? `Pending (${pending})` : f === 'approved' ? `Approved (${approved})` : `All (${total})`}
          </button>
        ))}
        </div>
      </div>

      {/* ── Exercise list ────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: '40px 0' }}>Loading exercises…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.textDim, border: `2px dashed ${C.border}`, borderRadius: 10 }}>
          <p style={{ fontSize: 14 }}>No exercises match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(ex => {
            const proposed = ex.candidates.filter(c => c.status === 'proposed')
            const isActing = acting === ex.id || proposed.some(c => acting === c.id)
            return (
              <div key={ex.id} style={{ background: C.surface, border: `1px solid ${ex.video_url ? C.greenBorder : C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* Exercise header */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: proposed.length > 0 || ex.video_url ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ex.name_display}</span>
                    {ex.video_url && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: C.greenDim, color: C.green, border: `1px solid ${C.greenBorder}` }}>
                        {ex.video_source === 'custom' ? 'CUSTOM' : 'APPROVED'}
                      </span>
                    )}
                    {!ex.video_url && proposed.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: C.amberDim, color: C.amber, border: `1px solid ${C.amberBorder}` }}>
                        {proposed.length} PROPOSED
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {ex.video_url && (
                      <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.greenBorder}`, background: C.greenDim, color: C.green, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                        ▶ View
                      </a>
                    )}
                    {!ex.video_url && proposed.length === 0 && (
                      <button onClick={() => runSingle(ex.id)} disabled={isActing || !hasChannels}
                        style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 11, cursor: isActing || !hasChannels ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {isActing ? '…' : '+ Get Suggestions'}
                      </button>
                    )}
                    {!ex.video_url && proposed.length > 0 && (
                      <button onClick={() => rejectAll(ex.id)} disabled={isActing}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: C.red, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {isActing ? '…' : '↺ Regenerate'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Candidate cards */}
                {proposed.length > 0 && (
                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {proposed.map(c => (
                      <div key={c.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
                        <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative' }}>
                          {c.thumbnail_url
                            ? <img src={c.thumbnail_url} alt={c.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', aspectRatio: '16/9', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: C.textDim, fontSize: 24 }}>▶</span>
                              </div>
                          }
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                            <span style={{ fontSize: 32, color: '#fff' }}>▶</span>
                          </div>
                        </a>
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor(c.ai_relevance_score), fontFamily: 'monospace' }}>
                              {Math.round(c.ai_relevance_score * 100)}% match
                            </span>
                            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>
                              {fmtViews(c.view_count)} views · {fmtDuration(c.duration_seconds)}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {c.title}
                          </p>
                          <p style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>{c.channel_title}</p>
                          <p style={{ fontSize: 11, color: C.textMid, lineHeight: 1.5, marginBottom: 10, fontStyle: 'italic' }}>"{c.ai_reasoning}"</p>
                          <button onClick={() => approve(c)} disabled={!!acting}
                            style={{ width: '100%', padding: '8px', borderRadius: 7, border: 'none', background: acting ? C.surface : C.green, color: acting ? C.textDim : '#fff', fontSize: 12, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            {acting === c.id ? 'Approving…' : '✓ Approve This One'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paste custom URL + clip trimming */}
                {!ex.video_url && (() => {
                  const rawUrl = pasteUrls[ex.id] ?? ''
                  const videoId = rawUrl ? extractYouTubeId(rawUrl) : null
                  const times = pasteTimes[ex.id] ?? { start: '', end: '' }
                  const startSec = parseMMSS(times.start)
                  const endSec = parseMMSS(times.end)
                  const embedSrc = videoId ? buildClipEmbedUrl(rawUrl, startSec, endSec) : ''
                  const hasClip = startSec != null || endSec != null
                  return (
                    <div style={{ padding: '12px 16px', borderTop: proposed.length > 0 ? `1px solid ${C.border}` : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 0 }}>
                        Paste a YouTube URL manually
                      </p>

                      {/* URL input */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={rawUrl}
                          onChange={e => setPasteUrls(prev => ({ ...prev, [ex.id]: e.target.value }))}
                          placeholder="https://www.youtube.com/watch?v=… or /shorts/…"
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: `1px solid ${videoId ? C.accentBorder : C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                        />
                        <button
                          onClick={() => pasteCustom(ex.id)}
                          disabled={!rawUrl.trim() || !!acting}
                          style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 700, cursor: !rawUrl.trim() || !!acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          {acting === ex.id ? '…' : 'Save'}
                        </button>
                      </div>

                      {/* Clip trimming — appears once a valid URL is pasted */}
                      {videoId && (
                        <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,0.06)', border: `1px solid ${C.accentBorder}`, borderRadius: 9 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>✂️ Clip Trimming</span>
                            <span style={{ fontSize: 11, color: C.textDim }}>— optional, leave blank to use the full video</span>
                          </div>

                          {/* How to use */}
                          <div style={{ padding: '8px 10px', background: C.bg, borderRadius: 7, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[
                              ['How to use', 'Enter start and end times in M:SS format (e.g. 1:30 for 1 minute 30 seconds)'],
                              ['Example', 'A 20-min video → Start: 2:00 · End: 3:15 → only that 75-second segment plays'],
                              ['Shorts', 'Clip trimming works on Shorts too — useful for looping a specific move'],
                            ].map(([label, val]) => (
                              <div key={label} style={{ display: 'flex', gap: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, minWidth: 60, flexShrink: 0 }}>{label}</span>
                                <span style={{ fontSize: 10, color: C.textMid }}>{val}</span>
                              </div>
                            ))}
                          </div>

                          {/* Time inputs */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: embedSrc ? 10 : 0 }}>
                            {[
                              { key: 'start', label: 'Start Time', placeholder: '0:00  (beginning)' },
                              { key: 'end',   label: 'End Time',   placeholder: '1:30  (leave blank = play to end)' },
                            ].map(({ key, label, placeholder }) => (
                              <div key={key}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
                                <input
                                  value={key === 'start' ? times.start : times.end}
                                  onChange={e => setPasteTimes(prev => ({
                                    ...prev,
                                    [ex.id]: { ...prev[ex.id] ?? { start: '', end: '' }, [key]: e.target.value },
                                  }))}
                                  placeholder={placeholder}
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                            ))}
                          </div>

                          {/* Live preview */}
                          {embedSrc && (
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                                Live Preview {hasClip ? `(${secondsToMMSS(startSec) || '0:00'} → ${secondsToMMSS(endSec) || 'end'})` : ''}
                              </p>
                              <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                                  <iframe
                                    key={embedSrc}
                                    src={embedSrc}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              </div>
                              {hasClip && (
                                <p style={{ fontSize: 10, color: C.accent, marginTop: 6, fontWeight: 600 }}>
                                  ✂️ Clip saved: will play from {secondsToMMSS(startSec) || '0:00'} to {secondsToMMSS(endSec) || 'end'} in the app
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
