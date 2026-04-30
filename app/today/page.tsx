'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'

type DayPlan = { day: string; label: string; type: string; movements: string[]; duration: string; focus?: string; rest?: { between_sets: string; between_rounds: string }; coaching?: string }

const TIPS = [
  'Consistency beats intensity. 10 minutes daily outperforms 1 hour occasionally.',
  'Sleep is your most powerful recovery tool. Prioritize 8+ hours on training nights.',
  'Hydration affects performance before you feel thirsty. Drink before workouts.',
  'Active recovery days keep blood moving and reduce next-day soreness.',
  'The best workout is the one you actually complete. Show up, then push.',
]

const TYPE_COLOR: Record<string, string> = {
  workout: 'var(--accent)', warmup: 'var(--orange)', cooldown: 'var(--yellow)',
  morning: 'var(--green)', abs: 'var(--accent)', evening: 'var(--orange)', rest: 'var(--text-dim)',
}

function getPhaseInfo(week: number) {
  if (week <= 4) return { label: 'Foundation', color: 'var(--green)' }
  if (week <= 8) return { label: 'Build', color: 'var(--accent)' }
  if (week <= 10) return { label: 'Peak', color: 'var(--orange)' }
  return { label: 'Maintenance', color: 'var(--yellow)' }
}

function getCurrentWeek(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), 13)
}

function getDayLabel() { return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()] }
function getDateLabel() { return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) }
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Let's get to work"
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function TodayPage() {
  const { user, loading: authLoading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const { activeRecovery } = useTheme()
  const router = useRouter()

  const [firstName, setFirstName] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState<number | null>(null)
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null)
  const [hasProgram, setHasProgram] = useState(false)
  const [weekGenerated, setWeekGenerated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: profile }, { data: prog }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', userId).single(),
      supabase.from('training_programs').select('id, start_date').eq('user_id', userId).single(),
    ])

    if (profile?.name) setFirstName(profile.name.split(' ')[0])

    if (!prog) { setHasProgram(false); setLoading(false); return }

    setHasProgram(true)
    const week = getCurrentWeek(prog.start_date)
    setCurrentWeek(week)

    const { data: weekPlan } = await supabase
      .from('weekly_plans').select('plan')
      .eq('program_id', prog.id).eq('week_number', week).single()

    if (weekPlan?.plan) {
      setWeekGenerated(true)
      const todayIdx = (new Date().getDay() + 6) % 7
      setTodayPlan((weekPlan.plan as DayPlan[])[todayIdx] ?? null)
    }

    setLoading(false)
  }, [user])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  const isRecovering = !!activeRecovery
  const isRestDay = todayPlan?.type === 'rest'
  const phase = currentWeek ? getPhaseInfo(currentWeek) : null
  const typeColor = todayPlan ? (TYPE_COLOR[todayPlan.type] ?? 'var(--accent)') : 'var(--accent)'
  const tip = TIPS[new Date().getDate() % TIPS.length]

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  return (
    <div className="page-content">

      {/* Header */}
      <div style={{ padding: '24px 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
          {getDayLabel()}, {getDateLabel()}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {getGreeting()}{firstName ? ',' : '.'}<br />
          <span style={{ color: 'var(--accent)' }}>{firstName ?? 'Athlete'}.</span>
        </h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: phase?.color ?? 'var(--text-dim)' }}>
            {currentWeek ?? '—'}<span style={{ fontSize: 12 }}>{currentWeek ? '/13' : ''}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Week</div>
        </div>
        <div style={{ flex: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: phase?.color ?? 'var(--text-dim)', paddingTop: 2 }}>
            {phase?.label ?? '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Phase</div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: isRecovering ? 'var(--accent)' : 'var(--text-dim)' }}>
            {isRecovering ? `P${activeRecovery.phase}` : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRecovering ? 'Recovery' : 'No Injury'}
          </div>
        </div>
      </div>

      {/* Today's session card */}
      <div style={{ margin: '0 16px 16px', background: 'linear-gradient(135deg, var(--accent-bg) 0%, rgba(0,0,0,0) 100%)', border: '1px solid var(--accent-border)', borderRadius: 18, padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'radial-gradient(circle, var(--accent-shadow) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
          ● Today&apos;s Session
        </div>

        {isRecovering && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
              {activeRecovery.planId ? (activeRecovery.injury ?? 'Injury Recovery') : 'SI Joint Recovery'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>
              Phase {activeRecovery.phase}{activeRecovery.totalPhases ? ` of ${activeRecovery.totalPhases}` : ''} · Continue where you left off
            </div>
            <Link href={activeRecovery.planId ? '/recovery/return-to-sport' : '/recovery/si-joint'} style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              ▶ Resume Session
            </Link>
          </>
        )}

        {!isRecovering && !hasProgram && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>No Active Plan</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>Set up your profile and generate your personalized 3-month program.</div>
            <Link href="/plan" style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              Get Started →
            </Link>
          </>
        )}

        {!isRecovering && hasProgram && !weekGenerated && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Week {currentWeek} Not Built Yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>Head to Your Plan to generate this week&apos;s workouts.</div>
            <Link href="/plan" style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              Generate Week {currentWeek} →
            </Link>
          </>
        )}

        {!isRecovering && weekGenerated && isRestDay && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Rest Day</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 12 }}>Recovery is part of training. Let your body absorb the work.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {todayPlan?.movements.map((m, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{m}</span>
              ))}
            </div>
            <Link href={`/calendar?date=${new Date().toISOString().split('T')[0]}`} style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, textAlign: 'center', textDecoration: 'none', border: '1px solid var(--border)' }}>
              View Today in Calendar →
            </Link>
          </>
        )}

        {!isRecovering && weekGenerated && todayPlan && !isRestDay && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{todayPlan.label}</div>
              {todayPlan.duration && todayPlan.duration !== '—' && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{todayPlan.duration}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: typeColor, fontWeight: 700, marginBottom: 12 }}>
              Week {currentWeek} · {phase?.label} Phase
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {todayPlan.movements.map((m, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{m}</span>
              ))}
            </div>
            <Link href={`/calendar?date=${new Date().toISOString().split('T')[0]}`} style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              ▶ Start Session
            </Link>
          </>
        )}
      </div>

      {/* Quick nav */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 16px' }}>
        <Link href="/plan" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Your Plan</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full week view</div>
        </Link>
        <Link href="/recovery" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🩹</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Recovery</div>
          <div style={{ fontSize: 10, color: isRecovering ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isRecovering ? `Phase ${activeRecovery.phase} active` : 'Playbooks'}
          </div>
        </Link>
      </div>

      {/* Tip of the day */}
      <div style={{ margin: '0 16px 24px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, borderLeft: '3px solid var(--accent)' }}>
        <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, marginBottom: 6, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Tip of the Day</div>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{tip}</p>
      </div>

    </div>
  )
}
