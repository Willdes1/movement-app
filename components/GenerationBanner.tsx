'use client'
import Link from 'next/link'
import { usePlanGeneration } from '@/components/PlanGenerationContext'

export default function GenerationBanner() {
  const { isGenerating, progress, showDoneNotification, dismissDone } = usePlanGeneration()

  if (!isGenerating && !showDoneNotification) return null

  if (showDoneNotification) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 16px', margin: '0 0 0 0',
        background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.25)',
        fontSize: 13, color: 'var(--text)',
      }}>
        <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Your plan is ready!</span>
        <Link href="/plan" style={{ color: '#22c55e', fontWeight: 600, textDecoration: 'underline' }}>View Plan →</Link>
        <Link href="/calendar" style={{ color: '#22c55e', fontWeight: 600, textDecoration: 'underline' }}>View Calendar →</Link>
        <button
          onClick={dismissDone}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
          aria-label="Dismiss"
        >✕</button>
      </div>
    )
  }

  // Generating state
  const label = progress
    ? progress.details
      ? 'Saving exercise coaching details…'
      : `Week ${progress.current} of ${progress.total}`
    : 'Starting…'

  return (
    <div style={{
      padding: '10px 16px', margin: '0 0 0 0',
      background: 'rgba(59,130,246,0.07)', borderBottom: '1px solid rgba(59,130,246,0.2)',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <span style={{ color: 'var(--accent, #3b82f6)', fontWeight: 700 }}>⚙ Generating your plan — {label}</span>
      </div>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>
        You can browse the app freely, but <strong style={{ color: 'var(--text)' }}>please don&apos;t close this browser tab</strong> or generation will stop.
      </p>
    </div>
  )
}
