'use client'
import { useParams } from 'next/navigation'

export default function CoachClientDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Coach Portal — Client
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Client Detail</h1>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{id}</p>
      </div>

      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--text-dim)',
        fontSize: 13,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Client detail view coming soon</div>
        <div>Program history, check-ins, exercise swaps, and progress charts will live here.</div>
      </div>
    </div>
  )
}
