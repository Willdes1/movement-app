'use client'
import { useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import TrackingTip from '@/components/ui/TrackingTip'

// Set tracking that lives inside the ExerciseDetailModal footer. Writes per-set
// rows to exercise_set_logs (granular history) + one summary row to workout_logs
// (keeps the existing "Last Session" displays + coach analytics working).

type SetEntry = { reps: string; weight: string; notes: string; lreps: string; lweight: string; rreps: string; rweight: string }
const blankSet = (): SetEntry => ({ reps: '', weight: '', notes: '', lreps: '', lweight: '', rreps: '', rweight: '' })

const inputStyle: CSSProperties = { width: 0, flex: 1, padding: '9px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', textAlign: 'center', fontFamily: 'inherit' }

export default function TrackWorkout({
  userId, exerciseNormalized, exerciseDisplay, programName, onSaved,
}: {
  userId: string
  exerciseNormalized: string
  exerciseDisplay: string
  programName?: string | null
  onSaved?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [bilateral, setBilateral] = useState(false)
  const [sets, setSets] = useState<SetEntry[]>([blankSet()])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (i: number, field: keyof SetEntry, val: string) =>
    setSets(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))
  const addSet = () => setSets(prev => [...prev, blankSet()])
  const duplicateSet = () => setSets(prev => [...prev, { ...prev[prev.length - 1] }])
  const removeSet = (i: number) => setSets(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))

  async function save() {
    const int = (v: string) => (v.trim() === '' ? null : parseInt(v, 10))
    const num = (v: string) => (v.trim() === '' ? null : parseFloat(v))
    const base = { user_id: userId, exercise_normalized: exerciseNormalized, exercise_display: exerciseDisplay, weight_unit: 'lbs', program_name: programName ?? null }
    const rows: Record<string, unknown>[] = []
    sets.forEach((s, i) => {
      const setNo = i + 1
      if (bilateral) {
        if (s.lreps || s.lweight) rows.push({ ...base, set_number: setNo, side: 'left', reps: int(s.lreps), weight: num(s.lweight), notes: s.notes.trim() || null })
        if (s.rreps || s.rweight) rows.push({ ...base, set_number: setNo, side: 'right', reps: int(s.rreps), weight: num(s.rweight), notes: s.notes.trim() || null })
      } else if (s.reps || s.weight || s.notes.trim()) {
        rows.push({ ...base, set_number: setNo, side: null, reps: int(s.reps), weight: num(s.weight), notes: s.notes.trim() || null })
      }
    })
    if (rows.length === 0) { setError('Enter at least one set.'); return }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('exercise_set_logs').insert(rows)
    if (insErr) {
      setError(insErr.code === '42P01' || /exercise_set_logs/.test(insErr.message)
        ? 'Tracking isn’t set up yet — run the exercise_set_logs SQL migration in Supabase.'
        : insErr.message)
      setSaving(false); return
    }
    // Summary row → workout_logs so "Last Session" + analytics keep working.
    const summaryReps = bilateral ? int(sets[0]?.lreps ?? '') : int(sets[sets.length - 1]?.reps ?? '')
    const summaryWeight = bilateral ? num(sets[0]?.lweight ?? '') : num(sets[sets.length - 1]?.weight ?? '')
    await supabase.from('workout_logs').insert({ user_id: userId, exercise_normalized: exerciseNormalized, sets: sets.length, reps: summaryReps, weight: summaryWeight, weight_unit: 'lbs' })
    setSaving(false); setSaved(true); onSaved?.()
  }

  if (!open) {
    return (
      <>
        <TrackingTip id="track-workout" scopeKey={exerciseNormalized}>
          Log your sets here to track progress over time. Open History to see past sessions and adjust your weight up or down.
        </TrackingTip>
        <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
          📋 Track Workout
        </button>
      </>
    )
  }

  if (saved) {
    return (
      <div style={{ padding: '14px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', marginBottom: 14, textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>✓ Saved your sets</p>
        <button onClick={() => { setSaved(false); setSets([blankSet()]); setOpen(false) }} style={{ fontSize: 12, color: 'var(--text-mid)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Back to instructions</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Track Workout</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={bilateral} onChange={e => setBilateral(e.target.checked)} /> Track L / R
        </label>
      </div>

      {sets.map((s, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', width: 38, flexShrink: 0 }}>Set {i + 1}</span>
            {!bilateral ? (
              <>
                <input inputMode="numeric" placeholder="Reps" value={s.reps} onChange={e => update(i, 'reps', e.target.value)} style={inputStyle} />
                <input inputMode="decimal" placeholder="Lbs" value={s.weight} onChange={e => update(i, 'weight', e.target.value)} style={inputStyle} />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(['l', 'r'] as const).map(side => (
                  <div key={side} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', width: 12, flexShrink: 0 }}>{side.toUpperCase()}</span>
                    <input inputMode="numeric" placeholder="Reps" value={s[`${side}reps` as keyof SetEntry]} onChange={e => update(i, `${side}reps` as keyof SetEntry, e.target.value)} style={inputStyle} />
                    <input inputMode="decimal" placeholder="Lbs" value={s[`${side}weight` as keyof SetEntry]} onChange={e => update(i, `${side}weight` as keyof SetEntry, e.target.value)} style={inputStyle} />
                  </div>
                ))}
              </div>
            )}
            {sets.length > 1 && <button onClick={() => removeSet(i)} title="Remove set" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>}
          </div>
          <input placeholder="Notes (optional)" value={s.notes} onChange={e => update(i, 'notes', e.target.value)} style={{ width: '100%', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 10 }}>
        <button onClick={duplicateSet} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-mid)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⧉ Duplicate Set</button>
        <button onClick={addSet} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-mid)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add Set</button>
      </div>

      {error && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8, lineHeight: 1.4 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}>{saving ? 'Saving…' : '💾 Save & return'}</button>
      </div>
    </div>
  )
}
