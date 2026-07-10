'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { COACH_PLANS, planFor, type CoachPlan, type PlanKey } from '@/lib/coach-plans'
import { BILLING_LIVE } from '@/lib/flags'
import { isNativeApp } from '@/lib/platform'

type Status = {
  planKey: PlanKey
  plan: CoachPlan
  usage: { ai_programs_used: number; messages_used: number }
  period: string
  hasBillingAccount: boolean
  stripeReady: boolean
}

function BillingInner() {
  const { user } = useAuth()
  const params = useSearchParams()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/coach/billing-status', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const d = await res.json().catch(() => null)
      if (res.ok) setStatus(d as Status)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const b = params.get('billing')
    if (b === 'success') setFlash('✓ Subscription active — thank you! Your plan updates within a few seconds.')
    if (b === 'cancelled') setFlash('Checkout cancelled — no charge was made.')
  }, [params])

  async function upgrade(tier: CoachPlan) {
    if (!user || !tier.stripePlan) return
    setBusy(tier.key)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: user.email, plan: tier.stripePlan, returnUrl: window.location.origin + '/coach/billing' }),
      })
      const d = await res.json().catch(() => null)
      if (d?.url) window.location.href = d.url
      else { setFlash(d?.error || 'Could not start checkout.'); setBusy(null) }
    } catch { setFlash('Could not start checkout.'); setBusy(null) }
  }

  async function manage() {
    if (!user) return
    setBusy('manage')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, returnUrl: window.location.origin + '/coach/billing' }),
      })
      const d = await res.json().catch(() => null)
      if (d?.url) window.location.href = d.url
      else { setFlash(d?.error || 'No billing account yet — subscribe to a plan first.'); setBusy(null) }
    } catch { setFlash('Could not open billing portal.'); setBusy(null) }
  }

  const current = status ? planFor(status.planKey) : COACH_PLANS[0]
  const native = isNativeApp()

  const bar = (used: number, cap: number | null, color: string) => {
    const pct = cap == null ? 0 : Math.min(100, Math.round((used / Math.max(1, cap)) * 100))
    const over = cap != null && used >= cap
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-mid)' }}>{used}{cap == null ? '' : ` / ${cap}`}</span>
          {over && <span style={{ color: '#ef4444', fontWeight: 700 }}>limit reached</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: cap == null ? '15%' : `${pct}%`, background: over ? '#ef4444' : color, opacity: 0.85 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="coach-page" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>Atlas Prime</p>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)' }}>Billing & Plan</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Credits reset monthly. Voice features (dictation + cloning) are on paid plans.</p>
      </div>

      {flash && (
        <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', margin: '14px 0' }}>{flash}</div>
      )}

      {!BILLING_LIVE && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 13, color: '#f59e0b', margin: '14px 0' }}>
          Billing is being finalized — you can preview the plans below. Checkout turns on the moment it&apos;s live.
        </div>
      )}
      {native && (
        <div style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-mid)', margin: '14px 0' }}>
          On the app, subscriptions are managed through your App Store / Google Play account.
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '40px 0', textAlign: 'center' }}>Loading your plan…</p>
      ) : (
        <>
          {/* Current plan + usage */}
          {status && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', margin: '16px 0 26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Current plan</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{current.name}{current.priceMonthly > 0 ? ` · $${current.priceMonthly}/mo` : ''}</p>
                </div>
                {current.key !== 'free' && !native && (
                  <button onClick={manage} disabled={busy === 'manage'} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {busy === 'manage' ? '…' : 'Manage billing'}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>AI programs this month</p>
                  {bar(status.usage.ai_programs_used, current.aiCredits, 'var(--accent)')}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Messages this month</p>
                  {bar(status.usage.messages_used, current.messagesPerMonth, '#a78bfa')}
                </div>
              </div>
            </div>
          )}

          {/* Plan cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {COACH_PLANS.map(tier => {
              const isCurrent = current.key === tier.key
              return (
                <div key={tier.key} style={{ background: 'var(--surface)', border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{tier.name}</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{tier.priceMonthly === 0 ? 'Free' : `$${tier.priceMonthly}`}<span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>{tier.priceMonthly === 0 ? '' : '/mo'}</span></p>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', minHeight: 32 }}>{tier.blurb}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--text-mid)' }}>
                    <li>✓ {tier.aiCredits} AI programs{tier.key === 'free' ? ' (trial)' : ' / mo'}</li>
                    <li>{tier.voice ? '✓' : '✕'} Voice dictation + cloning</li>
                    <li>✓ {tier.messagesPerMonth == null ? 'Unlimited' : tier.messagesPerMonth.toLocaleString()} messages / mo</li>
                  </ul>
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    {isCurrent ? (
                      <div style={{ padding: '9px', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>Current plan</div>
                    ) : tier.stripePlan ? (
                      <button
                        onClick={() => upgrade(tier)}
                        disabled={!BILLING_LIVE || native || busy === tier.key || !user}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: (!BILLING_LIVE || native) ? 'var(--surface2)' : 'var(--accent)', color: (!BILLING_LIVE || native) ? 'var(--text-dim)' : '#fff', fontSize: 13, fontWeight: 700, cursor: (!BILLING_LIVE || native) ? 'not-allowed' : 'pointer' }}
                      >
                        {busy === tier.key ? '…' : !BILLING_LIVE ? 'Coming soon' : `Choose ${tier.name}`}
                      </button>
                    ) : (
                      <div style={{ padding: '9px', borderRadius: 8, background: 'transparent', color: 'var(--text-dim)', fontSize: 12, textAlign: 'center' }}>Starter plan</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function CoachBillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  )
}
