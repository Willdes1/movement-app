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
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: pb.color, flexShrink: 0 }} />
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>{pb.title}</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12 }}>{pb.desc}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{pb.phase}</span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{pb.exercises}</span>
            </div>
          </Link>
        ))}

        {/* Return to Sport */}
        <Link
          href="/recovery/return-to-sport"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, rgba(120,60,0,0.35) 0%, rgba(60,25,0,0.55) 100%)',
            border: '1px solid rgba(255,140,0,0.2)',
            borderRadius: 14,
            padding: '18px',
            textDecoration: 'none',
            color: 'var(--text)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(255,140,0,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 8px var(--orange)', flexShrink: 0 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--orange)' }}>Injury Recovery Plan</h2>
            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,140,0,0.12)', color: 'var(--orange)', border: '1px solid rgba(255,140,0,0.22)' }}>AI</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 12 }}>
            Tell us what you hurt and what your doctor said. Movement AI builds a custom phase-by-phase recovery protocol — activate it and it takes over your Today page until you&apos;re cleared.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', color: 'var(--orange)' }}>Injury intake</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', color: 'var(--orange)' }}>Phased</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', color: 'var(--orange)' }}>Daily check-in</span>
          </div>
        </Link>

        {/* Anatomy Explorer */}
        <Link
          href="/recovery/anatomy"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, rgba(0,40,120,0.45) 0%, rgba(0,20,60,0.6) 100%)',
            border: '1px solid rgba(0,180,255,0.22)',
            borderRadius: 14,
            padding: '18px',
            textDecoration: 'none',
            color: 'var(--text)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(0,180,255,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', flexShrink: 0 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>Anatomy Explorer</h2>
            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(0,180,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,180,255,0.2)' }}>Beta</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 12 }}>
            Interactive 3D body map — explore bones, joints, muscles, and recovery protocols. Drag to rotate. Click any region to analyze.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.18)', color: 'var(--accent)' }}>206 Bones</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.18)', color: 'var(--accent)' }}>360 Joints</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.18)', color: '#00ff88' }}>SI Joint Live</span>
          </div>
        </Link>
      </div>

      <div style={{ marginTop: 24, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>More playbooks coming soon.<br />Hip flexor, hamstring, knee, and shoulder protocols in development.</p>
      </div>
    </div>
  )
}
