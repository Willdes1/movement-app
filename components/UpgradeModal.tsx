'use client'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { PlanTier } from '@/lib/usePlan'

const TIERS: {
  id: PlanTier
  name: string
  price: number
  color: string
  bg: string
  border: string
  features: string[]
  cta: string
}[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    color: 'var(--accent)',
    bg: 'var(--accent-bg)',
    border: 'var(--accent-border)',
    features: [
      'Unlimited AI plan generations',
      'Full exercise library + coaching cues',
      'Exercise videos',
      'Workout logging + calendar',
      'For-You personalized feed',
      'Push notifications + streak tracking',
    ],
    cta: 'Start Pro',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 19,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.25)',
    features: [
      'Everything in Pro',
      'Nutrition AI — 3-month meal plans',
      'Macros synced to training phases',
      'Injury → training handoff',
      'Multiple sport profiles',
      'Advanced progress analytics',
    ],
    cta: 'Start Plus',
  },
  {
    id: 'supreme',
    name: 'Supreme',
    price: 29,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    features: [
      'Everything in Plus',
      'Coach dashboard access',
      'Up to 5 athlete profiles',
      'Priority AI — faster generation',
      'Early access to new features',
      'Affiliate revenue sharing',
    ],
    cta: 'Start Supreme',
  },
]

interface Props {
  onClose: () => void
  highlightPlan?: PlanTier
}

export default function UpgradeModal({ onClose, highlightPlan = 'pro' }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<PlanTier | null>(null)
  const [error, setError] = useState('')

  async function handleUpgrade(planId: PlanTier) {
    if (!user) return
    setLoading(planId)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          plan: planId,
          returnUrl: window.location.href,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Could not start checkout. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--bg)', borderRadius: '20px 20px 0 0',
          padding: '24px 20px 48px', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Upgrade your plan
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Cancel anytime · Billed monthly
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        {/* Tier cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TIERS.map(tier => {
            const isHighlighted = tier.id === highlightPlan
            return (
              <div
                key={tier.id}
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  border: `1.5px solid ${isHighlighted ? tier.color : tier.border}`,
                  background: isHighlighted ? tier.bg : 'var(--surface)',
                  position: 'relative',
                }}
              >
                {isHighlighted && (
                  <div style={{
                    position: 'absolute', top: -10, left: 16,
                    padding: '2px 10px', borderRadius: 12,
                    background: tier.color, color: '#fff',
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Recommended
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: tier.color, marginBottom: 2 }}>
                      {tier.name}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>
                      ${tier.price}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)' }}>/mo</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={loading !== null}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: 'none',
                      background: tier.color, color: '#fff',
                      fontWeight: 700, fontSize: 13,
                      cursor: loading !== null ? 'default' : 'pointer',
                      opacity: loading !== null && loading !== tier.id ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loading === tier.id ? '…' : tier.cta}
                  </button>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tier.features.map(f => (
                    <li key={f} style={{ fontSize: 12, color: 'var(--text-mid)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: tier.color, fontSize: 12, marginTop: 1, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'rgba(255,100,100,0.9)', marginTop: 16, textAlign: 'center' }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 20, textAlign: 'center', lineHeight: 1.5 }}>
          Secure checkout via Stripe. Cancel anytime from Account settings.
        </p>
      </div>
    </div>
  )
}
