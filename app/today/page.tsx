'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { loadProfile } from '@/lib/storage'
import { useTheme } from '@/contexts/ThemeContext'
import type { UserProfile } from '@/lib/types'

const TIPS = [
  'Consistency beats intensity. 10 minutes daily outperforms 1 hour occasionally.',
  'Sleep is your most powerful recovery tool. Prioritize 8+ hours on training nights.',
  'Hydration affects performance before you feel thirsty. Drink before workouts.',
  'Active recovery days keep blood moving and reduce next-day soreness.',
  'The best workout is the one you actually complete. Show up, then push.',
]

function getDayLabel() {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
}
function getDateLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Let's get to work"
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function TodayPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const { activeRecovery } = useTheme()
  const tip = TIPS[new Date().getDate() % TIPS.length]

  useEffect(() => {
    const p = loadProfile() as UserProfile | null
    setProfile(p)
  }, [])

  const firstName = profile?.name?.split(' ')[0] ?? null
  const isRecovering = !!activeRecovery

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>

      <div style={{ padding: '24px 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
          {getDayLabel()}, {getDateLabel()}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {getGreeting()}{firstName ? ',' : '.'}<br />
          <span style={{ color: 'var(--accent)' }}>{firstName ?? 'Athlete'}. 🔥</span>
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        {([
          { val: '7', unit: '🔥', label: 'Streak', color: 'var(--accent)' },
          { val: '4', unit: '/5', label: 'Sessions', color: 'var(--green)' },
          { val: isRecovering ? `P${activeRecovery.phase}` : '—', unit: '', label: isRecovering ? 'Recovery' : 'No Injury', color: isRecovering ? 'var(--accent)' : 'var(--text-dim)' },
        ] as const).map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', color: s.color }}>
              {s.val}<span style={{ fontSize: 13 }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        margin: '0 16px 16px',
        background: 'linear-gradient(135deg, var(--accent-bg) 0%, rgba(0,0,0,0) 100%)',
        border: '1px solid var(--accent-border)',
        borderRadius: 18, padding: '20px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 120, height: 120,
          background: 'radial-gradient(circle, var(--accent-shadow) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
          fontSize: 10, fontWeight: 800, color: 'var(--accent)',
          letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10,
        }}>● Today&apos;s Session</div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {isRecovering ? 'SI Joint Recovery' : 'No Active Session'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>
          {isRecovering
            ? `Phase ${activeRecovery.phase} · 4 exercises ready · Continue where you left off`
            : 'Set up your profile to receive a personalized plan'}
        </div>
        {isRecovering && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 700 }}>
              <span>Recovery Progress</span><span>Phase {activeRecovery.phase} of 4</span>
            </div>
            <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(activeRecovery.phase / 4) * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))' }} />
            </div>
          </div>
        )}
        <Link href={isRecovering ? '/recovery/si-joint' : '/profile'} style={{
          display: 'block', width: '100%', padding: '14px',
          borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
          color: '#fff', fontWeight: 900, fontSize: 14, textAlign: 'center',
          textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase',
          boxShadow: '0 6px 24px var(--accent-shadow)',
        }}>
          {isRecovering ? '▶ Resume Session' : 'Set Up Profile →'}
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 16px' }}>
        <Link href="/plan" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Weekly Plan</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>View schedule</div>
        </Link>
        <Link href="/recovery" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🩹</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Recovery</div>
          <div style={{ fontSize: 10, color: isRecovering ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isRecovering ? `Phase ${activeRecovery.phase} active` : 'Playbooks'}
          </div>
        </Link>
      </div>

      <div style={{ margin: '0 16px 24px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, borderLeft: '3px solid var(--accent)' }}>
        <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, marginBottom: 6, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Tip of the Day</div>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{tip}</p>
      </div>

    </div>
  )
}
