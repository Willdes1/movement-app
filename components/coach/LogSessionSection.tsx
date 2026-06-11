'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// In-person session logging: the coach fills out the client's workout
// (sets/reps/weight + notes + adjustments) and optionally completes the day.
// Client's own logs for the day are pre-loaded so both can work on the record.

type ParsedDay = { day: string; label: string; type: string; movements: string[]; focus: string; duration: string }
type WeekRow = { week_number: number; days: ParsedDay[] }
type ClientLog = { id: string; exercise_normalized: string; sets: number | null; reps: number | null; weight: number | null }

type EntryState = {
  sets: string
  reps: string
  weight: string
  note: string
  existingLogId?: string
  clientLogged: boolean
}

const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function todayDayName(): string {
  return DOW_ORDER[(new Date().getDay() + 6) % 7]
}

function normalizeExName(raw: string) {
  return raw.toLowerCase()
    .replace(/\s+\d+[×x]\d+.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
    .replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

function splitMovement(raw: string): { name: string; scheme: string } {
  const m = raw.match(/^(.*?)\s+(\d+\s*[×x]\s*[\d-]+.*)$/i)
  if (m) return { name: m[1].trim(), scheme: m[2].trim() }
  return { name: raw.trim(), scheme: '' }
}

// "3x8" → { sets: '3', reps: '8' }; "4x8-12" → { sets: '4', reps: '8' }
function schemeDefaults(scheme: string): { sets: string; reps: string } {
  const m = scheme.match(/(\d+)\s*[×x]\s*(\d+)/)
  return m ? { sets: m[1], reps: m[2] } : { sets: '', reps: '' }
}

interface Props {
  clientId: string
  clientName: string
  assignment: { id: string; program_id: string; start_date: string; weeks_total: number; program_name: string }
}

export default function LogSessionSection({ clientId, clientName, assignment }: Props) {
  const defaultWeek = Math.min(Math.max(
    Math.floor((Date.now() - new Date(assignment.start_date).getTime()) / (7 * 86_400_000)) + 1, 1
  ), assignment.weeks_total)

  const [open, setOpen] = useState(false)
  const [weekNumber, setWeekNumber] = useState(defaultWeek)
  const [dayName, setDayName] = useState(todayDayName())
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [week, setWeek] = useState<WeekRow | null>(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [entries, setEntries] = useState<Record<number, EntryState>>({})
  const [sessionNote, setSessionNote] = useState('')
  const [completeDay, setCompleteDay] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const day = week?.days.find(d => d.day === dayName) ?? null

  const loadDay = useCallback(async () => {
    setLoadingDay(true)
    setError('')
    const { data: weekRow } = await supabase
      .from('coach_program_weeks')
      .select('week_number, days')
      .eq('program_id', assignment.program_id)
      .eq('week_number', weekNumber)
      .single()

    const w = (weekRow ?? null) as WeekRow | null
    setWeek(w)

    const d = w?.days.find(dd => dd.day === dayName)
    if (!d?.movements.length) { setEntries({}); setLoadingDay(false); return }

    // Pre-load the client's own logs for this date so the coach can edit or keep them
    const dayStart = new Date(`${sessionDate}T00:00:00`)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const normalized = d.movements.map(normalizeExName)
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id, exercise_normalized, sets, reps, weight')
      .eq('user_id', clientId)
      .in('exercise_normalized', normalized)
      .gte('logged_at', dayStart.toISOString())
      .lt('logged_at', dayEnd.toISOString())
      .order('logged_at', { ascending: false })

    const latestByExercise = new Map<string, ClientLog>()
    ;(logs as ClientLog[] | null)?.forEach(l => {
      if (!latestByExercise.has(l.exercise_normalized)) latestByExercise.set(l.exercise_normalized, l)
    })

    const next: Record<number, EntryState> = {}
    d.movements.forEach((mv, i) => {
      const key = normalizeExName(mv)
      const clientLog = latestByExercise.get(key)
      if (clientLog) {
        next[i] = {
          sets: clientLog.sets != null ? String(clientLog.sets) : '',
          reps: clientLog.reps != null ? String(clientLog.reps) : '',
          weight: clientLog.weight != null ? String(clientLog.weight) : '',
          note: '',
          existingLogId: clientLog.id,
          clientLogged: true,
        }
      } else {
        const { scheme } = splitMovement(mv)
        const defaults = schemeDefaults(scheme)
        next[i] = { sets: defaults.sets, reps: defaults.reps, weight: '', note: '', clientLogged: false }
      }
    })
    setEntries(next)
    setLoadingDay(false)
  }, [assignment.program_id, weekNumber, dayName, sessionDate, clientId])

  useEffect(() => { if (open) loadDay() }, [open, loadDay])

  function updateEntry(i: number, field: keyof EntryState, value: string) {
    setEntries(prev => ({ ...prev, [i]: { ...prev[i], [field]: value } }))
  }

  async function save() {
    if (!day || saving) return
    setSaving(true); setError(''); setResult('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expired — refresh the page.'); setSaving(false); return }

    const payload = {
      clientId,
      assignmentId: assignment.id,
      weekNumber,
      dayName,
      sessionDate,
      completeDay,
      sessionNote,
      entries: day.movements.map((mv, i) => {
        const e = entries[i]
        return {
          exercise: splitMovement(mv).name,
          exerciseNormalized: normalizeExName(mv),
          existingLogId: e?.existingLogId,
          sets: e?.sets ? parseInt(e.sets) : null,
          reps: e?.reps ? parseInt(e.reps) : null,
          weight: e?.weight ? parseFloat(e.weight) : null,
          note: e?.note ?? '',
        }
      }),
    }

    const res = await fetch('/api/coach/log-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setResult(`Session logged${completeDay ? ` — day marked complete and ${clientName.split(' ')[0]} was notified` : ''}.`)
      setSessionNote('')
    } else {
      setError(data.error ?? 'Something went wrong.')
    }
  }

  const firstName = clientName.split(' ')[0]

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 26, overflow: 'hidden' }}>
      <button
        onClick={() => { setOpen(o => !o); setResult('') }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            In-Person Session
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>📝 Log Session for {firstName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            Fill out their workout — it shows as completed on their app and counts in their stats.
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid var(--border)' }}>
          {/* Week / day / date pickers */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Week</label>
              <select value={weekNumber} onChange={e => setWeekNumber(parseInt(e.target.value))}
                style={{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
                {Array.from({ length: assignment.weeks_total }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>Week {n}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Day</label>
              <select value={dayName} onChange={e => setDayName(e.target.value)}
                style={{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
                {DOW_ORDER.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Session date</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, colorScheme: 'dark', fontFamily: 'inherit' }} />
            </div>
          </div>

          {loadingDay ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>Loading day…</div>
          ) : !day ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>No day found for {dayName} in Week {weekNumber}.</div>
          ) : day.type === 'rest' ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>{dayName} is a rest day in Week {weekNumber}.</div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
                {day.label || 'Training Day'}{day.focus ? ` · ${day.focus}` : ''}
              </div>

              {/* Exercise rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {day.movements.map((mv, i) => {
                  const { name, scheme } = splitMovement(mv)
                  const e = entries[i]
                  if (!e) return null
                  return (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{name}</span>
                        {scheme && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700 }}>programmed {scheme}</span>}
                        {e.clientLogged && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {firstName} logged this — edit or leave as is
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {([['Sets', 'sets'], ['Reps', 'reps'], ['Lbs', 'weight']] as const).map(([ph, field]) => (
                          <input
                            key={field}
                            type="number"
                            inputMode="decimal"
                            placeholder={ph}
                            value={e[field]}
                            onChange={ev => updateEntry(i, field, ev.target.value)}
                            style={{ width: 76, padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                          />
                        ))}
                        <input
                          placeholder="Note / adjustment (optional)"
                          value={e.note}
                          onChange={ev => updateEntry(i, 'note', ev.target.value)}
                          style={{ flex: 1, minWidth: 140, padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Session notes */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                  Session notes & adjustments (saved to client notes)
                </label>
                <textarea
                  value={sessionNote}
                  onChange={e => setSessionNote(e.target.value)}
                  rows={3}
                  placeholder="How the session went, adjustments made, what to watch next time…"
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Complete day toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={completeDay} onChange={e => setCompleteDay(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                Mark day complete for {firstName} (they&apos;ll get a &quot;Good job!&quot; notification)
              </label>

              {error && (
                <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13, marginBottom: 12 }}>{error}</div>
              )}
              {result && (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--green)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>✓ {result}</div>
              )}

              <button
                onClick={save}
                disabled={saving}
                style={{ width: '100%', padding: '13px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : completeDay ? '✓ Complete & Log Session' : 'Log Session'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
