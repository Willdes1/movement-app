'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/ui/Logo'

const MENU_ITEMS = [
  { href: '/coach/programs', label: 'Programs', desc: 'Program library & templates',      emoji: '📋' },
  { href: '/coach/builder',  label: 'Builder',  desc: 'AI & manual program builder',      emoji: '🛠️' },
  { href: '/coach/library',  label: 'Library',  desc: 'Your exercises & video clips',     emoji: '🎬' },
]

export default function CoachMobileMenu() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Hamburger button — boxed, matches user drawer icon tiles */}
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

      {/* Backdrop */}
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
          <Logo variant="coach" />
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
          {MENU_ITEMS.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
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

        {/* Bottom — back to the client app, kept quiet */}
        <div style={{ padding: '12px 12px 20px', borderTop: '1px solid var(--border)' }}>
          <Link
            href="/today"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
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
      </div>
    </>
  )
}
