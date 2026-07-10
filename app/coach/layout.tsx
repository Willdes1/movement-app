'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Logo from '@/components/ui/Logo'
import CoachMobileMenu from '@/components/coach/CoachMobileMenu'

const coachNav = [
  { href: '/coach/dashboard',  label: 'Dashboard', emoji: '📊' },
  { href: '/coach/programs',   label: 'Programs',  emoji: '📋' },
  { href: '/coach/clients',    label: 'Clients',   emoji: '👥' },
  { href: '/coach/builder',    label: 'Builder',   emoji: '🛠️' },
  { href: '/coach/library',    label: 'Library',   emoji: '🎬' },
  { href: '/coach/analytics',  label: 'Analytics', emoji: '📈' },
  { href: '/coach/messages',   label: 'Messages',  emoji: '💬' },
  { href: '/coach/billing',    label: 'Billing',   emoji: '💳' },
]

// Mobile bottom tabs — SVG line icons matching the user app's BottomNav style
const mobileTabs = [
  {
    href: '/coach/dashboard',
    label: 'Dashboard',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
      </svg>
    ),
  },
  {
    href: '/coach/clients',
    label: 'Clients',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round"/>
        <path d="M16 5a3.5 3.5 0 0 1 0 6.7M18.5 14.5c2 .8 3 2.6 3 5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/coach/messages',
    label: 'Messages',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 11.5c0 4.1-4 7.5-9 7.5-1.1 0-2.2-.2-3.2-.5L3 20l1.6-3.8C3.6 14.9 3 13.3 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/coach/analytics',
    label: 'Analytics',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} viewBox="0 0 24 24">
        <path d="M5 20v-6M11 20V8M17 20v-9" strokeLinecap="round"/>
        <path d="M21 20H3" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
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
      {/* Mobile header — hamburger + logo, left-aligned; hidden on desktop */}
      <div className="coach-mobile-header" style={{ gap: 12 }}>
        <CoachMobileMenu />
        <Logo variant="coach" />
      </div>

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
          <Logo variant="coach" />
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

      {/* Mobile bottom nav — 4 tabs, hidden on desktop via CSS class */}
      <nav className="coach-mobile-nav">
        {mobileTabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '4px 0',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                textDecoration: 'none',
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                position: 'relative',
              }}
            >
              {tab.icon(active)}
              {tab.label}
              {active && (
                <span style={{
                  position: 'absolute',
                  bottom: -8,
                  width: 18, height: 3,
                  borderRadius: '2px 2px 0 0',
                  background: 'var(--accent)',
                }} />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
