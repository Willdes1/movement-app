'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/today',     label: 'Home',       emoji: '🏠' },
  { href: '/for-you',  label: 'For You',    emoji: '⚡' },
  { href: '/nutrition',label: 'Nutrition',  emoji: '🥗' },
  { href: '/calendar', label: 'Calendar',   emoji: '📅' },
  { href: '/account',  label: 'Account',    emoji: '👤' },
  { href: '/recovery', label: 'Recovery',   emoji: '🩹' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [profile, setProfile] = useState<{ name: string | null; sports: string[] | null } | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('name, sports')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [user])

  if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) return null

  const firstName = profile?.name?.split(' ')[0] ?? 'Athlete'
  const sport = profile?.sports?.[0] ?? 'Movement'

  return (
    <nav className="app-sidebar" style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: 230,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      flexDirection: 'column',
      zIndex: 40,
      overflow: 'hidden',
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
          fontSize: 9,
          color: 'var(--text-dim)',
          fontWeight: 700,
          marginTop: 4,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          Your Movement Coach
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
            || (item.href === '/account' && pathname.startsWith('/profile'))
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

      {/* User section */}
      {user && (
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 10,
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 900,
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            {firstName[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {firstName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sport}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
