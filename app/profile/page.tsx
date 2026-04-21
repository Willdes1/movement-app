'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadProfile, saveProfile } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/types'

const SPORTS = [
  'Hockey', 'Soccer', 'Basketball', 'Baseball', 'Football', 'Lacrosse',
  'Tennis', 'Swimming', 'Track & Field', 'CrossFit', 'Weightlifting',
  'Cycling', 'Golf', 'Skateboarding', 'Snowboarding', 'Other',
]
const GOALS = ['Recover from injury', 'Reduce chronic pain', 'Improve mobility', 'Performance enhancement', 'General fitness']
const SESSION_LENGTHS = ['20 min', '30 min', '45 min', '60 min', '75+ min']
const DAYS = [3, 4, 5, 6, 7]
const WORKOUT_TIMES = ['Morning', 'Evening', 'Both', 'No preference']

// Areas that need a left/right/both selection
const BILATERAL_AREAS = ['Knee', 'Shoulder', 'Hip', 'Ankle', 'Hamstring', 'Hip flexor']
const SINGLE_AREAS = ['Lower back', 'Neck']
const ALL_RESTRICTION_AREAS = [...SINGLE_AREAS, ...BILATERAL_AREAS]

const SIDES = ['Left', 'Right', 'Both']

function getSideLabel(area: string, side: string) {
  const plural: Record<string, string> = {
    'Knee': 'knees', 'Shoulder': 'shoulders', 'Hip': 'hips',
    'Ankle': 'ankles', 'Hamstring': 'hamstrings', 'Hip flexor': 'hip flexors',
  }
  return side === 'Both' ? `Both ${plural[area]}` : `${side} ${area.toLowerCase()}`
}

function getBaseArea(entry: string): string {
  for (const a of BILATERAL_AREAS) {
    if (entry.toLowerCase().includes(a.toLowerCase())) return a
  }
  return entry
}

function isBilateral(area: string) {
  return BILATERAL_AREAS.includes(area)
}

function workoutTimeFromBooleans(morning?: boolean, evening?: boolean): string | undefined {
  if (morning && evening) return 'Both'
  if (morning) return 'Morning'
  if (evening) return 'Evening'
  if (morning === false && evening === false) return 'No preference'
  return undefined
}

function isCustomSport(sport: string) {
  return !SPORTS.slice(0, -1).includes(sport)
}

function parseSports(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(', ').filter(Boolean)
}

type Screen = 'overview' | 'edit'

export default function ProfilePage() {
  const router = useRouter()
  const { user, signOut, isAdmin } = useAuth()
  const [screen, setScreen] = useState<Screen>('overview')
  const [profile, setProfile] = useState<UserProfile>({})
  const [saved, setSaved] = useState(false)

  // Multi-sport state
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [customSport, setCustomSport] = useState('')
  const [showCustomSport, setShowCustomSport] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)
  const goalRef = useRef<HTMLDivElement>(null)

  // Workout time (derived from wantsMorning/wantsEvening)
  const [workoutTime, setWorkoutTime] = useState<string | undefined>(undefined)

  // Pending bilateral area waiting for side selection
  const [pendingArea, setPendingArea] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const p: UserProfile = {
              name: data.name ?? undefined,
              sport: data.sport ?? undefined,
              goal: data.goal ?? undefined,
              daysPerWeek: data.days_per_week ?? undefined,
              sessionLength: data.session_length ?? undefined,
              wantsMorning: data.wants_morning ?? undefined,
              wantsEvening: data.wants_evening ?? undefined,
              hasRestrictions: data.has_restrictions ?? undefined,
              restrictionAreas: data.restriction_areas ?? undefined,
            }
            setProfile(p)
            saveProfile(p)
            setWorkoutTime(workoutTimeFromBooleans(p.wantsMorning, p.wantsEvening))
            const sports = parseSports(p.sport)
            setSelectedSports(sports)
            const custom = sports.find(isCustomSport)
            if (custom) { setCustomSport(custom); setShowCustomSport(true) }
          } else {
            const local = loadProfile() as UserProfile | null
            if (local) {
              setProfile(local)
              setWorkoutTime(workoutTimeFromBooleans(local.wantsMorning, local.wantsEvening))
              const sports = parseSports(local.sport)
              setSelectedSports(sports)
              const custom = sports.find(isCustomSport)
              if (custom) { setCustomSport(custom); setShowCustomSport(true) }
            }
          }
        })
    } else {
      const p = loadProfile() as UserProfile | null
      if (p) {
        setProfile(p)
        setWorkoutTime(workoutTimeFromBooleans(p.wantsMorning, p.wantsEvening))
        const sports = parseSports(p.sport)
        setSelectedSports(sports)
        const custom = sports.find(isCustomSport)
        if (custom) { setCustomSport(custom); setShowCustomSport(true) }
      }
    }
  }, [user])

  async function handleSignOut() {
    await signOut()
    router.push('/auth')
  }

  function update(key: keyof UserProfile, val: unknown) {
    setProfile(prev => ({ ...prev, [key]: val }))
  }

  function toggleSport(s: string) {
    if (s === 'Other') {
      if (showCustomSport) {
        // Hide the input and remove any custom sport from the list
        setShowCustomSport(false)
        setCustomSport('')
        setSportSaved(false)
        setSelectedSports(prev => prev.filter(x => !isCustomSport(x)))
      } else {
        setShowCustomSport(true)
        setCustomSport('')
        setSportSaved(false)
      }
      return
    }
    setSelectedSports(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  function handleCustomSportChange(val: string) {
    setCustomSport(val)
    setSportSaved(false)
  }

  function handleCustomSportEnter() {
    if (!customSport.trim()) return
    const trimmed = customSport.trim()
    setSelectedSports(prev => {
      const withoutOld = prev.filter(x => !isCustomSport(x))
      return [...withoutOld, trimmed]
    })
    setSportSaved(true)
    setTimeout(() => {
      setSportSaved(false)
      goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 1800)
  }

  function selectWorkoutTime(t: string) {
    setWorkoutTime(t)
    update('wantsMorning', t === 'Morning' || t === 'Both')
    update('wantsEvening', t === 'Evening' || t === 'Both')
  }

  // Restriction area handling
  function getSelectedEntriesForArea(area: string): string[] {
    return (profile.restrictionAreas ?? []).filter(e => getBaseArea(e) === area || e === area)
  }

  function toggleSingleArea(area: string) {
    const current = profile.restrictionAreas ?? []
    const has = current.includes(area)
    update('restrictionAreas', has ? current.filter(e => e !== area) : [...current, area])
  }

  function clickBilateralArea(area: string) {
    const entries = getSelectedEntriesForArea(area)
    if (entries.length > 0) {
      // Already selected — clear it
      update('restrictionAreas', (profile.restrictionAreas ?? []).filter(e => getBaseArea(e) !== area))
      setPendingArea(null)
    } else {
      setPendingArea(area)
    }
  }

  function selectSide(area: string, side: string) {
    const label = getSideLabel(area, side)
    const current = (profile.restrictionAreas ?? []).filter(e => getBaseArea(e) !== area)
    update('restrictionAreas', [...current, label])
    setPendingArea(null)
  }

  async function handleSave() {
    const sportString = selectedSports.join(', ') || undefined
    const profileToSave = { ...profile, sport: sportString }
    saveProfile(profileToSave)
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: profileToSave.name ?? null,
        sport: profileToSave.sport ?? null,
        goal: profile.goal ?? null,
        days_per_week: profile.daysPerWeek ?? null,
        session_length: profile.sessionLength ?? null,
        wants_morning: profile.wantsMorning ?? null,
        wants_evening: profile.wantsEvening ?? null,
        has_restrictions: profile.hasRestrictions ?? null,
        restriction_areas: profile.restrictionAreas ?? null,
        updated_at: new Date().toISOString(),
      })
    }
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setScreen('overview')
    }, 800)
  }

  // ── Overview screen ──────────────────────────────────────────────────────────
  if (screen === 'overview') {
    return (
      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Profile</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>Your athlete profile powers your personalized plan</p>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <ProfileRow label="Name" value={profile.name ?? 'Not set'} dim={!profile.name} onClick={() => setScreen('edit')} />
          <ProfileRow label="Sport(s)" value={selectedSports.length ? selectedSports.join(', ') : 'Not set'} dim={!selectedSports.length} onClick={() => setScreen('edit')} />
          <ProfileRow label="Goal" value={profile.goal ?? 'Not set'} dim={!profile.goal} onClick={() => setScreen('edit')} />
          <ProfileRow label="Days/week" value={profile.daysPerWeek ? `${profile.daysPerWeek} days` : 'Not set'} dim={!profile.daysPerWeek} onClick={() => setScreen('edit')} />
          <ProfileRow label="Session length" value={profile.sessionLength ?? 'Not set'} dim={!profile.sessionLength} onClick={() => setScreen('edit')} />
          <ProfileRow label="Workout time" value={workoutTime ?? 'Not set'} dim={!workoutTime} onClick={() => setScreen('edit')} />
          <ProfileRow label="Restrictions" value={profile.hasRestrictions ? (profile.restrictionAreas?.join(', ') || 'Yes') : 'None'} dim={!profile.hasRestrictions} onClick={() => setScreen('edit')} last />
        </div>

        <button
          onClick={() => setScreen('edit')}
          style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          {Object.keys(profile).length === 0 ? 'Set up profile' : 'Edit profile'}
        </button>

        {user && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Signed in as {user.email}</div>
            {isAdmin && (
              <button onClick={() => router.push('/admin')} style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', marginBottom: 8, fontWeight: 700 }}>
                Admin Panel →
              </button>
            )}
            <button onClick={handleSignOut} style={{ fontSize: 13, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Sign out →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Edit screen ──────────────────────────────────────────────────────────────
  const sportIsCustom = showCustomSport || selectedSports.some(isCustomSport)

  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setScreen('overview')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0 }}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Edit Profile</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Name */}
        <Field label="Name">
          <input type="text" value={profile.name ?? ''} onChange={e => update('name', e.target.value)} placeholder="Your name" style={inputStyle} />
        </Field>

        {/* Sport */}
        <Field label="Your sport(s) — select all that apply">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SPORTS.map(s => (
              <Chip key={s} label={s} active={s === 'Other' ? sportIsCustom : selectedSports.includes(s)} onClick={() => toggleSport(s)} />
            ))}
          </div>
          {sportIsCustom && (
            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                value={customSport}
                onChange={e => handleCustomSportChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomSportEnter() } }}
                placeholder="Type your sport and press Enter…"
                autoFocus
                style={inputStyle}
              />
              {sportSaved ? (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: '#4ec97a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> Saved, thank you!
                </div>
              ) : customSport.trim() ? (
                <button
                  onClick={handleCustomSportEnter}
                  style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >
                  Save "{customSport}" →
                </button>
              ) : null}
            </div>
          )}
        </Field>

        {/* Goal */}
        <div ref={goalRef}>
          <Field label="Main goal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => (
                <Chip key={g} label={g} active={profile.goal === g} onClick={() => update('goal', g)} block />
              ))}
            </div>
          </Field>
        </div>

        {/* Days */}
        <Field label="Training days per week">
          <div style={{ display: 'flex', gap: 8 }}>
            {DAYS.map(d => (
              <Chip key={d} label={`${d}x`} active={profile.daysPerWeek === d} onClick={() => update('daysPerWeek', d)} />
            ))}
          </div>
        </Field>

        {/* Session length */}
        <Field label="Session length">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SESSION_LENGTHS.map(l => (
              <Chip key={l} label={l} active={profile.sessionLength === l} onClick={() => update('sessionLength', l)} />
            ))}
          </div>
        </Field>

        {/* Workout time */}
        <Field label="When do you work out?">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WORKOUT_TIMES.map(t => (
              <Chip key={t} label={t} active={workoutTime === t} onClick={() => selectWorkoutTime(t)} />
            ))}
          </div>
        </Field>

        {/* Restrictions */}
        <Field label="Any injuries or restrictions?">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Chip label="Yes" active={profile.hasRestrictions === true} onClick={() => update('hasRestrictions', true)} />
            <Chip label="No" active={profile.hasRestrictions === false} onClick={() => { update('hasRestrictions', false); update('restrictionAreas', []); setPendingArea(null) }} />
          </div>

          {profile.hasRestrictions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Single areas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SINGLE_AREAS.map(area => (
                  <Chip
                    key={area}
                    label={area}
                    active={(profile.restrictionAreas ?? []).includes(area)}
                    onClick={() => toggleSingleArea(area)}
                  />
                ))}
              </div>

              {/* Bilateral areas */}
              {BILATERAL_AREAS.map(area => {
                const selectedEntries = getSelectedEntriesForArea(area)
                const isSelected = selectedEntries.length > 0
                const isPending = pendingArea === area

                return (
                  <div key={area}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Chip
                        label={isSelected ? selectedEntries.join(', ') : area}
                        active={isSelected || isPending}
                        onClick={() => clickBilateralArea(area)}
                      />
                      {isPending && (
                        <>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Which side?</span>
                          {SIDES.map(side => (
                            <button
                              key={side}
                              onClick={() => selectSide(area, side)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 16,
                                border: '1px solid var(--accent)',
                                background: 'var(--accent-bg)',
                                color: 'var(--accent)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {side}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Field>

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: saved ? 'var(--green)' : 'var(--accent)',
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', transition: 'background 0.2s',
          }}
        >
          {saved ? '✓ Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}

function ProfileRow({ label, value, dim = false, last = false, onClick }: {
  label: string; value: string; dim?: boolean; last?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '13px 16px', background: 'none', border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: dim ? 'var(--text-dim)' : 'var(--text)' }}>{value}</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>›</span>
      </div>
    </button>
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
        padding: '7px 14px', borderRadius: 20,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-bg)' : 'var(--surface2)',
        color: active ? 'var(--accent)' : 'var(--text-mid)',
        fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
        width: block ? '100%' : 'auto', textAlign: block ? 'left' : 'center',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
