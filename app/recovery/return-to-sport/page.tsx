'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'

type RecoveryPhase = {
  phase: number
  title: string
  description: string
  duration_days: number
  exercises: string[]
  coaching: string
  readiness_check: string
}

type RecoveryPlan = {
  id: string
  user_id: string
  sport: string | null
  injury: string
  doctor_visit: boolean
  doctor_recommendations: string | null
  phases: RecoveryPhase[]
  current_phase: number
  last_checkin_date: string | null
  activated_at: string | null
  completed_at: string | null
}

const O = 'var(--orange)'
const O_DIM = 'rgba(255,140,0,0.1)'
const O_BORDER = 'rgba(255,140,0,0.22)'

export default function ReturnToSportPage() {
  const { user, loading: authLoading } = useAuth()
  const { activeRecovery, setRecovery, clearRecovery } = useTheme()
  const router = useRouter()

  const [plan, setPlan] = useState<RecoveryPlan | null>(null)
  const [sport, setSport] = useState('')
  const [age, setAge] = useState<number | null>(null)
  const [gender, setGender] = useState('')
  const [intake, setIntake] = useState({ injury: '', doctorVisit: false, doctorRecs: '' })
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: profile }, { data: existingPlan }] = await Promise.all([
      supabase.from('profiles').select('sport, age, gender').eq('id', user.id).single(),
      supabase.from('recovery_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (profile?.sport) setSport(profile.sport)
    if (profile?.age) setAge(profile.age)
    if (profile?.gender) setGender(profile.gender)
    if (existingPlan) setPlan(existingPlan as RecoveryPlan)

    setLoading(false)
  }, [user])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  async function generate() {
    setShowConfirm(false)
    setGenerating(true)
    setGenErr(false)
    try {
      const res = await fetch('/api/generate-recovery-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          injury: intake.injury,
          doctorVisit: intake.doctorVisit,
          doctorRecommendations: intake.doctorRecs,
          sport,
          age,
          gender,
        }),
      })
      const data = await res.json()
      if (!data.phases) throw new Error('No phases returned')

      const payload = {
        user_id: user!.id,
        sport: sport || null,
        injury: intake.injury,
        doctor_visit: intake.doctorVisit,
        doctor_recommendations: intake.doctorRecs || null,
        phases: data.phases,
        current_phase: 1,
        last_checkin_date: null,
        activated_at: null,
        completed_at: null,
      }

      let saved: RecoveryPlan | null = null
      if (plan && !plan.activated_at) {
        const { data: updated } = await supabase.from('recovery_plans').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', plan.id).select().single()
        saved = updated as RecoveryPlan
      } else {
        const { data: inserted } = await supabase.from('recovery_plans').insert(payload).select().single()
        saved = inserted as RecoveryPlan
      }
      if (saved) setPlan(saved)
    } catch {
      setGenErr(true)
    } finally {
      setGenerating(false)
    }
  }

  async function activatePlan() {
    if (!plan) return
    setActivating(true)
    const { data: updated } = await supabase
      .from('recovery_plans')
      .update({ activated_at: new Date().toISOString() })
      .eq('id', plan.id).select().single()
    if (updated) {
      setPlan(updated as RecoveryPlan)
      setRecovery('custom', 1, { planId: plan.id, injury: plan.injury, totalPhases: plan.phases.length })
    }
    setActivating(false)
    setSuccessMsg('Recovery plan activated. Your Today page will now show daily sessions.')
    setTimeout(() => setSuccessMsg(null), 6000)
  }

  async function deactivatePlan() {
    clearRecovery()
    setSuccessMsg('Recovery plan deactivated. Your training plan is active again.')
    setTimeout(() => setSuccessMsg(null), 5000)
  }

  async function handleCheckin(response: 'progress' | 'stay' | 'setback') {
    if (!plan) return
    setAdvancing(true)
    const today = new Date().toISOString().split('T')[0]
    const oldPhase = plan.current_phase
    const isLast = plan.current_phase === plan.phases.length

    let newPhase = plan.current_phase
    let completedAt: string | null = plan.completed_at

    if (response === 'progress') {
      if (isLast) {
        completedAt = new Date().toISOString()
        clearRecovery()
      } else {
        newPhase = plan.current_phase + 1
        setRecovery('custom', newPhase, { planId: plan.id, injury: plan.injury, totalPhases: plan.phases.length })
      }
    }

    const { data: updated } = await supabase
      .from('recovery_plans')
      .update({ current_phase: newPhase, last_checkin_date: today, completed_at: completedAt })
      .eq('id', plan.id).select().single()

    if (updated) setPlan(updated as RecoveryPlan)
    setCheckinOpen(false)
    setAdvancing(false)

    if (response === 'progress') {
      if (completedAt) {
        setSuccessMsg('Recovery complete. Welcome back to full training.')
      } else {
        setSuccessMsg(`Phase ${newPhase} unlocked: ${plan.phases[newPhase - 1]?.title}`)
      }
      setTimeout(() => setSuccessMsg(null), 6000)
    }
  }

  const hasCheckedInToday = plan?.last_checkin_date === new Date().toISOString().split('T')[0]
  const isCompleted = !!plan?.completed_at
  const isActivePlan = !!plan?.activated_at && !isCompleted
  const currentPhaseData = plan ? plan.phases.find(p => p.phase === plan.current_phase) : null
  const isThisPlanActive = activeRecovery?.planId === plan?.id

  const intakeValid = intake.injury.trim().length > 0

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  return (
    <div className="page-content">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/recovery" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: 18, flexShrink: 0 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Injury Recovery</h1>
          {plan?.activated_at && !isCompleted && (
            <div style={{ fontSize: 11, color: O, fontWeight: 700, marginTop: 2 }}>
              Phase {plan.current_phase} of {plan.phases.length} · {plan.injury}
            </div>
          )}
        </div>
        {isActivePlan && isThisPlanActive && (
          <button onClick={deactivatePlan} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
            Deactivate
          </button>
        )}
        {plan && !plan.activated_at && (
          <button
            onClick={() => { if (confirm('Regenerate your plan? This will discard the current preview.')) generate() }}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}
          >
            Redo
          </button>
        )}
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ margin: '0 16px 12px', padding: '12px 16px', background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.25)', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#00c864', textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
          ✦ {successMsg}
        </div>
      )}

      {/* ─── STATE 1: No plan — intake form ─── */}
      {!plan && !generating && (
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
            Answer a few questions and Movement AI will build a personalized recovery protocol — phase by phase, back to full training.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Injury */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
                What did you hurt? *
              </label>
              <textarea
                value={intake.injury}
                onChange={e => setIntake(i => ({ ...i, injury: e.target.value }))}
                placeholder="e.g. Strained left hamstring, knee pain after a fall, SI joint flare-up..."
                rows={3}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, color: 'var(--text)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
              />
            </div>

            {/* Doctor */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                Have you seen a doctor?
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Yes', 'No'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setIntake(i => ({ ...i, doctorVisit: opt === 'Yes' }))}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${intake.doctorVisit === (opt === 'Yes') ? O_BORDER : 'var(--border)'}`, background: intake.doctorVisit === (opt === 'Yes') ? O_DIM : 'var(--surface)', color: intake.doctorVisit === (opt === 'Yes') ? O : 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor recommendations */}
            {intake.doctorVisit && (
              <div style={{ animation: 'slideUp 0.2s ease' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
                  What did they recommend?
                </label>
                <textarea
                  value={intake.doctorRecs}
                  onChange={e => setIntake(i => ({ ...i, doctorRecs: e.target.value }))}
                  placeholder="e.g. No weight bearing for 2 weeks, avoid rotation, ice 3x daily, start PT after swelling reduces..."
                  rows={3}
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, color: 'var(--text)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                />
              </div>
            )}

            {/* Sport context */}
            {sport && (
              <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Return-to-sport goal</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sport}</span>
              </div>
            )}

            {genErr && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 10, fontSize: 12, color: '#ff8080' }}>
                Generation failed — check your connection and try again.
              </div>
            )}

            <button
              onClick={() => intakeValid && setShowConfirm(true)}
              disabled={!intakeValid}
              style={{ padding: '16px', borderRadius: 14, border: 'none', background: intakeValid ? `linear-gradient(135deg, ${O} 0%, #e06000 100%)` : 'var(--surface2)', color: intakeValid ? '#fff' : 'var(--text-dim)', fontWeight: 900, fontSize: 15, cursor: intakeValid ? 'pointer' : 'not-allowed', letterSpacing: '0.03em', textTransform: 'uppercase', marginTop: 4 }}
            >
              Build My Recovery Plan →
            </button>
          </div>
        </div>
      )}

      {/* ─── Generating state ─── */}
      {generating && (
        <div style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>🩺</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Movement AI is building your plan</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>Analyzing your injury, restrictions, and goals to create a phased recovery protocol...</div>
        </div>
      )}

      {/* ─── STATE 2: Plan generated, not yet activated ─── */}
      {plan && !plan.activated_at && !generating && (
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ padding: '14px 16px', background: O_DIM, border: `1px solid ${O_BORDER}`, borderRadius: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: O, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Your Recovery Plan</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 2 }}>{plan.injury}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{plan.phases.length} phases · activate to begin tracking</div>
          </div>

          {/* Phase preview cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {plan.phases.map((phase, i) => (
              <div key={phase.phase} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? O_DIM : 'var(--surface2)', border: `1px solid ${i === 0 ? O_BORDER : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: i === 0 ? O : 'var(--text-dim)' }}>{phase.phase}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{phase.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{phase.duration_days}+ days</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: '0 0 8px' }}>{phase.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {phase.exercises.map((ex, j) => (
                    <span key={j} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{ex}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={activatePlan}
            disabled={activating}
            style={{ width: '100%', padding: '17px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase', animation: activating ? 'pulse 1.2s ease infinite' : 'none' }}
          >
            {activating ? 'Activating...' : '▶ Activate Recovery Plan'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 10 }}>
            Activating pauses your normal training plan on the Today page until you complete recovery.
          </p>
        </div>
      )}

      {/* ─── STATE 3: Active plan — daily session view ─── */}
      {plan && plan.activated_at && !isCompleted && !generating && currentPhaseData && (
        <div style={{ padding: '0 16px 24px' }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span>Recovery Progress</span>
              <span style={{ color: O }}>Phase {plan.current_phase} of {plan.phases.length}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${((plan.current_phase - 1) / (plan.phases.length - 1)) * 100}%`, background: `linear-gradient(90deg, ${O}, #e06000)`, borderRadius: 99, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* Current phase card */}
          <div style={{ background: O_DIM, border: `1px solid ${O_BORDER}`, borderRadius: 16, padding: '18px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: O, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
              Current Phase {currentPhaseData.phase} · {currentPhaseData.duration_days}+ days
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{currentPhaseData.title}</div>
            <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.55, margin: '0 0 14px' }}>{currentPhaseData.description}</p>

            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Today's Exercises</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {currentPhaseData.exercises.map((ex, i) => (
                <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: O_DIM, border: `1px solid ${O_BORDER}`, color: O }}>{ex}</span>
              ))}
            </div>

            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Coaching Note</div>
              <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>{currentPhaseData.coaching}</div>
            </div>

            <button
              onClick={() => setCheckinOpen(true)}
              disabled={hasCheckedInToday}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: hasCheckedInToday ? 'var(--surface2)' : `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: hasCheckedInToday ? 'var(--text-dim)' : '#fff', fontWeight: 900, fontSize: 14, cursor: hasCheckedInToday ? 'default' : 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase' }}
            >
              {hasCheckedInToday ? '✓ Logged today — come back tomorrow' : '▶ Log Today\'s Session'}
            </button>
          </div>

          {/* Phase timeline */}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10, marginTop: 8 }}>All Phases</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.phases.map(phase => {
              const done = phase.phase < plan.current_phase
              const current = phase.phase === plan.current_phase
              return (
                <div key={phase.phase} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: current ? O_DIM : 'var(--surface)', border: `1px solid ${current ? O_BORDER : 'var(--border)'}`, borderRadius: 10, opacity: phase.phase > plan.current_phase ? 0.45 : 1 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? O : current ? 'transparent' : 'var(--surface2)', border: `2px solid ${done || current ? O : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {done && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
                    {current && <div style={{ width: 6, height: 6, borderRadius: '50%', background: O }} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: done || current ? 700 : 600, color: current ? O : done ? 'var(--text-mid)' : 'var(--text-dim)' }}>
                    {phase.title}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>{phase.duration_days}+ days</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Completed state ─── */}
      {plan && isCompleted && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Recovery Complete</div>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 28 }}>
            You completed every phase of your {plan.injury} recovery. Time to get back to full training.
          </p>
          <Link href="/today" style={{ display: 'block', padding: '16px', borderRadius: 14, background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 15, textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Back to Training →
          </Link>
        </div>
      )}

      {/* ─── Confirm modal ─── */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, animation: 'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, fontWeight: 800, color: O, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Movement AI</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Build recovery plan?</div>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 20 }}>
              AI will generate a custom phase-by-phase recovery protocol for <strong style={{ color: 'var(--text)' }}>{intake.injury}</strong>. This takes about 10 seconds.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={generate} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Generate →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Check-in modal ─── */}
      {checkinOpen && currentPhaseData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }} onClick={() => setCheckinOpen(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, animation: 'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>How did today feel?</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 20 }}>
              {currentPhaseData.readiness_check}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleCheckin('progress')} disabled={advancing} style={{ padding: '15px', borderRadius: 12, border: `1px solid ${O_BORDER}`, background: O_DIM, color: O, fontWeight: 900, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                {plan?.current_phase === plan?.phases.length ? '✓ Yes — ready to complete recovery' : '✓ Yes — ready to move to next phase'}
              </button>
              <button onClick={() => handleCheckin('stay')} disabled={advancing} style={{ padding: '15px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                ↻ Not yet — need more time here
              </button>
              <button onClick={() => handleCheckin('setback')} disabled={advancing} style={{ padding: '15px', borderRadius: 12, border: '1px solid rgba(255,100,100,0.25)', background: 'rgba(255,100,100,0.08)', color: '#ff8080', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                ⚠ Had pain or a setback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
