'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function NutritionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>Nutrition</h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 40 }}>Your AI-powered nutrition coach</p>

      <div style={{ padding: '48px 28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 18 }}>🥗</div>
        <p style={{ fontWeight: 900, fontSize: 20, marginBottom: 12, letterSpacing: '-0.02em' }}>Building in the Background</p>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, maxWidth: 300, margin: '0 auto' }}>
          Your AI nutrition coach is coming — a personalized 3-month meal plan synced to your training phase, goals, and schedule. Stay tuned.
        </p>
      </div>

      <div style={{ marginTop: 16, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>What's Coming</p>
        {[
          'AI meal plan synced to your workout phase',
          'Morning to night — what to eat and when',
          'Built around your allergies and health conditions',
          'Adapts as your training intensity changes',
        ].map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0, marginTop: 1 }}>→</span>
            <span style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
