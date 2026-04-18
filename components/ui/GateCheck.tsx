'use client'
import { useState, useEffect } from 'react'
import { getGateChecks, setGateChecks } from '@/lib/storage'

const GATE_ITEMS = [
  'No sharp or shooting pain in the last 24 hours',
  'Slept at least 6 hours last night',
  'Pain level is 4/10 or below right now',
  'No new injury or flare-up since last session',
]

export default function GateCheck({ onPass }: { onPass?: (passed: boolean) => void }) {
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false])
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setChecks(getGateChecks())
  }, [])

  const allPassed = checks.every(Boolean)

  function toggle(i: number) {
    const next = [...checks]
    next[i] = !next[i]
    setChecks(next)
    setGateChecks(next)
  }

  function handleReveal() {
    setRevealed(true)
    onPass?.(allPassed)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Daily Gate Check</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>Check all that apply before starting your session.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {GATE_ITEMS.map((item, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <div
              onClick={() => toggle(i)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `2px solid ${checks[i] ? 'var(--green)' : 'var(--border)'}`,
                background: checks[i] ? 'var(--green-bg)' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
                transition: 'all 0.15s',
              }}
            >
              {checks[i] && <span style={{ color: 'var(--green)', fontSize: 14, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-mid)' }}>{item}</span>
          </label>
        ))}
      </div>

      {!revealed ? (
        <button
          onClick={handleReveal}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Check my readiness
        </button>
      ) : (
        <div style={{
          padding: '14px 16px',
          borderRadius: 10,
          background: allPassed ? 'var(--green-bg)' : 'var(--orange-bg)',
          border: `1px solid ${allPassed ? 'var(--green-border)' : 'var(--orange-border)'}`,
        }}>
          <div style={{ fontWeight: 700, color: allPassed ? 'var(--green)' : 'var(--orange)', marginBottom: 4 }}>
            {allPassed ? '✓ You\'re cleared to train' : '⚠ Take it easy today'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-mid)' }}>
            {allPassed
              ? 'All checks passed. Proceed with today\'s program at full effort.'
              : 'One or more flags raised. Stick to Phase 1 movements only and keep intensity low.'}
          </div>
        </div>
      )}
    </div>
  )
}
