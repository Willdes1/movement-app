export default function CalendarPage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Coming Soon</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>Calendar</h1>
        <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>
          Your full monthly training view — see every workout, recovery session, and rest day at a glance with color-coded status.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: '📅', title: 'Monthly training calendar', desc: 'Every session on one screen' },
          { icon: '🎨', title: 'Color-coded by type', desc: 'Strength, mobility, recovery, rest — all distinct' },
          { icon: '✅', title: 'Completion tracking', desc: 'See what you hit and what you missed' },
          { icon: '🔄', title: 'Reschedule sessions', desc: 'Move workouts around your week' },
        ].map(f => (
          <div key={f.title} style={{
            display: 'flex', gap: 14, alignItems: 'center',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '16px',
          }}>
            <div style={{ fontSize: 24, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-bg)', borderRadius: 12, flexShrink: 0 }}>{f.icon}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: '16px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>In Development</div>
        <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>This section is still being built. Check back soon.</p>
      </div>
    </div>
  )
}
