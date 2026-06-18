'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/ui/Logo'

const MENU_ITEMS = [
  { href: '/for-you',        label: 'For You',           desc: 'Daily feed & mindset',              emoji: '⚡' },
  { href: '/exercises',      label: 'Exercise Library',  desc: 'Search & explore movements',        emoji: '📚' },
  { href: '/log',            label: 'History',           desc: 'Your workout log',                  emoji: '📋' },
  { href: '/mobility',       label: 'Mobility',           desc: 'Stretching & mobility drills',       emoji: '🧘' },
  { href: '/recovery',       label: 'Recovery',          desc: 'Active recovery tracking',          emoji: '🩹' },
  { href: '/my-coach',       label: 'My Coach',          desc: 'Coach-assigned program',            emoji: '🏋️' },
  { href: '/import-program', label: 'Import a Program',  desc: 'Bring your own PDF — AI-converted', emoji: '📄' },
  { href: '/programs',       label: 'My Programs',       desc: 'All your generated plans',           emoji: '📋' },
  { href: '/convert-plan',   label: 'Convert My Plan',   desc: 'Submit old plans for conversion',    emoji: '🔄' },
]

// Hidden while the user has an active coach assignment — these compete
// with the coach's programming
const COACHED_HIDDEN = ['/import-program', '/convert-plan']

export default function MobileMenu() {
  const pathname = usePathname()
  const { user, isAdmin, role, impersonating, hasAdminAccess } = useAuth()
  const { coached } = useCoached()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<{ name: string | null; sports: string[] | null } | null>(null)
  // Portal target only exists in the browser — render drawer after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name, sports').eq('id', user.id).single()
      .then(({ data }) => setProfile(data))
  }, [user])

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/coach') ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/join')
  ) return null

  const firstName = profile?.name?.split(' ')[0] ?? 'Athlete'
  const sport = profile?.sports?.[0] ?? 'Athlete'

  return (
    <>
      {/* Mobile header — hamburger + logo, left-aligned; hidden on desktop via CSS */}
      <div className="app-mobile-header" style={{ gap: 12 }}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={{
            width: 38, height: 38,
            borderRadius: 10,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'block', width: 18, height: 2, background: 'var(--text)', borderRadius: 2, marginBottom: 4 }} />
          <span style={{ display: 'block', width: 13, height: 2, background: 'var(--text)', borderRadius: 2, marginBottom: 4 }} />
          <span style={{ display: 'block', width: 16, height: 2, background: 'var(--text)', borderRadius: 2 }} />
        </button>
        <Logo />
      </div>

      {/* Backdrop + drawer rendered via portal at document.body — the blurred
          fixed header would otherwise trap position:fixed descendants inside it */}
      {mounted && createPortal(<>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: 290,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        zIndex: 201,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>

        {/* Header */}
        <div style={{
          padding: '52px 20px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <Logo />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              {firstName} · {sport}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{
              width: 34, height: 34,
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Label */}
        <div style={{ padding: '18px 20px 6px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            More
          </p>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '4px 12px' }}>
          {MENU_ITEMS.filter(item => !(coached && COACHED_HIDDEN.includes(item.href))).map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 12px',
                  borderRadius: 12,
                  marginBottom: 4,
                  textDecoration: 'none',
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'transparent'}`,
                }}
              >
                <span style={{
                  width: 38, height: 38,
                  borderRadius: 10,
                  background: active ? 'var(--accent-bg)' : 'var(--surface2)',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, flexShrink: 0,
                }}>
                  {item.emoji}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text)', lineHeight: 1.2 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {item.desc}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Admin portal — owner + permitted partners only; hidden during impersonation */}
        {!impersonating && hasAdminAccess && (
          <div style={{ padding: '4px 12px 8px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '12px 8px 6px' }}>
              Admin
            </p>
            <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 12px', borderRadius: 12, textDecoration: 'none', background: 'transparent', border: '1px solid transparent' }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                🔑
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Admin Portal</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{isAdmin ? 'Platform control center' : 'Your granted sections'}</div>
              </div>
            </Link>
          </div>
        )}

        {/* Coach portal — coaches and admins only; hidden during impersonation */}
        {!impersonating && (isAdmin || role === 'coach') && (
          <div style={{ padding: '4px 12px 8px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '12px 8px 6px' }}>
              Coaching
            </p>
            <Link
              href="/coach/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 12px',
                borderRadius: 12,
                textDecoration: 'none',
                background: 'transparent',
                border: '1px solid transparent',
              }}
            >
              <span style={{
                width: 38, height: 38,
                borderRadius: 10,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>
                🏋️
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                  Coach Portal
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Manage your clients & programs
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Bottom — account link */}
        <div style={{ padding: '12px 12px 20px', borderTop: '1px solid var(--border)' }}>
          <Link
            href="/account"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px', borderRadius: 12,
              textDecoration: 'none',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900, color: 'var(--accent)', flexShrink: 0,
            }}>
              {firstName[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{firstName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>View profile</div>
            </div>
          </Link>
        </div>
      </div>
      </>, document.body)}
    </>
  )
}
