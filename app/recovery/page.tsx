import Link from 'next/link'

const playbooks = [
  {
    href: '/recovery/si-joint',
    title: 'SI Joint Recovery',
    desc: 'Sacroiliac joint dysfunction — 4-phase return-to-sport protocol',
    phase: '4 Phases',
    exercises: '80+ exercises',
    color: 'var(--orange)',
  },
]

export default function RecoveryPage() {
  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Recovery</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>Structured return-to-sport playbooks</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {playbooks.map(pb => (
          <Link
            key={pb.href}
            href={pb.href}
            style={{
              display: 'block',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '18px',
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: pb.color,
                flexShrink: 0,
              }} />
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>{pb.title}</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12 }}>{pb.desc}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{pb.phase}</span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{pb.exercises}</span>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>More playbooks coming soon.<br/>Hip flexor, hamstring, knee, and shoulder protocols in development.</p>
      </div>
    </div>
  )
}
