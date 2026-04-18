'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { loadProfile } from '@/lib/storage'
import type { UserProfile } from '@/lib/types'

function getDayLabel(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date().getDay()]
}

function getDateLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function TodayPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const p = loadProfile() as UserProfile | null
    setProfile(p)
  }, [])

  const name = profile?.name ? `, ${profile.name.split(' ')[0]}` : ''

  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>{getDayLabel()}, {getDateLabel()}</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>Good morning{name} 👋</h1>
      </div>

      {/* Quick status card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '18px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>Today&apos;s Session</h2>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', color: 'var(--orange)', fontWeight: 600 }}>Recovery</span>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
          Start with your gate check, then work through today&apos;s movement protocol.
        </p>
        <Link
          href="/recovery/si-joint"
          style={{
            display: 'block',
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Open SI Joint Playbook
        </Link>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Link
          href="/plan"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Weekly Plan</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>View your schedule</div>
        </Link>

        <Link
          href="/profile"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Profile</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {profile?.sport ? profile.sport : 'Set up your profile'}
          </div>
        </Link>
      </div>

      {/* Tip */}
      <div style={{
        marginTop: 20,
        padding: '14px 16px',
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>TIP OF THE DAY</div>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>
          Consistency beats intensity. Even a 10-minute morning reset session done daily will outperform a one-hour session done occasionally.
        </p>
      </div>
    </div>
  )
}
