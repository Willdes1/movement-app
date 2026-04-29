'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Step = {
  step: number
  title: string
  description: string
  activities: string[]
  readiness_check: string
  duration_days: number
}

type Plan = {
  id: string
  sport: string
  steps: Step[]
  current_step: number
  last_checkin_date: string | null
}

const G = '#00e878'
const G_DIM = 'rgba(0,232,120,0.12)'
const G_BORDER = 'rgba(0,232,120,0.22)'

function StepCard({ step, index, currentStep, total }: { step: Step; index: number; currentStep: number; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const isDone = index < currentStep
  const isCurrent = index === currentStep
  const isFuture = index > currentStep

  const lineColor = isDone ? G : isCurrent ? G : 'var(--border)'
  const dotBg = isDone ? G : isCurrent ? 'transparent' : 'var(--surface2)'
  const dotBorder = isDone ? G : isCurrent ? G : 'var(--border)'

  return (
    <div style={{ display: 'flex', gap: 12, opacity: isFuture ? 0.45 : 1 }}>
      {/* Timeline column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 20 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: dotBg, border: `2px solid ${dotBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 2,
          boxShadow: isCurrent ? `0 0 10px ${G}55` : 'none',
        }}>
          {isDone && <div style={{ width: 8, height: 8, borderRadius: '50%', background: G }} />}
          {isCurrent && <div style={{ width: 6, height: 6, borderRadius: '50%', background: G }} />}
        </div>
        {index < total - 1 && (
          <div style={{ flex: 1, width: 2, background: lineColor, opacity: isDone ? 0.6 : 0.25, marginTop: 4, minHeight: 20 }} />
        )}
      </div>

      {/* Card content */}
      <div style={{
        flex: 1,
        background: isCurrent ? G_DIM : 'var(--surface)',
        border: `1px solid ${isCurrent ? G_BORDER : 'var(--border)'}`,
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isDone ? 0 : 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: isCurrent ? G : 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Step {step.step}
          </span>
          {isDone && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: G, letterSpacing: '0.05em' }}>✓ DONE</span>
          )}
          {isCurrent && (
            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: G, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, background: G_DIM, border: `1px solid ${G_BORDER}` }}>Current</span>
          )}
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: isCurrent ? G : 'var(--text)', marginBottom: isDone ? 0 : 6 }}>
          {step.title}
        </div>

        {!isDone && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.55, marginBottom: 10 }}>{step.description}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: isCurrent ? 12 : 0 }}>
              {step.activities.map((a, i) => (
                <span key={i} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: isCurrent ? 'rgba(0,232,120,0.08)' : 'var(--surface2)', border: `1px solid ${isCurrent ? G_BORDER : 'var(--border)'}`, color: isCurrent ? G : 'var(--text-mid)' }}>
                  {a}
                </span>
              ))}
            </div>
          </>
        )}

        {isCurrent && (
          <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Readiness Check</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>{step.readiness_check}</div>
          </div>
        )}

        {isDone && (
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {expanded ? '▲ Hide' : '▼ Show activities'}
          </button>
        )}
        {isDone && expanded && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {step.activities.map((a, i) => (
              <span key={i} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{a}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReturnToSportPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [sport, setSport] = useState('')
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [injuryArea, setInjuryArea] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [genErr, setGenErr] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: profile }, { data: existingPlan }] = await Promise.all([
      supabase.from('profiles').select('sport, restriction_areas, has_restrictions').eq('id', user.id).single(),
      supabase.from('return_to_sport_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (profile?.sport) setSport(profile.sport)
    if (profile?.has_restrictions && Array.isArray(profile?.restriction_areas)) {
      setRestrictions(profile.restriction_areas as string[])
      setInjuryArea((profile.restriction_areas as string[]).join(', '))
    }

    if (existingPlan) setPlan(existingPlan as Plan)

    setLoading(false)
  }, [user])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  async function generate() {
    setGenerating(true)
    setGenErr(false)
    try {
      const res = await fetch('/api/generate-return-to-sport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, restrictions, injuryArea }),
      })
      const data = await res.json()
      if (!data.steps) throw new Error('No steps')

      let saved: Plan | null = null
      if (plan) {
        const { data: updated } = await supabase
          .from('return_to_sport_plans')
          .update({ sport, steps: data.steps, current_step: 0, last_checkin_date: null, updated_at: new Date().toISOString() })
          .eq('id', plan.id).select().single()
        saved = updated as Plan
      } else {
        const { data: inserted } = await supabase
          .from('return_to_sport_plans')
          .insert({ user_id: user!.id, sport, steps: data.steps, current_step: 0 })
          .select().single()
        saved = inserted as Plan
      }
      if (saved) setPlan(saved)
    } catch {
      setGenErr(true)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCheckin(response: 'progress' | 'stay' | 'setback') {
    if (!plan) return
    setAdvancing(true)
    const today = new Date().toISOString().split('T')[0]
    const oldStep = plan.current_step
    const newStep = response === 'progress'
      ? Math.min(plan.current_step + 1, plan.steps.length - 1)
      : plan.current_step

    const { data: updated } = await supabase
      .from('return_to_sport_plans')
      .update({ current_step: newStep, last_checkin_date: today })
      .eq('id', plan.id).select().single()

    if (updated) setPlan(updated as Plan)
    setCheckinOpen(false)
    setAdvancing(false)

    if (response === 'progress' && newStep > oldStep) {
      const isFinished = newStep === plan.steps.length - 1
      setSuccessMsg(isFinished ? 'Full return achieved. You made it back.' : `Step ${newStep + 1} unlocked: ${plan.steps[newStep]?.title}`)
      setTimeout(() => setSuccessMsg(null), 5000)
    }
  }

  const hasCheckedInToday = plan?.last_checkin_date === new Date().toISOString().split('T')[0]
  const isFinished = plan ? plan.current_step === plan.steps.length - 1 : false
  const currentStepData = plan ? plan.steps[plan.current_step] : null

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  return (
    <div className="page-content">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes glow { 0%,100%{box-shadow:0 0 12px ${G}33} 50%{box-shadow:0 0 24px ${G}88} }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/recovery" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: 18, flexShrink: 0 }}>←</Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Return to Sport</h1>
          {plan && <div style={{ fontSize: 11, color: G, fontWeight: 700, marginTop: 2 }}>{plan.sport} · Step {plan.current_step + 1} of {plan.steps.length}</div>}
        </div>
        {plan && (
          <button onClick={() => { if (confirm('Regenerate your return plan? This will reset your progress.')) generate() }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700 }}>
            Regenerate
          </button>
        )}
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ margin: '0 16px 12px', padding: '12px 16px', background: G_DIM, border: `1px solid ${G_BORDER}`, borderRadius: 12, fontSize: 13, fontWeight: 700, color: G, textAlign: 'center' }}>
          ✦ {successMsg}
        </div>
      )}

      {/* No plan: generate UI */}
      {!plan && (
        <div style={{ margin: '0 16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Your Profile</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Sport</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: sport ? 'var(--text)' : 'var(--text-dim)' }}>{sport || 'Not set — update profile'}</span>
              </div>
              {injuryArea && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Restrictions</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>{injuryArea}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: G_DIM, border: `1px solid ${G_BORDER}`, borderRadius: 16, padding: '18px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: G, marginBottom: 6 }}>AI-Powered Comeback</div>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, margin: 0 }}>
              Claude will generate a personalized step-by-step progression to get you safely back to {sport || 'your sport'}. Each step unlocks after you confirm readiness.
            </p>
          </div>

          {genErr && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 10, fontSize: 12, color: '#ff8080', marginBottom: 12 }}>
              Generation failed. Check your connection and try again.
            </div>
          )}

          <button
            onClick={generate}
            disabled={generating || !sport}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: sport ? `linear-gradient(135deg, ${G} 0%, #00b860 100%)` : 'var(--surface2)', color: sport ? '#000' : 'var(--text-dim)', fontWeight: 900, fontSize: 15, cursor: sport ? 'pointer' : 'not-allowed', letterSpacing: '0.03em', textTransform: 'uppercase', animation: generating ? 'pulse 1.4s ease-in-out infinite' : 'none' }}
          >
            {generating ? 'Building your progression...' : sport ? `Generate ${sport} Return Plan →` : 'Set your sport in Profile first'}
          </button>
        </div>
      )}

      {/* Plan loaded: step progression */}
      {plan && (
        <div style={{ padding: '0 16px 24px' }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span>Progress</span>
              <span style={{ color: G }}>{plan.current_step}/{plan.steps.length - 1} steps</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(plan.current_step / (plan.steps.length - 1)) * 100}%`, background: `linear-gradient(90deg, ${G}, #00b860)`, borderRadius: 99, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* Check-in button for current step */}
          {!isFinished && (
            <div style={{ marginBottom: 20, padding: '16px', background: G_DIM, border: `1px solid ${G_BORDER}`, borderRadius: 14, animation: 'glow 3s ease-in-out infinite' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
                Current: {currentStepData?.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 12, lineHeight: 1.5 }}>
                {hasCheckedInToday ? "You've already logged today. Come back tomorrow." : "Completed today's session? Log how it went."}
              </div>
              <button
                onClick={() => setCheckinOpen(true)}
                disabled={hasCheckedInToday}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: hasCheckedInToday ? 'var(--surface2)' : `linear-gradient(135deg, ${G} 0%, #00b860 100%)`, color: hasCheckedInToday ? 'var(--text-dim)' : '#000', fontWeight: 900, fontSize: 14, cursor: hasCheckedInToday ? 'default' : 'pointer', letterSpacing: '0.03em', textTransform: 'uppercase' }}
              >
                {hasCheckedInToday ? '✓ Logged today' : '▶ Log Today\'s Session'}
              </button>
            </div>
          )}

          {isFinished && (
            <div style={{ marginBottom: 20, padding: '20px', background: G_DIM, border: `1px solid ${G_BORDER}`, borderRadius: 14, textAlign: 'center', animation: 'glow 3s ease-in-out infinite' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: G, marginBottom: 4 }}>Full Return Achieved</div>
              <div style={{ fontSize: 13, color: 'var(--text-mid)' }}>You completed every step. Back to full {plan.sport}.</div>
            </div>
          )}

          {/* Step timeline */}
          <div>
            {plan.steps.map((step, i) => (
              <StepCard key={step.step} step={step} index={i} currentStep={plan.current_step} total={plan.steps.length} />
            ))}
          </div>
        </div>
      )}

      {/* Check-in modal */}
      {checkinOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }} onClick={() => setCheckinOpen(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>How did today feel?</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
              {currentStepData?.readiness_check}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleCheckin('progress')}
                disabled={advancing}
                style={{ padding: '15px', borderRadius: 12, border: `1px solid ${G_BORDER}`, background: G_DIM, color: G, fontWeight: 900, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
              >
                ✓ Yes — ready to progress
              </button>
              <button
                onClick={() => handleCheckin('stay')}
                disabled={advancing}
                style={{ padding: '15px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
              >
                ↻ Not quite — need another day
              </button>
              <button
                onClick={() => handleCheckin('setback')}
                disabled={advancing}
                style={{ padding: '15px', borderRadius: 12, border: '1px solid rgba(255,100,100,0.25)', background: 'rgba(255,100,100,0.08)', color: '#ff8080', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
              >
                ⚠ Had pain / setback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
