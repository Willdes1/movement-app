'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // Validate and apply promo code if provided
      if (promoCode.trim() && signUpData.user) {
        const code = promoCode.trim().toUpperCase()
        const { data: promo } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('code', code)
          .eq('active', true)
          .single()

        if (promo) {
          const usageOk = !promo.max_uses || promo.uses_count < promo.max_uses
          if (usageOk) {
            // Apply the plan tier from the promo code
            await supabase
              .from('profiles')
              .upsert({ id: signUpData.user.id, plan_tier: promo.grants_tier })

            await supabase
              .from('promo_codes')
              .update({ uses_count: promo.uses_count + 1 })
              .eq('id', promo.id)
          } else {
            setError('That promo code has reached its usage limit.')
            setLoading(false)
            return
          }
        } else {
          setError('Invalid or expired promo code.')
          setLoading(false)
          return
        }
      }

      setConfirmSent(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/today')
      }
    }

    setLoading(false)
  }

  if (confirmSent) {
    return (
      <div style={{ padding: '48px 24px', maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Check your email</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
          We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />
          Click it to activate your account, then come back to log in.
        </p>
        <button
          onClick={() => { setConfirmSent(false); setMode('login') }}
          style={{ marginTop: 24, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '48px 24px', maxWidth: 400, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          {mode === 'login' ? 'Sign in to your Movement account' : 'Start your personalized movement journey'}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            style={inputStyle}
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Promo Code <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value)}
              placeholder="e.g. BETA2026"
              style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            />
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)', padding: '10px 14px', background: 'rgba(255,77,77,0.08)', borderRadius: 8, border: '1px solid rgba(255,77,77,0.2)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 4,
            padding: '14px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'var(--surface2)' : 'var(--accent)',
            color: loading ? 'var(--text-dim)' : '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-dim)' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}
