'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const ONBOARDING_KEY = (id: string) => `onboarding_v1_${id}`
const WELCOME_KEY    = (id: string) => `movement_welcomed_${id}`

const SPORTS = [
  'Gym / Weight Training', 'Running', 'Cycling', 'Swimming',
  'Basketball', 'Soccer / Football', 'Tennis / Pickleball', 'Golf',
  'Skateboarding', 'Snowboarding / Skiing', 'Surfing',
  'Martial Arts / Combat Sports', 'Yoga / Pilates',
  'CrossFit / HIIT', 'Hiking / Trail', 'Other',
]

const GOALS = [
  'Build strength & muscle',
  'Lose weight / body recomposition',
  'Improve athletic performance',
  'Recover from injury',
  'Build endurance & cardio base',
  'Improve flexibility & mobility',
  'General fitness & health',
]

const LOCATIONS = [
  { val: 'gym', label: 'Gym', sub: 'Full equipment access' },
  { val: 'home', label: 'Home gym', sub: 'Some equipment' },
  { val: 'bodyweight', label: 'Bodyweight only', sub: 'No equipment needed' },
  { val: 'hybrid', label: 'Hybrid', sub: 'Gym + home' },
]

const EQUIPMENT_LIST = [
  'Barbells & plates', 'Dumbbells', 'Kettlebells', 'Pull-up bar',
  'Resistance bands', 'Cable machine', 'Bench', 'Squat rack',
  'Cardio equipment', 'Foam roller / mobility tools',
]

const RESTRICTION_AREAS = [
  'Lower back', 'Knee(s)', 'Shoulder(s)', 'Hip(s)',
  'Elbow(s)', 'Neck / cervical', 'Ankle(s)', 'Wrist(s)',
]

const DAYS = [3, 4, 5, 6]
const SESSION_LENGTHS = ['30 min', '45 min', '60 min', '75 min', '90 min']

type Form = {
  name: string
  age: string
  gender: string
  sport: string
  customSport: string
  goal: string
  daysPerWeek: number
  sessionLength: string
  workoutLocation: string
  homeEquipment: string[]
  hasRestrictions: boolean
  restrictionAreas: string[]
  restrictionNotes: string
}

const DEFAULT: Form = {
  name: '', age: '', gender: '',
  sport: '', customSport: '',
  goal: '', daysPerWeek: 4, sessionLength: '60 min',
  workoutLocation: '', homeEquipment: [],
  hasRestrictions: false, restrictionAreas: [], restrictionNotes: '',
}

const TOTAL = 5

// ─── Chip button ─────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: active ? 700 : 500, transition: 'all 0.15s',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(255,92,53,0.12)' : 'var(--surface2, #1a1f27)',
        color: active ? 'var(--accent)' : 'var(--text-mid)',
      }}
    >
      {label}
    </button>
  )
}

// ─── Step 1: You ─────────────────────────────────────────────────────────────
function StepYou({ form, set }: { form: Form; set: (k: keyof Form, v: string) => void }) {
  const [showWhyGender, setShowWhyGender] = useState(false)
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Welcome to Atlas Prime.
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 28, lineHeight: 1.6 }}>
        Let's set up your profile so the AI can build a plan that actually fits your life. Takes about 2 minutes.
      </p>

      <Field label="First name">
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Marcus"
          autoFocus
          style={inputStyle}
        />
      </Field>

      <Field label="Age">
        <input
          value={form.age}
          onChange={e => set('age', e.target.value)}
          placeholder="e.g. 28"
          type="number"
          style={{ ...inputStyle, maxWidth: 120 }}
        />
      </Field>

      <Field label="Sex assigned at birth">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {['Male', 'Female'].map(g => (
            <Chip key={g} label={g} active={form.gender === g} onClick={() => set('gender', g)} />
          ))}
        </div>
        <button
          onClick={() => setShowWhyGender(v => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
        >
          {showWhyGender ? '▲ Hide' : '▼ Why we ask'}
        </button>
        {showWhyGender && (
          <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 8, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
            Biological sex affects hormonal cycles, muscle fiber composition, recovery rates, and injury risk profiles. The AI uses this to calibrate training load and recovery recommendations — not to make assumptions about your identity.
          </p>
        )}
      </Field>
    </div>
  )
}

// ─── Step 2: Sport ───────────────────────────────────────────────────────────
function StepSport({ form, set }: { form: Form; set: (k: keyof Form, v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
        What's your primary sport or activity?
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
        This shapes your training style, movement patterns, and recovery protocols.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SPORTS.map(s => (
          <Chip key={s} label={s} active={form.sport === s} onClick={() => set('sport', s)} />
        ))}
      </div>

      {form.sport === 'Other' && (
        <Field label="Tell us more">
          <input
            value={form.customSport}
            onChange={e => set('customSport', e.target.value)}
            placeholder="e.g. Powerlifting, Rock climbing…"
            style={inputStyle}
            autoFocus
          />
        </Field>
      )}
    </div>
  )
}

// ─── Step 3: Goals + Training ────────────────────────────────────────────────
function StepGoals({ form, set, setNum }: { form: Form; set: (k: keyof Form, v: string) => void; setNum: (k: keyof Form, v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
        What's your primary goal?
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
        The AI will prioritize this when building your program.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {GOALS.map(g => (
          <button
            key={g}
            onClick={() => set('goal', g)}
            style={{
              padding: '12px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: form.goal === g ? 700 : 500, textAlign: 'left',
              border: `1.5px solid ${form.goal === g ? 'var(--accent)' : 'var(--border)'}`,
              background: form.goal === g ? 'rgba(255,92,53,0.10)' : 'var(--surface2, #1a1f27)',
              color: form.goal === g ? 'var(--accent)' : 'var(--text)',
              transition: 'all 0.15s',
            }}
          >
            {g}
          </button>
        ))}
      </div>

      <Field label="Training days per week">
        <div style={{ display: 'flex', gap: 8 }}>
          {DAYS.map(d => (
            <button
              key={d}
              onClick={() => setNum('daysPerWeek', d)}
              style={{
                width: 48, height: 48, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 700,
                border: `1.5px solid ${form.daysPerWeek === d ? 'var(--accent)' : 'var(--border)'}`,
                background: form.daysPerWeek === d ? 'rgba(255,92,53,0.12)' : 'var(--surface2, #1a1f27)',
                color: form.daysPerWeek === d ? 'var(--accent)' : 'var(--text-mid)',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Session length">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SESSION_LENGTHS.map(s => (
            <Chip key={s} label={s} active={form.sessionLength === s} onClick={() => set('sessionLength', s)} />
          ))}
        </div>
      </Field>
    </div>
  )
}

// ─── Step 4: Equipment ───────────────────────────────────────────────────────
function StepEquipment({ form, set, toggle }: { form: Form; set: (k: keyof Form, v: string) => void; toggle: (item: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Where do you train?
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
        The AI uses this to select the right exercises for your environment.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {LOCATIONS.map(loc => (
          <button
            key={loc.val}
            onClick={() => set('workoutLocation', loc.val)}
            style={{
              padding: '14px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              textAlign: 'left',
              border: `1.5px solid ${form.workoutLocation === loc.val ? 'var(--accent)' : 'var(--border)'}`,
              background: form.workoutLocation === loc.val ? 'rgba(255,92,53,0.10)' : 'var(--surface2, #1a1f27)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: form.workoutLocation === loc.val ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{loc.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{loc.sub}</div>
          </button>
        ))}
      </div>

      {(form.workoutLocation === 'home' || form.workoutLocation === 'hybrid') && (
        <Field label="Equipment you have at home">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EQUIPMENT_LIST.map(eq => (
              <Chip
                key={eq}
                label={eq}
                active={form.homeEquipment.includes(eq)}
                onClick={() => toggle(eq)}
              />
            ))}
          </div>
        </Field>
      )}
    </div>
  )
}

// ─── Step 5: Restrictions ────────────────────────────────────────────────────
function StepRestrictions({ form, set, toggle }: { form: Form; set: (k: keyof Form, v: string) => void; setB: (k: keyof Form, v: boolean) => void; toggle: (item: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Any injuries or restrictions?
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.6 }}>
        The AI will avoid contraindicated exercises and modify your plan accordingly.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[{ val: false, label: 'No restrictions', sub: 'I\'m good to go' }, { val: true, label: 'Yes, I have some', sub: 'Tell me where' }].map(opt => (
          <button
            key={String(opt.val)}
            onClick={() => set('hasRestrictions', String(opt.val))}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              textAlign: 'left',
              border: `1.5px solid ${form.hasRestrictions === opt.val ? 'var(--accent)' : 'var(--border)'}`,
              background: form.hasRestrictions === opt.val ? 'rgba(255,92,53,0.10)' : 'var(--surface2, #1a1f27)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: form.hasRestrictions === opt.val ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{opt.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{opt.sub}</div>
          </button>
        ))}
      </div>

      {form.hasRestrictions && (
        <>
          <Field label="Affected areas">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RESTRICTION_AREAS.map(area => (
                <Chip
                  key={area}
                  label={area}
                  active={form.restrictionAreas.includes(area)}
                  onClick={() => toggle(area)}
                />
              ))}
            </div>
          </Field>

          <Field label="Any notes for the AI? (optional)">
            <textarea
              value={form.restrictionNotes}
              onChange={e => set('restrictionNotes', e.target.value)}
              placeholder="e.g. Post-op left knee, avoid deep flexion. SI joint flare-up, no heavy deadlifts."
              rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
            />
          </Field>
        </>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(255,92,53,0.06)', border: '1px solid rgba(255,92,53,0.2)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>You're almost ready</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          After this, we'll take you to the Plan page where the AI will generate your personalized training program.
        </div>
      </div>
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface2, #1a1f27)',
  color: 'var(--text)', fontSize: 16, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function OnboardingModal() {
  const { user, loading, isAdmin, role } = useAuth()
  const router = useRouter()
  const [show, setShow]       = useState(false)
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState<Form>(DEFAULT)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (loading || !user) return
    if (isAdmin || role === 'admin' || role === 'coach') {
      setShow(false) // ensure modal is hidden if role loads after first render
      return
    }
    if (localStorage.getItem(ONBOARDING_KEY(user.id))) return
    // Secondary check: if profile already has data they've onboarded on another device
    supabase
      .from('profiles')
      .select('name, sport')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.name || data?.sport) {
          localStorage.setItem(ONBOARDING_KEY(user.id), '1')
        } else {
          setShow(true)
        }
      })
  }, [user, loading, isAdmin, role])

  function set(k: keyof Form, v: string) {
    setForm(f => ({
      ...f,
      [k]: k === 'hasRestrictions' ? v === 'true' : v,
    }))
  }

  function setNum(k: keyof Form, v: number) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleEquipment(item: string) {
    setForm(f => ({
      ...f,
      homeEquipment: f.homeEquipment.includes(item)
        ? f.homeEquipment.filter(x => x !== item)
        : [...f.homeEquipment, item],
    }))
  }

  function toggleRestriction(item: string) {
    setForm(f => ({
      ...f,
      restrictionAreas: f.restrictionAreas.includes(item)
        ? f.restrictionAreas.filter(x => x !== item)
        : [...f.restrictionAreas, item],
    }))
  }

  function buildUpsertPayload() {
    const sportVal = form.sport === 'Other' ? form.customSport : form.sport
    return {
      id: user!.id,
      name: form.name || null,
      age: form.age || null,
      gender: form.gender || null,
      sport: sportVal || null,
      goal: form.goal || null,
      days_per_week: form.daysPerWeek,
      session_length: form.sessionLength || null,
      workout_location: form.workoutLocation || null,
      home_equipment: form.homeEquipment.length ? form.homeEquipment : null,
      has_restrictions: form.hasRestrictions,
      restriction_areas: form.restrictionAreas.length ? form.restrictionAreas : null,
      restriction_notes: form.restrictionNotes || null,
      updated_at: new Date().toISOString(),
    }
  }

  async function saveAndNext() {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('profiles').upsert(buildUpsertPayload(), { onConflict: 'id' })
    } catch { /* silent — data saved again on next step */ } finally {
      setSaving(false)
    }

    if (step < TOTAL) {
      setStep(s => s + 1)
    } else {
      finish()
    }
  }

  function finish() {
    if (!user) return
    localStorage.setItem(ONBOARDING_KEY(user.id), '1')
    localStorage.setItem(WELCOME_KEY(user.id), '1')
    setShow(false)
    router.push('/plan')
  }

  async function skip() {
    if (!user) return
    localStorage.setItem(ONBOARDING_KEY(user.id), '1')
    localStorage.setItem(WELCOME_KEY(user.id), '1')
    setShow(false)
    try { await supabase.from('profiles').upsert(buildUpsertPayload(), { onConflict: 'id' }) } catch { /* silent */ }
  }

  if (!show) return null

  const pct = ((step - 1) / TOTAL) * 100

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        width: '100%', maxWidth: 520,
        maxHeight: '92vh',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 0.35s ease' }} />
        </div>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 0', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Step {step} of {TOTAL}
          </span>
          <button
            onClick={skip}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px' }}
          >
            Skip setup
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {step === 1 && <StepYou form={form} set={set} />}
          {step === 2 && <StepSport form={form} set={set} />}
          {step === 3 && <StepGoals form={form} set={set} setNum={setNum} />}
          {step === 4 && <StepEquipment form={form} set={set} toggle={toggleEquipment} />}
          {step === 5 && <StepRestrictions form={form} set={set} setB={() => {}} toggle={toggleRestriction} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 10,
                padding: '10px 20px', color: 'var(--text-mid)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Back
            </button>
          ) : <div />}

          <button
            onClick={saveAndNext}
            disabled={saving}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 10,
              padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Saving…' : step === TOTAL ? 'Build My Plan →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
