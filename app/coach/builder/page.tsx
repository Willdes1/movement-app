'use client'

export default function CoachBuilderPage() {
  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Coach Portal
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Program Builder</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Create, import, and AI-generate training programs for your clients.</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { icon: '🤖', label: 'AI Generate',    desc: 'Two-agent pipeline — Planner + Filler',   disabled: true },
          { icon: '📄', label: 'Import PDF/DOCX', desc: 'Parse an existing program from a file',   disabled: true },
          { icon: '✏️', label: 'Build Manually',  desc: 'Drag-and-drop week/day builder',          disabled: true },
        ].map(opt => (
          <div
            key={opt.label}
            style={{
              flex: 1,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '24px 20px',
              opacity: 0.55,
              cursor: 'not-allowed',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{opt.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{opt.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{opt.desc}</div>
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
        Builder options are greyed out during scaffolding. AI generation, PDF import, and manual builder are the three entry points — all coming in subsequent steps.
      </div>
    </div>
  )
}
