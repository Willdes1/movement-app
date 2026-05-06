'use client'

export default function CoachClientsPage() {
  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Coach Portal
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Clients</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Manage your client roster and assigned programs.</p>
      </div>

      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--text-dim)',
        fontSize: 13,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No clients yet</div>
        <div>Client management coming soon — add clients, assign programs, and view progress here.</div>
      </div>
    </div>
  )
}
