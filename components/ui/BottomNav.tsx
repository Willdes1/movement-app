'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'

const tabs = [
  {
    href: '/today',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      </svg>
    ),
  },
  {
    href: '/plan',
    label: 'Plan',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    href: '/recovery',
    label: 'Recovery',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 21C12 21 4 15 4 9a8 8 0 0 1 16 0c0 6-8 12-8 12z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}/>
        <circle cx="12" cy="9" r="2" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
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
        const isRecovery = tab.href === '/recovery' && !!activeRecovery
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
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              position: 'relative',
            }}
          >
            {tab.icon(active)}
            {tab.label}
            {isRecovery && !active && (
              <span style={{
                position: 'absolute',
                top: 2, right: 'calc(50% - 18px)',
                width: 7, height: 7,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '1.5px solid var(--bg)',
              }} />
            )}
            {active && (
              <span style={{
                position: 'absolute',
                bottom: -8,
                width: 20, height: 3,
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
