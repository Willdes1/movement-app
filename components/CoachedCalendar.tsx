'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'
import CoachedSessionCard from '@/components/CoachedSessionCard'

// The coached athlete's Calendar. When a user is on a coach's program, this
// replaces the AI-plan calendar on /calendar. It's a week/day picker that drives
// the proven CoachedSessionCard (reused, day-agnostic) for the selected day.

const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

function todayDayName(): string {
  return DOW_ORDER[(new Date().getDay() + 6) % 7]
}

function currentProgramWeek(startDate: string, weeksTotal: number): number {
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), weeksTotal)
}

export default function CoachedCalendar() {
  const { user, effectiveUserId } = useAuth()
  const { coachName, program, assignment, weeks } = useCoached()
  const userId = effectiveUserId ?? user?.id ?? ''

  const liveWeek = assignment && program ? currentProgramWeek(assignment.start_date, program.weeks_total) : 1
  const realToday = todayDayName()

  const [selectedWeek, setSelectedWeek] = useState(liveWeek)
  const [selectedDay, setSelectedDay] = useState<string>(realToday)
  const [completions, setCompletions] = useState<Set<string>>(new Set())

  const week = useMemo(() => weeks.find(w => w.week_number === selectedWeek), [weeks, selectedWeek])

  // Default the selected day to today if today is in this week, else the first
  // training day, else the first day.
  useEffect(() => {
    if (!week) return
    const hasToday = week.days.some(d => d.day === selectedDay)
    if (hasToday) return
    const firstTraining = week.days.find(d => d.type !== 'rest')
    setSelectedDay(firstTraining?.day ?? week.days[0]?.day ?? realToday)
  }, [week]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load every completed (week, day) for this assignment → checkmarks.
  useEffect(() => {
    if (!assignment || !userId) return
    supabase
      .from('coach_day_completions')
      .select('week_number, day_name')
      .eq('user_id', userId)
      .eq('assignment_id', assignment.id)
      .then(({ data }) => {
        const set = new Set<string>()
        for (const r of data ?? []) set.add(`${r.week_number}-${r.day_name}`)
        setCompletions(set)
      })
  }, [assignment, userId, selectedDay])

  if (!program || !assignment) return null

  const coachFirst = coachName.split(' ')[0] || 'your coach'
  const totalWeeks = program.weeks_total ?? weeks.length ?? 1

  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 10, fontWeight: 800, color: 'var(--text-mid)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
        🏋️ Programmed by Coach {coachFirst}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.02em' }}>{program.name}</h1>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18 }}>
        {totalWeeks}-week program · tap any day to train it
      </p>

      {/* Week selector */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 14, WebkitOverflowScrolling: 'touch' }}>
        {weeks.map(w => {
          const sel = w.week_number === selectedWeek
          const isLive = w.week_number === liveWeek
          return (
            <button
              key={w.id}
              onClick={() => setSelectedWeek(w.week_number)}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: sel ? 'none' : '1px solid var(--border)',
                background: sel ? 'var(--accent)' : 'var(--surface2)',
                color: sel ? '#fff' : 'var(--text-mid)',
                fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
              }}
            >
              Week {w.week_number}{isLive ? ' •' : ''}
            </button>
          )
        })}
      </div>

      {/* Day selector for the selected week */}
      {week && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
          {DOW_ORDER.map(dow => {
            const d = week.days.find(x => x.day === dow)
            const sel = selectedDay === dow
            const isRest = !d || d.type === 'rest'
            const done = completions.has(`${selectedWeek}-${dow}`)
            const isLiveToday = selectedWeek === liveWeek && dow === realToday
            return (
              <button
                key={dow}
                onClick={() => setSelectedDay(dow)}
                title={d?.label || DOW_FULL[dow]}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '8px 2px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: sel ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface2)',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 800, color: isLiveToday ? 'var(--accent)' : 'var(--text-dim)', letterSpacing: '0.04em' }}>{dow.toUpperCase()}</span>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{done ? '✅' : isRest ? '·' : '💪'}</span>
                {isLiveToday && <span style={{ position: 'absolute', top: 3, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Selected day's workout — reuses the proven Today card, keyed so it
          remounts cleanly (re-fetches its own lib/logs/completion) per day. */}
      <CoachedSessionCard key={`${selectedWeek}-${selectedDay}`} weekOverride={selectedWeek} dayOverride={selectedDay} />
    </div>
  )
}
