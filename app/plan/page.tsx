'use client'
import { useEffect, useState, useCallback } from 'react'
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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TYPE_COLOR: Record<string, string> = {
  workout: 'var(--accent)',
  warmup: 'var(--orange)',
  cooldown: 'var(--yellow)',
  morning: 'var(--green)',
  abs: 'var(--accent)',
  evening: 'var(--orange)',
  rest: 'var(--text-dim)',
}
const TYPE_BG: Record<string, string> = {
  workout: 'var(--accent-bg)',
  warmup: 'var(--orange-bg)',
  cooldown: 'var(--yellow-bg)',
  morning: 'var(--green-bg)',
  abs: 'var(--accent-bg)',
  evening: 'var(--orange-bg)',
  rest: 'rgba(120,130,148,0.06)',
}
const TYPE_BORDER: Record<string, string> = {
  workout: 'var(--accent-border)',
  warmup: 'var(--orange-border)',
  cooldown: 'var(--yellow-border)',
  morning: 'var(--green-border)',
  abs: 'var(--accent-border)',
  evening: 'var(--orange-border)',
  rest: 'var(--border)',
}

export default function PlanPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const todayIdx = (new Date().getDay() + 6) % 7

  const [plan, setPlan] = useState<DayPlan[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const generatePlan = useCallback(async () => {
    if (!user) return
    setGenerating(true)
    setError(null)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile?.sport && !profile?.goal) {
      setError('Set up your profile first so your AI coach knows what to build.')
      setGenerating(false)
      return
    }

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })

      if (!res.ok) throw new Error('Generation failed')
      const { plan: newPlan } = await res.json()

      const now = new Date().toISOString()
      await supabase
        .from('generated_plans')
        .upsert({ user_id: user.id, plan: newPlan, generated_at: now })

      setPlan(newPlan)
      setGeneratedAt(now)
    } catch {
      setError('Something went wrong. Tap Regenerate to try again.')
    } finally {
      setGenerating(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase
      .from('generated_plans')
      .select('plan, generated_at')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.plan) {
          setPlan(data.plan as DayPlan[])
          setGeneratedAt(data.generated_at)
        } else {
          generatePlan()
        }
      })
  }, [user, generatePlan])

  if (authLoading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  if (generating) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>⚡</div>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Building your plan...</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
          Your AI coach is designing a personalized weekly program based on your profile. This takes about 10 seconds.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Weekly Plan</h1>
        <button
          onClick={generatePlan}
          style={{
            fontSize: 12, color: 'var(--accent)', background: 'none',
            border: '1px solid var(--accent-border)', borderRadius: 20,
            padding: '5px 14px', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Regenerate
        </button>
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>
        {generatedAt
          ? `AI-personalized · Generated ${new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : 'AI-personalized plan'}
      </p>

      {error && (
        <div style={{
          padding: '12px 16px', background: 'var(--orange-bg)',
          border: '1px solid var(--orange-border)', borderRadius: 10,
          marginBottom: 20, fontSize: 13, color: 'var(--text)',
        }}>
          {error}
        </div>
      )}

      {/* Day scroll strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div
            key={d}
            style={{
              flexShrink: 0, width: 42, height: 42, borderRadius: 10,
              background: i === todayIdx ? 'var(--accent)' : 'var(--surface)',
              border: `1px solid ${i === todayIdx ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: i === todayIdx ? '#fff' : 'var(--text-dim)' }}>{d}</span>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan?.map((day, i) => (
          <div
            key={day.day}
            style={{
              background: i === todayIdx ? (TYPE_BG[day.type] ?? 'var(--surface)') : 'var(--surface)',
              border: `1px solid ${i === todayIdx ? (TYPE_BORDER[day.type] ?? 'var(--border)') : 'var(--border)'}`,
              borderRadius: 12, padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 28, letterSpacing: '0.04em',
                  color: TYPE_COLOR[day.type] ?? 'var(--text-dim)',
                }}>
                  {day.day}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{day.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.duration}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {day.movements.map((m, mi) => (
                <span
                  key={mi}
                  style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 20,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: 'var(--text-mid)',
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
