'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'

const tabs = [
  {
    href: '/today',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      </svg>
    ),
  },
  {
    href: '/nutrition',
    label: 'Nutrition',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 11h18c0 5.5-4.5 9-9 9s-9-3.5-9-9z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <path d="M8 3v5M12 2v5M16 3v5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" fillOpacity={active ? 0.15 : 0}/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
        <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { activeRecovery } = useTheme()

  if (pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/coach') || pathname.startsWith('/legal') || pathname.startsWith('/auth') || pathname.startsWith('/join') || pathname.startsWith('/blog')) return null

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: 'auto',
      minHeight: '64px',
      background: 'rgba(19,19,24,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: '10px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {activeRecovery && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))',
        }} />
      )}

      {tabs.map(tab => {
        const active = pathname.startsWith(tab.href) || (tab.href === '/account' && pathname.startsWith('/profile'))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 0',
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              textDecoration: 'none',
              fontSize: '8px',
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
  )
}
