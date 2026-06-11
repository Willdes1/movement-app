'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'
import Logo from '@/components/ui/Logo'

const PENDING_SLUG_KEY = 'pending_coach_slug'

// Public landing page for a coach's vanity join link.
// Logged out → store slug, send to signup; the JoinLinkRedeemer connects them after auth.
// Logged in  → connect immediately.
export default function JoinPage() {
  const params = useParams<{ slug: string }>()
  const slug = (params.slug ?? '').toLowerCase()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useCoached()

  const [coachName, setCoachName] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) { setInvalid(true); return }
    fetch(`/api/join/info?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (d.valid) setCoachName(d.coachName); else setInvalid(true) })
      .catch(() => setInvalid(true))
  }, [slug])

  async function join() {
    setError('')
    if (!user) {
      // Remember the link, finish after signup
      try { localStorage.setItem(PENDING_SLUG_KEY, slug) } catch { /* silent */ }
      router.push('/auth')
      return
    }
    setJoining(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/coach/redeem-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ slug }),
    })
    const data = await res.json()
    setJoining(false)
    if (data.success) {
      refresh()
      router.push('/my-coach')
    } else {
      setError(data.error ?? 'Something went wrong — please try again.')
    }
  }

  const coachFirst = coachName?.split(' ')[0] ?? ''

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Logo />
        </div>

        {invalid ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🤔</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, letterSpacing: '-0.02em' }}>
              This link isn&apos;t active
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 28 }}>
              Double-check the link with your coach, or ask them for their invite code instead.
            </p>
            <button
              onClick={() => router.push('/auth')}
              style={{ padding: '14px 28px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Go to Atlas Prime →
            </button>
          </>
        ) : !coachName ? (
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Loading…</p>
        ) : (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
              background: 'var(--accent-bg)', border: '2px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: 'var(--accent)',
            }}>
              {coachName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Personal Invitation
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              Coach {coachFirst} invited you to train on Atlas Prime
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 28 }}>
              Get your training program, daily workouts, progress tracking, and a direct line to your coach — all in one app.
            </p>

            {error && (
              <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '10px 14px', color: '#ff3b30', fontSize: 13, marginBottom: 14 }}>{error}</div>
            )}

            <button
              onClick={join}
              disabled={joining || authLoading}
              style={{
                display: 'block', width: '100%', padding: '16px', borderRadius: 12,
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
                color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em', boxShadow: '0 6px 24px var(--accent-shadow)',
                opacity: joining ? 0.6 : 1, marginBottom: 12,
              }}
            >
              {joining ? 'Connecting…' : user ? `Join Coach ${coachFirst} →` : 'Sign Up & Join →'}
            </button>
            {!user && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Already have an account? Same button — sign in and you&apos;ll be connected automatically.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
