'use client'
import { useState, useEffect } from 'react'
import { loadProfile, saveProfile } from '@/lib/storage'
import type { UserProfile } from '@/lib/types'

const SPORTS = ['Hockey', 'Soccer', 'Basketball', 'Baseball', 'Football', 'Lacrosse', 'Tennis', 'Swimming', 'Track & Field', 'CrossFit', 'Weightlifting', 'Cycling', 'Golf', 'Other']
const GOALS = ['Recover from injury', 'Reduce chronic pain', 'Improve mobility', 'Performance enhancement', 'General fitness']
const SESSION_LENGTHS = ['20 min', '30 min', '45 min', '60 min', '75+ min']
const DAYS = [3, 4, 5, 6, 7]
const RESTRICTION_AREAS = ['Lower back', 'SI joint / hip', 'Knee', 'Shoulder', 'Neck', 'Ankle', 'Hamstring', 'Hip flexor']

type Screen = 'overview' | 'edit'

export default function ProfilePage() {
  const [screen, setScreen] = useState<Screen>('overview')
  const [profile, setProfile] = useState<UserProfile>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = loadProfile() as UserProfile | null
    if (p) setProfile(p)
  }, [])

  function update(key: keyof UserProfile, val: unknown) {
    setProfile(prev => ({ ...prev, [key]: val }))
  }

  function toggleRestrictionArea(area: string) {
    const current = profile.restrictionAreas ?? []
    const next = current.includes(area) ? current.filter(a => a !== area) : [...current, area]
    update('restrictionAreas', next)
  }

  function handleSave() {
    saveProfile(profile)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setScreen('overview')
    }, 800)
  }

  if (screen === 'overview') {
    return (
      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Profile</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>Your athlete profile powers your personalized plan</p>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          {profile.name ? (
            <ProfileRow label="Name" value={profile.name} />
          ) : (
            <ProfileRow label="Name" value="Not set" dim />
          )}
          <ProfileRow label="Sport" value={profile.sport ?? 'Not set'} dim={!profile.sport} />
          <ProfileRow label="Goal" value={profile.goal ?? 'Not set'} dim={!profile.goal} />
          <ProfileRow label="Days/week" value={profile.daysPerWeek ? `${profile.daysPerWeek} days` : 'Not set'} dim={!profile.daysPerWeek} />
          <ProfileRow label="Session length" value={profile.sessionLength ?? 'Not set'} dim={!profile.sessionLength} />
          <ProfileRow label="Restrictions" value={profile.hasRestrictions ? (profile.restrictionAreas?.join(', ') || 'Yes') : 'None'} dim={!profile.hasRestrictions} last />
        </div>

        <button
          onClick={() => setScreen('edit')}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {Object.keys(profile).length === 0 ? 'Set up profile' : 'Edit profile'}
        </button>
      </div>
    )
  }

  // Edit screen
  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setScreen('overview')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0 }}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Edit Profile</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Field label="Name">
          <input
            type="text"
            value={profile.name ?? ''}
            onChange={e => update('name', e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
        </Field>

        <Field label="Primary sport">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SPORTS.map(s => (
              <Chip key={s} label={s} active={profile.sport === s} onClick={() => update('sport', s)} />
            ))}
          </div>
        </Field>

        <Field label="Main goal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GOALS.map(g => (
              <Chip key={g} label={g} active={profile.goal === g} onClick={() => update('goal', g)} block />
            ))}
          </div>
        </Field>

        <Field label="Training days per week">
          <div style={{ display: 'flex', gap: 8 }}>
            {DAYS.map(d => (
              <Chip key={d} label={`${d}x`} active={profile.daysPerWeek === d} onClick={() => update('daysPerWeek', d)} />
            ))}
          </div>
        </Field>

        <Field label="Session length">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SESSION_LENGTHS.map(l => (
              <Chip key={l} label={l} active={profile.sessionLength === l} onClick={() => update('sessionLength', l)} />
            ))}
          </div>
        </Field>

        <Field label="Morning routine?">
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip label="Yes" active={profile.wantsMorning === true} onClick={() => update('wantsMorning', true)} />
            <Chip label="No" active={profile.wantsMorning === false} onClick={() => update('wantsMorning', false)} />
          </div>
        </Field>

        <Field label="Evening routine?">
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip label="Yes" active={profile.wantsEvening === true} onClick={() => update('wantsEvening', true)} />
            <Chip label="No" active={profile.wantsEvening === false} onClick={() => update('wantsEvening', false)} />
          </div>
        </Field>

        <Field label="Any injuries or restrictions?">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Chip label="Yes" active={profile.hasRestrictions === true} onClick={() => update('hasRestrictions', true)} />
            <Chip label="No" active={profile.hasRestrictions === false} onClick={() => { update('hasRestrictions', false); update('restrictionAreas', []) }} />
          </div>
          {profile.hasRestrictions && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {RESTRICTION_AREAS.map(area => (
                <Chip
                  key={area}
                  label={area}
                  active={(profile.restrictionAreas ?? []).includes(area)}
                  onClick={() => toggleRestrictionArea(area)}
                />
              ))}
            </div>
          )}
        </Field>

        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            border: 'none',
            background: saved ? 'var(--green)' : 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {saved ? '✓ Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}

function ProfileRow({ label, value, dim = false, last = false }: { label: string; value: string; dim?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: dim ? 'var(--text-dim)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--text-mid)' }}>{label}</div>
      {children}
    </div>
  )
}

function Chip({ label, active, onClick, block = false }: { label: string; active: boolean; onClick: () => void; block?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-bg)' : 'var(--surface2)',
        color: active ? 'var(--accent)' : 'var(--text-mid)',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        width: block ? '100%' : 'auto',
        textAlign: block ? 'left' : 'center',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}
