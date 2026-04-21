'use client'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

const PHASE_LABELS = ['Pain Control', 'Load Foundation', 'Strengthen', 'Return to Sport']

export default function RecoveryBanner() {
  const { activeRecovery, clearRecovery } = useTheme()
  const [showModal, setShowModal] = useState(false)

  if (!activeRecovery) return null

  const phaseLabel = PHASE_LABELS[activeRecovery.phase - 1]
  const progress = Math.round((activeRecovery.phase / 4) * 100)

  function handleLeave(saveProgress: boolean) {
    if (!saveProgress) {
      // Clear all set tracking for this playbook too
    }
    clearRecovery()
    setShowModal(false)
  }

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--accent-bg)',
        borderBottom: '1px solid var(--accent-border)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--accent)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        <span style={{ flexShrink: 0 }}>⚡ Recovery Mode</span>
        <span style={{ color: 'var(--text-dim)', fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
          Phase {activeRecovery.phase} · {phaseLabel} · {progress}%
        </span>
        <div style={{ flex: 1, height: 3, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden', minWidth: 40 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))', borderRadius: 2 }} />
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            flexShrink: 0,
            background: 'none',
            border: '1px solid var(--accent-border)',
            borderRadius: 6,
            color: 'var(--accent)',
            fontSize: 10,
            fontWeight: 800,
            padding: '3px 8px',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Leave Plan
        </button>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div className="animate-modalPop" style={{
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 20,
            padding: '28px 24px',
            maxWidth: 400,
            width: '100%',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>🏃</div>
            <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8, textAlign: 'center' }}>
              Leave Recovery Plan?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>
              This will take you back to your original Ember view and your regular workout plan. Your SI Joint protocol is at <strong style={{ color: 'var(--accent)' }}>Phase {activeRecovery.phase} ({progress}%)</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleLeave(true)}
                style={{
                  padding: '14px',
                  borderRadius: 12,
                  border: '1px solid var(--accent-border)',
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: 1.4,
                }}
              >
                💾 Save progress & leave
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginTop: 2 }}>
                  Your phase and sets are saved — come back any time
                </div>
              </button>

              <button
                onClick={() => handleLeave(false)}
                style={{
                  padding: '14px',
                  borderRadius: 12,
                  border: '1px solid var(--red-border)',
                  background: 'var(--red-bg)',
                  color: 'var(--red)',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: 1.4,
                }}
              >
                ✕ Leave without saving
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginTop: 2 }}>
                  Exit plan and return to your original workout
                </div>
              </button>

              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '12px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-dim)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel — stay in recovery
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
