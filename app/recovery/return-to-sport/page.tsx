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
  created_at: string
}

type RestartModal = {
  plan: RecoveryPlan
  step: 'confirm' | 'reinjured' | 'pain'
  reinjured: boolean | null
}

const O = 'var(--orange)'
const O_DIM = 'rgba(255,140,0,0.1)'
const O_BORDER = 'rgba(255,140,0,0.22)'

// Keyword map for template cache matching
const INJURY_KEYWORDS: Record<string, string[]> = {
  'hamstring':  ['hamstring', 'hammy', 'biceps femoris', 'back of thigh'],
  'si-joint':   ['si joint', 'sacroiliac', 'sacrum', 'si dysfunction'],
  'knee':       ['knee', 'acl', 'mcl', 'pcl', 'meniscus', 'patellar', 'patella'],
  'ankle':      ['ankle', 'achilles', 'lateral ankle', 'peroneal'],
  'shoulder':   ['shoulder', 'rotator cuff', 'labrum', 'ac joint', 'impingement'],
  'quad':       ['quad', 'quadriceps', 'rectus femoris', 'front of thigh'],
  'calf':       ['calf', 'gastrocnemius', 'soleus', 'shin splint'],
  'hip':        ['hip flexor', 'hip pain', 'groin', 'iliopsoas', 'piriformis', 'hip strain'],
  'lower-back': ['lower back', 'lumbar', 'disc', 'herniated', 'sciatica', 'back pain'],
  'wrist':      ['wrist', 'carpal', 'tfcc'],
  'elbow':      ['elbow', 'tennis elbow', 'golfer', 'epicondyle'],
  'neck':       ['neck', 'cervical', 'whiplash'],
}

function extractInjuryKey(injury: string): string | null {
  const lower = injury.toLowerCase()
  for (const [key, kws] of Object.entries(INJURY_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) return key
  }
  return null
}

const PAIN_OPTIONS = [
  { label: 'Significant pain', sub: '7–10 out of 10', phase: 1 },
  { label: 'Moderate discomfort', sub: '4–6 out of 10', phase: 2 },
  { label: 'Minimal soreness', sub: '1–3 out of 10', phase: 3 },
  { label: 'No pain at all', sub: '0 — feeling good', phase: 4 },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReturnToSportPage() {
  const { user, loading: authLoading } = useAuth()
  const { activeRecovery, setRecovery, clearRecovery } = useTheme()
  const router = useRouter()

  const [allPlans, setAllPlans] = useState<RecoveryPlan[]>([])
  const [sport, setSport] = useState('')
  const [age, setAge] = useState<number | null>(null)
  const [gender, setGender] = useState('')

  const [intake, setIntake] = useState({ injury: '', doctorVisit: false, doctorRecs: '' })
  const [showIntake, setShowIntake] = useState(false)

  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr] = useState(false)
  const [templateHit, setTemplateHit] = useState(false)

  const [checkinOpen, setCheckinOpen] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [activating, setActivating] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [restartModal, setRestartModal] = useState<RestartModal | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: profile }, { data: plansData }] = await Promise.all([
      supabase.from('profiles').select('sport, age, gender').eq('id', user.id).single(),
      supabase.from('recovery_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (profile?.sport) setSport(profile.sport)
    if (profile?.age) setAge(profile.age)
    if (profile?.gender) setGender(profile.gender)
    setAllPlans((plansData ?? []) as RecoveryPlan[])
    setLoading(false)
  }, [user])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  // Derived plan states
  const activePlan = allPlans.find(p => !!p.activated_at && !p.completed_at) ?? null
  const pendingPlan = allPlans.find(p => !p.activated_at && !p.completed_at) ?? null
  const completedPlan = !activePlan && !pendingPlan && allPlans.length > 0 ? allPlans[0] : null
  const plan = activePlan ?? pendingPlan ?? completedPlan
  const prevPlans = allPlans.filter(p => p.id !== plan?.id)

  function flash(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 6000)
  }

  async function generate() {
    setShowConfirm(false)
    setGenerating(true)
    setGenErr(false)
    setTemplateHit(false)

    try {
      let phases: RecoveryPhase[] | null = null
      const injuryKey = extractInjuryKey(intake.injury)

      // 1. Check template cache
      if (injuryKey) {
        const { data: tmpl } = await supabase
          .from('recovery_templates')
          .select('phases')
          .eq('injury_key', injuryKey)
          .limit(1)
          .maybeSingle()
        if (tmpl?.phases) {
          phases = tmpl.phases as RecoveryPhase[]
          setTemplateHit(true)
        }
      }

      // 2. Call AI if no template
      if (!phases) {
        const res = await fetch('/api/generate-recovery-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ injury: intake.injury, doctorVisit: intake.doctorVisit, doctorRecommendations: intake.doctorRecs, sport, age, gender }),
        })
        const data = await res.json()
        if (!data.phases) throw new Error('No phases')
        phases = data.phases

        // 3. Save to template cache for future users
        if (injuryKey) {
          const { data: existing } = await supabase.from('recovery_templates').select('id').eq('injury_key', injuryKey).limit(1).maybeSingle()
          if (!existing) await supabase.from('recovery_templates').insert({ injury_key: injuryKey, phases })
        }
      }

      // 4. Save user's plan
      const payload = {
        user_id: user!.id, sport: sport || null,
        injury: intake.injury, doctor_visit: intake.doctorVisit,
        doctor_recommendations: intake.doctorRecs || null,
        phases, current_phase: 1, last_checkin_date: null, activated_at: null, completed_at: null,
      }

      let saved: RecoveryPlan | null = null
      if (pendingPlan) {
        const { data: updated } = await supabase.from('recovery_plans').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', pendingPlan.id).select().single()
        saved = updated as RecoveryPlan
      } else {
        const { data: inserted } = await supabase.from('recovery_plans').insert(payload).select().single()
        saved = inserted as RecoveryPlan
      }

      if (saved) setAllPlans(prev => [saved!, ...prev.filter(p => p.id !== saved!.id)])
      setShowIntake(false)
    } catch {
      setGenErr(true)
    } finally {
      setGenerating(false)
    }
  }

  async function activatePlan(target: RecoveryPlan) {
    setActivating(true)
    const { data: updated } = await supabase.from('recovery_plans').update({ activated_at: new Date().toISOString() }).eq('id', target.id).select().single()
    if (updated) {
      setAllPlans(prev => prev.map(p => p.id === target.id ? updated as RecoveryPlan : p))
      setRecovery('custom', target.current_phase, { planId: target.id, injury: target.injury, totalPhases: target.phases.length })
    }
    setActivating(false)
    flash('Recovery plan activated. Your Today page now shows daily sessions.')
  }

  async function deactivatePlan() {
    clearRecovery()
    flash('Recovery plan deactivated. Training plan is active again.')
  }

  async function handleCheckin(response: 'progress' | 'stay' | 'setback') {
    if (!activePlan) return
    setAdvancing(true)
    const today = new Date().toISOString().split('T')[0]
    const isLast = activePlan.current_phase === activePlan.phases.length
    let newPhase = activePlan.current_phase
    let completedAt: string | null = null

    if (response === 'progress') {
      if (isLast) {
        completedAt = new Date().toISOString()
        clearRecovery()
      } else {
        newPhase = activePlan.current_phase + 1
        setRecovery('custom', newPhase, { planId: activePlan.id, injury: activePlan.injury, totalPhases: activePlan.phases.length })
      }
    }

    const { data: updated } = await supabase.from('recovery_plans').update({ current_phase: newPhase, last_checkin_date: today, completed_at: completedAt }).eq('id', activePlan.id).select().single()
    if (updated) setAllPlans(prev => prev.map(p => p.id === activePlan.id ? updated as RecoveryPlan : p))
    setCheckinOpen(false)
    setAdvancing(false)

    if (response === 'progress') {
      flash(completedAt ? 'Recovery complete. Welcome back to full training.' : `Phase ${newPhase} unlocked: ${activePlan.phases[newPhase - 1]?.title}`)
    }
  }

  async function doRestart(modal: RestartModal, startPhase: number) {
    const clamped = Math.min(Math.max(startPhase, 1), modal.plan.phases.length)
    const { data: updated } = await supabase.from('recovery_plans')
      .update({ current_phase: clamped, last_checkin_date: null, activated_at: new Date().toISOString(), completed_at: null, updated_at: new Date().toISOString() })
      .eq('id', modal.plan.id).select().single()
    if (updated) {
      setAllPlans(prev => [updated as RecoveryPlan, ...prev.filter(p => p.id !== modal.plan.id)])
      setRecovery('custom', clamped, { planId: modal.plan.id, injury: modal.plan.injury, totalPhases: modal.plan.phases.length })
    }
    setRestartModal(null)
    flash(`Restarting at Phase ${clamped}: ${modal.plan.phases[clamped - 1]?.title ?? modal.plan.injury}`)
  }

  const hasCheckedInToday = activePlan?.last_checkin_date === new Date().toISOString().split('T')[0]
  const currentPhaseData = activePlan ? activePlan.phases.find(p => p.phase === activePlan.current_phase) : null
  const isThisPlanActive = activeRecovery?.planId === activePlan?.id
  const intakeValid = intake.injury.trim().length > 4
  const showingIntake = showIntake || (!plan && !generating)

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  return (
    <div className="page-content">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/recovery" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: 18, flexShrink: 0 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Injury Recovery</h1>
          {activePlan && <div style={{ fontSize: 11, color: O, fontWeight: 700, marginTop: 2 }}>Phase {activePlan.current_phase} of {activePlan.phases.length} · {activePlan.injury}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activePlan && isThisPlanActive && (
            <button onClick={deactivatePlan} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700 }}>Deactivate</button>
          )}
          {!showingIntake && (
            <button onClick={() => { setShowIntake(true); setIntake({ injury: '', doctorVisit: false, doctorRecs: '' }) }} style={{ background: 'none', border: `1px solid ${O_BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 11, color: O, cursor: 'pointer', fontWeight: 700 }}>+ New Plan</button>
          )}
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ margin: '0 16px 12px', padding: '12px 16px', background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.25)', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#00c864', textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
          ✦ {successMsg}
        </div>
      )}

      {/* ─── INTAKE FORM ─── */}
      {showingIntake && !generating && (
        <div style={{ padding: '0 16px 24px', animation: 'slideUp 0.2s ease' }}>
          {!plan && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
              Tell us about your injury. Movement AI will build a phase-by-phase recovery protocol and get you back to full training.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>What did you hurt? *</label>
              <textarea value={intake.injury} onChange={e => setIntake(i => ({ ...i, injury: e.target.value }))} placeholder="e.g. Strained left hamstring, knee pain after a fall, SI joint flare-up..." rows={3} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, color: 'var(--text)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Have you seen a doctor?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Yes', 'No'] as const).map(opt => (
                  <button key={opt} onClick={() => setIntake(i => ({ ...i, doctorVisit: opt === 'Yes' }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${intake.doctorVisit === (opt === 'Yes') ? O_BORDER : 'var(--border)'}`, background: intake.doctorVisit === (opt === 'Yes') ? O_DIM : 'var(--surface)', color: intake.doctorVisit === (opt === 'Yes') ? O : 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{opt}</button>
                ))}
              </div>
            </div>
            {intake.doctorVisit && (
              <div style={{ animation: 'slideUp 0.2s ease' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>What did they recommend?</label>
                <textarea value={intake.doctorRecs} onChange={e => setIntake(i => ({ ...i, doctorRecs: e.target.value }))} placeholder="e.g. No weight bearing 2 weeks, avoid rotation, ice 3x daily, start PT after swelling reduces..." rows={3} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 13, color: 'var(--text)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
              </div>
            )}
            {sport && (
              <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Return-to-sport goal</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{sport}</span>
              </div>
            )}
            {genErr && <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 10, fontSize: 12, color: '#ff8080' }}>Generation failed — check your connection and try again.</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              {plan && <button onClick={() => setShowIntake(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>}
              <button onClick={() => intakeValid && setShowConfirm(true)} disabled={!intakeValid} style={{ flex: plan ? 2 : 1, padding: '14px', borderRadius: 12, border: 'none', background: intakeValid ? `linear-gradient(135deg, ${O} 0%, #e06000 100%)` : 'var(--surface2)', color: intakeValid ? '#fff' : 'var(--text-dim)', fontWeight: 900, fontSize: 14, cursor: intakeValid ? 'pointer' : 'not-allowed', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Build My Recovery Plan →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── GENERATING ─── */}
      {generating && (
        <div style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>🩺</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Movement AI is building your plan</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>Analyzing your injury and goals to build a phased recovery protocol...</div>
        </div>
      )}

      {/* ─── PENDING PLAN — preview + activate ─── */}
      {!showingIntake && !generating && pendingPlan && !activePlan && (
        <div style={{ padding: '0 16px 8px', animation: 'slideUp 0.25s ease' }}>
          {templateHit && (
            <div style={{ padding: '8px 12px', background: 'rgba(0,200,100,0.08)', border: '1px solid rgba(0,200,100,0.2)', borderRadius: 8, fontSize: 11, color: '#00c864', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚡ Loaded from template — no tokens used
            </div>
          )}
          <div style={{ padding: '14px 16px', background: O_DIM, border: `1px solid ${O_BORDER}`, borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: O, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Your Recovery Plan</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 2 }}>{pendingPlan.injury}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{pendingPlan.phases.length} phases · activate to begin tracking</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {pendingPlan.phases.map((phase, i) => (
              <div key={phase.phase} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? O_DIM : 'var(--surface2)', border: `1px solid ${i === 0 ? O_BORDER : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: i === 0 ? O : 'var(--text-dim)' }}>{phase.phase}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{phase.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>{phase.duration_days}+ days</span>
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
          <button onClick={() => activatePlan(pendingPlan)} disabled={activating} style={{ width: '100%', padding: '17px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase', animation: activating ? 'pulse 1.2s ease infinite' : 'none', marginBottom: 8 }}>
            {activating ? 'Activating...' : '▶ Activate Recovery Plan'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', margin: '0 0 16px' }}>Activating pauses your normal training plan on the Today page.</p>
        </div>
      )}

      {/* ─── ACTIVE PLAN — daily session view ─── */}
      {!showingIntake && !generating && activePlan && currentPhaseData && (
        <div style={{ padding: '0 16px 8px', animation: 'slideUp 0.25s ease' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span>Recovery Progress</span>
              <span style={{ color: O }}>Phase {activePlan.current_phase} of {activePlan.phases.length}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${((activePlan.current_phase - 1) / Math.max(activePlan.phases.length - 1, 1)) * 100}%`, background: `linear-gradient(90deg, ${O}, #e06000)`, borderRadius: 99, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          <div style={{ background: O_DIM, border: `1px solid ${O_BORDER}`, borderRadius: 16, padding: '18px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: O, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Phase {currentPhaseData.phase} · {currentPhaseData.duration_days}+ days</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{currentPhaseData.title}</div>
            <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.55, margin: '0 0 14px' }}>{currentPhaseData.description}</p>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Today&apos;s Exercises</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {currentPhaseData.exercises.map((ex, i) => (
                <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: O_DIM, border: `1px solid ${O_BORDER}`, color: O }}>{ex}</span>
              ))}
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Coaching Note</div>
              <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>{currentPhaseData.coaching}</div>
            </div>
            <button onClick={() => setCheckinOpen(true)} disabled={hasCheckedInToday} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: hasCheckedInToday ? 'var(--surface2)' : `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: hasCheckedInToday ? 'var(--text-dim)' : '#fff', fontWeight: 900, fontSize: 14, cursor: hasCheckedInToday ? 'default' : 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              {hasCheckedInToday ? '✓ Logged today — come back tomorrow' : '▶ Log Today\'s Session'}
            </button>
          </div>

          {/* Phase timeline */}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>All Phases</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {activePlan.phases.map(phase => {
              const done = phase.phase < activePlan.current_phase
              const current = phase.phase === activePlan.current_phase
              return (
                <div key={phase.phase} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: current ? O_DIM : 'var(--surface)', border: `1px solid ${current ? O_BORDER : 'var(--border)'}`, borderRadius: 10, opacity: phase.phase > activePlan.current_phase ? 0.45 : 1 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? O : current ? 'transparent' : 'var(--surface2)', border: `2px solid ${done || current ? O : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {done && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
                    {current && <div style={{ width: 6, height: 6, borderRadius: '50%', background: O }} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: done || current ? 700 : 600, color: current ? O : done ? 'var(--text-mid)' : 'var(--text-dim)', flex: 1 }}>{phase.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{phase.duration_days}+ days</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── COMPLETED ─── */}
      {!showingIntake && !generating && completedPlan && !activePlan && !pendingPlan && (
        <div style={{ padding: '40px 24px 16px', textAlign: 'center', animation: 'slideUp 0.25s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Recovery Complete</div>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24 }}>You completed every phase of your {completedPlan.injury} recovery.</p>
          <Link href="/today" style={{ display: 'block', padding: '16px', borderRadius: 14, background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 15, textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 32 }}>
            Back to Training →
          </Link>
        </div>
      )}

      {/* ─── PREVIOUS PLANS ─── */}
      {!generating && prevPlans.length > 0 && (
        <div style={{ padding: '0 16px 24px' }}>
          <button onClick={() => setPrevOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Previous Plans ({prevPlans.length})</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{prevOpen ? '▲' : '▼'}</span>
          </button>

          {prevOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, animation: 'slideUp 0.2s ease' }}>
              {prevPlans.map(p => (
                <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{p.injury}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtDate(p.created_at)} · {p.phases.length} phases</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: p.completed_at ? 'rgba(0,200,100,0.12)' : p.activated_at ? O_DIM : 'var(--surface2)', color: p.completed_at ? '#00c864' : p.activated_at ? O : 'var(--text-dim)', border: `1px solid ${p.completed_at ? 'rgba(0,200,100,0.25)' : p.activated_at ? O_BORDER : 'var(--border)'}`, flexShrink: 0 }}>
                      {p.completed_at ? '✓ Done' : p.activated_at ? 'Was Active' : 'Not started'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => activatePlan(p)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: `1px solid ${O_BORDER}`, background: O_DIM, color: O, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {p.completed_at ? 'Redo Plan' : 'Resume'}
                    </button>
                    <button onClick={() => setRestartModal({ plan: p, step: 'confirm', reinjured: null })} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Restart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── CONFIRM GENERATE MODAL ─── */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, animation: 'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, fontWeight: 800, color: O, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Movement AI</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Build recovery plan?</div>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 20 }}>
              AI will generate a custom phase-by-phase protocol for <strong style={{ color: 'var(--text)' }}>{intake.injury}</strong>.
              {extractInjuryKey(intake.injury) ? ' We\'ll check our template library first — may be instant.' : ' Takes about 10 seconds.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={generate} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Generate →</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHECK-IN MODAL ─── */}
      {checkinOpen && currentPhaseData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }} onClick={() => setCheckinOpen(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, animation: 'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>How did today feel?</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 20 }}>{currentPhaseData.readiness_check}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleCheckin('progress')} disabled={advancing} style={{ padding: '15px', borderRadius: 12, border: `1px solid ${O_BORDER}`, background: O_DIM, color: O, fontWeight: 900, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                {activePlan?.current_phase === activePlan?.phases.length ? '✓ Yes — ready to complete recovery' : '✓ Yes — ready to move to next phase'}
              </button>
              <button onClick={() => handleCheckin('stay')} disabled={advancing} style={{ padding: '15px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>↻ Not yet — need more time here</button>
              <button onClick={() => handleCheckin('setback')} disabled={advancing} style={{ padding: '15px', borderRadius: 12, border: '1px solid rgba(255,100,100,0.25)', background: 'rgba(255,100,100,0.08)', color: '#ff8080', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>⚠ Had pain or a setback</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RESTART MODAL ─── */}
      {restartModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }} onClick={() => setRestartModal(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, animation: 'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>

            {restartModal.step === 'confirm' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Restart this plan?</div>
                <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                  This will clear your progress on <strong style={{ color: 'var(--text)' }}>{restartModal.plan.injury}</strong> and put you back on a phase based on where you&apos;re at right now.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setRestartModal(null)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => setRestartModal(m => m ? { ...m, step: 'reinjured' } : null)} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${O} 0%, #e06000 100%)`, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>Yes, restart →</button>
                </div>
              </>
            )}

            {restartModal.step === 'reinjured' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Did you get hurt again?</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>Or is this the same issue flaring back up?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => doRestart(restartModal, 1)} style={{ padding: '15px', borderRadius: 12, border: '1px solid rgba(255,100,100,0.25)', background: 'rgba(255,100,100,0.08)', color: '#ff8080', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                    Fresh injury — start from Phase 1
                  </button>
                  <button onClick={() => setRestartModal(m => m ? { ...m, step: 'pain', reinjured: false } : null)} style={{ padding: '15px', borderRadius: 12, border: `1px solid ${O_BORDER}`, background: O_DIM, color: O, fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                    Same issue — assess my current pain →
                  </button>
                </div>
              </>
            )}

            {restartModal.step === 'pain' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Where&apos;s your pain at right now?</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>Be honest — this determines where you start.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PAIN_OPTIONS.map(opt => (
                    <button key={opt.phase} onClick={() => doRestart(restartModal, Math.min(opt.phase, restartModal.plan.phases.length))} style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, marginTop: 2 }}>{opt.sub}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: O, background: O_DIM, border: `1px solid ${O_BORDER}`, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>P{Math.min(opt.phase, restartModal.plan.phases.length)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
