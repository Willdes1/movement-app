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
const GOALS = [
  'Recover from injury', 'Reduce chronic pain', 'Improve mobility',
  'Performance enhancement', 'General fitness', 'Other',
]
const SESSION_LENGTHS = ['20 min', '30 min', '45 min', '60 min', '75+ min']
const DAYS = [3, 4, 5, 6, 7]
const WORKOUT_TIMES = ['Morning', 'Evening', 'Both', 'No preference']
const BILATERAL_AREAS = ['Knee', 'Shoulder', 'Hip', 'Ankle', 'Hamstring', 'Hip flexor']
const SINGLE_AREAS = ['Lower back', 'Neck']
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

function workoutTimeFromBooleans(morning?: boolean, evening?: boolean): string | undefined {
  if (morning && evening) return 'Both'
  if (morning) return 'Morning'
  if (evening) return 'Evening'
  if (morning === false && evening === false) return 'No preference'
  return undefined
}

const STANDARD_SPORTS = SPORTS.slice(0, -1)
const STANDARD_GOALS = GOALS.slice(0, -1)

function isCustomSport(s: string) { return !STANDARD_SPORTS.includes(s) }
function isCustomGoal(g: string) { return !STANDARD_GOALS.includes(g) }
function isCustomRestrictionNote(entry: string) {
  if (SINGLE_AREAS.includes(entry)) return false
  if (BILATERAL_AREAS.some(a => entry.toLowerCase().includes(a.toLowerCase()))) return false
  return true
}
function parseList(raw: string | undefined): string[] {
  return raw ? raw.split(', ').filter(Boolean) : []
}

type Screen = 'overview' | 'edit'

export default function ProfilePage() {
  const router = useRouter()
  const { user, signOut, isAdmin } = useAuth()
  const [screen, setScreen] = useState<Screen>('overview')
  const [profile, setProfile] = useState<UserProfile>({})
  const [saved, setSaved] = useState(false)

  // Sports multi-select
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [customSport, setCustomSport] = useState('')
  const [showCustomSport, setShowCustomSport] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)

  // Goals multi-select
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [customGoal, setCustomGoal] = useState('')
  const [showCustomGoal, setShowCustomGoal] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  // Restrictions
  const [pendingArea, setPendingArea] = useState<string | null>(null)
  const [customRestriction, setCustomRestriction] = useState('')
  const [restrictionSaved, setRestrictionSaved] = useState(false)

  // Scroll refs
  const goalRef = useRef<HTMLDivElement>(null)
  const daysRef = useRef<HTMLDivElement>(null)

  function loadProfileData(p: UserProfile) {
    setProfile(p)
    setWorkoutTimeFromProfile(p)

    const sports = parseList(p.sport)
    setSelectedSports(sports)
    const customS = sports.find(isCustomSport)
    if (customS) { setCustomSport(customS); setShowCustomSport(true); setSportSaved(true) }

    const goals = parseList(p.goal)
    setSelectedGoals(goals)
    const customG = goals.find(isCustomGoal)
    if (customG) { setCustomGoal(customG); setShowCustomGoal(true); setGoalSaved(true) }
  }

  const [workoutTime, setWorkoutTime] = useState<string | undefined>(undefined)
  function setWorkoutTimeFromProfile(p: UserProfile) {
    setWorkoutTime(workoutTimeFromBooleans(p.wantsMorning, p.wantsEvening))
  }

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
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
          loadProfileData(p)
          saveProfile(p)
        } else {
          const local = loadProfile() as UserProfile | null
          if (local) loadProfileData(local)
        }
      })
    } else {
      const p = loadProfile() as UserProfile | null
      if (p) loadProfileData(p)
    }
  }, [user])

  async function handleSignOut() { await signOut(); router.push('/auth') }

  function update(key: keyof UserProfile, val: unknown) {
    setProfile(prev => ({ ...prev, [key]: val }))
  }

  // ── Sports ───────────────────────────────────────────────────────────────────
  function toggleSport(s: string) {
    if (s === 'Other') {
      if (showCustomSport) {
        setShowCustomSport(false); setCustomSport(''); setSportSaved(false)
        setSelectedSports(prev => prev.filter(x => !isCustomSport(x)))
      } else {
        setShowCustomSport(true); setCustomSport(''); setSportSaved(false)
      }
      return
    }
    setSelectedSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function confirmCustomSport() {
    if (!customSport.trim()) return
    const trimmed = customSport.trim()
    setSelectedSports(prev => [...prev.filter(x => !isCustomSport(x)), trimmed])
    setSportSaved(true)
    // Input stays open so user can see what they saved — scrolls to next section
    setTimeout(() => {
      goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 400)
  }

  // ── Goals ────────────────────────────────────────────────────────────────────
  function toggleGoal(g: string) {
    if (g === 'Other') {
      if (showCustomGoal) {
        setShowCustomGoal(false); setCustomGoal(''); setGoalSaved(false)
        setSelectedGoals(prev => prev.filter(x => !isCustomGoal(x)))
      } else {
        setShowCustomGoal(true); setCustomGoal(''); setGoalSaved(false)
      }
      return
    }
    setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  function confirmCustomGoal() {
    if (!customGoal.trim()) return
    const trimmed = customGoal.trim()
    setSelectedGoals(prev => [...prev.filter(x => !isCustomGoal(x)), trimmed])
    setGoalSaved(true)
    setTimeout(() => {
      daysRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 400)
  }

  // ── Restrictions ─────────────────────────────────────────────────────────────
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
  function confirmCustomRestriction() {
    if (!customRestriction.trim()) return
    const trimmed = customRestriction.trim()
    update('restrictionAreas', [...(profile.restrictionAreas ?? []), trimmed])
    setRestrictionSaved(true)
    setCustomRestriction('')
    // Green message stays briefly, then clears so they can add another note
    setTimeout(() => setRestrictionSaved(false), 2000)
  }

  function removeCustomRestriction(note: string) {
    update('restrictionAreas', (profile.restrictionAreas ?? []).filter(e => e !== note))
  }

  // ── Workout time ─────────────────────────────────────────────────────────────
  function selectWorkoutTime(t: string) {
    setWorkoutTime(t)
    update('wantsMorning', t === 'Morning' || t === 'Both')
    update('wantsEvening', t === 'Evening' || t === 'Both')
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const sportString = selectedSports.join(', ') || undefined
    const goalString = selectedGoals.join(', ') || undefined
    const profileToSave = { ...profile, sport: sportString, goal: goalString }
    saveProfile(profileToSave)
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: profileToSave.name ?? null,
        sport: profileToSave.sport ?? null,
        goal: profileToSave.goal ?? null,
        days_per_week: profileToSave.daysPerWeek ?? null,
        session_length: profileToSave.sessionLength ?? null,
        wants_morning: profileToSave.wantsMorning ?? null,
        wants_evening: profileToSave.wantsEvening ?? null,
        has_restrictions: profileToSave.hasRestrictions ?? null,
        restriction_areas: profileToSave.restrictionAreas ?? null,
        updated_at: new Date().toISOString(),
      })
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); setScreen('overview') }, 800)
  }

  // ── Overview ─────────────────────────────────────────────────────────────────
  if (screen === 'overview') {
    return (
      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Profile</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>Your athlete profile powers your personalized plan</p>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <ProfileRow label="Name" value={profile.name ?? 'Not set'} dim={!profile.name} onClick={() => setScreen('edit')} />
          <ProfileRow label="Sport(s)" value={selectedSports.length ? selectedSports.join(', ') : 'Not set'} dim={!selectedSports.length} onClick={() => setScreen('edit')} />
          <ProfileRow label="Goal(s)" value={selectedGoals.length ? selectedGoals.join(', ') : 'Not set'} dim={!selectedGoals.length} onClick={() => setScreen('edit')} />
          <ProfileRow label="Days/week" value={profile.daysPerWeek ? `${profile.daysPerWeek} days` : 'Not set'} dim={!profile.daysPerWeek} onClick={() => setScreen('edit')} />
          <ProfileRow label="Session length" value={profile.sessionLength ?? 'Not set'} dim={!profile.sessionLength} onClick={() => setScreen('edit')} />
          <ProfileRow label="Workout time" value={workoutTime ?? 'Not set'} dim={!workoutTime} onClick={() => setScreen('edit')} />
          <ProfileRow label="Restrictions" value={profile.hasRestrictions ? (profile.restrictionAreas?.join(', ') || 'Yes') : 'None'} dim={!profile.hasRestrictions} onClick={() => setScreen('edit')} last />
        </div>

        <button onClick={() => setScreen('edit')} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
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

  // ── Edit screen ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setScreen('overview')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0 }}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Edit Profile</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Name */}
        <Field label="Name">
          <input type="text" value={profile.name ?? ''} onChange={e => update('name', e.target.value)} placeholder="Your name" style={inputStyle} />
        </Field>

        {/* Sports */}
        <Field label="Your sport(s) — select all that apply">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SPORTS.map(s => (
              <Chip key={s} label={s}
                active={s === 'Other' ? (showCustomSport || selectedSports.some(isCustomSport)) : selectedSports.includes(s)}
                onClick={() => toggleSport(s)} />
            ))}
          </div>
          {showCustomSport && (
            <div style={{ marginTop: 10 }}>
              <input
                type="text" value={customSport}
                onChange={e => { setCustomSport(e.target.value); if (sportSaved) setSportSaved(false) }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), confirmCustomSport())}
                placeholder="Type your sport and press Enter…"
                autoFocus style={inputStyle}
              />
              <ConfirmRow
                value={customSport} saved={sportSaved}
                label="sport" onConfirm={confirmCustomSport}
              />
            </div>
          )}
        </Field>

        {/* Goals */}
        <div ref={goalRef}>
          <Field label="Your goal(s) — select all that apply">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => (
                <Chip key={g} label={g}
                  active={g === 'Other' ? (showCustomGoal || selectedGoals.some(isCustomGoal)) : selectedGoals.includes(g)}
                  onClick={() => toggleGoal(g)} block />
              ))}
            </div>
            {showCustomGoal && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="text" value={customGoal}
                  onChange={e => { setCustomGoal(e.target.value); if (goalSaved) setGoalSaved(false) }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), confirmCustomGoal())}
                  placeholder="Describe your goal and press Enter…"
                  autoFocus style={inputStyle}
                />
                <ConfirmRow
                  value={customGoal} saved={goalSaved}
                  label="goal" onConfirm={confirmCustomGoal}
                />
              </div>
            )}
          </Field>
        </div>

        {/* Days */}
        <div ref={daysRef}>
          <Field label="Training days per week">
            <div style={{ display: 'flex', gap: 8 }}>
              {DAYS.map(d => (
                <Chip key={d} label={`${d}x`} active={profile.daysPerWeek === d} onClick={() => update('daysPerWeek', d)} />
              ))}
            </div>
          </Field>
        </div>

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Single areas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SINGLE_AREAS.map(area => (
                  <Chip key={area} label={area} active={(profile.restrictionAreas ?? []).includes(area)} onClick={() => toggleSingleArea(area)} />
                ))}
              </div>

              {/* Bilateral areas */}
              {BILATERAL_AREAS.map(area => {
                const selectedEntries = getSelectedEntriesForArea(area)
                const isSelected = selectedEntries.length > 0
                const isPending = pendingArea === area
                return (
                  <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Chip
                      label={isSelected ? selectedEntries.join(', ') : area}
                      active={isSelected || isPending}
                      onClick={() => clickBilateralArea(area)}
                    />
                    {isPending && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Which side?</span>
                        {SIDES.map(side => (
                          <button key={side} onClick={() => selectSide(area, side)}
                            style={{ padding: '5px 12px', borderRadius: 16, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {side}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}

              {/* Custom restriction notes */}
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Anything else? Describe it below:</p>
                {/* Show saved custom notes as removable chips */}
                {(profile.restrictionAreas ?? []).filter(isCustomRestrictionNote).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {(profile.restrictionAreas ?? []).filter(isCustomRestrictionNote).map(note => (
                      <div key={note} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 16, background: 'var(--accent-bg)', border: '1px solid var(--accent)', fontSize: 12, color: 'var(--accent)' }}>
                        <span>{note}</span>
                        <button onClick={() => removeCustomRestriction(note)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 13, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={customRestriction}
                  onChange={e => { setCustomRestriction(e.target.value); setRestrictionSaved(false) }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), confirmCustomRestriction())}
                  placeholder="e.g. Lower back tightness after squats…"
                  style={inputStyle}
                />
                <ConfirmRow
                  value={customRestriction} saved={restrictionSaved}
                  label="note" onConfirm={confirmCustomRestriction}
                />
              </div>
            </div>
          )}
        </Field>

        {/* Save */}
        <button
          onClick={handleSave}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: saved ? 'var(--green)' : 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', transition: 'background 0.2s' }}
        >
          {saved ? '✓ Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}

// ── Shared confirm row ────────────────────────────────────────────────────────
function ConfirmRow({ value, saved, label, onConfirm }: { value: string; saved: boolean; label: string; onConfirm: () => void }) {
  if (saved) {
    return (
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: '#4ec97a', display: 'flex', alignItems: 'center', gap: 6 }}>
        ✓ Saved, thank you!
      </div>
    )
  }
  if (!value.trim()) return null
  return (
    <button onClick={onConfirm} style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
      Save {label} →
    </button>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ProfileRow({ label, value, dim = false, last = false, onClick }: { label: string; value: string; dim?: boolean; last?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 16px', background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: dim ? 'var(--text-dim)' : 'var(--text)', textAlign: 'right', maxWidth: 200 }}>{value}</span>
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
    <button onClick={onClick} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'var(--surface2)', color: active ? 'var(--accent)' : 'var(--text-mid)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', width: block ? '100%' : 'auto', textAlign: block ? 'left' : 'center', transition: 'all 0.15s' }}>
      {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
