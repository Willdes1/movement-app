'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/today')
    }
  }, [user, authLoading, router])

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
      // Validate promo code before creating account
      const code = promoCode.trim().toUpperCase()
      let validatedPromo: { id: string; role: string; uses: number; max_uses: number } | null = null
      if (code) {
        const { data: promo } = await supabase
          .from('promo_codes')
          .select('id, role, uses, max_uses')
          .eq('code', code)
          .single()
        if (!promo) {
          setError('Invalid or expired promo code.')
          setLoading(false)
          return
        }
        if (promo.max_uses > 0 && promo.uses >= promo.max_uses) {
          setError('That promo code has reached its usage limit.')
          setLoading(false)
          return
        }
        validatedPromo = promo
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // If email confirmation is required, stash the promo code so we can apply it after login
      if (validatedPromo) {
        sessionStorage.setItem('pendingPromo', JSON.stringify({ id: validatedPromo.id, role: validatedPromo.role }))
      }

      // If signup returned a session (no email confirmation required), apply immediately
      if (signUpData.session && validatedPromo && signUpData.user) {
        await supabase.from('profiles').upsert({ id: signUpData.user.id, role: validatedPromo.role })
        await supabase.from('promo_codes').update({ uses: validatedPromo.uses + 1 }).eq('id', validatedPromo.id)
        sessionStorage.removeItem('pendingPromo')
      }

      setConfirmSent(true)
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        // Apply any pending promo code from signup
        const pending = sessionStorage.getItem('pendingPromo')
        if (pending && data.user) {
          try {
            const promo = JSON.parse(pending) as { id: string; role: string }
            const { data: current } = await supabase.from('promo_codes').select('uses').eq('id', promo.id).single()
            await supabase.from('profiles').update({ role: promo.role }).eq('id', data.user.id)
            await supabase.from('promo_codes').update({ uses: (current?.uses ?? 0) + 1 }).eq('id', promo.id)
            sessionStorage.removeItem('pendingPromo')
          } catch { /* silent — promo already applied or malformed */ }
        }
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
