'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type DayPlan = { day: string; label: string; type: string; movements: string[]; duration: string; focus?: string; rest?: { between_sets: string; between_rounds: string }; coaching?: string }
type Program = { id: string; startDate: string; totalWeeks: number; status: string }
type ExerciseDetail = { name_normalized: string; name_display: string; how: string; breathing: string; core: string; tip: string }
type WorkoutLog = { id: string; exercise_normalized: string; logged_at: string; sets: number | null; reps: number | null; weight: number | null; weight_unit: string }
type CompletionInsert = { user_id: string; program_id: string; week_number: number; day_index: number; skipped: boolean }

function parseExerciseName(m: string) { return m.replace(/\s+\d+[×x]\d+.*$/i, '').replace(/\s+\d+\s+sets?.*$/i, '').trim() }
function normalizeExerciseName(n: string) { return n.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_') }
const REST_MOVEMENTS = new Set(['Full rest', 'Light walk optional', 'Sleep 8+ hours'])
function fallbackDetail(m: string, day: DayPlan): ExerciseDetail {
  const name = parseExerciseName(m)
  const restNote = day.rest && day.rest.between_sets !== '—' ? ` Rest ${day.rest.between_sets} between sets.` : ''
  return {
    name_normalized: normalizeExerciseName(name),
    name_display: name,
    how: 'Detailed coaching for this exercise is still loading. Tap again in a few seconds, or regenerate the week to refresh.',
    breathing: 'Exhale on exertion — the push, pull, or drive phase. Inhale slowly and controlled on the return.',
    core: 'Brace your core before every rep. Think of pulling your navel toward your spine throughout the set.',
    tip: (day.coaching ?? 'Focus on controlled form over speed.') + restNote,
  }
}
function extractDisplayNames(plan: DayPlan[]) {
  return [...new Set(plan.filter(d => d.type !== 'rest').flatMap(d => d.movements).map(parseExerciseName).filter(n => n && !REST_MOVEMENTS.has(n)))]
}

const TOTAL_WEEKS = 13
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COMPLETION_MESSAGES = [
  'You crushed it. Every rep counts.',
  'Built different. Keep going.',
  'Records were made for breaking.',
  'Another day, another win.',
  'You hit your numbers. Respect.',
  'Consistency is the cheat code.',
  "That's what champions do.",
  'One more day closer to your best.',
]
const TYPE_COLOR: Record<string, string> = { workout: 'var(--accent)', warmup: 'var(--orange)', cooldown: 'var(--yellow)', morning: 'var(--green)', abs: 'var(--accent)', evening: 'var(--orange)', rest: 'var(--text-dim)' }
const TYPE_BG: Record<string, string> = { workout: 'var(--accent-bg)', warmup: 'var(--orange-bg)', cooldown: 'var(--yellow-bg)', morning: 'var(--green-bg)', abs: 'var(--accent-bg)', evening: 'var(--orange-bg)', rest: 'rgba(120,130,148,0.06)' }
const TYPE_BORDER: Record<string, string> = { workout: 'var(--accent-border)', warmup: 'var(--orange-border)', cooldown: 'var(--yellow-border)', morning: 'var(--green-border)', abs: 'var(--accent-border)', evening: 'var(--orange-border)', rest: 'var(--border)' }

function getPhaseInfo(week: number) {
  if (week <= 4) return { phase: 'foundation', label: 'Foundation Phase', color: 'var(--green)', intensity: 'RPE 6-7. Build base fitness and movement quality. Focus on form over load.' }
  if (week <= 8) return { phase: 'build', label: 'Build Phase', color: 'var(--accent)', intensity: 'RPE 7-8. Increase volume and load progressively each week. Challenge yourself.' }
  if (week <= 10) return { phase: 'peak', label: 'Peak Phase', color: 'var(--orange)', intensity: 'RPE 9-10. Maximum training stimulus. Push hard — you have earned it.' }
  return { phase: 'maintenance', label: 'Maintenance Phase', color: 'var(--yellow)', intensity: 'RPE 6-7. Reduce volume, lock in gains, stay sharp and engaged.' }
}

function getCurrentWeek(startDate: string) {
  const start = new Date(startDate)
  const now = new Date()
  return Math.min(Math.max(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1, 1), TOTAL_WEEKS)
}

function DumbbellSparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="1" y="10" width="3" height="7" rx="1.2"/><rect x="4" y="11.5" width="2" height="4" rx="0.5"/>
      <rect x="6" y="12.5" width="12" height="2" rx="1"/><rect x="18" y="11.5" width="2" height="4" rx="0.5"/>
      <rect x="20" y="10" width="3" height="7" rx="1.2"/>
      <path d="M20 1.5 L20.7 3.3 L22.5 4 L20.7 4.7 L20 6.5 L19.3 4.7 L17.5 4 L19.3 3.3 Z"/>
      <path d="M5 1.5 L5.45 2.55 L6.5 3 L5.45 3.45 L5 4.5 L4.55 3.45 L3.5 3 L4.55 2.55 Z"/>
      <circle cx="22" cy="8" r="0.9"/>
    </svg>
  )
}

export default function PlanPage() {
  const { user, loading: authLoading, isAdmin, role } = useAuth()
  const router = useRouter()
  const todayIdx = (new Date().getDay() + 6) % 7

  const [program, setProgram] = useState<Program | null>(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [viewingWeek, setViewingWeek] = useState(1)
  const [weekPlans, setWeekPlans] = useState<Record<number, DayPlan[]>>({})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [programComplete, setProgramComplete] = useState(false)
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [regenInstructions, setRegenInstructions] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)
  const [pendingWeek, setPendingWeek] = useState<number | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  const [exerciseLibrary, setExerciseLibrary] = useState<Record<string, ExerciseDetail>>({})
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDetail | null>(null)
  const [lastLog, setLastLog] = useState<WorkoutLog | null>(null)
  const [logWeight, setLogWeight] = useState('')
  const [logSets, setLogSets] = useState('')
  const [logReps, setLogReps] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [logSaved, setLogSaved] = useState(false)

  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [missedDays, setMissedDays] = useState<string[]>([])
  const [pendingComplete, setPendingComplete] = useState<{ weekNum: number; dayIdx: number } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [selectedDayIdx, setSelectedDayIdx] = useState(todayIdx)
  const [completionMsg, setCompletionMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
    return data
  }, [user])

  const loadLibraryForWeek = useCallback(async (plan: DayPlan[]) => {
    const names = [...new Set(extractDisplayNames(plan).map(normalizeExerciseName))]
    if (!names.length) return
    const { data } = await supabase.from('exercise_library').select('name_normalized, name_display, how, breathing, core, tip').in('name_normalized', names)
    if (data) setExerciseLibrary(prev => { const n = { ...prev }; data.forEach(e => { n[e.name_normalized] = e as ExerciseDetail }); return n })
  }, [])

  const populateLibrary = useCallback(async (plan: DayPlan[]) => {
    const displayNames = extractDisplayNames(plan)
    const normalizedNames = displayNames.map(normalizeExerciseName)
    if (!normalizedNames.length) return
    const { data: existing } = await supabase.from('exercise_library').select('name_normalized').in('name_normalized', normalizedNames)
    const existingSet = new Set(existing?.map(e => e.name_normalized) ?? [])
    const missing = [...new Set(displayNames.filter(n => !existingSet.has(normalizeExerciseName(n))))]
    if (missing.length > 0) {
      try {
        const res = await fetch('/api/generate-exercise-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exercises: missing }) })
        if (res.ok) {
          const { details } = await res.json()
          if (Array.isArray(details) && details.length > 0) await supabase.from('exercise_library').upsert(details, { onConflict: 'name_normalized' })
        }
      } catch { /* silent */ }
    }
    await loadLibraryForWeek(plan)
  }, [loadLibraryForWeek])

  const generateWeek = useCallback(async (prog: Program, weekNum: number, silent = false, instructions = '') => {
    if (!silent) { setGenerating(true); setError(null) }
    const profile = await fetchProfile()
    if (!profile?.sport && !profile?.goal) {
      if (!silent) { setError('Set up your profile first so your AI coach knows what to build.'); setGenerating(false) }
      return
    }
    const { phase, label, intensity } = getPhaseInfo(weekNum)
    try {
      const res = await fetch('/api/generate-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, weekNumber: weekNum, phaseLabel: label, intensity, instructions }) })
      if (!res.ok) throw new Error('failed')
      const { plan } = await res.json()
      await supabase.from('weekly_plans').upsert({ program_id: prog.id, user_id: user!.id, week_number: weekNum, phase, plan })
      setWeekPlans(prev => ({ ...prev, [weekNum]: plan }))
      if (!silent) populateLibrary(plan)
    } catch {
      if (!silent) setError('Generation failed. Tap the regen button to try again.')
    } finally {
      if (!silent) setGenerating(false)
    }
  }, [fetchProfile, user, populateLibrary])

  const startProgram = useCallback(async () => {
    if (!user) return
    setGenerating(true)
    const today = new Date().toISOString().split('T')[0]
    const { data: newProg } = await supabase.from('training_programs').insert({ user_id: user.id, start_date: today, total_weeks: 13, status: 'active' }).select('id, start_date, total_weeks, status').single()
    if (!newProg) { setGenerating(false); return }
    const prog: Program = { id: newProg.id, startDate: newProg.start_date, totalWeeks: newProg.total_weeks, status: newProg.status }
    setProgram(prog); setCurrentWeek(1); setViewingWeek(1)
    await generateWeek(prog, 1)
  }, [user, generateWeek])

  const initProgram = useCallback(async () => {
    if (!user) return
    setDataLoading(true)
    const [{ data: existing }, { data: prof }] = await Promise.all([
      supabase.from('training_programs').select('id, start_date, total_weeks, status').eq('user_id', user.id).single(),
      supabase.from('profiles').select('sport, goal').eq('id', user.id).single(),
    ])
    setProfileReady(!!(prof?.sport || prof?.goal))
    if (!existing) { setDataLoading(false); return }
    const prog: Program = { id: existing.id, startDate: existing.start_date, totalWeeks: existing.total_weeks, status: existing.status }
    setProgram(prog)
    const week = getCurrentWeek(prog.startDate)
    setCurrentWeek(week)
    setViewingWeek(week)
    if (week >= TOTAL_WEEKS) setProgramComplete(true)
    const [{ data: plans }, { data: compData }] = await Promise.all([
      supabase.from('weekly_plans').select('week_number, plan').eq('program_id', prog.id),
      supabase.from('day_completions').select('week_number, day_index').eq('program_id', prog.id).eq('user_id', user.id),
    ])
    const planMap: Record<number, DayPlan[]> = {}
    plans?.forEach(p => { planMap[p.week_number] = p.plan as DayPlan[] })
    setWeekPlans(planMap)
    if (compData) setCompletions(new Set(compData.map(r => `${r.week_number}-${r.day_index}`)))
    if (!planMap[week]) await generateWeek(prog, week)
    setDataLoading(false)
  }, [user, generateWeek])

  useEffect(() => { if (user) initProgram() }, [user, initProgram])
  useEffect(() => { const plan = weekPlans[viewingWeek]; if (plan) populateLibrary(plan) }, [viewingWeek, weekPlans, populateLibrary])
  useEffect(() => { setSelectedDayIdx(viewingWeek === currentWeek ? todayIdx : 0) }, [viewingWeek, currentWeek, todayIdx])

  useEffect(() => {
    setLastLog(null); setLogWeight(''); setLogSets(''); setLogReps(''); setLogSaved(false)
    if (!selectedExercise || !user) return
    supabase.from('workout_logs').select('id, exercise_normalized, logged_at, sets, reps, weight, weight_unit').eq('user_id', user.id).eq('exercise_normalized', selectedExercise.name_normalized).order('logged_at', { ascending: false }).limit(1).single().then(({ data }) => { if (data) setLastLog(data as WorkoutLog) })
  }, [selectedExercise, user])

  async function logSet() {
    if (!user || !selectedExercise || logSaving || logSaved) return
    setLogSaving(true)
    await supabase.from('workout_logs').insert({ user_id: user.id, exercise_normalized: selectedExercise.name_normalized, sets: logSets ? parseInt(logSets) : null, reps: logReps ? parseInt(logReps) : null, weight: logWeight ? parseFloat(logWeight) : null, weight_unit: 'lbs' })
    const { data } = await supabase.from('workout_logs').select('id, exercise_normalized, logged_at, sets, reps, weight, weight_unit').eq('user_id', user.id).eq('exercise_normalized', selectedExercise.name_normalized).order('logged_at', { ascending: false }).limit(1).single()
    if (data) setLastLog(data as WorkoutLog)
    setLogSaved(true); setLogSaving(false)
  }

  async function doMarkComplete(weekNum: number, dayIdx: number) {
    if (!program || !user) return
    setCompleting(true)
    await supabase.from('day_completions').upsert({ user_id: user.id, program_id: program.id, week_number: weekNum, day_index: dayIdx, skipped: false }, { onConflict: 'user_id,program_id,week_number,day_index' })
    setCompletions(prev => new Set([...prev, `${weekNum}-${dayIdx}`]))
    setCompleting(false)
    const msg = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]
    setCompletionMsg(msg)
    setTimeout(() => setCompletionMsg(null), 4000)
  }

  async function handleCompleteDay(weekNum: number, dayIdx: number) {
    const plan = weekPlans[weekNum]
    if (!plan || !program) return
    if (weekNum === currentWeek) {
      const missed: string[] = []
      for (let i = 0; i < dayIdx; i++) {
        if (plan[i].type === 'rest') continue
        if (!completions.has(`${weekNum}-${i}`)) missed.push(plan[i].day)
      }
      if (missed.length > 0) { setMissedDays(missed); setPendingComplete({ weekNum, dayIdx }); setShowCompleteModal(true); return }
    }
    await doMarkComplete(weekNum, dayIdx)
  }

  async function markAllAndComplete() {
    if (!program || !user || !pendingComplete) return
    setCompleting(true)
    const plan = weekPlans[pendingComplete.weekNum]
    const inserts: CompletionInsert[] = []
    for (let i = 0; i <= pendingComplete.dayIdx; i++) {
      const key = `${pendingComplete.weekNum}-${i}`
      if (!completions.has(key) && plan[i].type !== 'rest') inserts.push({ user_id: user.id, program_id: program.id, week_number: pendingComplete.weekNum, day_index: i, skipped: false })
    }
    if (inserts.length > 0) {
      await supabase.from('day_completions').upsert(inserts, { onConflict: 'user_id,program_id,week_number,day_index' })
      setCompletions(prev => new Set([...prev, ...inserts.map(r => `${r.week_number}-${r.day_index}`)]))
    }
    setShowCompleteModal(false); setPendingComplete(null); setCompleting(false)
  }

  async function restructureAndComplete() {
    if (!pendingComplete) return
    setShowCompleteModal(false)
    await doMarkComplete(pendingComplete.weekNum, pendingComplete.dayIdx)
    setRegenInstructions(`I missed ${missedDays.join(' and ')}. Please restructure the remaining days this week to make up for the missed sessions without overloading any single day.`)
    setPendingComplete(null); setShowRegenModal(true)
  }

  function navigateWeek(dir: number) {
    const next = viewingWeek + dir
    if (next < 1 || next > TOTAL_WEEKS || !program) return
    if (!weekPlans[next]) { setPendingWeek(next); setShowGenModal(true); return }
    setViewingWeek(next)
  }

  async function confirmGenerate() {
    if (!pendingWeek || !program) return
    setShowGenModal(false); setViewingWeek(pendingWeek)
    const week = pendingWeek; setPendingWeek(null)
    generateWeek(program, week)
  }

  async function regenerate() {
    if (!program) return
    setShowRegenModal(false)
    await supabase.from('weekly_plans').delete().eq('program_id', program.id).eq('week_number', viewingWeek)
    setWeekPlans(prev => { const n = { ...prev }; delete n[viewingWeek]; return n })
    generateWeek(program, viewingWeek, false, regenInstructions)
    setRegenInstructions('')
  }

  async function restartProgram() {
    if (!user) return
    await supabase.from('training_programs').delete().eq('user_id', user.id)
    setProgram(null); setWeekPlans({}); setCurrentWeek(1); setViewingWeek(1); setProgramComplete(false)
    initProgram()
  }

  async function continueProgram() {
    if (!program) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('training_programs').update({ start_date: today, status: 'active' }).eq('id', program.id)
    await supabase.from('weekly_plans').delete().eq('program_id', program.id)
    const updated = { ...program, startDate: today, status: 'active' }
    setProgram(updated); setWeekPlans({}); setCurrentWeek(1); setViewingWeek(1); setProgramComplete(false)
    generateWeek(updated, 1)
  }

  function isDayActionable(weekNum: number, dayIdx: number) {
    if (weekNum < currentWeek) return true
    if (weekNum === currentWeek && dayIdx <= todayIdx) return true
    return false
  }

  if (authLoading || dataLoading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>

  if (generating && !weekPlans[viewingWeek]) {
    const { label, color } = getPhaseInfo(viewingWeek)
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>⚡</div>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Building Week {viewingWeek}…</p>
        <p style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 12 }}>{label}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>Your 3-month program generates week by week — each week is built fresh when you need it. Takes about 10 seconds.</p>
      </div>
    )
  }

  if (programComplete && !weekPlans[viewingWeek]) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Program Complete!</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>You finished all 13 weeks. That&apos;s a serious achievement. What&apos;s next?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={continueProgram} style={{ padding: '14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Continue for Another 3 Months →</button>
          <button onClick={restartProgram} style={{ padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Start a Fresh Plan</button>
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⚡</div>
        <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          {profileReady ? 'Ready to Build Your Plan' : 'Set Up Your Profile First'}
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
          {profileReady
            ? 'Your AI coach will build a personalized 13-week program based on your profile. It takes about 15 seconds.'
            : 'Tell your AI coach about your sport, goals, and schedule so it can build the right program for you.'}
        </p>
        {profileReady ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
            <button onClick={startProgram} disabled={generating} style={{ padding: '15px 28px', borderRadius: 12, border: 'none', background: generating ? 'var(--surface2)' : 'var(--accent)', color: generating ? 'var(--text-dim)' : '#fff', fontWeight: 800, fontSize: 15, cursor: generating ? 'default' : 'pointer' }}>
              {generating ? 'Building Week 1…' : 'Generate My 3-Month Plan →'}
            </button>
            <button onClick={() => router.push('/profile')} style={{ padding: '11px 28px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Edit Profile First
            </button>
          </div>
        ) : (
          <button onClick={() => router.push('/profile')} style={{ padding: '15px 28px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            Set Up Profile →
          </button>
        )}
      </div>
    )
  }

  const showRightPanel = isAdmin || role === 'ff'
  const { label: phaseLabel, color: phaseColor } = getPhaseInfo(viewingWeek)
  const progress = Math.round((viewingWeek / TOTAL_WEEKS) * 100)
  const plan = weekPlans[viewingWeek] ?? []

  return (
    <>
      <style>{`
        .plan-outer { padding: 24px 16px 100px; max-width: 760px; margin: 0 auto; }
        .plan-grid { display: flex; flex-direction: column; gap: 24px; }
        @media (min-width: 768px) {
          .plan-outer { padding: 32px 40px 80px; }
          .plan-outer.with-sidebar { max-width: 1060px; }
          .plan-grid.has-sidebar { flex-direction: row; align-items: flex-start; gap: 40px; }
          .plan-grid.has-sidebar .plan-left { flex: 1; min-width: 0; }
          .plan-grid.has-sidebar .plan-right { flex: 0 0 300px; }
        }
      `}</style>
      <div className={`plan-outer${showRightPanel ? ' with-sidebar' : ''}`}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Your Plan</h1>
            <p style={{ fontSize: 12, color: phaseColor, fontWeight: 700, letterSpacing: '0.04em' }}>{phaseLabel}</p>
          </div>
          <button onClick={() => setShowRegenModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', marginTop: 4 }}>
            <DumbbellSparkleIcon size={18}/>
          </button>
        </div>

        <div className={`plan-grid${showRightPanel ? ' has-sidebar' : ''}`}>
          <div className="plan-left">

            <div style={{ marginTop: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Week {viewingWeek} of {TOTAL_WEEKS}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{progress}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: phaseColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <button onClick={() => navigateWeek(-1)} disabled={viewingWeek <= 1} style={{ fontSize: 13, fontWeight: 600, color: viewingWeek <= 1 ? 'var(--text-dim)' : 'var(--accent)', background: 'none', border: 'none', cursor: viewingWeek <= 1 ? 'default' : 'pointer', padding: '4px 8px' }}>
                ← Week {viewingWeek - 1 > 0 ? viewingWeek - 1 : ''}
              </button>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Week {viewingWeek}</span>
                {viewingWeek === currentWeek && <div style={{ fontSize: 10, color: phaseColor, fontWeight: 700, marginTop: 1 }}>CURRENT</div>}
              </div>
              <button onClick={() => navigateWeek(1)} disabled={viewingWeek >= TOTAL_WEEKS} style={{ fontSize: 13, fontWeight: 600, color: viewingWeek >= TOTAL_WEEKS ? 'var(--text-dim)' : 'var(--accent)', background: 'none', border: 'none', cursor: viewingWeek >= TOTAL_WEEKS ? 'default' : 'pointer', padding: '4px 8px' }}>
                Week {viewingWeek + 1 <= TOTAL_WEEKS ? viewingWeek + 1 : ''} →
              </button>
            </div>

            {error && <div style={{ padding: '12px 16px', background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
              {DAYS.map((d, i) => {
                const isSelected = i === selectedDayIdx
                const isToday = i === todayIdx && viewingWeek === currentWeek
                const chipCompleted = completions.has(`${viewingWeek}-${i}`) && plan[i]?.type !== 'rest'
                return (
                  <button key={d} onClick={() => setSelectedDayIdx(i)} style={{ flexShrink: 0, width: 42, height: 48, borderRadius: 10, background: isSelected ? 'var(--accent)' : isToday ? 'var(--accent-bg)' : 'var(--surface)', border: `1px solid ${isSelected ? 'var(--accent)' : isToday ? 'var(--accent-border)' : 'var(--border)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-dim)' }}>{d}</span>
                    {chipCompleted && <span style={{ fontSize: 8, lineHeight: 1, color: isSelected ? 'rgba(255,255,255,0.85)' : '#4ec97a' }}>✓</span>}
                  </button>
                )
              })}
            </div>

            {completionMsg && (
              <div style={{ padding: '14px 16px', background: 'rgba(78,201,122,0.1)', border: '1px solid rgba(78,201,122,0.3)', borderRadius: 12, marginBottom: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#4ec97a', marginBottom: 3 }}>✓ Day Complete!</p>
                <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{completionMsg}</p>
              </div>
            )}

            {(() => {
              const day = plan[selectedDayIdx]
              if (!day) return null
              const i = selectedDayIdx
              const isToday = i === todayIdx && viewingWeek === currentWeek
              const actionable = isDayActionable(viewingWeek, i)
              const completed = completions.has(`${viewingWeek}-${i}`)
              const isRest = day.type === 'rest'
              return (
                <div style={{ background: isToday ? (TYPE_BG[day.type] ?? 'var(--surface)') : 'var(--surface)', border: `1px solid ${isToday ? (TYPE_BORDER[day.type] ?? 'var(--border)') : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (!isRest && (day.focus || day.coaching)) ? 6 : 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 28, letterSpacing: '0.04em', color: TYPE_COLOR[day.type] ?? 'var(--text-dim)' }}>{day.day}</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{day.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {completed && !isRest && <span style={{ fontSize: 12, fontWeight: 800, color: '#4ec97a' }}>✓ Done</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.duration}</span>
                    </div>
                  </div>

                  {!isRest && (day.focus || day.rest || day.coaching) && (
                    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                      {day.focus && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[day.type] ?? 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.02em' }}>{day.focus}</p>
                      )}
                      {day.rest && day.rest.between_sets !== '—' && (
                        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: day.coaching ? 6 : 0 }}>
                          ⏱ {day.rest.between_sets} between sets · {day.rest.between_rounds} between rounds
                        </p>
                      )}
                      {day.coaching && (
                        <p style={{ fontSize: 12, color: 'var(--text-mid)', fontStyle: 'italic', lineHeight: 1.55, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                          {day.coaching}
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: actionable && !isRest && !completed ? 10 : 0 }}>
                    {day.movements.map((m, mi) => {
                      const detail = exerciseLibrary[normalizeExerciseName(parseExerciseName(m))]
                      return (
                        <button key={mi} onClick={() => setSelectedExercise(detail ?? fallbackDetail(m, day))} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {m}
                        </button>
                      )
                    })}
                  </div>

                  {actionable && !isRest && !completed && (
                    <button onClick={() => handleCompleteDay(viewingWeek, i)} disabled={completing} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid rgba(78,201,122,0.3)', background: 'rgba(78,201,122,0.08)', color: '#4ec97a', fontWeight: 700, fontSize: 12, cursor: completing ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
                      {completing ? '…' : '✓  Complete Day'}
                    </button>
                  )}
                </div>
              )
            })()}

            {viewingWeek === TOTAL_WEEKS && plan.length > 0 && (
              <div style={{ marginTop: 24, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Final week incoming 🏁</p>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>You&apos;re almost there. After this week, choose your next move.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={continueProgram} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Continue 3 More Months</button>
                  <button onClick={restartProgram} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fresh Start</button>
                </div>
              </div>
            )}

          </div>

          {showRightPanel && (
            <div className="plan-right">
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 12 }}>Programs</p>
              <div style={{ background: 'linear-gradient(145deg, rgba(0,12,40,0.96) 0%, rgba(0,6,22,0.99) 100%)', border: '1px solid rgba(0,180,255,0.2)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,180,255,0.07), inset 0 1px 0 rgba(0,180,255,0.08)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,180,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(0,180,255,0.2) 0%, rgba(0,100,200,0.12) 100%)', border: '1px solid rgba(0,180,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b4ff' }}>
                    <DumbbellSparkleIcon size={18}/>
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#dff0ff', marginBottom: 2 }}>AX2 Athlean-X</p>
                    <p style={{ fontSize: 10, color: 'rgba(0,180,255,0.6)', fontWeight: 600, letterSpacing: '0.03em' }}>12 Weeks · Phase-Based</p>
                  </div>
                </div>
                <div style={{ padding: '14px 16px 18px' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                    {['Strength', 'Athletic', 'Hypertrophy'].map(tag => (
                      <span key={tag} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 20, background: 'rgba(0,180,255,0.07)', border: '1px solid rgba(0,180,255,0.15)', color: 'rgba(0,180,255,0.7)', fontWeight: 700, letterSpacing: '0.03em' }}>{tag}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: '#4a8aaa', lineHeight: 1.65, marginBottom: 14 }}>
                    Phase-based training with progressive mechanical stimulus. Athletic movements, weekly benchmarks, and HIIT conditioning built in.
                  </p>
                  <button style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid rgba(0,180,255,0.25)', background: 'rgba(0,180,255,0.08)', color: 'rgba(0,180,255,0.5)', fontWeight: 700, fontSize: 12, cursor: 'not-allowed', fontFamily: 'inherit', letterSpacing: '0.02em' }}>
                    Coming Soon
                  </button>
                  <p style={{ fontSize: 9, color: 'rgba(90,154,184,0.4)', textAlign: 'center', marginTop: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin · F&F Access</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Exercise detail modal */}
      {selectedExercise && (
        <div onClick={() => setSelectedExercise(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, border: '1px solid var(--border)', borderBottom: 'none', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <p style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3, paddingRight: 12 }}>{selectedExercise.name_display}</p>
                <button onClick={() => setSelectedExercise(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 24px 40px', flexGrow: 1 }}>
              <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase' }}>Last Session</p>
                {lastLog ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {lastLog.weight != null && <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{lastLog.weight} {lastLog.weight_unit}</span>}
                    {(lastLog.sets != null || lastLog.reps != null) && <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>{[lastLog.sets != null && `${lastLog.sets} sets`, lastLog.reps != null && `${lastLog.reps} reps`].filter(Boolean).join(' · ')}</span>}
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>{new Date(lastLog.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ) : <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No sessions logged yet</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {[{ label: 'HOW TO DO IT', text: selectedExercise.how, color: 'var(--text)' }, { label: 'BREATHING', text: selectedExercise.breathing, color: 'var(--text-mid)' }, { label: 'CORE ENGAGEMENT', text: selectedExercise.core, color: 'var(--text-mid)' }, { label: 'COACHING TIP', text: selectedExercise.tip, color: 'var(--accent)' }].map(({ label, text, color }) => (
                  <div key={label} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ fontSize: 13, color, lineHeight: 1.65 }}>{text}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: '14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase' }}>Log Set</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[{ label: 'Weight (lbs)', value: logWeight, set: setLogWeight }, { label: 'Sets', value: logSets, set: setLogSets }, { label: 'Reps', value: logReps, set: setLogReps }].map(({ label, value, set }) => (
                    <div key={label}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.04em' }}>{label}</p>
                      <input type="number" inputMode="decimal" value={value} onChange={e => { set(e.target.value); setLogSaved(false) }} style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontWeight: 700, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                    </div>
                  ))}
                </div>
                <button onClick={logSet} disabled={logSaving || logSaved} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: logSaved ? '#4ec97a' : 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: logSaving || logSaved ? 'default' : 'pointer', transition: 'background 0.2s' }}>
                  {logSaving ? 'Saving…' : logSaved ? '✓ Logged' : 'Log Set'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Missed days modal */}
      {showCompleteModal && (
        <div onClick={() => setShowCompleteModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>You missed some days</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>{missedDays.join(', ')}</strong> {missedDays.length === 1 ? 'was' : 'were'} not completed. How would you like to handle it?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={markAllAndComplete} disabled={completing} style={{ padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>✓  Mark All as Complete</button>
              <button onClick={restructureAndComplete} disabled={completing} style={{ padding: '13px', borderRadius: 10, border: '1px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                ⚡ Restructure My Week
                <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8, marginTop: 3 }}>AI rebuilds your remaining days</div>
              </button>
              <button onClick={async () => { if (pendingComplete) { await doMarkComplete(pendingComplete.weekNum, pendingComplete.dayIdx); setPendingComplete(null) } setShowCompleteModal(false) }} disabled={completing} style={{ padding: '13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Just Mark Today</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate week modal */}
      {showGenModal && pendingWeek && (
        <div onClick={() => { setShowGenModal(false); setPendingWeek(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: 'var(--accent)' }}><DumbbellSparkleIcon size={26}/></span>
              <p style={{ fontSize: 18, fontWeight: 700 }}>Generate Week {pendingWeek}?</p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>Your AI coach will build a new 7-day plan for Week {pendingWeek} — {getPhaseInfo(pendingWeek).label}.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowGenModal(false); setPendingWeek(null) }} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmGenerate} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Generate →</button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate modal */}
      {showRegenModal && (
        <div onClick={() => { setShowRegenModal(false); setRegenInstructions('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: 'var(--accent)' }}><DumbbellSparkleIcon size={26}/></span>
              <p style={{ fontSize: 18, fontWeight: 700 }}>Regenerate Week {viewingWeek}?</p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.6 }}>Your current plan for this week will be replaced. Add any specific instructions below, or leave blank to let the AI decide.</p>
            <textarea value={regenInstructions} onChange={e => setRegenInstructions(e.target.value)} placeholder={'e.g. "No workouts on Saturday" or "I missed Mon — rebuild the rest of the week"'} rows={3} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, padding: '10px 12px', resize: 'none', fontFamily: 'inherit', marginBottom: 18, boxSizing: 'border-box', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowRegenModal(false); setRegenInstructions('') }} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={regenerate} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Confirm →</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
