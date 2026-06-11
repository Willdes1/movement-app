'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'

const PENDING_SLUG_KEY = 'pending_coach_slug'

// If the user arrived via a coach join link (/join/{slug}) and then signed up
// or signed in, this completes the coach connection automatically.
export default function JoinLinkRedeemer() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, impersonating } = useAuth()
  const { refresh } = useCoached()
  const [connectedTo, setConnectedTo] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (!user || impersonating || attempted.current) return
    if (pathname.startsWith('/join') || pathname.startsWith('/auth')) return
    let slug: string | null = null
    try { slug = localStorage.getItem(PENDING_SLUG_KEY) } catch { return }
    if (!slug) return
    attempted.current = true

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/coach/redeem-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ slug }),
        })
        const data = await res.json()
        localStorage.removeItem(PENDING_SLUG_KEY)
        if (data.success) {
          refresh()
          setConnectedTo(data.coachName ?? 'your coach')
        }
      } catch {
        // leave the key for a retry next page load
        attempted.current = false
      }
    })()
  }, [user, impersonating, pathname, refresh])

  if (!connectedTo) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 400, border: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🤝</div>
        <p style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em' }}>
          You&apos;re connected!
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24 }}>
          {connectedTo} is now your coach. Your program will appear as soon as they assign it — you can message them any time.
        </p>
        <button
          onClick={() => { setConnectedTo(null); router.push('/my-coach') }}
          style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
        >
          Go to My Coach →
        </button>
        <button
          onClick={() => setConnectedTo(null)}
          style={{ display: 'block', width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Explore the app first
        </button>
      </div>
    </div>
  )
}
