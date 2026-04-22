'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type DayPlan = {
  day: string
  label: string
  type: string
  movements: string[]
  duration: string
}

type Program = {
  id: string
  startDate: string
  totalWeeks: number
  status: string
}

const TOTAL_WEEKS = 13
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TYPE_COLOR: Record<string, string> = {
  workout: 'var(--accent)', warmup: 'var(--orange)', cooldown: 'var(--yellow)',
  morning: 'var(--green)', abs: 'var(--accent)', evening: 'var(--orange)', rest: 'var(--text-dim)',
}
const TYPE_BG: Record<string, string> = {
  workout: 'var(--accent-bg)', warmup: 'var(--orange-bg)', cooldown: 'var(--yellow-bg)',
  morning: 'var(--green-bg)', abs: 'var(--accent-bg)', evening: 'var(--orange-bg)',
  rest: 'rgba(120,130,148,0.06)',
}
const TYPE_BORDER: Record<string, string> = {
  workout: 'var(--accent-border)', warmup: 'var(--orange-border)', cooldown: 'var(--yellow-border)',
  morning: 'var(--green-border)', abs: 'var(--accent-border)', evening: 'var(--orange-border)',
  rest: 'var(--border)',
}

function getPhaseInfo(week: number) {
  if (week <= 4) return { phase: 'foundation', label: 'Foundation Phase', color: 'var(--green)', intensity: 'RPE 6-7. Build base fitness and movement quality. Focus on form over load.' }
  if (week <= 8) return { phase: 'build', label: 'Build Phase', color: 'var(--accent)', intensity: 'RPE 7-8. Increase volume and load progressively each week. Challenge yourself.' }
  if (week <= 10) return { phase: 'peak', label: 'Peak Phase', color: 'var(--orange)', intensity: 'RPE 9-10. Maximum training stimulus. Push hard — you have earned it.' }
  return { phase: 'maintenance', label: 'Maintenance Phase', color: 'var(--yellow)', intensity: 'RPE 6-7. Reduce volume, lock in gains, stay sharp and engaged.' }
}

function getCurrentWeek(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), TOTAL_WEEKS)
}

export default function PlanPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const todayIdx = (new Date().getDay() + 6) % 7

  const [program, setProgram] = useState<Program | null>(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [viewingWeek, setViewingWeek] = useState(1)
  const [weekPlans, setWeekPlans] = useState<Record<number, DayPlan[]>>({})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [programComplete, setProgramComplete] = useState(false)
  const pregenRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
    return data
  }, [user])

  const generateWeek = useCallback(async (
    prog: Program,
    weekNum: number,
    silent = false
  ) => {
    if (!silent) { setGenerating(true); setError(null) }

    const profile = await fetchProfile()
    if (!profile?.sport && !profile?.goal) {
      if (!silent) {
        setError('Set up your profile first so your AI coach knows what to build.')
        setGenerating(false)
      }
      return
    }

    const { phase, label, intensity } = getPhaseInfo(weekNum)
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, weekNumber: weekNum, phaseLabel: label, intensity }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { plan } = await res.json()

      await supabase.from('weekly_plans').upsert({
        program_id: prog.id,
        user_id: user!.id,
        week_number: weekNum,
        phase,
        plan,
      })

      setWeekPlans(prev => ({ ...prev, [weekNum]: plan }))
    } catch {
      if (!silent) setError('Generation failed. Tap Regenerate to try again.')
    } finally {
      if (!silent) setGenerating(false)
    }
  }, [fetchProfile, user])

  const initProgram = useCallback(async () => {
    // Load or create program
    let prog: Program
    const { data: existing } = await supabase
      .from('training_programs')
      .select('id, start_date, total_weeks, status')
      .eq('user_id', user!.id)
      .single()

    if (existing) {
      prog = { id: existing.id, startDate: existing.start_date, totalWeeks: existing.total_weeks, status: existing.status }
    } else {
      const { data: created } = await supabase
        .from('training_programs')
        .insert({ user_id: user!.id, start_date: new Date().toISOString().split('T')[0] })
        .select('id, start_date, total_weeks, status')
        .single()
      prog = { id: created!.id, startDate: created!.start_date, totalWeeks: created!.total_weeks, status: created!.status }
    }

    setProgram(prog)
    const week = getCurrentWeek(prog.startDate)
    setCurrentWeek(week)
    setViewingWeek(week)
    if (week >= TOTAL_WEEKS) setProgramComplete(true)

    // Load all existing weekly plans
    const { data: existingPlans } = await supabase
      .from('weekly_plans')
      .select('week_number, plan')
      .eq('program_id', prog.id)

    const plans: Record<number, DayPlan[]> = {}
    existingPlans?.forEach(p => { plans[p.week_number] = p.plan as DayPlan[] })
    setWeekPlans(plans)

    // Generate current week if missing
    if (!plans[week]) await generateWeek(prog, week)

    // Pre-generate next week silently
    if (week < TOTAL_WEEKS && !plans[week + 1] && !pregenRef.current.has(week + 1)) {
      pregenRef.current.add(week + 1)
      generateWeek(prog, week + 1, true)
    }
  }, [user, generateWeek])

  useEffect(() => {
    if (!user) return
    initProgram()
  }, [user, initProgram])

  async function navigateWeek(dir: number) {
    const next = viewingWeek + dir
    if (next < 1 || next > TOTAL_WEEKS || !program) return
    setViewingWeek(next)
    if (!weekPlans[next]) generateWeek(program, next)

    // Pre-gen the one after
    const after = next + dir
    if (after >= 1 && after <= TOTAL_WEEKS && !weekPlans[after] && !pregenRef.current.has(after)) {
      pregenRef.current.add(after)
      generateWeek(program, after, true)
    }
  }

  async function regenerate() {
    if (!program) return
    await supabase.from('weekly_plans').delete()
      .eq('program_id', program.id).eq('week_number', viewingWeek)
    setWeekPlans(prev => { const n = { ...prev }; delete n[viewingWeek]; return n })
    generateWeek(program, viewingWeek)
  }

  async function restartProgram() {
    if (!user) return
    await supabase.from('training_programs').delete().eq('user_id', user.id)
    setProgram(null); setWeekPlans({}); setCurrentWeek(1); setViewingWeek(1); setProgramComplete(false)
    pregenRef.current.clear()
    initProgram()
  }

  async function continueProgram() {
    if (!program) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('training_programs').update({ start_date: today, status: 'active' }).eq('id', program.id)
    await supabase.from('weekly_plans').delete().eq('program_id', program.id)
    const updated = { ...program, startDate: today, status: 'active' }
    setProgram(updated); setWeekPlans({}); setCurrentWeek(1); setViewingWeek(1); setProgramComplete(false)
    pregenRef.current.clear()
    generateWeek(updated, 1)
  }

  if (authLoading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  if (generating && !weekPlans[viewingWeek]) {
    const { label, color } = getPhaseInfo(viewingWeek)
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>⚡</div>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Building Week {viewingWeek}…</p>
        <p style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 12 }}>{label}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
          Your AI coach is designing a personalized 7-day plan. This takes about 10 seconds.
        </p>
      </div>
    )
  }

  // Program complete screen
  if (programComplete && !weekPlans[viewingWeek]) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Program Complete!</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          You finished all 13 weeks. That&apos;s a serious achievement — your fitness has transformed. What&apos;s next?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={continueProgram} style={{ padding: '14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Continue for Another 3 Months →
          </button>
          <button onClick={restartProgram} style={{ padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            Start a Fresh Plan
          </button>
        </div>
      </div>
    )
  }

  const { label: phaseLabel, color: phaseColor } = getPhaseInfo(viewingWeek)
  const progress = Math.round((viewingWeek / TOTAL_WEEKS) * 100)
  const plan = weekPlans[viewingWeek] ?? []

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Your Plan</h1>
          <p style={{ fontSize: 12, color: phaseColor, fontWeight: 700, letterSpacing: '0.04em' }}>{phaseLabel}</p>
        </div>
        <button
          onClick={regenerate}
          style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, marginTop: 4 }}
        >
          Regenerate
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Week {viewingWeek} of {TOTAL_WEEKS}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{progress}%</span>
        </div>
        <div style={{ height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: phaseColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <button
          onClick={() => navigateWeek(-1)}
          disabled={viewingWeek <= 1}
          style={{ fontSize: 13, fontWeight: 600, color: viewingWeek <= 1 ? 'var(--text-dim)' : 'var(--accent)', background: 'none', border: 'none', cursor: viewingWeek <= 1 ? 'default' : 'pointer', padding: '4px 8px' }}
        >
          ← Week {viewingWeek - 1 > 0 ? viewingWeek - 1 : ''}
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Week {viewingWeek}</span>
          {viewingWeek === currentWeek && (
            <div style={{ fontSize: 10, color: phaseColor, fontWeight: 700, marginTop: 1 }}>CURRENT</div>
          )}
        </div>
        <button
          onClick={() => navigateWeek(1)}
          disabled={viewingWeek >= TOTAL_WEEKS}
          style={{ fontSize: 13, fontWeight: 600, color: viewingWeek >= TOTAL_WEEKS ? 'var(--text-dim)' : 'var(--accent)', background: 'none', border: 'none', cursor: viewingWeek >= TOTAL_WEEKS ? 'default' : 'pointer', padding: '4px 8px' }}
        >
          Week {viewingWeek + 1 <= TOTAL_WEEKS ? viewingWeek + 1 : ''} →
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--text)' }}>
          {error}
        </div>
      )}

      {/* Day strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{
            flexShrink: 0, width: 42, height: 42, borderRadius: 10,
            background: i === todayIdx && viewingWeek === currentWeek ? 'var(--accent)' : 'var(--surface)',
            border: `1px solid ${i === todayIdx && viewingWeek === currentWeek ? 'var(--accent)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: i === todayIdx && viewingWeek === currentWeek ? '#fff' : 'var(--text-dim)' }}>{d}</span>
          </div>
        ))}
      </div>

      {/* Generating indicator for background weeks */}
      {generating && weekPlans[viewingWeek] && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>
          Pre-generating adjacent weeks…
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan.map((day, i) => (
          <div key={day.day} style={{
            background: i === todayIdx && viewingWeek === currentWeek ? (TYPE_BG[day.type] ?? 'var(--surface)') : 'var(--surface)',
            border: `1px solid ${i === todayIdx && viewingWeek === currentWeek ? (TYPE_BORDER[day.type] ?? 'var(--border)') : 'var(--border)'}`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 28, letterSpacing: '0.04em', color: TYPE_COLOR[day.type] ?? 'var(--text-dim)' }}>
                  {day.day}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{day.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.duration}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {day.movements.map((m, mi) => (
                <span key={mi} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* End-of-program prompt on week 13 */}
      {viewingWeek === TOTAL_WEEKS && plan.length > 0 && (
        <div style={{ marginTop: 24, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Final week incoming 🏁</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>You&apos;re almost there. After this week, choose your next move.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={continueProgram} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Continue 3 More Months
            </button>
            <button onClick={restartProgram} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Fresh Start
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
