'use client'
import { useAuth } from '@/contexts/AuthContext'

export default function CoachDashboardPage() {
  const { user } = useAuth()

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Coach Portal
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Welcome back. Your clients and programs will appear here.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 40,
      }}>
        {[
          { label: 'Active Clients',     value: '—', icon: '👥' },
          { label: 'Active Programs',    value: '—', icon: '📋' },
          { label: 'Pending Check-ins',  value: '—', icon: '📬' },
          { label: 'Affiliate Earnings', value: '$0', icon: '💰' },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '20px 24px',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '24px',
        color: 'var(--text-dim)',
        fontSize: 13,
        lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 8 }}>🚧 Under Construction</strong>
        Coach portal is in active development. Next up: client management, program builder, and AI generation pipeline.
      </div>
    </div>
  )
}
