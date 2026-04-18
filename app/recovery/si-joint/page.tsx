'use client'
import { useState } from 'react'
import { PHASES } from '@/lib/data'
import BlockAccordion from '@/components/ui/BlockAccordion'
import GateCheck from '@/components/ui/GateCheck'
import ExerciseModal from '@/components/ui/ExerciseModal'
import { ModalProvider } from '@/contexts/ModalContext'

const PHASE_COLORS = ['var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--green)']
const PHASE_LABELS = [
  { label: 'P1', title: 'Pain Control', sub: 'Calm & stabilize' },
  { label: 'P2', title: 'Load Foundation', sub: 'Rebuild base' },
  { label: 'P3', title: 'Strengthen', sub: 'Progressive load' },
  { label: 'P4', title: 'Return to Sport', sub: 'Full function' },
]

function SIJointContent() {
  const [phase, setPhase] = useState(1)

  const blocks = PHASES[phase] ?? []

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Recovery Protocol</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>SI Joint Playbook</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>4-phase return-to-sport protocol for sacroiliac joint dysfunction</p>
      </div>

      {/* Phase tabs */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {PHASE_LABELS.map((p, i) => {
            const phaseNum = i + 1
            const active = phase === phaseNum
            const color = PHASE_COLORS[i]
            return (
              <button
                key={phaseNum}
                onClick={() => setPhase(phaseNum)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? color : 'var(--border)'}`,
                  background: active ? `rgba(${colorToRgb(color)}, 0.1)` : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: active ? color : 'var(--text-dim)' }}>{p.label}</div>
                <div style={{ fontSize: 10, color: active ? color : 'var(--text-dim)', marginTop: 2, fontWeight: 600 }}>{p.title}</div>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <span style={{ fontWeight: 700, color: PHASE_COLORS[phase - 1] }}>Phase {phase}: </span>
          <span style={{ color: 'var(--text-mid)', fontSize: 13 }}>{PHASE_LABELS[phase - 1].title} — {PHASE_LABELS[phase - 1].sub}</span>
        </div>
      </div>

      {/* Gate check (only Phase 1) */}
      {phase === 1 && (
        <div style={{ padding: '0 16px' }}>
          <GateCheck />
        </div>
      )}

      {/* Blocks */}
      <div style={{ padding: '0 16px 32px' }}>
        {blocks.map((block, i) => (
          <BlockAccordion key={`${phase}-${i}`} block={block} phase={phase} defaultOpen={i === 0} />
        ))}
      </div>

      <ExerciseModal />
    </div>
  )
}

function colorToRgb(cssVar: string): string {
  // Fallback RGB values for known vars
  const map: Record<string, string> = {
    'var(--red)': '255,77,77',
    'var(--orange)': '255,159,67',
    'var(--yellow)': '255,211,42',
    'var(--green)': '38,222,129',
    'var(--accent)': '94,159,255',
  }
  return map[cssVar] ?? '255,255,255'
}

export default function SIJointPage() {
  return (
    <ModalProvider>
      <SIJointContent />
    </ModalProvider>
  )
}
