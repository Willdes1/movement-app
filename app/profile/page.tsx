'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadProfile, saveProfile } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { UserProfile, SportSchedule } from '@/lib/types'

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
const WORKOUT_LOCATIONS = ['Home', 'Gym', 'Both']
const HOME_EQUIPMENT = ['Treadmill', 'Pull-up bar', 'Bench', 'Dumbbells', 'Barbells', 'Resistance bands', 'Kettlebells', 'Jump rope']

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

  // Per-field blur confirmations
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [programsConfirmed, setProgramsConfirmed] = useState(false)

  // Sports
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [customSport, setCustomSport] = useState('')
  const [showCustomSport, setShowCustomSport] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)

  // Goals — standard chips + "Other" opens a textarea stored in goalNotes
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [goalNotes, setGoalNotes] = useState('')
  const [showGoalNotes, setShowGoalNotes] = useState(false)
  const [goalNotesSaved, setGoalNotesSaved] = useState(false)

  // Prior programs
  const [priorPrograms, setPriorPrograms] = useState('')

  // Sport schedule
  const [sportSchedule, setSportSchedule] = useState<SportSchedule>({})

  // Workout location + equipment
  const [workoutLocation, setWorkoutLocation] = useState<string | undefined>(undefined)
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [customEquipment, setCustomEquipment] = useState('')
  const [equipmentSaved, setEquipmentSaved] = useState(false)

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
    if (sports.find(isCustomSport)) setShowCustomSport(true)
    // Standard goals only — custom goals moved to goalNotes
    setSelectedGoals(parseList(p.goal).filter(g => STANDARD_GOALS.includes(g)))
    if (p.goalNotes) { setGoalNotes(p.goalNotes); setShowGoalNotes(true) }
    if (p.priorPrograms) setPriorPrograms(p.priorPrograms)
    if (p.sportSchedule) setSportSchedule(p.sportSchedule)
    if (p.workoutLocation) setWorkoutLocation(p.workoutLocation)
    if (p.homeEquipment) setSelectedEquipment(p.homeEquipment)
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
            gender: data.gender ?? undefined,
            sport: data.sport ?? undefined,
            goal: data.goal ?? undefined,
            goalNotes: data.goal_notes ?? undefined,
            priorPrograms: data.prior_programs ?? undefined,
            daysPerWeek: data.days_per_week ?? undefined,
            sessionLength: data.session_length ?? undefined,
            wantsMorning: data.wants_morning ?? undefined,
            wantsEvening: data.wants_evening ?? undefined,
            hasRestrictions: data.has_restrictions ?? undefined,
            restrictionAreas: data.restriction_areas ?? undefined,
            sportSchedule: data.sport_schedule ?? undefined,
            workoutLocation: data.workout_location ?? undefined,
            homeEquipment: data.home_equipment ?? undefined,
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
    setCustomSport('')
    setSportSaved(true)
    setTimeout(() => {
      setSportSaved(false)
      goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 2000)
  }

  function removeCustomSport() {
    setSelectedSports(prev => prev.filter(x => !isCustomSport(x)))
    setCustomSport(''); setSportSaved(false)
  }

  // ── Goals ────────────────────────────────────────────────────────────────────
  function toggleGoal(g: string) {
    if (g === 'Other') {
      if (showGoalNotes) {
        setShowGoalNotes(false); setGoalNotes(''); setGoalNotesSaved(false)
      } else {
        setShowGoalNotes(true); setGoalNotesSaved(false)
      }
      return
    }
    setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  function confirmGoalNotes() {
    if (!goalNotes.trim()) return
    setGoalNotesSaved(true)
    setTimeout(() => {
      setGoalNotesSaved(false)
      daysRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 2000)
  }

  // ── Restrictions ─────────────────────────────────────────────────────────────
  function getSelectedEntriesForArea(area: string): string[] {
    return (profile.restrictionAreas ?? []).filter(e => getBaseArea(e) === area || e === area)
  }
  function toggleSingleArea(area: string) {
    const current = profile.restrictionAreas ?? []
    update('restrictionAreas', current.includes(area) ? current.filter(e => e !== area) : [...current, area])
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
    update('restrictionAreas', [...(profile.restrictionAreas ?? []).filter(e => getBaseArea(e) !== area), label])
    setPendingArea(null)
  }
  function confirmCustomRestriction() {
    if (!customRestriction.trim()) return
    update('restrictionAreas', [...(profile.restrictionAreas ?? []), customRestriction.trim()])
    setRestrictionSaved(true)
    setCustomRestriction('')
    setTimeout(() => setRestrictionSaved(false), 2000)
  }
  function removeCustomRestriction(note: string) {
    update('restrictionAreas', (profile.restrictionAreas ?? []).filter(e => e !== note))
  }

  // ── Equipment ─────────────────────────────────────────────────────────────────
  function toggleEquipment(item: string) {
    setSelectedEquipment(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item])
  }
  function addCustomEquipment() {
    if (!customEquipment.trim()) return
    setSelectedEquipment(prev => [...prev, customEquipment.trim()])
    setCustomEquipment('')
    setEquipmentSaved(true)
    setTimeout(() => setEquipmentSaved(false), 2000)
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
    const profileToSave = { ...profile, sport: sportString, goal: goalString, goalNotes: goalNotes || undefined, sportSchedule, workoutLocation, homeEquipment: selectedEquipment.length ? selectedEquipment : undefined }
    saveProfile(profileToSave)
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: profileToSave.name ?? null,
        gender: profileToSave.gender ?? null,
        sport: profileToSave.sport ?? null,
        goal: profileToSave.goal ?? null,
        goal_notes: goalNotes || null,
        prior_programs: priorPrograms || null,
        days_per_week: profileToSave.daysPerWeek ?? null,
        session_length: profileToSave.sessionLength ?? null,
        wants_morning: profileToSave.wantsMorning ?? null,
        wants_evening: profileToSave.wantsEvening ?? null,
        has_restrictions: profileToSave.hasRestrictions ?? null,
        restriction_areas: profileToSave.restrictionAreas ?? null,
        sport_schedule: Object.keys(sportSchedule).length ? sportSchedule : null,
        workout_location: workoutLocation ?? null,
        home_equipment: selectedEquipment.length ? selectedEquipment : null,
        updated_at: new Date().toISOString(),
      })
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); setScreen('overview') }, 900)
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
          <ProfileRow label="Goal(s)" value={selectedGoals.length ? selectedGoals.join(', ') : (goalNotes ? 'Custom goal set' : 'Not set')} dim={!selectedGoals.length && !goalNotes} onClick={() => setScreen('edit')} />
          <ProfileRow label="Days/week" value={profile.daysPerWeek ? `${profile.daysPerWeek} days` : 'Not set'} dim={!profile.daysPerWeek} onClick={() => setScreen('edit')} />
          <ProfileRow label="Session length" value={profile.sessionLength ?? 'Not set'} dim={!profile.sessionLength} onClick={() => setScreen('edit')} />
          <ProfileRow label="Workout time" value={workoutTime ?? 'Not set'} dim={!workoutTime} onClick={() => setScreen('edit')} />
          <ProfileRow label="Workout location" value={workoutLocation ?? 'Not set'} dim={!workoutLocation} onClick={() => setScreen('edit')} />
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
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setScreen('overview')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0 }}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Edit Profile</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Name */}
        <Field label="Name">
          <input
            type="text"
            value={profile.name ?? ''}
            onChange={e => { update('name', e.target.value); setNameConfirmed(false) }}
            onBlur={() => { if ((profile.name ?? '').trim()) setNameConfirmed(true) }}
            placeholder="Your name"
            style={inputStyle}
          />
          {nameConfirmed && <GreenCheck />}
        </Field>

        {/* Gender */}
        <Field label="Gender">
          <div style={{ display: 'flex', gap: 8 }}>
            {['Male', 'Female'].map(g => (
              <Chip key={g} label={g} active={profile.gender === g} onClick={() => update('gender', profile.gender === g ? undefined : g)} />
            ))}
          </div>
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
              {selectedSports.filter(isCustomSport).map(s => (
                <div key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 16, background: 'var(--accent-bg)', border: '1px solid var(--accent)', fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>
                  <span>{s}</span>
                  <button onClick={removeCustomSport} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 13, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <input
                type="text" value={customSport}
                onChange={e => { setCustomSport(e.target.value); setSportSaved(false) }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), confirmCustomSport())}
                placeholder="Type your sport and press Enter…"
                style={inputStyle}
              />
              <ConfirmRow value={customSport} saved={sportSaved} label="sport" onConfirm={confirmCustomSport} />
            </div>
          )}
        </Field>

        {/* Sport schedule */}
        {selectedSports.filter(s => s !== 'Other' && s !== '').length > 0 && (
          <Field label="When do you play or perform?">
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
              Pick your typical days for each sport. We&apos;ll schedule warm-ups and prep on those days so you&apos;re ready to perform — not worn out.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedSports.filter(s => s !== 'Other' && s !== '').map(sport => (
                <SportScheduleRow
                  key={sport}
                  sport={sport}
                  entry={sportSchedule[sport] ?? { days: [], duration: '' }}
                  onChange={entry => setSportSchedule(prev => ({ ...prev, [sport]: entry }))}
                />
              ))}
            </div>
          </Field>
        )}

        {/* Prior programs */}
        <Field label="Programs you've tried or enjoyed (optional)">
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            Helps your AI coach match your training style and build on what you already know.
          </p>
          <input
            type="text"
            value={priorPrograms}
            onChange={e => { setPriorPrograms(e.target.value); setProgramsConfirmed(false) }}
            onBlur={() => { if (priorPrograms.trim()) setProgramsConfirmed(true) }}
            placeholder="e.g. Athlean-X, 5/3/1, P90X, Starting Strength…"
            style={inputStyle}
          />
          {programsConfirmed && <GreenCheck />}
        </Field>

        {/* Goals */}
        <div ref={goalRef}>
          <Field label="Your goal(s) — select all that apply">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => (
                <Chip key={g} label={g}
                  active={g === 'Other' ? showGoalNotes : selectedGoals.includes(g)}
                  onClick={() => toggleGoal(g)} block />
              ))}
            </div>
            {showGoalNotes && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={goalNotes}
                  onChange={e => { setGoalNotes(e.target.value); setGoalNotesSaved(false) }}
                  placeholder="Describe your goal… e.g. Build upper body muscle since my sports are lower-body dominant. Stay snowboard-ready year round."
                  rows={4}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--surface2)',
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                    resize: 'none', lineHeight: 1.6, boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <ConfirmRow value={goalNotes} saved={goalNotesSaved} label="goal" onConfirm={confirmGoalNotes} />
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

        {/* Workout location */}
        <Field label="Where do you work out?">
          <div style={{ display: 'flex', gap: 8 }}>
            {WORKOUT_LOCATIONS.map(loc => (
              <Chip key={loc} label={loc} active={workoutLocation === loc} onClick={() => setWorkoutLocation(workoutLocation === loc ? undefined : loc)} />
            ))}
          </div>
        </Field>

        {/* Home equipment — only shown when Home or Both */}
        {(workoutLocation === 'Home' || workoutLocation === 'Both') && (
          <Field label="What equipment do you have at home?">
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
              Your AI coach will only program exercises you can actually do.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {HOME_EQUIPMENT.map(item => (
                <Chip key={item} label={item} active={selectedEquipment.includes(item)} onClick={() => toggleEquipment(item)} />
              ))}
            </div>
            {selectedEquipment.filter(e => !HOME_EQUIPMENT.includes(e)).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {selectedEquipment.filter(e => !HOME_EQUIPMENT.includes(e)).map(e => (
                  <div key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 16, background: 'var(--accent-bg)', border: '1px solid var(--accent)', fontSize: 12, color: 'var(--accent)' }}>
                    <span>{e}</span>
                    <button onClick={() => setSelectedEquipment(prev => prev.filter(x => x !== e))} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 13, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="text"
              value={customEquipment}
              onChange={e => { setCustomEquipment(e.target.value); setEquipmentSaved(false) }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomEquipment())}
              placeholder="Anything else? e.g. Cable machine, TRX…"
              style={inputStyle}
            />
            <ConfirmRow value={customEquipment} saved={equipmentSaved} label="equipment" onConfirm={addCustomEquipment} />
          </Field>
        )}

        {/* Restrictions */}
        <Field label="Any injuries or restrictions?">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Chip label="Yes" active={profile.hasRestrictions === true} onClick={() => update('hasRestrictions', true)} />
            <Chip label="No" active={profile.hasRestrictions === false} onClick={() => { update('hasRestrictions', false); update('restrictionAreas', []); setPendingArea(null) }} />
          </div>
          {profile.hasRestrictions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SINGLE_AREAS.map(area => (
                  <Chip key={area} label={area} active={(profile.restrictionAreas ?? []).includes(area)} onClick={() => toggleSingleArea(area)} />
                ))}
              </div>
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
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Anything else? Describe it below:</p>
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
                <ConfirmRow value={customRestriction} saved={restrictionSaved} label="note" onConfirm={confirmCustomRestriction} />
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

// ── Green check ───────────────────────────────────────────────────────────────
function GreenCheck() {
  return (
    <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: '#4ec97a', display: 'flex', alignItems: 'center', gap: 6 }}>
      ✓ Saved, thank you!
    </div>
  )
}

// ── Confirm row ───────────────────────────────────────────────────────────────
function ConfirmRow({ value, saved, label, onConfirm }: { value: string; saved: boolean; label: string; onConfirm: () => void }) {
  if (saved) return <GreenCheck />
  if (!value.trim()) return null
  return (
    <button onClick={onConfirm} style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
      Save {label} →
    </button>
  )
}

// ── Sport schedule row ────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DURATIONS = ['Under 1 hr', '1–2 hrs', '2–3 hrs', '3+ hrs']

function getSchedulePlaceholder(sport: string): string {
  const examples: Record<string, string> = {
    'Golf': 'e.g. I golf whenever the weather is nice — usually once or twice a month, no set day.',
    'Skiing': 'e.g. I ski a few weekends a season when conditions are good.',
    'Snowboarding': 'e.g. I snowboard a few weekends a season — whenever there\'s fresh snow.',
    'Surfing': 'e.g. I surf whenever the swell is right, usually early mornings.',
    'Skateboarding': 'e.g. I skate a few times a week when the weather is good, no fixed days.',
  }
  return examples[sport] ?? `e.g. I ${sport.toLowerCase()} occasionally — whenever my schedule or conditions allow.`
}

function SportScheduleRow({ sport, entry, onChange }: {
  sport: string
  entry: { days: string[]; duration: string; noSchedule?: boolean; description?: string }
  onChange: (e: typeof entry) => void
}) {
  const [descConfirmed, setDescConfirmed] = useState(false)

  function toggleDay(day: string) {
    onChange({ ...entry, days: entry.days.includes(day) ? entry.days.filter(d => d !== day) : [...entry.days, day] })
  }

  function toggleNoSchedule() {
    onChange({ ...entry, noSchedule: !entry.noSchedule, days: [], duration: '', description: entry.description ?? '' })
  }

  return (
    <div style={{ padding: '14px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sport}</p>
        <button onClick={toggleNoSchedule} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${entry.noSchedule ? 'var(--accent)' : 'var(--border)'}`, background: entry.noSchedule ? 'var(--accent-bg)' : 'var(--surface)', color: entry.noSchedule ? 'var(--accent)' : 'var(--text-dim)', transition: 'all 0.15s' }}>
          No specific schedule
        </button>
      </div>

      {entry.noSchedule ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            Describe when you typically do this. We&apos;ll still build strength and mobility into your plan, and you can log a session manually from the Calendar anytime.
          </p>
          <textarea
            value={entry.description ?? ''}
            onChange={e => { onChange({ ...entry, description: e.target.value }); setDescConfirmed(false) }}
            onBlur={() => { if ((entry.description ?? '').trim()) setDescConfirmed(true) }}
            placeholder={getSchedulePlaceholder(sport)}
            rows={3}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          {descConfirmed && <GreenCheck />}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {DAYS_OF_WEEK.map(day => {
              const active = entry.days.includes(day)
              return (
                <button key={day} onClick={() => toggleDay(day)} style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-dim)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {day}
                </button>
              )
            })}
          </div>
          {entry.days.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>How long per session?</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => onChange({ ...entry, duration: entry.duration === d ? '' : d })} style={{ padding: '5px 12px', borderRadius: 16, border: `1px solid ${entry.duration === d ? 'var(--accent)' : 'var(--border)'}`, background: entry.duration === d ? 'var(--accent-bg)' : 'var(--surface)', color: entry.duration === d ? 'var(--accent)' : 'var(--text-dim)', fontSize: 12, fontWeight: entry.duration === d ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
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
