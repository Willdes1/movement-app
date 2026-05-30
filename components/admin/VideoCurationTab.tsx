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

export default function VideoCurationTab() {
  const { user } = useAuth()

  // ── Channel state ──────────────────────────────────────────────────────────
  const [channels, setChannels]           = useState<Channel[]>([])
  const [channelsLoading, setChLoading]   = useState(true)
  const [discovering, setDiscovering]     = useState(false)
  const [discoverLog, setDiscoverLog]     = useState<string[]>([])

  // ── Priority queue (from client plan generation) ───────────────────────────
  const [queuedIds, setQueuedIds]         = useState<Set<string>>(new Set())

  // ── Exercise / candidate state ─────────────────────────────────────────────
  const [exercises, setExercises]   = useState<Exercise[]>([])
  const [loading, setLoading]       = useState(true)
  const [running, setRunning]       = useState(false)
  const [runLog, setRunLog]         = useState<string[]>([])
  const [filter, setFilter]         = useState<'pending' | 'approved' | 'all'>('pending')
  const [search, setSearch]         = useState('')
  const [batchSize, setBatchSize]   = useState(10)
  const [pasteUrls, setPasteUrls]   = useState<Record<string, string>>({})
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

    // Collect queued exercise IDs (from client plan generation)
    const { data: queued } = await supabase
      .from('exercise_video_candidates')
      .select('exercise_id')
      .eq('status', 'queued')
    setQueuedIds(new Set((queued ?? []).map(r => r.exercise_id)))

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
    const isShort = raw.includes('/shorts/')
    const savedUrl = isShort
      ? `https://www.youtube.com/shorts/${match[1]}`
      : `https://www.youtube.com/watch?v=${match[1]}`
    setActing(exerciseId)
    await supabase.from('exercise_library')
      .update({ video_url: savedUrl, video_source: 'custom', video_approved_at: new Date().toISOString(), video_approved_by: user?.id })
      .eq('id', exerciseId)
    setPasteUrls(prev => { const n = { ...prev }; delete n[exerciseId]; return n })
    await loadExercises()
    setActing(null)
  }

  async function bulkApproveHighScore() {
    const toApprove = exercises.flatMap(e =>
      e.candidates.filter(c => c.status === 'proposed' && c.ai_relevance_score >= 0.85).slice(0, 1)
    )
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

      {/* ── Priority Queue (from client plan generation) ───────────────────── */}
      {queuedIds.size > 0 && (
        <div style={{ padding: '14px 18px', background: C.surface, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.red, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                🔴 Priority — {queuedIds.size} {queuedIds.size === 1 ? 'Exercise' : 'Exercises'} From Client Plans
              </p>
              <p style={{ fontSize: 11, color: C.textDim }}>A client generated a plan with these exercises but no videos are assigned yet. Find videos first.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exercises.filter(e => queuedIds.has(e.id) && !e.video_url).map(ex => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ex.name_display}</span>
                <button
                  onClick={() => runSingle(ex.id)}
                  disabled={acting === ex.id || !hasChannels}
                  style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: acting === ex.id ? C.surface2 : C.red, color: acting === ex.id ? C.textDim : '#fff', fontSize: 11, fontWeight: 700, cursor: acting === ex.id || !hasChannels ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {acting === ex.id ? '…' : '▶ Find Videos'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pipeline controls ───────────────────────────────────────────────── */}
      <div style={{ padding: '16px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Run Pipeline</p>

        {!hasChannels && !channelsLoading ? (
          <p style={{ fontSize: 12, color: C.amber }}>⚠ Auto-Discover Channels first — the pipeline needs approved channels to search.</p>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.textMid }}>Batch size:</span>
              <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }}>
                {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n} exercises</option>)}
              </select>
            </div>
            <button onClick={runPipeline} disabled={running || !hasChannels}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: running || !hasChannels ? C.surface2 : C.accent, color: running || !hasChannels ? C.textDim : '#fff', fontSize: 13, fontWeight: 700, cursor: running || !hasChannels ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {running ? '⏳ Running…' : '▶ Run Curation'}
            </button>
            <button onClick={bulkApproveHighScore} disabled={running || !hasChannels}
              style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.greenBorder}`, background: C.greenDim, color: C.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✓ Approve All ≥ 0.85
            </button>
          </div>
        )}

        {runLog.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, maxHeight: 160, overflowY: 'auto' }}>
            {runLog.map((l, i) => <p key={i} style={{ fontSize: 11, color: C.textMid, fontFamily: 'monospace', lineHeight: 1.7 }}>{l}</p>)}
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

                {/* Paste custom URL */}
                {!ex.video_url && (
                  <div style={{ padding: '10px 16px', borderTop: proposed.length > 0 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 8 }}>
                    <input
                      value={pasteUrls[ex.id] ?? ''}
                      onChange={e => setPasteUrls(prev => ({ ...prev, [ex.id]: e.target.value }))}
                      placeholder="Or paste a YouTube URL…"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button onClick={() => pasteCustom(ex.id)} disabled={!pasteUrls[ex.id]?.trim() || !!acting}
                      style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
