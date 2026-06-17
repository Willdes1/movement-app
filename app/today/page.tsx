'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useCoached } from '@/contexts/CoachedContext'
import { supabase } from '@/lib/supabase'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import CoachedSessionCard from '@/components/CoachedSessionCard'
import { useStreak } from '@/lib/useStreak'
import { useTTS } from '@/hooks/useTTS'
import { inferEquipment, timeCommitment } from '@/lib/workout-display'

type DailyBlock = { label: string; duration: string; exercises: string[]; tip?: string }
type DailySession = { morning?: DailyBlock; warmup?: DailyBlock; workout?: DailyBlock; abs?: DailyBlock; cooldown?: DailyBlock; evening?: DailyBlock }
type DayPlan = { day: string; label: string; type: string; movements: string[]; duration: string; focus?: string; rest?: { between_sets: string; between_rounds: string }; coaching?: string; daily_session?: DailySession }

const REST_BLOCK_ORDER = ['morning', 'abs', 'evening'] as const
const BLOCK_CONFIG: Record<string, { color: string; icon: string }> = {
  morning:  { color: 'var(--green)',    icon: '🌅' },
  warmup:   { color: 'var(--orange)',   icon: '🔥' },
  workout:  { color: 'var(--accent)',   icon: '💪' },
  abs:      { color: 'var(--accent)',   icon: '⚡' },
  cooldown: { color: 'var(--yellow)',   icon: '🧘' },
  evening:  { color: 'var(--orange)',   icon: '🌙' },
}

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
  const { user, loading: authLoading, effectiveUserId, role, isAdmin } = useAuth()
  const { coached, loading: coachedLoading, coachName, assignment: coachAssignment, program: coachProgram } = useCoached()
  const { currentStreak, longestStreak } = useStreak()
  const isFF = !isAdmin && role === 'ff'
  const userId = effectiveUserId ?? user?.id ?? ''
  const { activeRecovery } = useTheme()
  const router = useRouter()

  const { speak, stop, speaking, loading: ttsLoading, gender } = useTTS()
  const [speakingKey, setSpeakingKey] = useState<string | null>(null)
  const [exerciseLib, setExerciseLib] = useState<Record<string, { how: string | null; tip: string | null; tts_url_male: string | null; tts_url_female: string | null; video_url: string | null; video_source: string | null; youtube_start_sec: number | null; youtube_end_sec: number | null; loop_start_sec: number | null; loop_end_sec: number | null }>>({})

  const [firstName, setFirstName] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState<number | null>(null)
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null)
  const [hasProgram, setHasProgram] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [weekGenerated, setWeekGenerated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: profile }, { data: prog }] = await Promise.all([
        supabase.from('profiles').select('name, sport, goal').eq('id', userId).single(),
        supabase.from('training_programs').select('id, start_date').eq('user_id', userId).single(),
      ])

      if (profile?.name) setFirstName(profile.name.split(' ')[0])
      setProfileReady(!!(profile?.sport || profile?.goal))

      if (!prog) { setHasProgram(false); return }

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
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  // Pre-load exercise library details for today's exercises (enables fast TTS)
  useEffect(() => {
    if (!todayPlan || !user) return
    const names: string[] = todayPlan.daily_session
      ? (Object.values(todayPlan.daily_session).flatMap(b => b?.exercises ?? []) as string[])
      : todayPlan.movements
    const normalized = [...new Set(names.map(normalizeExName))].filter(Boolean)
    if (!normalized.length) return
    supabase
      .from('exercise_library')
      .select('name_normalized, how, tip, tts_url_male, tts_url_female, video_url, video_source, youtube_start_sec, youtube_end_sec, loop_start_sec, loop_end_sec')
      .in('name_normalized', normalized)
      .then(({ data }) => {
        const map: typeof exerciseLib = {}
        data?.forEach(e => { map[e.name_normalized] = e })
        setExerciseLib(map)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayPlan, user])

  useEffect(() => {
    if (!user || loading) return
    if (isAdmin || role === 'admin') return
    // Don't show welcome modal while onboarding flow is still active
    if (!localStorage.getItem(`onboarding_v1_${userId}`)) return
    const key = `movement_welcomed_${userId}`
    if (!localStorage.getItem(key)) {
      setShowWelcomeModal(true)
      localStorage.setItem(key, '1')
    }
  }, [user, userId, loading, isAdmin, role])

  function normalizeExName(raw: string) {
    return raw.toLowerCase()
      .replace(/\s+\d+[×x]\d+.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
      .replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
  }

  async function speakExercise(rawName: string) {
    const key = normalizeExName(rawName)
    if (speakingKey === key) { stop(); setSpeakingKey(null); return }
    setSpeakingKey(key)
    const lib = exerciseLib[key]
    const displayName = rawName.replace(/\s+\d+[×x]\d+.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
    const parts = [displayName]
    if (lib?.how) parts.push(lib.how)
    if (lib?.tip) parts.push('Coaching tip: ' + lib.tip)
    const preUrl = gender === 'male' ? lib?.tts_url_male : lib?.tts_url_female
    await speak(parts.join('. '), { preGeneratedUrl: preUrl ?? undefined, nameNormalized: preUrl ? undefined : key })
    setSpeakingKey(null)
  }

  const isRecovering = !!activeRecovery
  const isRestDay = todayPlan?.type === 'rest'
  const phase = currentWeek ? getPhaseInfo(currentWeek) : null
  const typeColor = todayPlan ? (TYPE_COLOR[todayPlan.type] ?? 'var(--accent)') : 'var(--accent)'
  const tip = TIPS[new Date().getDate() % TIPS.length]

  // Phase 1 dashboard summary — derived from existing plan data, no new tokens.
  const sessionExNames: string[] = todayPlan
    ? (todayPlan.daily_session ? (Object.values(todayPlan.daily_session).flatMap(b => b?.exercises ?? []) as string[]) : todayPlan.movements)
    : []
  const equipment = inferEquipment(sessionExNames)
  const sessionSummary = todayPlan
    ? (todayPlan.coaching || (todayPlan.focus ? `${todayPlan.label} — ${todayPlan.focus}.` : `Today's focus: ${todayPlan.label}.`))
    : ''

  // Coached mode — active coach assignment replaces the AI program as the main program
  const coachWeekNum = coached && coachAssignment && coachProgram
    ? Math.min(Math.max(Math.floor((Date.now() - new Date(coachAssignment.start_date).getTime()) / (7 * 86_400_000)) + 1, 1), coachProgram.weeks_total)
    : null

  if (authLoading || loading || coachedLoading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  return (
    <div className="page-content">
      <PushNotificationBanner />

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
          <div style={{ fontSize: 20, fontWeight: 900, color: coached ? 'var(--accent)' : (phase?.color ?? 'var(--text-dim)') }}>
            {coached
              ? <>{coachWeekNum}<span style={{ fontSize: 12 }}>/{coachProgram?.weeks_total}</span></>
              : <>{currentWeek ?? '—'}<span style={{ fontSize: 12 }}>{currentWeek ? '/13' : ''}</span></>}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Week</div>
        </div>
        <div style={{ flex: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: coached ? 13 : 15, fontWeight: 900, color: coached ? 'var(--accent)' : (phase?.color ?? 'var(--text-dim)'), paddingTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {coached ? `Coach ${coachName.split(' ')[0] || ''}` : (phase?.label ?? '—')}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {coached ? 'Program' : 'Phase'}
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: isRecovering ? 'var(--accent)' : 'var(--text-dim)' }}>
            {isRecovering ? `P${activeRecovery.phase}` : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRecovering ? 'Recovery' : 'No Injury'}
          </div>
        </div>
        <div style={{ flex: 1, background: currentStreak > 0 ? 'rgba(245,158,11,0.08)' : 'var(--surface)', border: `1px solid ${currentStreak > 0 ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`, borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: currentStreak > 0 ? '#f59e0b' : 'var(--text-dim)' }}>
            {currentStreak > 0 ? `${currentStreak}🔥` : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Streak</div>
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

        {/* Coached mode — the coach's program is the main program */}
        {!isRecovering && coached && <CoachedSessionCard />}

        {!isRecovering && !coached && !hasProgram && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>No Active Plan</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>Set up your profile and generate your personalized 3-month program.</div>
            <Link href="/plan" style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              Get Started →
            </Link>
          </>
        )}

        {!isRecovering && !coached && hasProgram && !weekGenerated && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Week {currentWeek} Not Built Yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>Head to Your Plan to generate this week&apos;s workouts.</div>
            <Link href="/plan" style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              Generate Week {currentWeek} →
            </Link>
          </>
        )}

        {!isRecovering && !coached && weekGenerated && isRestDay && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Rest Day</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>Recovery is part of training. Let your body absorb the work.</div>
            {todayPlan?.daily_session ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {REST_BLOCK_ORDER
                  .filter(key => todayPlan.daily_session![key])
                  .map(key => {
                    const block = todayPlan.daily_session![key]!
                    const cfg = BLOCK_CONFIG[key]
                    return (
                      <div key={key} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 15 }}>{cfg.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, flex: 1 }}>{block.label}</span>
                          {block.duration && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{block.duration}</span>}
                        </div>
                        <div style={{ padding: '8px 12px' }}>
                          {block.exercises.map((ex, ei) => {
                            const exKey = normalizeExName(ex)
                            const isSpeaking = speakingKey === exKey && (speaking || ttsLoading)
                            return (
                              <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: ei < block.exercises.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{ex}</span>
                                <button onClick={() => speakExercise(ex)} style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: isSpeaking ? cfg.color : 'var(--text-dim)', flexShrink: 0 }}>
                                  {isSpeaking ? '🔊' : '🔈'}
                                </button>
                              </div>
                            )
                          })}
                          {block.tip && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic', paddingTop: 6, borderTop: '1px solid var(--border)' }}>💡 {block.tip}</p>}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {todayPlan?.movements.map((m, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{m}</span>
                ))}
              </div>
            )}
            <Link href={`/calendar?date=${new Date().toISOString().split('T')[0]}`} style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, textAlign: 'center', textDecoration: 'none', border: '1px solid var(--border)' }}>
              View Today in Calendar →
            </Link>
          </>
        )}

        {!isRecovering && !coached && weekGenerated && todayPlan && !isRestDay && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{todayPlan.label}</div>
              {todayPlan.duration && todayPlan.duration !== '—' && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{todayPlan.duration}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: typeColor, fontWeight: 700, marginBottom: 14 }}>
              Week {currentWeek} · {phase?.label} Phase
            </div>
            {/* Clean summary (replaces the long block breakdown) */}
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 14 }}>{sessionSummary}</p>

            {/* Time commitment + equipment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-mid)' }}>
                <span style={{ fontSize: 14 }}>⏱️</span>
                <span style={{ fontWeight: 700 }}>{timeCommitment(todayPlan.duration)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-mid)' }}>
                <span style={{ fontSize: 14 }}>🎒</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {equipment.map(eq => (
                    <span key={eq} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{eq}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* For You note */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 14 }}>✨</span>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: 0 }}><strong style={{ color: 'var(--text-mid)' }}>For you:</strong> {tip}</p>
            </div>
            <Link href={`/calendar?date=${new Date().toISOString().split('T')[0]}&focus=1`} style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center', textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', boxShadow: '0 6px 24px var(--accent-shadow)' }}>
              ▶ Start Session
            </Link>
          </>
        )}
      </div>

      {/* Quick nav */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 16px' }}>
        <Link href={coached ? '/my-coach' : '/plan'} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{coached ? '🏋️' : '📅'}</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{coached ? 'My Coach' : 'Your Plan'}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{coached ? 'Program & messages' : 'Full week view'}</div>
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

      {/* First-login welcome modal — shown once per user via localStorage */}
      {showWelcomeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, padding: '0 0 0 0' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 36px', width: '100%', maxWidth: 480, border: '1px solid var(--border)', borderBottom: 'none' }}>
            <p style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.02em' }}>
              Welcome to Atlas Prime{firstName ? `, ${firstName}` : ''}! 👋
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
              {isFF ? "You're in as a founding member. Here's how to get started." : "Here's how to get started in 3 steps."}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 28 }}>
              {[
                {
                  title: 'Complete your profile',
                  desc: 'Tell us your sport, goals, schedule, and any injuries.',
                  done: profileReady,
                },
                coached
                  ? {
                      title: 'Your coach has your program',
                      desc: `Coach ${coachName.split(' ')[0] || ''} programs your training — find it in My Coach.`,
                      done: true,
                    }
                  : {
                      title: 'Generate your plan',
                      desc: isFF
                        ? 'Your AI coach builds a custom 1-month program in ~2 minutes.'
                        : 'Your AI coach builds a personalized program in ~2 minutes.',
                      done: hasProgram,
                    },
                {
                  title: 'Start training',
                  desc: 'Follow daily workouts, log your sets, and track your progress.',
                  done: false,
                },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: step.done ? 'var(--accent)' : 'var(--surface2)',
                    border: `1.5px solid ${step.done ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                    color: step.done ? '#fff' : 'var(--text-dim)',
                  }}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{step.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href={coached ? '/my-coach' : profileReady ? '/plan' : '/profile'}
              onClick={() => setShowWelcomeModal(false)}
              style={{ display: 'block', padding: '15px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, textAlign: 'center', textDecoration: 'none', marginBottom: 10 }}
            >
              {coached ? 'View My Program →' : profileReady ? 'Generate My Plan →' : 'Set Up Profile →'}
            </Link>
            <button
              onClick={() => setShowWelcomeModal(false)}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              I&apos;ll explore first
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
