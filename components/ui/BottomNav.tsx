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
    href: '/for-you',
    label: 'For You',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fillOpacity={active ? 0.2 : 0}/>
      </svg>
    ),
  },
  {
    href: '/plan',
    label: 'Your Plan',
    center: true,
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" fillOpacity={active ? 0.15 : 0}/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
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
    href: '/browse',
    label: 'Browse',
    icon: (active: boolean) => (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { activeRecovery } = useTheme()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: '80px',
      background: 'rgba(19,19,24,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: '8px',
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
        const active = pathname.startsWith(tab.href)
        const isRecoveryTab = tab.href === '/plan' && !!activeRecovery

        if (tab.center) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                padding: '0 0 4px',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                textDecoration: 'none',
                fontSize: '8px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                position: 'relative',
                marginTop: -10,
              }}
            >
              <div style={{
                width: 48, height: 48,
                borderRadius: 16,
                background: active
                  ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)'
                  : 'var(--surface2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: active ? '#fff' : 'var(--text-dim)',
                boxShadow: active ? '0 4px 16px var(--accent-shadow)' : 'none',
              }}>
                {tab.icon(active)}
              </div>
              <span style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}>
                {isRecoveryTab ? 'Recovery' : tab.label}
              </span>
            </Link>
          )
        }

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
