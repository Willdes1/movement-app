'use client'

// PLACEHOLDER LOGO — replace this single component with final asset later.
// When the real logo arrives: swap the contents of this file only.
// Imported by: components/ui/Sidebar.tsx, app/coach/layout.tsx,
//              app/admin/page.tsx, app/admin/mockup-a/page.tsx

type LogoVariant = 'app' | 'admin' | 'coach'

export default function Logo({ variant = 'app' }: { variant?: LogoVariant }) {
  const portalLabel =
    variant === 'admin' ? 'OS' :
    variant === 'coach' ? 'Coach OS' :
    null

  return (
    <div style={{ lineHeight: 1, userSelect: 'none' }}>
      {/* Primary word */}
      <div style={{
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text)',
        lineHeight: 1,
      }}>
        ATLAS
      </div>

      {/* Secondary word — accent colour for contrast */}
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        lineHeight: 1,
        marginTop: 3,
      }}>
        PRIME
      </div>

      {/* Portal label (admin / coach only) */}
      {portalLabel && (
        <div style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          lineHeight: 1,
          marginTop: 4,
        }}>
          {portalLabel}
        </div>
      )}
    </div>
  )
}
