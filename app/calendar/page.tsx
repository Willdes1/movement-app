'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import LoopPreview from '@/components/ui/LoopPreview'
import { inferEquipment, REST_GUIDANCE } from '@/lib/workout-display'
import ExerciseDetailModal from '@/components/ui/ExerciseDetailModal'
import TrackWorkout from '@/components/ui/TrackWorkout'

type RecoveryDailyBlock = { label: string; duration: string; exercises: string[] }
type RecoveryDailySession = {
  morning: RecoveryDailyBlock; warmup: RecoveryDailyBlock; workout: RecoveryDailyBlock
  abs: RecoveryDailyBlock; cooldown: RecoveryDailyBlock; evening: RecoveryDailyBlock
}
type RecoveryPhase = {
  phase: number; title: string; description: string; duration_days: number
  daily_session?: RecoveryDailySession; coaching: string; readiness_check: string
}
type RecoveryPlan = {
  id: string; injury: string; phases: RecoveryPhase[]
  current_phase: number; activated_at: string | null; completed_at: string | null
}

type TrainDailyBlock = { label: string; duration: string; exercises: string[]; tip?: string }
type TrainDailySession = {
  morning?: TrainDailyBlock; warmup?: TrainDailyBlock; workout?: TrainDailyBlock
  abs?: TrainDailyBlock; cooldown?: TrainDailyBlock; evening?: TrainDailyBlock
}

const REC_BLOCK_ORDER = ['morning', 'warmup', 'workout', 'abs', 'cooldown', 'evening'] as const
const REC_BLOCK_META: Record<string, { icon: string; label: string; color: string; iconBg: string }> = {
  morning:  { icon: '☀️', label: 'MORNING',  color: 'var(--orange)', iconBg: 'rgba(255,140,0,0.18)' },
  warmup:   { icon: '⚡', label: 'WARMUP',   color: '#3b82f6',       iconBg: 'rgba(59,130,246,0.18)' },
  workout:  { icon: '💪', label: 'WORKOUT',  color: 'var(--green)',  iconBg: 'rgba(0,200,80,0.15)' },
  abs:      { icon: '⚙️', label: 'ABS',      color: 'var(--orange)', iconBg: 'rgba(255,140,0,0.18)' },
  cooldown: { icon: '❄️', label: 'COOLDOWN', color: '#8b5cf6',       iconBg: 'rgba(139,92,246,0.18)' },
  evening:  { icon: '🌙', label: 'EVENING',  color: '#6366f1',       iconBg: 'rgba(99,102,241,0.18)' },
}

type DayPlan = {
  day: string
  label: string
  type: string
  movements: string[]
  duration: string
  focus?: string
  rest?: { between_sets: string; between_rounds: string }
  coaching?: string
  daily_session?: TrainDailySession
}

type Program = {
  id: string
  startDate: string
}

type ExerciseDetail = {
  name_normalized: string
  name_display: string
  how: string
  breathing: string
  core: string
  tip: string
  video_url: string | null
  video_source: string | null
  youtube_start_sec: number | null
  youtube_end_sec: number | null
  loop_start_sec?: number | null
  loop_end_sec?: number | null
  tts_url_male: string | null
  tts_url_female: string | null
}

// VideoPlayer + extractYouTubeId moved to components/ui/LoopPreview.tsx + lib/youtube-iframe.ts

type WorkoutLog = {
  id: string
  exercise_normalized: string
  logged_at: string
  sets: number | null
  reps: number | null
  weight: number | null
  weight_unit: string
}

function parseExerciseName(movement: string): string {
  return movement
    .replace(/\s+\d+[×x]\d+.*$/i, '')
    .replace(/\s+\d+\s+sets?.*$/i, '')
    .trim()
}

function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

// Day-view exercise row: inline looping preview (reuses LoopPreview) + name + a
// short Coaching Cue (the `how` field). Tapping anything opens the full popup.
function ExerciseRow({ raw, detail, onOpen }: { raw: string; detail?: ExerciseDetail; onOpen: () => void }) {
  const name = parseExerciseName(raw)
  const scheme = raw.slice(name.length).trim()
  const fullCue = detail?.how ?? ''
  const cue = fullCue.length > 140 ? fullCue.slice(0, 140).trim() + '…' : fullCue
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
      {detail?.video_url ? (
        <LoopPreview compact lazy url={detail.video_url} source={detail.video_source} name={name} loopStart={detail.loop_start_sec} loopEnd={detail.loop_end_sec} clipStart={detail.youtube_start_sec} clipEnd={detail.youtube_end_sec} onClick={onOpen} />
      ) : (
        <div onClick={onOpen} style={{ width: 104, flexShrink: 0, aspectRatio: '16 / 9', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer' }}>🎬</div>
      )}
      <button onClick={onOpen} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{name}</span>
          {scheme && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{scheme}</span>}
        </div>
        {cue && (
          <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.45, marginTop: 3 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-mid)' }}>Cue:</span> {cue}
          </p>
        )}
      </button>
    </div>
  )
}

function fallbackDetail(m: string, _day: DayPlan): ExerciseDetail {
  const name = parseExerciseName(m)
  return {
    name_normalized: normalizeExerciseName(name),
    name_display: name,
    how: 'Coaching for this exercise is loading. Tap again in a moment.',
    breathing: null as unknown as string,
    core: null as unknown as string,
    youtube_start_sec: null,
    youtube_end_sec: null,
    tip: null as unknown as string,
    video_url: null,
    video_source: null,
    tts_url_male: null,
    tts_url_female: null,
  }
}

const TOTAL_WEEKS = 13
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const TYPE_COLOR: Record<string, string> = {
  workout: 'var(--accent)', warmup: 'var(--orange)', cooldown: 'var(--yellow)',
  morning: 'var(--green)', abs: 'var(--accent)', evening: 'var(--orange)', rest: 'var(--text-dim)',
}
const TYPE_BG: Record<string, string> = {
  workout: 'var(--accent-bg)', warmup: 'var(--orange-bg)', cooldown: 'var(--yellow-bg)',
  morning: 'var(--green-bg)', abs: 'var(--accent-bg)', evening: 'var(--orange-bg)',
  rest: 'rgba(120,130,148,0.05)',
}

function getPhaseInfo(week: number) {
  if (week <= 4) return { label: 'Foundation', color: 'var(--green)' }
  if (week <= 8) return { label: 'Build', color: 'var(--accent)' }
  if (week <= 10) return { label: 'Peak', color: 'var(--orange)' }
  return { label: 'Maintenance', color: 'var(--yellow)' }
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function planDayToDate(startDate: string, weekNum: number, dayIndex: number): Date {
  const start = new Date(startDate)
  const d = new Date(start)
  d.setDate(d.getDate() + (weekNum - 1) * 7 + dayIndex)
  return d
}

function CalendarInner() {
  const { user, loading: authLoading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const { activeRecovery } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  // Focus mode (from Start Session): show only today's focused day view, month grid hidden.
  const [focusMode, setFocusMode] = useState(() => searchParams.get('focus') === '1')

  const [program, setProgram] = useState<Program | null>(null)
  const [recoveryPlan, setRecoveryPlan] = useState<RecoveryPlan | null>(null)
  const [expandedRecovBlock, setExpandedRecovBlock] = useState<string | null>('morning')
  const [expandedTrainBlock, setExpandedTrainBlock] = useState<string | null>('warmup')
  const [historyBump, setHistoryBump] = useState(0)
  const [weekPlans, setWeekPlans] = useState<Record<number, DayPlan[]>>({})
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedKey, setSelectedKey] = useState<string | null>(() => new Date().toISOString().split('T')[0])
  const [exerciseLibrary, setExerciseLibrary] = useState<Record<string, ExerciseDetail>>({})
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDetail | null>(null)
  const [exerciseFetching, setExerciseFetching] = useState(false)
  const [lastLog, setLastLog] = useState<WorkoutLog | null>(null)
  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState(false)
  // Travel adjustment
  const [travelOpen, setTravelOpen] = useState(false)
  const [travelSituation, setTravelSituation] = useState('')
  const [travelLoading, setTravelLoading] = useState(false)
  // Missed session
  const [missedOpen, setMissedOpen] = useState(false)
  const [missedLoading, setMissedLoading] = useState(false)
  // Auto-capture prompt after completing
  const [showLogPrompt, setShowLogPrompt] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  // Reset per-day UI state whenever the selected day changes
  useEffect(() => {
    setTravelOpen(false)
    setTravelSituation('')
    setTravelLoading(false)
    setMissedOpen(false)
    setMissedLoading(false)
    setShowLogPrompt(false)
  }, [selectedKey])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: prog } = await supabase
        .from('training_programs')
        .select('id, start_date')
        .eq('user_id', userId)
        .single()

      if (!prog) return

      const program: Program = { id: prog.id, startDate: prog.start_date }
      setProgram(program)
      setViewMonth(new Date(prog.start_date))

      const [{ data: plans }, { data: compData }] = await Promise.all([
        supabase.from('weekly_plans').select('week_number, plan').eq('program_id', prog.id),
        supabase.from('day_completions').select('week_number, day_index').eq('program_id', prog.id).eq('user_id', userId),
      ])

      if (compData) setCompletions(new Set(compData.map(r => `${r.week_number}-${r.day_index}`)))

      const map: Record<number, DayPlan[]> = {}
      plans?.forEach(p => { map[p.week_number] = p.plan as DayPlan[] })
      setWeekPlans(map)

      // Load whatever is already in the library (fast path)
      const allDays = Object.values(map).flat()
      const displayNames = [...new Set(
        allDays
          .filter(d => d.type !== 'rest')
          .flatMap(d => d.movements)
          .map(m => parseExerciseName(m))
          .filter(Boolean)
      )]
      const normalizedNames = displayNames.map(normalizeExerciseName)

      if (normalizedNames.length > 0) {
        const { data: libData } = await supabase
          .from('exercise_library')
          .select('name_normalized, name_display, how, breathing, core, tip, video_url, video_source, youtube_start_sec, youtube_end_sec, loop_start_sec, loop_end_sec, tts_url_male, tts_url_female')
          .in('name_normalized', normalizedNames)
        if (libData) {
          const libMap: Record<string, ExerciseDetail> = {}
          libData.forEach(e => { libMap[e.name_normalized] = e as ExerciseDetail })
          setExerciseLibrary(libMap)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  // On-demand fetch for a single exercise if not yet in library
  const openExercise = useCallback(async (rawName: string) => {
    const name = parseExerciseName(rawName)
    const key = normalizeExerciseName(name)
    const cached = exerciseLibrary[key]
    if (cached) { setSelectedExercise(cached); return }

    // Show loading placeholder immediately
    setSelectedExercise({ name_normalized: key, name_display: name, how: 'Loading coaching details…', breathing: null as unknown as string, core: null as unknown as string, tip: null as unknown as string, video_url: null, video_source: null, youtube_start_sec: null, youtube_end_sec: null, tts_url_male: null, tts_url_female: null })
    setExerciseFetching(true)
    try {
      // Check DB before calling AI — avoids charges on every tap
      const { data: dbEntry } = await supabase.from('exercise_library').select('name_normalized, name_display, how, breathing, core, tip, video_url, video_source, youtube_start_sec, youtube_end_sec, loop_start_sec, loop_end_sec, tts_url_male, tts_url_female').eq('name_normalized', key).single()
      if (dbEntry) {
        setExerciseLibrary(prev => ({ ...prev, [key]: dbEntry as ExerciseDetail }))
        setSelectedExercise(dbEntry as ExerciseDetail)
        return
      }
      // Not in library — coaching tips are pre-generated at plan generation time
      setSelectedExercise({ name_normalized: key, name_display: name, how: 'Coaching tips for this exercise are not yet available. Generate your plan to load all coaching details automatically.', breathing: null as unknown as string, core: null as unknown as string, tip: null as unknown as string, video_url: null, video_source: null, youtube_start_sec: null, youtube_end_sec: null, tts_url_male: null, tts_url_female: null })
    } catch { /* keep placeholder visible */ }
    finally { setExerciseFetching(false) }
  }, [exerciseLibrary])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  useEffect(() => {
    if (!user || !activeRecovery?.planId) { setRecoveryPlan(null); return }
    supabase.from('recovery_plans').select('id, injury, phases, current_phase, activated_at, completed_at')
      .eq('id', activeRecovery.planId).single()
      .then(({ data }) => { if (data) setRecoveryPlan(data as RecoveryPlan) })
  }, [user, activeRecovery?.planId])

  useEffect(() => {
    if (!dateParam) return
    setSelectedKey(dateParam)
    const d = new Date(dateParam + 'T12:00:00')
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [dateParam])

  useEffect(() => {
    setLastLog(null)
    if (!selectedExercise || !user) return
    supabase
      .from('workout_logs')
      .select('id, exercise_normalized, logged_at, sets, reps, weight, weight_unit')
      .eq('user_id', userId)
      .eq('exercise_normalized', selectedExercise.name_normalized)
      .order('logged_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setLastLog(data as WorkoutLog) })
  }, [selectedExercise, user])

  async function completeDay(weekNum: number, dayIdx: number) {
    if (!program || !user || completing) return
    setCompleting(true)
    await supabase.from('day_completions').upsert(
      { user_id: userId, program_id: program.id, week_number: weekNum, day_index: dayIdx, skipped: false },
      { onConflict: 'user_id,program_id,week_number,day_index' }
    )
    setCompletions(prev => new Set([...prev, `${weekNum}-${dayIdx}`]))
    setCompleting(false)
    setShowLogPrompt(true)
  }

  async function handleTravelAdjust() {
    if (!program || !selectedEntry || !travelSituation.trim()) return
    setTravelLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/user/travel-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ programId: program.id, weekNum: selectedEntry.weekNum, dayIdx: selectedEntry.dayIdx, situation: travelSituation }),
      })
      const data = await resp.json()
      if (data.day) {
        setWeekPlans(prev => {
          const weekArr = [...(prev[selectedEntry.weekNum] ?? [])]
          weekArr[selectedEntry.dayIdx] = data.day
          return { ...prev, [selectedEntry.weekNum]: weekArr }
        })
        setTravelOpen(false)
        setTravelSituation('')
      }
    } finally {
      setTravelLoading(false)
    }
  }

  async function skipDay(weekNum: number, dayIdx: number) {
    if (!program || !user || missedLoading) return
    setMissedLoading(true)
    await supabase.from('day_completions').upsert(
      { user_id: userId, program_id: program.id, week_number: weekNum, day_index: dayIdx, skipped: true },
      { onConflict: 'user_id,program_id,week_number,day_index' }
    )
    setCompletions(prev => new Set([...prev, `${weekNum}-${dayIdx}`]))
    setMissedOpen(false)
    setMissedLoading(false)
  }

  async function undoCompletion(weekNum: number, dayIdx: number) {
    if (!program || !user || completing) return
    setCompleting(true)
    await supabase.from('day_completions').delete()
      .eq('user_id', userId)
      .eq('program_id', program.id)
      .eq('week_number', weekNum)
      .eq('day_index', dayIdx)
    setCompletions(prev => {
      const next = new Set(prev)
      next.delete(`${weekNum}-${dayIdx}`)
      return next
    })
    setCompleting(false)
  }

  // Build date → plan day map using day-of-week alignment (matches plan page's day_index convention)
  const dayMap: Record<string, { day: DayPlan; weekNum: number; dayIdx: number }> = {}
  if (program) {
    Object.entries(weekPlans).forEach(([weekStr, plan]) => {
      const weekNum = Number(weekStr)
      plan.forEach((_, seqIdx) => {
        const calDate = planDayToDate(program.startDate, weekNum, seqIdx)
        const key = dateKey(calDate)
        // Use actual day-of-week (Mon=0) to index into the plan — same as plan page's todayIdx
        const dowIdx = (calDate.getDay() + 6) % 7
        dayMap[key] = { day: plan[dowIdx] ?? plan[seqIdx], weekNum, dayIdx: dowIdx }
      })
    })
  }

  function isRecoveryDay(key: string): boolean {
    if (!recoveryPlan?.activated_at) return false
    const start = recoveryPlan.activated_at.split('T')[0]
    const end = recoveryPlan.completed_at?.split('T')[0] ?? '9999-12-31'
    return key >= start && key <= end
  }

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const todayKey = dateKey(new Date())

  const programEnd = program
    ? (() => { const d = new Date(program.startDate); d.setDate(d.getDate() + TOTAL_WEEKS * 7 - 1); return d })()
    : null

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedEntry = selectedKey ? dayMap[selectedKey] : null

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  if (!program) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No program yet</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Generate your 13-week program first, then your full calendar will appear here.
        </p>
        <button
          onClick={() => router.push('/today')}
          style={{ padding: '13px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Go to Home →
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      {focusMode ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={() => setFocusMode(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-mid)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📅 View Calendar</button>
        </div>
      ) : (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Calendar</h1>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
            13-week program · tap any day for details
          </p>
        </>
      )}

      {!focusMode && (<>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <button
          onClick={() => { setViewMonth(new Date(year, month - 1, 1)); setSelectedKey(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer', padding: '2px 8px', fontWeight: 700 }}
        >←</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{MONTHS[month]} {year}</span>
        <button
          onClick={() => { setViewMonth(new Date(year, month + 1, 1)); setSelectedKey(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer', padding: '2px 8px', fontWeight: 700 }}
        >→</button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', padding: '3px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((dateNum, i) => {
          if (dateNum === null) return <div key={i} style={{ minHeight: 54 }} />

          const cellDate = new Date(year, month, dateNum)
          const key = dateKey(cellDate)
          const entry = dayMap[key]
          const isToday = key === todayKey
          const isSelected = key === selectedKey
          const inProgram = programEnd && cellDate >= new Date(program.startDate) && cellDate <= programEnd
          const isPast = cellDate < new Date() && !isToday
          const isRecovDay = isRecoveryDay(key)
          const typeColor = isRecovDay ? 'var(--orange)' : entry ? (TYPE_COLOR[entry.day.type] ?? 'var(--text-dim)') : null
          const typeBg = isRecovDay ? 'rgba(255,140,0,0.07)' : entry ? (TYPE_BG[entry.day.type] ?? 'var(--surface)') : 'var(--surface)'

          return (
            <button
              key={i}
              onClick={() => setSelectedKey(isSelected ? null : key)}
              style={{
                minHeight: 54,
                borderRadius: 8,
                border: `1.5px solid ${isSelected ? (typeColor ?? 'var(--accent)') : isToday ? 'var(--accent)' : isRecovDay ? 'rgba(255,140,0,0.3)' : 'var(--border)'}`,
                background: isSelected || (isToday && !entry && !isRecovDay) ? 'var(--accent-bg)' : typeBg,
                cursor: 'pointer',
                padding: '5px 2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                opacity: !inProgram && !isRecovDay ? 0.28 : isPast && entry?.day.type === 'rest' && !isRecovDay ? 0.45 : isPast && !isRecovDay ? 0.65 : 1,
                transition: 'opacity 0.1s, border-color 0.1s',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                {dateNum}
              </span>
              {isRecovDay ? (
                <>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)', flexShrink: 0 }} />
                  <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--orange)', textAlign: 'center', lineHeight: 1.2 }}>Rcvy</span>
                </>
              ) : entry ? (
                <>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: typeColor ?? 'var(--text-dim)', flexShrink: 0 }} />
                  {entry.day.type !== 'rest' && (
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: typeColor ?? 'var(--text-dim)', textAlign: 'center', lineHeight: 1.25, wordBreak: 'break-word', padding: '0 2px', maxWidth: '100%' }}>
                      {entry.day.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                </>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
        {[
          { label: 'Workout / Abs', color: 'var(--accent)' },
          { label: 'Warmup / Evening', color: 'var(--orange)' },
          { label: 'Morning', color: 'var(--green)' },
          { label: 'Rest', color: 'var(--text-dim)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{l.label}</span>
          </div>
        ))}
      </div>

      </>)}

      {/* Selected day detail — recovery mode */}
      {selectedKey && isRecoveryDay(selectedKey) && recoveryPlan && (() => {
        const phase = recoveryPlan.phases.find(p => p.phase === recoveryPlan.current_phase)
        const session = phase?.daily_session
        return (
          <div style={{ marginTop: 20, padding: '18px', background: 'rgba(255,140,0,0.08)', border: '1.5px solid rgba(255,140,0,0.28)', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 3 }}>
                  {new Date(selectedKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--orange)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Recovery Mode · Phase {recoveryPlan.current_phase} of {recoveryPlan.phases.length}</div>
                <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 0 }}>{phase?.title ?? recoveryPlan.injury}</p>
              </div>
              <button onClick={() => focusMode ? setFocusMode(false) : setSelectedKey(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-dim)', cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}>×</button>
            </div>
            {session ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                {REC_BLOCK_ORDER.map(key => {
                  const block = session[key]
                  if (!block) return null
                  const meta = REC_BLOCK_META[key]
                  const isExpanded = expandedRecovBlock === key
                  return (
                    <div key={key} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <button onClick={() => setExpandedRecovBlock(isExpanded ? null : key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: meta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{meta.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: meta.color, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 1 }}>{meta.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.label}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{block.duration}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {block.exercises.map((ex, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{ex}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 12px' }}>
                This plan was generated in an older format. Regenerate for the full 6-block daily session.
              </p>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>Log your progress from the Recovery tab</div>
          </div>
        )
      })()}

      {/* Selected day detail — training plan */}
      {selectedEntry && selectedKey && !isRecoveryDay(selectedKey) && (
        <div style={{
          marginTop: 20,
          padding: '18px',
          background: TYPE_BG[selectedEntry.day.type] ?? 'var(--surface)',
          border: `1.5px solid ${TYPE_COLOR[selectedEntry.day.type] ?? 'var(--border)'}`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 3 }}>
                {new Date(selectedKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Day {(selectedEntry.weekNum - 1) * 7 + selectedEntry.dayIdx + 1}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <p style={{ fontWeight: 800, fontSize: 17 }}>{selectedEntry.day.label}</p>
                {selectedEntry.day.duration !== '—' && (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{selectedEntry.day.duration}</span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: getPhaseInfo(selectedEntry.weekNum).color }}>
                Week {selectedEntry.weekNum} · {getPhaseInfo(selectedEntry.weekNum).label} Phase
              </span>
            </div>
            <button
              onClick={() => focusMode ? setFocusMode(false) : setSelectedKey(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-dim)', cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}
            >×</button>
          </div>
          {selectedEntry.day.daily_session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {REC_BLOCK_ORDER.map(bk => {
                const block = selectedEntry.day.daily_session![bk]
                if (!block) return null
                const meta = REC_BLOCK_META[bk]
                const isExpanded = expandedTrainBlock === bk
                return (
                  <div key={bk} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button onClick={() => setExpandedTrainBlock(isExpanded ? null : bk)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: meta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{meta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: meta.color, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 1 }}>{meta.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.label}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{block.duration}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', padding: '10px 12px' }}>
                        {block.tip && (
                          <p style={{ fontSize: 11, color: '#3b82f6', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5 }}>💡 {block.tip}</p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {block.exercises.map((ex, ei) => (
                            <ExerciseRow key={ei} raw={ex} detail={exerciseLibrary[normalizeExerciseName(parseExerciseName(ex))]} onOpen={() => openExercise(ex)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: selectedEntry.day.type !== 'rest' ? 12 : 0 }}>
              {selectedEntry.day.movements.map((m, i) => (
                <ExerciseRow key={i} raw={m} detail={exerciseLibrary[normalizeExerciseName(parseExerciseName(m))]} onOpen={() => openExercise(m)} />
              ))}
            </div>
          )}

          {/* Gentle recommendation + equipment + rest guidance */}
          {selectedEntry.day.type !== 'rest' && (() => {
            const allNames = selectedEntry.day.daily_session
              ? (Object.values(selectedEntry.day.daily_session).flatMap(b => b?.exercises ?? []) as string[])
              : selectedEntry.day.movements
            const equip = inferEquipment(allNames)
            const hasAbs = !!selectedEntry.day.daily_session?.abs
            const hasCooldown = !!selectedEntry.day.daily_session?.cooldown
            return (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                {(hasAbs || hasCooldown) && (
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 10 }}>
                    💡 {hasAbs ? 'We recommend abs today. ' : ''}{hasCooldown ? 'If you have extra time, add a cool down for best results.' : ''}
                  </p>
                )}
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Equipment needed</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {equip.map(eq => <span key={eq} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{eq}</span>)}
                </div>
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Rest guidance</p>
                {REST_GUIDANCE.map(r => (
                  <p key={r.label} style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-mid)' }}>{r.label}:</span> {r.detail}
                  </p>
                ))}
              </div>
            )
          })()}
          {/* Travel Adjustment — show on any workout day */}
          {selectedEntry.day.type !== 'rest' && (
            <div style={{ marginBottom: 10 }}>
              {!travelOpen ? (
                <button
                  onClick={() => setTravelOpen(true)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  ✈️  Need modifications?
                </button>
              ) : (
                <div style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Describe your situation</p>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
                    e.g. "hotel gym with dumbbells only" or "at home, no equipment"
                  </p>
                  <textarea
                    value={travelSituation}
                    onChange={e => setTravelSituation(e.target.value)}
                    placeholder="What's your situation?"
                    rows={2}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 8, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setTravelOpen(false); setTravelSituation('') }}
                      style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Cancel</button>
                    <button
                      onClick={handleTravelAdjust}
                      disabled={!travelSituation.trim() || travelLoading}
                      style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: !travelSituation.trim() || travelLoading ? 'var(--surface2)' : 'var(--accent)', color: !travelSituation.trim() || travelLoading ? 'var(--text-dim)' : '#fff', fontSize: 12, cursor: !travelSituation.trim() || travelLoading ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                    >{travelLoading ? 'Adapting…' : 'Adapt Workout'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(() => {
            if (!selectedEntry || selectedEntry.day.type === 'rest') return null
            const { dayIdx } = selectedEntry
            const compKey = `${selectedEntry.weekNum}-${dayIdx}`
            const done = completions.has(compKey)
            const isPastOrToday = selectedKey! <= dateKey(new Date())
            if (!isPastOrToday) return null
            return done ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4ec97a' }}>✓ Completed</div>
                  <button
                    onClick={() => undoCompletion(selectedEntry.weekNum, dayIdx)}
                    disabled={completing}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', cursor: completing ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >
                    {completing ? '…' : 'Undo'}
                  </button>
                </div>
                {/* Auto-capture prompt */}
                {showLogPrompt && (
                  <div style={{ padding: '10px 12px', background: 'rgba(78,201,122,0.07)', border: '1px solid rgba(78,201,122,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#4ec97a', marginBottom: 1 }}>Nice work!</p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tap any exercise above to log your sets.</p>
                    </div>
                    <button onClick={() => setShowLogPrompt(false)} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => completeDay(selectedEntry.weekNum, dayIdx)}
                  disabled={completing}
                  style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid rgba(78,201,122,0.3)', background: 'rgba(78,201,122,0.08)', color: '#4ec97a', fontWeight: 700, fontSize: 12, cursor: completing ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
                >
                  {completing ? '…' : '✓  Complete Day'}
                </button>
                {/* Missed session — show on past days only */}
                {selectedKey! < dateKey(new Date()) && (
                  !missedOpen ? (
                    <button
                      onClick={() => setMissedOpen(true)}
                      style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(255,77,77,0.18)', background: 'transparent', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      Couldn&apos;t make it?
                    </button>
                  ) : (
                    <div style={{ padding: '12px', background: 'rgba(255,77,77,0.05)', border: '1px solid rgba(255,77,77,0.15)', borderRadius: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>What do you want to do?</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          onClick={() => skipDay(selectedEntry.weekNum, dayIdx)}
                          disabled={missedLoading}
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-mid)', fontSize: 12, cursor: missedLoading ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left' }}
                        >
                          {missedLoading ? '…' : 'Skip this day — mark it done and move on'}
                        </button>
                        <button
                          onClick={() => setMissedOpen(false)}
                          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Weeks not yet generated notice */}
      {Object.keys(weekPlans).length < TOTAL_WEEKS && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          Some weeks are missing from this calendar. Go to <span style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }} onClick={() => router.push('/plan')}>Your Plan</span> and tap AI Generate to build your full program.
        </div>
      )}

      {/* Exercise detail modal (reusable component — Common Mistakes = tip) */}
      {selectedExercise && (
        <ExerciseDetailModal
          data={selectedExercise}
          lastLog={lastLog}
          generating={exerciseFetching}
          userId={userId}
          historyRefresh={historyBump}
          onClose={() => setSelectedExercise(null)}
          footer={<TrackWorkout userId={userId} exerciseNormalized={selectedExercise.name_normalized} exerciseDisplay={selectedExercise.name_display} onSaved={() => setHistoryBump(n => n + 1)} />}
        />
      )}
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>}>
      <CalendarInner />
    </Suspense>
  )
}
