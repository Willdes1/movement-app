'use client'
import { useState, useEffect } from 'react'
import { PHASES } from '@/lib/data'
import BlockAccordion from '@/components/ui/BlockAccordion'
import GateCheck from '@/components/ui/GateCheck'
import ExerciseModal from '@/components/ui/ExerciseModal'
import { ModalProvider } from '@/contexts/ModalContext'
import { useTheme } from '@/contexts/ThemeContext'

const PHASE_LABELS = [
  { label: 'P1', title: 'Pain Control', sub: 'Calm & stabilize' },
  { label: 'P2', title: 'Load Foundation', sub: 'Rebuild base' },
  { label: 'P3', title: 'Strengthen', sub: 'Progressive load' },
  { label: 'P4', title: 'Return to Sport', sub: 'Full function' },
]

function SIJointContent() {
  const [phase, setPhase] = useState(1)
  const { setRecovery } = useTheme()

  useEffect(() => {
    setRecovery('si-joint', phase)
  }, [phase, setRecovery])

  const blocks = PHASES[phase] ?? []

  function handlePhaseChange(p: number) {
    setPhase(p)
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="recovery-mode-banner">
        <span>⚡</span>
        <span>Recovery Mode Active</span>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>SI Joint Protocol</span>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Recovery Protocol</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>SI Joint Playbook</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>4-phase return-to-sport protocol for sacroiliac joint dysfunction</p>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {PHASE_LABELS.map((p, i) => {
            const phaseNum = i + 1
            const active = phase === phaseNum
            return (
              <button
                key={phaseNum}
                onClick={() => handlePhaseChange(phaseNum)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-bg)' : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 900, color: active ? 'var(--accent)' : 'var(--text-dim)' }}>{p.label}</div>
                <div style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-dim)', marginTop: 2, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{p.title}</div>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
          <span style={{ fontWeight: 800, color: 'var(--accent)' }}>Phase {phase}: </span>
          <span style={{ color: 'var(--text-mid)', fontSize: 13 }}>{PHASE_LABELS[phase - 1].title} — {PHASE_LABELS[phase - 1].sub}</span>
        </div>

        <div style={{ marginTop: 10, height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${(phase / 4) * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.04em', marginTop: 5 }}>
          PHASE {phase} OF 4 — {Math.round((phase / 4) * 100)}% TOWARD RETURN TO SPORT
        </div>
      </div>

      {phase === 1 && (
        <div style={{ padding: '0 16px' }}>
          <GateCheck />
        </div>
      )}

      <div style={{ padding: '0 16px 32px' }}>
        {blocks.map((block, i) => (
          <BlockAccordion key={`${phase}-${i}`} block={block} phase={phase} defaultOpen={i === 0} />
        ))}
      </div>

      <ExerciseModal />
    </div>
  )
}

export default function SIJointPage() {
  return (
    <ModalProvider>
      <SIJointContent />
    </ModalProvider>
  )
}
