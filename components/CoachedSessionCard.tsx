'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'
import { useTTS } from '@/hooks/useTTS'

// Renders inside the Today page session card when the user has an active
// coach assignment. Everything shown comes from the coach's program —
// no AI substitution.

type LibEntry = { how: string | null; tip: string | null; tts_url_male: string | null; tts_url_female: string | null }
type LastLog = { sets: number | null; reps: number | null; weight: number | null; logged_at: string }

const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function todayDayName(): string {
  return DOW_ORDER[(new Date().getDay() + 6) % 7]
}

function currentProgramWeek(startDate: string, weeksTotal: number): number {
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), weeksTotal)
}

function normalizeExName(raw: string) {
  return raw.toLowerCase()
    .replace(/\s+\d+[×x]\d+.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
    .replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

// "Bench Press 3x8 @ RPE 8" → { name: "Bench Press", scheme: "3x8 @ RPE 8" }
function splitMovement(raw: string): { name: string; scheme: string } {
  const m = raw.match(/^(.*?)\s+(\d+\s*[×x]\s*[\d-]+.*)$/i)
  if (m) return { name: m[1].trim(), scheme: m[2].trim() }
  return { name: raw.trim(), scheme: '' }
}

export default function CoachedSessionCard() {
  const { user, effectiveUserId, loggedInsert } = useAuth()
  const { coachName, assignment, program, weeks } = useCoached()
  const userId = effectiveUserId ?? user?.id ?? ''

  const { speak, stop, speaking, loading: ttsLoading, gender } = useTTS()
  const [speakingKey, setSpeakingKey] = useState<string | null>(null)
  const [lib, setLib] = useState<Record<string, LibEntry>>({})

  const [openLog, setOpenLog] = useState<number | null>(null)
  const [lastLogs, setLastLogs] = useState<Record<string, LastLog | null>>({})
  const [logSets, setLogSets] = useState('')
  const [logReps, setLogReps] = useState('')
  const [logWeight, setLogWeight] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [loggedIdx, setLoggedIdx] = useState<Set<number>>(new Set())

  const [completed, setCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  // Set when the coach completed the day on the client's behalf
  const [coachCompleted, setCoachCompleted] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const weekNum = assignment && program ? currentProgramWeek(assignment.start_date, program.weeks_total) : 1
  const week = weeks.find(w => w.week_number === weekNum)
  const today = todayDayName()
  const todayDay = week?.days.find(d => d.day === today)
  const coachFirst = coachName.split(' ')[0] || 'your coach'

  // Preload exercise library entries for TTS + tips
  useEffect(() => {
    if (!todayDay?.movements.length) return
    const normalized = [...new Set(todayDay.movements.map(normalizeExName))].filter(Boolean)
    if (!normalized.length) return
    supabase
      .from('exercise_library')
      .select('name_normalized, how, tip, tts_url_male, tts_url_female')
      .in('name_normalized', normalized)
      .then(({ data }) => {
        const map: Record<string, LibEntry> = {}
        data?.forEach(e => { map[e.name_normalized] = e })
        setLib(map)
      })
  }, [todayDay])

  // Load completion state for today
  useEffect(() => {
    if (!assignment || !userId || !todayDay) return
    supabase
      .from('coach_day_completions')
      .select('id, completed_by')
      .eq('user_id', userId)
      .eq('assignment_id', assignment.id)
      .eq('week_number', weekNum)
      .eq('day_name', today)
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as { id: string; completed_by?: string | null } | undefined
        setCompleted(!!row)
        const byCoach = !!row?.completed_by && row.completed_by !== userId
        setCoachCompleted(byCoach)
        if (byCoach) {
          // Celebrate once per completed day
          const key = `coach_completed_seen_${assignment.id}_${weekNum}_${today}`
          if (!localStorage.getItem(key)) {
            setCelebrate(true)
            localStorage.setItem(key, '1')
          }
        }
      })
  }, [assignment, userId, weekNum, today, todayDay])

  async function speakExercise(rawName: string) {
    const key = normalizeExName(rawName)
    if (speakingKey === key) { stop(); setSpeakingKey(null); return }
    setSpeakingKey(key)
    const entry = lib[key]
    const { name } = splitMovement(rawName)
    const parts = [name]
    if (entry?.how) parts.push(entry.how)
    if (entry?.tip) parts.push('Coaching tip: ' + entry.tip)
    const preUrl = gender === 'male' ? entry?.tts_url_male : entry?.tts_url_female
    await speak(parts.join('. '), { preGeneratedUrl: preUrl ?? undefined, nameNormalized: preUrl ? undefined : key })
    setSpeakingKey(null)
  }

  async function toggleLog(idx: number, movement: string) {
    if (openLog === idx) { setOpenLog(null); return }
    setOpenLog(idx)
    setLogSets(''); setLogReps(''); setLogWeight('')
    const key = normalizeExName(movement)
    if (!(key in lastLogs)) {
      const { data } = await supabase
        .from('workout_logs')
        .select('sets, reps, weight, logged_at')
        .eq('user_id', userId)
        .eq('exercise_normalized', key)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single()
      setLastLogs(prev => ({ ...prev, [key]: data ?? null }))
    }
  }

  async function saveLog(idx: number, movement: string) {
    if (logSaving || (!logSets && !logReps && !logWeight)) return
    setLogSaving(true)
    const key = normalizeExName(movement)
    await loggedInsert('workout_logs', {
      user_id: userId,
      exercise_normalized: key,
      sets: logSets ? parseInt(logSets) : null,
      reps: logReps ? parseInt(logReps) : null,
      weight: logWeight ? parseFloat(logWeight) : null,
      weight_unit: 'lbs',
    })
    setLastLogs(prev => ({
      ...prev,
      [key]: {
        sets: logSets ? parseInt(logSets) : null,
        reps: logReps ? parseInt(logReps) : null,
        weight: logWeight ? parseFloat(logWeight) : null,
        logged_at: new Date().toISOString(),
      },
    }))
    setLoggedIdx(prev => new Set(prev).add(idx))
    setLogSaving(false)
    setOpenLog(null)
  }

  async function completeDay() {
    if (!assignment || completing) return
    setCompleting(true)
    if (completed) {
      await supabase
        .from('coach_day_completions')
        .delete()
        .eq('user_id', userId)
        .eq('assignment_id', assignment.id)
        .eq('week_number', weekNum)
        .eq('day_name', today)
      setCompleted(false)
      setCoachCompleted(false)
    } else {
      const { error } = await supabase
        .from('coach_day_completions')
        .upsert(
          { user_id: userId, assignment_id: assignment.id, week_number: weekNum, day_name: today, skipped: false },
          { onConflict: 'user_id,assignment_id,week_number,day_name' }
        )
      if (!error) setCompleted(true)
    }
    setCompleting(false)
  }

  if (!program || !assignment) return null

  const coachBadge = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 10, fontWeight: 800, color: 'var(--text-mid)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
      🏋️ Programmed by Coach {coachFirst}
    </div>
  )

  // ── Rest day ──────────────────────────────────────────────────────────────
  if (todayDay && todayDay.type === 'rest') {
    return (
      <>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Rest Day</div>
        {coachBadge}
        <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>
          Coach {coachFirst} has you on scheduled recovery today. Let your body absorb the work.
        </div>
        <Link href="/my-coach" style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, textAlign: 'center', textDecoration: 'none', border: '1px solid var(--border)' }}>
          View Full Program →
        </Link>
      </>
    )
  }

  // ── No workout scheduled today ────────────────────────────────────────────
  if (!todayDay) {
    return (
      <>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
          {weekNum >= (program.weeks_total ?? 1) && !week ? 'Program Complete' : 'No Session Today'}
        </div>
        {coachBadge}
        <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 14 }}>
          Nothing on the schedule from Coach {coachFirst} today.
        </div>
        <Link href="/my-coach" style={{ display: 'block', padding: '14px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, textAlign: 'center', textDecoration: 'none', border: '1px solid var(--border)' }}>
          View Full Program →
        </Link>
      </>
    )
  }

  // ── Training day ──────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{todayDay.label || 'Training Day'}</div>
        {todayDay.duration && todayDay.duration !== '—' && (
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{todayDay.duration}</span>
        )}
      </div>
      {coachBadge}
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 14 }}>
        Week {weekNum} of {program.weeks_total} · {program.name}
        {todayDay.focus ? ` · ${todayDay.focus}` : ''}
      </div>

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        {todayDay.movements.map((mv, i) => {
          const { name, scheme } = splitMovement(mv)
          const key = normalizeExName(mv)
          const isSpeaking = speakingKey === key && (speaking || ttsLoading)
          const last = lastLogs[key]
          const isOpen = openLog === i
          return (
            <div key={i} style={{ borderBottom: i < todayDay.movements.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: loggedIdx.has(i) ? 'var(--green)' : 'var(--accent)', flexShrink: 0 }} />
                <button
                  onClick={() => toggleLog(i, mv)}
                  style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{name}</span>
                  {scheme && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, flexShrink: 0 }}>{scheme}</span>}
                </button>
                {loggedIdx.has(i) && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 800, flexShrink: 0 }}>✓</span>}
                <button onClick={() => speakExercise(mv)} style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: isSpeaking ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0 }}>
                  {isSpeaking ? '🔊' : '🔈'}
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: '0 12px 12px' }}>
                  {lib[key]?.tip && (
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 8 }}>💡 {lib[key].tip}</p>
                  )}
                  {last && (
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                      Last session: {last.sets ?? '—'}×{last.reps ?? '—'}{last.weight ? ` @ ${last.weight} lbs` : ''}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([['Sets', logSets, setLogSets], ['Reps', logReps, setLogReps], ['Lbs', logWeight, setLogWeight]] as const).map(([ph, val, setter]) => (
                      <input
                        key={ph}
                        type="number"
                        inputMode="decimal"
                        placeholder={ph}
                        value={val}
                        onChange={e => setter(e.target.value)}
                        style={{ width: 0, flex: 1, padding: '9px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    ))}
                    <button
                      onClick={() => saveLog(i, mv)}
                      disabled={logSaving}
                      style={{ padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: logSaving ? 0.6 : 1, flexShrink: 0 }}
                    >
                      {logSaving ? '…' : 'Log'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {celebrate && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', marginBottom: 2 }}>
              Good job!
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>
              Looks like you crushed today&apos;s session with Coach {coachFirst} — everything&apos;s logged for you. Check History for your numbers.
            </div>
          </div>
          <button onClick={() => setCelebrate(false)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer', padding: 2, flexShrink: 0 }}>×</button>
        </div>
      )}

      <button
        onClick={completeDay}
        disabled={completing}
        style={{
          display: 'block', width: '100%', padding: '14px', borderRadius: 12,
          background: completed ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
          color: completed ? 'var(--green)' : '#fff',
          border: completed ? '1px solid rgba(34,197,94,0.35)' : 'none',
          fontWeight: 900, fontSize: 14, textAlign: 'center', cursor: 'pointer',
          letterSpacing: '0.03em', textTransform: 'uppercase', fontFamily: 'inherit',
          boxShadow: completed ? 'none' : '0 6px 24px var(--accent-shadow)',
          opacity: completing ? 0.6 : 1,
          marginBottom: 10,
        }}
      >
        {completed
          ? coachCompleted ? `✓ Completed with Coach ${coachFirst}` : '✓ Day Completed — Tap to Undo'
          : '✓ Complete Day'}
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link href="/my-coach" style={{ flex: 1, display: 'block', padding: '12px', borderRadius: 12, background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>
          View Full Program →
        </Link>
        <Link
          href={`/my-coach?tab=messages&draft=${encodeURIComponent(`Hey Coach — I need a modification for today's session (${todayDay.label || 'training day'}): `)}`}
          style={{ flex: 1, display: 'block', padding: '12px', borderRadius: 12, background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none', border: '1px dashed var(--border)' }}
        >
          ✈️ Need changes? Message coach
        </Link>
      </div>
    </>
  )
}
