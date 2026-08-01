'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import YouTubeLoopTrimmer from './YouTubeLoopTrimmer'
import InstructionCuratePanel from './InstructionCuratePanel'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)', greenBorder: 'rgba(34,197,94,0.25)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)', amberBorder: 'rgba(245,158,11,0.25)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

// PostgREST caps an unbounded select at 1,000 rows. exercise_library is past
// 2,000, so a plain .select() silently returned a slice: this tab reported
// exactly 1000 total exercises and could not see the rest of the library at all.
const PAGE_ROWS = 1000
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await build(from, from + PAGE_ROWS - 1)
    if (error) return { data: out, error }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE_ROWS) break
  }
  return { data: out, error: null }
}

// A paid search fallback must never be invisible, so the run log states per
// exercise whether the match came from the free cache or cost 100 units.
type CurationResult = {
  exercise: string; status: string; candidates?: number; error?: string
  usedFallback?: boolean; matchScore?: number; source?: string
}

function fmtResult(r: CurationResult): string {
  const icon = r.status === 'proposed' ? '✓' : r.status === 'fallback_capped' ? '⏸' : r.status === 'no_results' ? '○' : '⚠'
  const cost = r.usedFallback ? ' · 💸 search fallback (100 units)' : r.status === 'proposed' ? ' · 🆓 local cache' : ''
  const score = typeof r.matchScore === 'number' ? ` · match ${r.matchScore.toFixed(2)}` : ''
  const detail = r.candidates ? `${r.candidates} candidates` : `${r.status}${r.error ? ` ${r.error}` : ''}`
  return `${icon} ${r.exercise} — ${detail}${score}${cost}`
}

function summarise(results: CurationResult[]): string[] {
  const paid = results.filter(r => r.usedFallback).length
  const free = results.filter(r => r.status === 'proposed' && !r.usedFallback).length
  const capped = results.filter(r => r.status === 'fallback_capped').length
  const units = paid * 100 + Math.ceil(results.length / 50)
  return [
    `   ${free} from cache (0 units) · ${paid} paid searches (${paid * 100} units) · ${capped} deferred to tomorrow`,
    `   ≈ ${units} units this run, vs ${results.length * 201} on the old pipeline`,
  ]
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
  // Shown beside the candidates so a video can be judged against what the
  // exercise actually says, instead of on its title alone.
  how?: string | null; breathing?: string | null; tip?: string | null
  video_url: string | null; video_source: string | null
  loop_start_sec?: number | null; loop_end_sec?: number | null
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

  // ── Uploads-index build estimate (Task 1, read-only, costs 1 unit per 50 channels)
  type IndexEstimate = {
    channels_active: number; channels_resolved: number; unresolved: string[]
    total_videos: number; one_time_build_units: number
    daily_refresh_units_estimate: number; units_spent_on_this_estimate: number
    percent_of_daily_quota: number
    per_channel: { channel_name: string; video_count: number; build_units: number; resolved: boolean }[]
    error?: string
  }
  const [estimating, setEstimating]       = useState(false)
  const [estimate, setEstimate]           = useState<IndexEstimate | null>(null)
  const [indexing, setIndexing]           = useState(false)
  const [indexLog, setIndexLog]           = useState<string[]>([])
  const [handleInput, setHandleInput]     = useState('')

  // ── Live quota meter (Task 1 item 4) ───────────────────────────────────────
  type Quota = {
    daily_quota: number; used: number; remaining: number; used_pct: number
    by_endpoint: { endpoint: string; calls: number; units: number }[]
    fallback_calls_today: number; videos_remaining_via_fallback: number
    hours_until_reset: number; failures_today: number
  }
  const [quota, setQuota] = useState<Quota | null>(null)

  async function loadQuota() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res: Response = await fetch('/api/admin/youtube-quota', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const d = await res.json()
      if (!d.error) setQuota(d as Quota)
    } catch { /* meter is informational; never break the tab */ }
  }
  useEffect(() => { loadQuota() }, [])

  // ── Matching dry run (zero YouTube quota; picks the confidence threshold)
  type DryRun = {
    sampled: number; zero_candidates: number; timed_out?: boolean
    backlog?: {
      total_uncurated: number; fitness: number; trick: number; trick_pct: number
      trick_by_source: [string, number][]
      trick_examples: { name: string; why: string[]; confidence: number }[]
      fitness_examples: string[]
    }
    percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
    histogram: { bucket: string; count: number }[]
    tradeoff: { threshold: number; matched_locally: number; needs_fallback: number; local_rate_pct: number; projected_fallback_backlog: number }[]
    examples: Record<string, { exercise: string; score: number; matched: string | null; why: string[] }[]>
    error?: string
  }
  const [dryRunning, setDryRunning]       = useState(false)
  const [dryRun, setDryRun]               = useState<DryRun | null>(null)

  // ── Priority queue (from client plan generation) ───────────────────────────
  const [queuedIds, setQueuedIds]         = useState<Set<string>>(new Set())
  const [programExerciseIds, setProgramExerciseIds] = useState<Set<string>>(new Set())

  // ── Program lanes ──────────────────────────────────────────────────────────
  type ProgramLane = { programId: string; name: string; exerciseIds: string[]; pendingCount: number; needsCurationCount: number }
  type ProgramDetailEx = { id: string; name_display: string; video_url: string | null; candidates: Candidate[] }
  type ProgramDetail = { name: string; exercises: ProgramDetailEx[]; total: number; withVideo: number }
  const [programLanes, setProgramLanes]   = useState<ProgramLane[]>([])
  const [programDetails, setProgramDetails] = useState<ProgramDetail[]>([])
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set())
  const [planQueueIds, setPlanQueueIds]   = useState<string[]>([])

  // ── Exercise / candidate state ─────────────────────────────────────────────
  const [exercises, setExercises]   = useState<Exercise[]>([])
  const [loading, setLoading]       = useState(true)
  const [running, setRunning]       = useState(false)
  const [runLog, setRunLog]         = useState<string[]>([])
  const [runningLane, setRunningLane] = useState<string | null>(null)
  const [filter, setFilter]         = useState<'pending' | 'approved' | 'all'>('pending')
  /**
   * Rows you have just acted on stay visible even when they no longer match the
   * filter. Approving or pasting a URL sets video_url, which immediately fails
   * the "pending" predicate, so the row used to vanish the instant you finished
   * with it. Keeping it in place means you can confirm the result, and trim it,
   * without hunting through filters. Cleared on refresh or filter change.
   */
  const [justActed, setJustActed]   = useState<Set<string>>(new Set())
  /** Per-exercise toggle for the written coaching instructions. */
  const [showCues, setShowCues]     = useState<Set<string>>(new Set())
  const keepVisible = (id: string) => setJustActed(prev => new Set(prev).add(id))
  const [search, setSearch]         = useState('')
  const [batchSize, setBatchSize]   = useState(10)
  const [pasteUrls, setPasteUrls]   = useState<Record<string, string>>({})
  const [pasteTimes, setPasteTimes] = useState<Record<string, { start: string; end: string }>>({})
  const [acting, setActing]         = useState<string | null>(null)
  const [editingApproved, setEditingApproved] = useState<Set<string>>(new Set())

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
    // This route fires 5 search.list calls at 100 units each. It is also what
    // produced the six mangled channel ids that had to be repaired by hand.
    // Adding channels by handle costs 1 unit and is exact, so this path now
    // has to be confirmed with its price on the label.
    const ok = window.confirm(
      'Re-discover costs about 500 quota units (5% of the daily budget) and often returns nothing.\n\n' +
      'Adding channels by handle costs 1 unit each and is exact. Use the "Add channels by handle" box instead.\n\n' +
      'Run the expensive discovery anyway?'
    )
    if (!ok) return
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

  // Read-only. Costs 1 quota unit per 50 approved channels and writes nothing.
  async function estimateIndexBuild() {
    setEstimating(true)
    setEstimate(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/youtube-index-estimate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const data = await res.json()
      setEstimate(data)
    } catch (err) {
      setEstimate({ error: err instanceof Error ? err.message : 'Estimate failed' } as IndexEstimate)
    }
    setEstimating(false)
  }

  // Fills or refreshes the cached uploads index. The route is time-budgeted and
  // hands back a resume point, so this loops until it reports done.
  type IndexRunResult = {
    done?: boolean; quota_exhausted?: boolean
    units_spent?: number; videos_upserted?: number; pruned?: number
    cached_total?: number | null; errors?: string[]
    resume?: { channelId: string; pageToken: string } | null
    error?: string
  }
  async function runIndex(mode: 'build' | 'refresh') {
    setIndexing(true)
    setIndexLog([mode === 'build' ? 'Building uploads index…' : 'Refreshing uploads index…'])
    let resumeChannelId: string | null = null
    let resumePageToken: string | null = null
    let units = 0, videos = 0, pruned = 0

    // Safety cap: a full build of ~6,300 videos is ~127 pages, and each round
    // fits many pages, so this can never be the binding limit in practice.
    for (let round = 0; round < 60; round++) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res: Response = await fetch('/api/admin/youtube-index', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, resumeChannelId, resumePageToken }),
        })
        const d: IndexRunResult = await res.json()
        if (d.error) { setIndexLog(p => [...p, `Error: ${d.error}`]); break }

        units  += d.units_spent ?? 0
        videos += d.videos_upserted ?? 0
        pruned += d.pruned ?? 0
        setIndexLog(p => [...p, `  round ${round + 1}: +${d.videos_upserted} videos · ${d.units_spent} units · ${d.cached_total ?? '?'} cached total`])
        for (const e of (d.errors ?? [])) setIndexLog(p => [...p, `  ⚠ ${e}`])

        if (d.quota_exhausted) { setIndexLog(p => [...p, '⛔ Daily quota exhausted. Resume after the midnight PT reset.']); break }
        if (d.done) {
          setIndexLog(p => [...p, `✓ Done — ${videos} videos cached · ${units} units spent${pruned ? ` · ${pruned} pruned` : ''}`])
          break
        }
        resumeChannelId = d.resume?.channelId ?? null
        resumePageToken = d.resume?.pageToken || null
      } catch (err) {
        setIndexLog(p => [...p, `Error: ${err instanceof Error ? err.message : 'index run failed'}`])
        break
      }
    }
    setIndexing(false)
  }

  // Cheap first: handle lookups at 1 unit each. No search.list unless asked.
  async function repairChannels() {
    setIndexing(true)
    setIndexLog(['Checking which channel ids still resolve…'])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res: Response = await fetch('/api/admin/youtube-repair-channels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowSearch: false }),
      })
      const d = await res.json()
      if (d.error) { setIndexLog(p => [...p, `Error: ${d.error}`]); setIndexing(false); return }
      setIndexLog(p => [...p, `${d.broken} broken · ${d.units_spent} units spent`])
      for (const r of (d.repaired ?? [])) {
        setIndexLog(p => [...p, `  ✓ ${r.name}: ${r.old_id} → ${r.new_id} (${r.via})`])
      }
      for (const s of (d.still_broken ?? [])) {
        setIndexLog(p => [...p, `  ✗ ${s.name}: tried ${s.tried.join(', ')}`])
      }
      if (d.next_step) setIndexLog(p => [...p, `→ ${d.next_step}`])
      await loadChannels()
    } catch (err) {
      setIndexLog(p => [...p, `Error: ${err instanceof Error ? err.message : 'repair failed'}`])
    }
    setIndexing(false)
  }

  // 1 unit per handle. The cheap way to widen coverage: index more of YouTube
  // rather than searching it.
  async function addChannels() {
    if (!handleInput.trim()) return
    setIndexing(true)
    setIndexLog(['Resolving handles…'])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res: Response = await fetch('/api/admin/youtube-add-channels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ handles: handleInput }),
      })
      const d = await res.json()
      if (d.error) { setIndexLog(p => [...p, `Error: ${d.error}`]); setIndexing(false); return }
      setIndexLog(p => [...p, `${d.added?.length ?? 0} added · ${d.units_spent} units spent`])
      for (const a of (d.added ?? [])) {
        setIndexLog(p => [...p, `  ✓ ${a.name} — ${a.videos.toLocaleString()} videos · ${a.index_units} units to index`])
      }
      for (const s of (d.skipped ?? [])) {
        setIndexLog(p => [...p, `  ✗ @${s.handle}: ${s.reason}`])
      }
      if (d.estimated_index_units) {
        setIndexLog(p => [...p, `→ ${d.new_videos_available?.toLocaleString()} new videos for ~${d.estimated_index_units} units (${d.estimated_index_pct_of_day}% of a day). Run Build index.`])
      }
      setHandleInput('')
      await loadChannels()
    } catch (err) {
      setIndexLog(p => [...p, `Error: ${err instanceof Error ? err.message : 'add failed'}`])
    }
    setIndexing(false)
  }

  async function runDryRun() {
    setDryRunning(true)
    setDryRun(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res: Response = await fetch('/api/admin/youtube-match-dryrun', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSize: 300 }),
      })
      setDryRun(await res.json() as DryRun)
    } catch (err) {
      setDryRun({ error: err instanceof Error ? err.message : 'Dry run failed' } as DryRun)
    }
    setDryRunning(false)
  }

  // ── Exercise helpers ───────────────────────────────────────────────────────
  /**
   * `silent` refreshes the data WITHOUT blanking the list.
   *
   * Every action called this with the loading flag set, which replaced the
   * whole list with a one-line "Loading exercises…" paragraph. The page
   * collapsed to almost nothing, the browser pinned scroll to the top, and
   * when the list came back you were somewhere else entirely. That is the
   * jumping.
   */
  async function loadExercises(silent = false) {
    if (!silent) setLoading(true)
    // Loop columns (loop_start_sec/loop_end_sec) may not exist yet if the migration
    // hasn't been run — fall back to a select without them so the tab still loads.
    let exList: Omit<Exercise, 'candidates'>[] | null = null
    const withLoop = await fetchAllRows((f, t) => supabase
      .from('exercise_library')
      .select('id, name_display, name_normalized, video_url, video_source, loop_start_sec, loop_end_sec, how, breathing, tip')
      .order('name_display')
      .range(f, t))
    if (withLoop.error) {
      const fallback = await fetchAllRows((f, t) => supabase
        .from('exercise_library')
        .select('id, name_display, name_normalized, video_url, video_source, how, breathing, tip')
        .order('name_display')
        .range(f, t))
      exList = (fallback.data ?? []) as unknown as Omit<Exercise, 'candidates'>[]
    } else {
      exList = (withLoop.data ?? []) as unknown as Omit<Exercise, 'candidates'>[]
    }

    // Collect ALL queued entries with source_label.
    // Try selecting source_label; if the column doesn't exist yet (migration not run),
    // fall back to a query without it so lanes still render with 0 program entries.
    let queuedRows: { exercise_id: string; source_label: string | null }[] | null = null
    const { data: qr, error: qrErr } = await fetchAllRows((f, t) => supabase
      .from('exercise_video_candidates')
      .select('exercise_id, source_label')
      .eq('status', 'queued')
      .order('exercise_id')
      .range(f, t))
    if (!qrErr) {
      queuedRows = qr as { exercise_id: string; source_label: string | null }[]
    } else {
      // Column likely doesn't exist yet — fall back without source_label
      const { data: qrFallback } = await fetchAllRows<{ exercise_id: string }>((f, t) => supabase
        .from('exercise_video_candidates')
        .select('exercise_id')
        .eq('status', 'queued')
        .order('exercise_id')
        .range(f, t))
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
    const { data: programExercises } = await fetchAllRows((f, t) => supabase
      .from('exercise_library')
      .select('id, name_display, source_program, video_url')
      .not('source_program', 'is', null)
      .order('name_display')
      .range(f, t))

    // Group by program name
    const progMap: Record<string, { id: string; name_display: string; video_url: string | null }[]> = {}
    for (const ex of (programExercises ?? []) as { id: string; name_display: string; source_program: string; video_url: string | null }[]) {
      // Collapse every Library Builder seed (source_program 'seed:<category>') into
      // ONE "Library Builder" lane — no per-sport lane clutter. Coach programs keep
      // their own named lanes.
      const laneKey = ex.source_program.startsWith('seed:') ? 'Library Builder' : ex.source_program
      if (!progMap[laneKey]) progMap[laneKey] = []
      progMap[laneKey].push(ex)
    }
    // Program-lane exercise IDs — excluded from the Full Library Backlog so the
    // lanes are a clean partition (no exercise counted in two lanes).
    setProgramExerciseIds(new Set((programExercises ?? []).map((e: { id: string }) => e.id)))

    const { data: cands } = await fetchAllRows<Candidate>((f, t) => supabase
      .from('exercise_video_candidates')
      .select('*')
      .in('status', ['proposed', 'approved'])
      .order('ai_relevance_score', { ascending: false })
      .order('id')
      .range(f, t))

    const candMap: Record<string, Candidate[]> = {}
    for (const c of (cands ?? [])) {
      if (!candMap[c.exercise_id]) candMap[c.exercise_id] = []
      candMap[c.exercise_id].push(c as Candidate)
    }

    // Build lanes here so we can check candMap for already-proposed exercises
    const lanes: ProgramLane[] = Object.entries(progMap).map(([name, exs]) => {
      const pending = exs.filter(e => !e.video_url)
      const needsCuration = pending.filter(e => !(candMap[e.id] ?? []).some(c => c.status === 'proposed'))
      return {
        programId: name,
        name,
        exerciseIds: needsCuration.map(e => e.id),
        pendingCount: pending.length,
        needsCurationCount: needsCuration.length,
      }
    }).filter(l => l.pendingCount > 0)
    setProgramLanes(lanes)

    const details: ProgramDetail[] = Object.entries(progMap).map(([name, exs]) => ({
      name,
      exercises: exs.map(e => ({
        id: e.id,
        name_display: e.name_display,
        video_url: e.video_url,
        candidates: candMap[e.id] ?? [],
      })),
      total: exs.length,
      withVideo: exs.filter(e => e.video_url).length,
    }))
    setProgramDetails(details)

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
      const lines = (data.results ?? []).map(fmtResult)
      setRunLog([`Done — ${data.processed} exercises processed`, ...summarise(data.results ?? []), ...lines])
      await loadExercises(true)
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
      const lines = (data.results ?? []).map(fmtResult)
      setRunLog([`Done — ${data.processed} processed`, ...summarise(data.results ?? []), ...lines])
      await loadExercises(true)
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
      await loadExercises(true)
    } catch { /* ignore */ }
    setActing(null)
  }

  async function approve(candidate: Candidate) {
    setActing(candidate.id)
    keepVisible(candidate.exercise_id)
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
    await loadExercises(true)
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
    keepVisible(exerciseId)
    await loadExercises(true)
    setActing(null)
  }

  async function saveLoop(exerciseId: string, startSec: number, endSec: number) {
    setActing(exerciseId)
    const { error } = await supabase.from('exercise_library')
      .update({ loop_start_sec: startSec, loop_end_sec: endSec })
      .eq('id', exerciseId)
    if (error) alert(`Could not save loop — make sure the loop columns migration has been run in Supabase.\n\n${error.message}`)
    await loadExercises(true)
    setActing(null)
  }

  async function clearLoop(exerciseId: string) {
    setActing(exerciseId)
    await supabase.from('exercise_library')
      .update({ loop_start_sec: null, loop_end_sec: null })
      .eq('id', exerciseId)
    await loadExercises(true)
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

  async function regenerateApproved(exerciseId: string) {
    setActing(exerciseId)
    await supabase.from('exercise_library')
      .update({ video_url: null, video_source: null, youtube_start_sec: null, youtube_end_sec: null, video_approved_at: null, video_approved_by: null })
      .eq('id', exerciseId)
    await supabase.from('exercise_video_candidates')
      .update({ status: 'superseded' })
      .eq('exercise_id', exerciseId)
    try {
      await fetch('/api/admin/curate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId, regenerate: true }),
      })
    } catch { /* ignore */ }
    setEditingApproved(prev => { const n = new Set(prev); n.delete(exerciseId); return n })
    await loadExercises(true)
    setActing(null)
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
    // Keep whatever you just finished with in place rather than yanking it away.
    if (justActed.has(e.id)) return true
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

      {/* Self-hiding bulk instruction curation (vanishes at 100%) */}
      <InstructionCuratePanel />

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
            {discovering ? '⏳ Discovering…' : hasChannels ? '↺ Re-discover (~500 units)' : '🔍 Auto-Discover (~500 units)'}
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

      {/* ── Live quota meter ─────────────────────────────────────────────────── */}
      {quota && (
        <div style={{ padding: '14px 18px', background: C.surface, border: `1px solid ${quota.used_pct > 80 ? C.red : quota.used_pct > 50 ? C.amberBorder : C.border}`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              YouTube quota today
            </p>
            <button onClick={loadQuota} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>
          <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${Math.min(100, quota.used_pct)}%`, height: '100%', background: quota.used_pct > 80 ? C.red : quota.used_pct > 50 ? C.amber : C.green }} />
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{quota.used.toLocaleString()}<span style={{ fontSize: 12, color: C.textDim }}> / {quota.daily_quota.toLocaleString()}</span></p>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>units used ({quota.used_pct}%)</p>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{quota.remaining.toLocaleString()}</p>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>remaining</p>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.textMid }}>~{quota.videos_remaining_via_fallback}</p>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>more paid searches</p>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{quota.fallback_calls_today}</p>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>fallbacks fired</p>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.textMid }}>{quota.hours_until_reset}h</p>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>to reset (midnight PT)</p>
            </div>
          </div>
          {quota.by_endpoint?.length > 0 && (
            <p style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', marginTop: 8 }}>
              {quota.by_endpoint.map(e => `${e.endpoint}: ${e.calls} calls / ${e.units} units`).join('  ·  ')}
              {quota.failures_today ? `  ·  ${quota.failures_today} failed` : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Uploads index build estimate (Task 1) ───────────────────────────── */}
      {hasChannels && (
        <div style={{ padding: '16px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                Uploads index build cost
              </p>
              <p style={{ fontSize: 12, color: C.textDim }}>
                Read-only check. Costs 1 quota unit per 50 channels and writes nothing.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={estimateIndexBuild}
                disabled={estimating || indexing}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.border}`,
                  cursor: (estimating || indexing) ? 'not-allowed' : 'pointer',
                  background: estimating ? C.surface2 : 'transparent',
                  color: estimating ? C.textDim : C.textMid,
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                {estimating ? '⏳ Checking…' : '📐 Estimate index build'}
              </button>
              <button
                onClick={() => runIndex('refresh')}
                disabled={estimating || indexing}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.border}`,
                  cursor: (estimating || indexing) ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: C.textMid,
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                ↻ Refresh index
              </button>
              <button
                onClick={repairChannels}
                disabled={estimating || indexing}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.amberBorder}`,
                  cursor: (estimating || indexing) ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: C.amber,
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                🔧 Repair channel IDs
              </button>
              <button
                onClick={() => runIndex('build')}
                disabled={estimating || indexing}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  cursor: (estimating || indexing) ? 'not-allowed' : 'pointer',
                  background: indexing ? C.surface2 : C.purple,
                  color: indexing ? C.textDim : '#000',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                {indexing ? '⏳ Indexing…' : '⚡ Build index'}
              </button>
            </div>
          </div>

          {/* Add channels by handle — 1 unit each, the cheap coverage lever */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
              Add channels by handle, 1 unit each. Paste @handles or channel URLs, separated by spaces or new lines.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={handleInput}
                onChange={e => setHandleInput(e.target.value)}
                placeholder="@SquatUniversity @E3Rehab @TomMerrick"
                style={{
                  flex: 1, minWidth: 240, padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                  fontSize: 13, fontFamily: 'inherit',
                }} />
              <button
                onClick={addChannels}
                disabled={indexing || !handleInput.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.border}`,
                  cursor: (indexing || !handleInput.trim()) ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: C.textMid,
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                + Add channels
              </button>
            </div>
          </div>

          {indexLog.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, maxHeight: 220, overflowY: 'auto' }}>
              {indexLog.map((l, i) => (
                <p key={i} style={{ fontSize: 11, color: i === 0 ? C.purple : C.textMid, fontFamily: 'monospace', lineHeight: 1.7 }}>{l}</p>
              ))}
            </div>
          )}

          {estimate && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7 }}>
              {estimate.error ? (
                <p style={{ fontSize: 12, color: C.red, fontFamily: 'monospace' }}>Error: {estimate.error}</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{estimate.one_time_build_units?.toLocaleString()}</p>
                      <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>one-time units</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{estimate.percent_of_daily_quota}%</p>
                      <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>of one day</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{estimate.total_videos?.toLocaleString()}</p>
                      <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>videos cached</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.green }}>~{estimate.daily_refresh_units_estimate}</p>
                      <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>units/day refresh</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.textMid }}>{estimate.units_spent_on_this_estimate}</p>
                      <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>units this check</p>
                    </div>
                  </div>
                  {estimate.unresolved?.length > 0 && (
                    <p style={{ fontSize: 11, color: C.amber, marginBottom: 6 }}>
                      ⚠ {estimate.unresolved.length} channel id(s) did not resolve on YouTube: {estimate.unresolved.join(', ')}
                    </p>
                  )}
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {(estimate.per_channel ?? []).map((c, i) => (
                      <p key={i} style={{ fontSize: 11, color: c.resolved ? C.textMid : C.red, fontFamily: 'monospace', lineHeight: 1.7 }}>
                        {c.build_units.toString().padStart(4)} units · {c.video_count.toLocaleString()} videos · {c.channel_name}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Matching dry run (zero quota) ──────────────────────────────────── */}
      {hasChannels && (
        <div style={{ padding: '16px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                Matching dry run
              </p>
              <p style={{ fontSize: 12, color: C.textDim }}>
                Matches 300 uncurated exercises against the cache. No fallback fires, nothing is written, zero YouTube quota.
              </p>
            </div>
            <button
              onClick={runDryRun}
              disabled={dryRunning}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                cursor: dryRunning ? 'not-allowed' : 'pointer',
                background: dryRunning ? C.surface2 : C.accent,
                color: dryRunning ? C.textDim : '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
              {dryRunning ? '⏳ Matching…' : '🔬 Run dry run'}
            </button>
          </div>

          {dryRun && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7 }}>
              {dryRun.error ? (
                <p style={{ fontSize: 12, color: C.red, fontFamily: 'monospace' }}>Error: {dryRun.error}</p>
              ) : (
                <>
                  {/* Backlog split — counts only, nothing written */}
                  {dryRun.backlog && (
                    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                      <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        Backlog split (counts only, nothing written)
                      </p>
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{dryRun.backlog.total_uncurated.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>uncurated</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{dryRun.backlog.fitness.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>fitness (curate)</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{dryRun.backlog.trick.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>trick ({dryRun.backlog.trick_pct}%)</p>
                        </div>
                      </div>
                      {dryRun.backlog.trick_by_source?.length > 0 && (
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMid, marginBottom: 6 }}>
                          {dryRun.backlog.trick_by_source.map(([src, n]) => (
                            <p key={src} style={{ lineHeight: 1.7 }}>{String(n).padStart(4)} · {src}</p>
                          ))}
                        </div>
                      )}
                      {dryRun.backlog.trick_examples?.length > 0 && (
                        <div>
                          <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', marginBottom: 3 }}>classified as trick</p>
                          {dryRun.backlog.trick_examples.map((t, i) => (
                            <p key={i} style={{ fontSize: 11, color: C.textMid, fontFamily: 'monospace', lineHeight: 1.7 }}>
                              {t.name} <span style={{ color: C.textDim }}>({t.why.join(', ')})</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p style={{ fontSize: 12, color: C.textMid, marginBottom: 10 }}>
                    {dryRun.sampled} fitness exercises scored · {dryRun.zero_candidates} found nothing in the cache
                    {dryRun.timed_out ? ' · stopped early on the time budget' : ''}
                    {' · median '}<strong style={{ color: C.text }}>{dryRun.percentiles?.p50?.toFixed(2)}</strong>
                  </p>

                  {/* Histogram */}
                  <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Top-match score distribution</p>
                  {(dryRun.histogram ?? []).map(h => {
                    const max = Math.max(...(dryRun.histogram ?? []).map(x => x.count), 1)
                    return (
                      <div key={h.bucket} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', width: 56 }}>{h.bucket}</span>
                        <div style={{ flex: 1, height: 12, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(h.count / max) * 100}%`, height: '100%', background: C.accent }} />
                        </div>
                        <span style={{ fontSize: 10, color: C.textMid, fontFamily: 'monospace', width: 34, textAlign: 'right' }}>{h.count}</span>
                      </div>
                    )
                  })}

                  {/* Threshold trade-off */}
                  <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px' }}>
                    What each threshold would cost
                  </p>
                  <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    <p style={{ color: C.textDim, lineHeight: 1.8 }}>threshold · matched locally · fallback across whole fitness backlog</p>
                    {(dryRun.tradeoff ?? []).map(t => (
                      <p key={t.threshold} style={{ color: C.textMid, lineHeight: 1.8 }}>
                        {t.threshold.toFixed(2)} · {String(t.matched_locally).padStart(4)} ({t.local_rate_pct}%) · {t.projected_fallback_backlog?.toLocaleString()} exercises ≈ {Math.ceil((t.projected_fallback_backlog ?? 0) / 20)} days at 20/day
                      </p>
                    ))}
                  </div>

                  {/* Worked examples */}
                  {['strong', 'middle', 'weak', 'nothing'].map(bandKey => {
                    const items = dryRun.examples?.[bandKey] ?? []
                    if (!items.length) return null
                    return (
                      <div key={bandKey} style={{ marginTop: 12 }}>
                        <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{bandKey} matches</p>
                        {items.map((ex, i) => (
                          <div key={i} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${C.border}` }}>
                            <p style={{ fontSize: 11, color: C.text, fontFamily: 'monospace' }}>{ex.score.toFixed(2)} · {ex.exercise}</p>
                            <p style={{ fontSize: 11, color: C.textMid }}>→ {ex.matched ?? '(nothing)'}</p>
                            <p style={{ fontSize: 10, color: C.textDim }}>{(ex.why ?? []).join(' · ')}</p>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}

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
                curationCount: planQueueIds.filter(id => !exercises.find(e => e.id === id)?.video_url).length,
                ids: planQueueIds,
                borderColor: 'rgba(239,68,68,0.25)',
                labelColor: C.red,
              },
              // One row per seeded program
              ...programLanes.map(lane => ({
                id: `program:${lane.name}`,
                label: `🔵 ${lane.name}`,
                desc: lane.needsCurationCount > 0
                  ? `${lane.needsCurationCount} need AI curation · ${lane.pendingCount - lane.needsCurationCount} awaiting your review below`
                  : `All ${lane.pendingCount} exercises have proposals — scroll down to review & approve`,
                count: lane.needsCurationCount,
                curationCount: lane.needsCurationCount,
                ids: lane.exerciseIds,
                borderColor: C.accentBorder,
                labelColor: C.accent,
              })),
              // Backlog lane
              (() => {
                const backlogCount = exercises.filter(e => !e.video_url && !e.candidates.some(c => c.status === 'proposed') && !queuedIds.has(e.id) && !programExerciseIds.has(e.id)).length
                return {
                  id: 'backlog',
                  label: '⬜ Full Library Backlog',
                  desc: 'All remaining exercises without videos (alphabetical)',
                  count: backlogCount,
                  curationCount: backlogCount,
                  ids: [] as string[],
                  borderColor: C.border,
                  labelColor: C.textDim,
                }
              })(),
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
                      disabled={running || !!runningLane || !hasChannels || lane.curationCount === 0}
                      style={{
                        padding: '6px 14px', borderRadius: 7, border: `1px solid ${lane.borderColor}`,
                        background: runningLane === lane.id ? C.surface2 : `${lane.labelColor}12`,
                        color: (running || !!runningLane || lane.curationCount === 0) ? C.textDim : lane.labelColor,
                        fontSize: 12, fontWeight: 700, cursor: (running || !!runningLane || lane.curationCount === 0) ? 'not-allowed' : 'pointer',
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

      {/* ── Program Library View ────────────────────────────────────────────── */}
      {programDetails.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Video Library — Programs</p>
            <span style={{ fontSize: 11, color: C.textDim }}>Programs vanish from Priority Lanes once all exercises have videos.</span>
          </div>

          {programDetails.map(prog => {
            const pct = prog.total > 0 ? Math.round((prog.withVideo / prog.total) * 100) : 0
            const isExpanded = expandedPrograms.has(prog.name)
            return (
              <div key={prog.name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => setExpandedPrograms(prev => { const n = new Set(prev); if (n.has(prog.name)) n.delete(prog.name); else n.add(prog.name); return n })}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>🔵 {prog.name}</span>
                  <span style={{ fontSize: 12, color: C.textMid, whiteSpace: 'nowrap' }}>{prog.withVideo}/{prog.total} have videos</span>
                  <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.green : C.accent, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? C.green : C.textMid, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {prog.exercises.map(pex => {
                      const hasProposals = pex.candidates.some(c => c.status === 'proposed')
                      const rawUrl = pasteUrls[pex.id] ?? ''
                      return (
                        <div key={pex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, background: pex.video_url ? 'rgba(34,197,94,0.03)' : 'transparent', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, flexShrink: 0, width: 18, color: pex.video_url ? C.green : hasProposals ? C.amber : C.red }}>
                            {pex.video_url ? '✓' : hasProposals ? '○' : '✗'}
                          </span>
                          <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: pex.video_url ? C.textMid : C.text }}>{pex.name_display}</span>
                          {pex.video_url && (
                            <a href={pex.video_url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, color: C.green, fontWeight: 700, textDecoration: 'none', padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.greenBorder}`, background: C.greenDim, whiteSpace: 'nowrap' }}>
                              ▶ View
                            </a>
                          )}
                          {!pex.video_url && hasProposals && (
                            <button onClick={() => { setSearch(pex.name_display); setFilter('pending') }}
                              style={{ fontSize: 11, color: C.amber, fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.amberBorder}`, background: C.amberDim, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              {pex.candidates.filter(c => c.status === 'proposed').length} proposal{pex.candidates.filter(c => c.status === 'proposed').length !== 1 ? 's' : ''} — review ↓
                            </button>
                          )}
                          {!pex.video_url && !hasProposals && (
                            <>
                              <button onClick={() => runSingle(pex.id)} disabled={!!acting || !hasChannels}
                                style={{ fontSize: 11, color: C.textDim, padding: '3px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', cursor: !!acting || !hasChannels ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {acting === pex.id ? '…' : '▶ Run'}
                              </button>
                              <input value={rawUrl} onChange={e => setPasteUrls(prev => ({ ...prev, [pex.id]: e.target.value }))}
                                placeholder="Paste YouTube URL…"
                                style={{ width: 190, padding: '4px 8px', borderRadius: 5, border: `1px solid ${rawUrl ? C.accentBorder : C.border}`, background: C.bg, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
                              {rawUrl && (
                                <button onClick={() => pasteCustom(pex.id)} disabled={!!acting}
                                  style={{ fontSize: 11, color: C.accent, fontWeight: 700, padding: '3px 10px', borderRadius: 5, border: `1px solid ${C.accentBorder}`, background: C.accentDim, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  ✓ Save
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Plan generation queue */}
          {planQueueIds.length > 0 && (
            <div style={{ background: C.surface, border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpandedPrograms(prev => { const n = new Set(prev); if (n.has('__plan__')) n.delete('__plan__'); else n.add('__plan__'); return n })}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>🔴 From User Plan Generation</span>
                <span style={{ fontSize: 12, color: C.textMid }}>
                  {planQueueIds.filter(id => !exercises.find(e => e.id === id)?.video_url).length} still need videos
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: C.textDim }}>{expandedPrograms.has('__plan__') ? '▲' : '▼'}</span>
              </div>
              {expandedPrograms.has('__plan__') && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {planQueueIds.map(id => {
                    const pex = exercises.find(e => e.id === id)
                    if (!pex) return null
                    const hasProposals = pex.candidates.some(c => c.status === 'proposed')
                    const rawUrl = pasteUrls[pex.id] ?? ''
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, background: pex.video_url ? 'rgba(34,197,94,0.03)' : 'transparent', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, flexShrink: 0, width: 18, color: pex.video_url ? C.green : hasProposals ? C.amber : C.red }}>
                          {pex.video_url ? '✓' : hasProposals ? '○' : '✗'}
                        </span>
                        <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: pex.video_url ? C.textMid : C.text }}>{pex.name_display}</span>
                        {pex.video_url && (
                          <a href={pex.video_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: C.green, fontWeight: 700, textDecoration: 'none', padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.greenBorder}`, background: C.greenDim }}>
                            ▶ View
                          </a>
                        )}
                        {!pex.video_url && hasProposals && (
                          <button onClick={() => { setSearch(pex.name_display); setFilter('pending') }}
                            style={{ fontSize: 11, color: C.amber, fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.amberBorder}`, background: C.amberDim, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            {pex.candidates.filter(c => c.status === 'proposed').length} proposals — review ↓
                          </button>
                        )}
                        {!pex.video_url && !hasProposals && (
                          <>
                            <button onClick={() => runSingle(pex.id)} disabled={!!acting || !hasChannels}
                              style={{ fontSize: 11, color: C.textDim, padding: '3px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', cursor: !!acting || !hasChannels ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {acting === pex.id ? '…' : '▶ Run'}
                            </button>
                            <input value={rawUrl} onChange={e => setPasteUrls(prev => ({ ...prev, [pex.id]: e.target.value }))}
                              placeholder="Paste YouTube URL…"
                              style={{ width: 190, padding: '4px 8px', borderRadius: 5, border: `1px solid ${rawUrl ? C.accentBorder : C.border}`, background: C.bg, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
                            {rawUrl && (
                              <button onClick={() => pasteCustom(pex.id)} disabled={!!acting}
                                style={{ fontSize: 11, color: C.accent, fontWeight: 700, padding: '3px 10px', borderRadius: 5, border: `1px solid ${C.accentBorder}`, background: C.accentDim, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                ✓ Save
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              <div key={ex.id} style={{ background: C.surface, border: `1px solid ${justActed.has(ex.id) ? C.accent : ex.video_url ? C.greenBorder : C.border}`, borderRadius: 10, overflow: 'hidden' }}>
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
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                    {(ex.how || ex.breathing || ex.tip) && (
                      <button
                        onClick={() => setShowCues(prev => {
                          const n = new Set(prev)
                          if (n.has(ex.id)) n.delete(ex.id); else n.add(ex.id)
                          return n
                        })}
                        title="Show the written instructions so you can judge the video against them"
                        style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${showCues.has(ex.id) ? C.accentBorder : C.border}`, background: showCues.has(ex.id) ? C.accentDim : 'transparent', color: showCues.has(ex.id) ? C.accent : C.textDim, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {showCues.has(ex.id) ? '✕ Instructions' : '📋 Instructions'}
                      </button>
                    )}
                    {ex.video_url && (
                      <>
                        <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                          style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.greenBorder}`, background: C.greenDim, color: C.green, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                          ▶ View
                        </a>
                        <button
                          onClick={() => setEditingApproved(prev => {
                            const n = new Set(prev)
                            if (n.has(ex.id)) n.delete(ex.id); else n.add(ex.id)
                            return n
                          })}
                          style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: editingApproved.has(ex.id) ? C.surface2 : 'transparent', color: C.textMid, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {editingApproved.has(ex.id) ? '✕ Close' : '✏ Edit'}
                        </button>
                      </>
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

                {/* Written instructions, so a video can be judged against what
                    the exercise actually says rather than its title alone. */}
                {showCues.has(ex.id) && (ex.how || ex.breathing || ex.tip) && (
                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: 'rgba(59,130,246,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ex.how && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>How to do it</p>
                        <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>{ex.how}</p>
                      </div>
                    )}
                    {ex.breathing && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 800, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Breathing</p>
                        <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>{ex.breathing}</p>
                      </div>
                    )}
                    {ex.tip && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 800, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Coaching tip</p>
                        <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>{ex.tip}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Approved edit panel */}
                {ex.video_url && editingApproved.has(ex.id) && (() => {
                  const rawUrl = pasteUrls[ex.id] ?? ''
                  const previewUrl = rawUrl || ex.video_url
                  const videoId = rawUrl ? extractYouTubeId(rawUrl) : extractYouTubeId(ex.video_url)
                  const isShort = previewUrl.includes('/shorts/')
                  const times = pasteTimes[ex.id] ?? { start: '', end: '' }
                  const startSec = parseMMSS(times.start)
                  const endSec = parseMMSS(times.end)
                  const embedSrc = buildClipEmbedUrl(previewUrl, startSec, endSec)
                  const hasClip = startSec != null || endSec != null
                  return (
                    <div style={{ padding: '16px', borderTop: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Current video preview */}
                      {!rawUrl && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Current Video</p>
                            {isShort && <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)' }}>SHORT 9:16</span>}
                          </div>
                          <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: isShort ? 220 : 480 }}>
                            <div style={{ position: 'relative', paddingBottom: isShort ? '177.78%' : '56.25%', height: 0 }}>
                              <iframe
                                src={buildClipEmbedUrl(ex.video_url, null, null)}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Movement loop trimmer — the GIF-style preview users see while browsing */}
                      {!rawUrl && videoId && (
                        <div style={{ padding: '14px', background: 'rgba(34,197,94,0.05)', border: `1px solid ${C.greenBorder}`, borderRadius: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>🔁 Movement Loop</span>
                            <span style={{ fontSize: 11, color: C.textDim }}>— the auto-looping muted preview users see while browsing</span>
                          </div>
                          <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5, marginBottom: 12 }}>
                            Drag the ⟮ ⟯ handles (or use the playhead buttons) to pick the exact movement execution to loop, then preview and save. The original video is never changed.
                          </p>
                          <YouTubeLoopTrimmer
                            key={ex.video_url ?? videoId}
                            videoId={videoId}
                            isShort={isShort}
                            initialStart={ex.loop_start_sec ?? null}
                            initialEnd={ex.loop_end_sec ?? null}
                            saving={acting === ex.id}
                            hasSavedLoop={ex.loop_start_sec != null || ex.loop_end_sec != null}
                            onSave={(s, e) => saveLoop(ex.id, s, e)}
                            onClear={() => clearLoop(ex.id)}
                          />
                          {ex.loop_start_sec != null && ex.loop_end_sec != null && (
                            <div style={{ marginTop: 10, fontSize: 11, color: C.green, fontWeight: 700 }}>
                              ✓ Loop saved: {secondsToMMSS(Math.round(ex.loop_start_sec))} → {secondsToMMSS(Math.round(ex.loop_end_sec))} ({(ex.loop_end_sec - ex.loop_start_sec).toFixed(1)}s)
                            </div>
                          )}
                        </div>
                      )}

                      {/* Replace URL */}
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Replace with a Different URL</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={rawUrl}
                            onChange={e => setPasteUrls(prev => ({ ...prev, [ex.id]: e.target.value }))}
                            placeholder="Paste new YouTube URL…"
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: `1px solid ${rawUrl ? C.accentBorder : C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                          />
                          <button
                            onClick={() => pasteCustom(ex.id)}
                            disabled={!rawUrl.trim() || !!acting}
                            style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 700, cursor: !rawUrl.trim() || !!acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            {acting === ex.id ? '…' : '✓ Save'}
                          </button>
                        </div>

                        {/* Clip trimming — appears once a new URL is pasted */}
                        {rawUrl && videoId && (
                          <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(59,130,246,0.06)', border: `1px solid ${C.accentBorder}`, borderRadius: 9 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>✂️ Clip Trimming</span>
                              <span style={{ fontSize: 11, color: C.textDim }}>— optional, leave blank to use the full video</span>
                            </div>
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
                            {embedSrc && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Preview {hasClip ? `(${secondsToMMSS(startSec) || '0:00'} → ${secondsToMMSS(endSec) || 'end'})` : ''}
                                  </p>
                                  {isShort && <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)' }}>SHORT 9:16</span>}
                                </div>
                                <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: isShort ? 220 : '100%' }}>
                                  <div style={{ position: 'relative', paddingBottom: isShort ? '177.78%' : '56.25%', height: 0 }}>
                                    <iframe key={embedSrc} src={embedSrc} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Regenerate with AI */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9 }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>Get new AI suggestions</p>
                          <p style={{ fontSize: 11, color: C.textDim }}>Clears this approval and runs a fresh search — you&apos;ll review new candidates</p>
                        </div>
                        <button
                          onClick={() => regenerateApproved(ex.id)}
                          disabled={!!acting}
                          style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: C.red, fontSize: 12, fontWeight: 700, cursor: !!acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          {acting === ex.id ? '…' : '↺ Regenerate'}
                        </button>
                      </div>
                    </div>
                  )
                })()}

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
                  const isShort = rawUrl.includes('/shorts/')
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                  Live Preview {hasClip ? `(${secondsToMMSS(startSec) || '0:00'} → ${secondsToMMSS(endSec) || 'end'})` : ''}
                                </p>
                                {isShort && <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)' }}>SHORT 9:16</span>}
                              </div>
                              <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: isShort ? 220 : '100%' }}>
                                <div style={{ position: 'relative', paddingBottom: isShort ? '177.78%' : '56.25%', height: 0 }}>
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
