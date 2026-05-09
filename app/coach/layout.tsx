'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

const coachNav = [
  { href: '/coach/dashboard',  label: 'Dashboard', emoji: '📊' },
  { href: '/coach/programs',   label: 'Programs',  emoji: '📋' },
  { href: '/coach/clients',    label: 'Clients',   emoji: '👥' },
  { href: '/coach/builder',    label: 'Builder',   emoji: '🛠️' },
]

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, isAdmin, role } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth'); return }
    if (!isAdmin && role !== 'coach') { router.replace('/today'); return }
  }, [user, loading, isAdmin, role, router])

  if (loading || !user || (!isAdmin && role !== 'coach')) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading…</div>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Coach sidebar — hidden on mobile via CSS class */}
      <nav className="coach-sidebar" style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: 230,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        zIndex: 40,
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>
            Move
            <span style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>.</span>
          </div>
          <div style={{
            fontSize: 9, color: 'var(--accent)', fontWeight: 800,
            marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Coach Portal
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {coachNav.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 20px',
                  margin: '1px 8px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {item.emoji}
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Back to app */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <Link
            href="/today"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--text-dim)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 13 }}>←</span>
            Back to My Training
          </Link>
        </div>
      </nav>

      {/* Main content — margin-left handled by CSS class on desktop */}
      <main className="coach-main">
        {children}
      </main>

      {/* Mobile bottom nav — hidden on desktop via CSS class */}
      <nav className="coach-mobile-nav">
        {coachNav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 0',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                textDecoration: 'none',
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.emoji}</span>
              {item.label}
            </Link>
          )
        })}
        <Link
          href="/today"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '4px 0',
            color: 'var(--text-dim)',
            textDecoration: 'none',
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ fontSize: 18 }}>←</span>
          My App
        </Link>
      </nav>
    </div>
  )
}
