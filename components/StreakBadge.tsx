'use client'
import { useEffect, useState } from 'react'

interface Props {
  streak: number
  longestStreak?: number
  size?: 'sm' | 'md' | 'lg'
  showRecord?: boolean
  isNewRecord?: boolean
}

const MILESTONE_LABEL: Record<number, string> = {
  7:   '1 Week',
  30:  '1 Month',
  60:  '2 Months',
  100: '100 Days',
  365: '1 Year',
}

function getMilestone(streak: number): string | null {
  return MILESTONE_LABEL[streak] ?? null
}

export default function StreakBadge({ streak, longestStreak, size = 'md', showRecord = false, isNewRecord = false }: Props) {
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (isNewRecord && streak > 1) {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isNewRecord, streak])

  const milestone = getMilestone(streak)

  const sizes = {
    sm: { flame: 14, count: 15, label: 10, padding: '4px 10px', gap: 4 },
    md: { flame: 20, count: 20, label: 11, padding: '8px 14px', gap: 6 },
    lg: { flame: 28, count: 28, label: 13, padding: '12px 20px', gap: 8 },
  }
  const s = sizes[size]

  if (streak === 0) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: s.gap,
        padding: s.padding, borderRadius: 20,
        background: 'var(--surface2)', border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: s.flame, lineHeight: 1 }}>🔥</span>
        <div>
          <div style={{ fontSize: s.count, fontWeight: 800, color: 'var(--text-dim)', lineHeight: 1 }}>0</div>
          <div style={{ fontSize: s.label, color: 'var(--text-dim)', marginTop: 1 }}>day streak</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: s.gap,
      padding: s.padding, borderRadius: 20,
      background: celebrate ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
      border: `1px solid ${celebrate ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.2)'}`,
      transition: 'background 0.4s, border-color 0.4s',
    }}>
      <span style={{ fontSize: s.flame, lineHeight: 1, filter: celebrate ? 'drop-shadow(0 0 6px rgba(245,158,11,0.8))' : 'none', transition: 'filter 0.4s' }}>
        🔥
      </span>
      <div>
        <div style={{ fontSize: s.count, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
          {streak}
        </div>
        <div style={{ fontSize: s.label, color: 'rgba(245,158,11,0.7)', marginTop: 1, fontWeight: 600 }}>
          {milestone ? milestone + ' streak!' : `day streak`}
        </div>
      </div>
      {showRecord && longestStreak !== undefined && longestStreak > 0 && (
        <div style={{ marginLeft: 4, paddingLeft: s.gap, borderLeft: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: s.label, color: 'rgba(245,158,11,0.5)', fontWeight: 600 }}>
            best
          </div>
          <div style={{ fontSize: s.count - 4, fontWeight: 800, color: 'rgba(245,158,11,0.6)', lineHeight: 1 }}>
            {longestStreak}
          </div>
        </div>
      )}
    </div>
  )
}
