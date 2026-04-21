export default function BrowsePage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Coming Soon</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>Browse & Learn</h1>
        <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>
          Explore the full exercise library, recovery playbooks, and education content built from ISSA and physical therapy sources.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { icon: '💪', label: 'Strength', count: '24 workouts', color: 'var(--accent)' },
          { icon: '🧘', label: 'Mobility', count: '18 sessions', color: 'var(--blue)' },
          { icon: '🩹', label: 'Recovery', count: '12 protocols', color: 'var(--green)' },
          { icon: '📚', label: 'Learn', count: '8 articles', color: 'var(--purple)' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px 16px',
            opacity: 0.7,
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: c.color }}>{c.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontWeight: 600 }}>{c.count}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: '🦴', title: 'SI Joint Playbook', desc: '4 phases · 82 exercises', active: true },
          { icon: '🏋️', title: 'Shoulder Impingement', desc: '3 phases · Coming soon' },
          { icon: '🦵', title: 'Knee Rehabilitation', desc: '4 phases · Coming soon' },
        ].map(p => (
          <div key={p.title} style={{
            display: 'flex', gap: 14, alignItems: 'center',
            background: p.active ? 'var(--accent-bg)' : 'var(--surface)',
            border: `1px solid ${p.active ? 'var(--accent-border)' : 'var(--border)'}`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 22, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.active ? 'var(--accent-bg)' : 'var(--surface2)', borderRadius: 12, flexShrink: 0 }}>{p.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
            </div>
            {p.active && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '3px 8px', borderRadius: 20, border: '1px solid var(--accent-border)' }}>Active</span>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: '16px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>In Development</div>
        <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>Full search, filtering, and content library coming soon.</p>
      </div>
    </div>
  )
}
