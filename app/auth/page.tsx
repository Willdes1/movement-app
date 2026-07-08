'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/track'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'signup'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }} fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  // Coach signup mode — /coaches redirects here with ?as=coach. New accounts
  // created in this mode get role='coach' and land in the Coach Portal.
  const [asCoach, setAsCoach] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('as') === 'coach') {
      setAsCoach(true)
      setMode('signup')
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(asCoach ? '/coach/dashboard' : '/today')
    }
  }, [user, authLoading, router, asCoach])

  // Show error if returning from a failed OAuth redirect
  const oauthError = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('error')
    : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [error, setError] = useState(oauthError ? 'Sign-in failed or was cancelled. Please try again.' : '')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('')
    if (mode === 'signup' && !tosAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)

    // Coach signup link → stamp the intent so the callback assigns role=coach.
    if (asCoach) sessionStorage.setItem('pendingCoach', '1')

    if (mode === 'signup' && !asCoach) {
      const code = promoCode.trim().toUpperCase()
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
        sessionStorage.setItem('pendingPromo', JSON.stringify({ id: promo.id, role: promo.role, uses: promo.uses }))
      }
    }

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // Page navigates away — no setLoading(false) needed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && !tosAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)

    if (mode === 'signup') {
      // Validate promo code before creating account (coach mode skips codes).
      const code = promoCode.trim().toUpperCase()
      let validatedPromo: { id: string; role: string; uses: number; max_uses: number } | null = null
      if (code && !asCoach) {
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
      trackEvent(asCoach ? 'coach_signup' : 'signup', { method: 'email' })

      // Coach signup: stamp the intent, and apply role immediately if we got a
      // session (no email confirmation); otherwise apply on first login.
      if (asCoach) {
        sessionStorage.setItem('pendingCoach', '1')
        if (signUpData.session && signUpData.user) {
          await supabase.from('profiles').upsert({ id: signUpData.user.id, role: 'coach' })
          sessionStorage.removeItem('pendingCoach')
          router.push('/coach/dashboard')
          return
        }
        setConfirmSent(true)
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
        // Coach confirming after email signup, or logging in via the coach link.
        const pendingCoach = sessionStorage.getItem('pendingCoach')
        if ((pendingCoach || asCoach) && data.user) {
          if (pendingCoach) await supabase.from('profiles').update({ role: 'coach' }).eq('id', data.user.id)
          sessionStorage.removeItem('pendingCoach')
          router.push('/coach/dashboard')
          setLoading(false)
          return
        }
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
        {asCoach && (
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            Atlas Prime for Coaches
          </div>
        )}
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          {asCoach
            ? (mode === 'login' ? 'Coach sign in' : 'Set up your Coach Portal')
            : (mode === 'login' ? 'Welcome back' : 'Create account')}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          {asCoach
            ? 'Build AI programs, manage your clients, and coach in their ears — free to start.'
            : (mode === 'login' ? 'Sign in to your Atlas Prime account' : 'Start your personalized movement journey')}
        </p>
      </div>

      {/* OAuth buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => handleOAuth('google')}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '13px 16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <button
          onClick={() => handleOAuth('apple')}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '13px 16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: '#000',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <AppleIcon />
          Continue with Apple
        </button>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
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

        {mode === 'signup' && !asCoach && (
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

        {mode === 'signup' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={e => setTosAccepted(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              I agree to the{' '}
              <a href="/legal/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                Privacy Policy
              </a>
              , including that admins may access my account for support purposes with full audit logging.
            </span>
          </label>
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
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setTosAccepted(false) }}
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
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
}
