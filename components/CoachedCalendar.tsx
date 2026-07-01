'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'
import CoachedSessionCard from '@/components/CoachedSessionCard'

// The coached athlete's Calendar. When a user is on a coach's program, this
// replaces the AI-plan calendar on /calendar. It lays the coach program out on a
// real month grid mapped from the assignment start date — using the SAME visual
// language as the AI-plan calendar so switching between the two is seamless —
// then drives the proven, day-agnostic CoachedSessionCard for the tapped day.

const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Normalize a DB date/timestamp to local noon on that calendar day — avoids the
// UTC-midnight off-by-one that bites negative timezones.
function parseLocalDate(s: string): Date {
  return new Date(s.slice(0, 10) + 'T12:00:00')
}
function mondayNoonOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7 // Mon=0
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  x.setDate(x.getDate() - dow)
  return x
}
function dowName(d: Date): string {
  return DOW_ORDER[(d.getDay() + 6) % 7]
}
function sameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CoachedCalendar() {
  const { user, effectiveUserId } = useAuth()
  const { coachName, program, assignment, weeks } = useCoached()
  const userId = effectiveUserId ?? user?.id ?? ''

  const totalWeeks = program?.weeks_total ?? weeks.length ?? 1
  // Week 1 is anchored to the Monday of the week the assignment started.
  const startMonday = useMemo(
    () => (assignment ? mondayNoonOf(parseLocalDate(assignment.start_date)) : null),
    [assignment]
  )

  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [selected, setSelected] = useState<{ week: number; day: string } | null>(null)

  // Map a real calendar date → program week (1..totalWeeks), or null if outside.
  function programWeekOf(date: Date): number | null {
    if (!startMonday) return null
    const days = Math.round((date.getTime() - startMonday.getTime()) / 86_400_000)
    if (days < 0) return null
    const wk = Math.floor(days / 7) + 1
    return wk >= 1 && wk <= totalWeeks ? wk : null
  }

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
  }, [assignment, userId, selected])

  // Land on today's session if today is inside the program; otherwise week 1's
  // first training day, and jump the month view to match.
  useEffect(() => {
    if (selected || !startMonday || weeks.length === 0) return
    const t = new Date()
    const tWk = programWeekOf(t)
    if (tWk) {
      setSelected({ week: tWk, day: dowName(t) })
      setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1))
      return
    }
    const wk1 = weeks.find(w => w.week_number === 1) ?? weeks[0]
    const firstTraining = wk1?.days.find(d => d.type !== 'rest') ?? wk1?.days[0]
    if (wk1 && firstTraining) {
      setSelected({ week: wk1.week_number, day: firstTraining.day })
      const d = new Date(startMonday)
      d.setDate(d.getDate() + (wk1.week_number - 1) * 7 + Math.max(0, DOW_ORDER.indexOf(firstTraining.day)))
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }, [startMonday, weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!program || !assignment) return null

  const coachFirst = coachName.split(' ')[0] || 'your coach'
  const today = new Date()
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Human label for the currently selected (week, day).
  let selectedDateLabel = ''
  if (selected && startMonday) {
    const d = new Date(startMonday)
    d.setDate(d.getDate() + (selected.week - 1) * 7 + Math.max(0, DOW_ORDER.indexOf(selected.day)))
    selectedDateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  return (
    <div className="page-content" style={{ padding: '24px 16px 120px' }}>
      {/* Header */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 10, fontWeight: 800, color: 'var(--text-mid)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
        🏋️ Programmed by Coach {coachFirst}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{program.name}</h1>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
        {totalWeeks}-week program · tap any day for details
      </p>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <button
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer', padding: '2px 8px', fontWeight: 700, fontFamily: 'inherit' }}
        >←</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{MONTHS[month]} {year}</span>
        <button
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          aria-label="Next month"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer', padding: '2px 8px', fontWeight: 700, fontFamily: 'inherit' }}
        >→</button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
        {DOW_ORDER.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', padding: '3px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((dateNum, i) => {
          if (dateNum === null) return <div key={i} style={{ minHeight: 54 }} />

          const cellDate = new Date(year, month, dateNum, 12, 0, 0)
          const wk = programWeekOf(cellDate)
          const dName = dowName(cellDate)
          const dayObj = wk ? weeks.find(w => w.week_number === wk)?.days.find(d => d.day === dName) : undefined
          const inProgram = wk != null
          const isTraining = !!(inProgram && dayObj && dayObj.type !== 'rest')
          const done = inProgram && completions.has(`${wk}-${dName}`)
          const isToday = sameYMD(cellDate, today)
          const isSelected = !!(selected && selected.week === wk && selected.day === dName)
          const dotColor = done ? 'var(--green)' : isTraining ? 'var(--accent)' : 'var(--text-dim)'

          return (
            <button
              key={i}
              disabled={!inProgram}
              onClick={() => inProgram && setSelected({ week: wk as number, day: dName })}
              title={isTraining ? (dayObj?.label || 'Training day') : inProgram ? 'Rest day' : undefined}
              style={{
                minHeight: 54,
                borderRadius: 8,
                border: `1.5px solid ${isSelected ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected || (isToday && !inProgram) ? 'var(--accent-bg)' : 'var(--surface)',
                cursor: inProgram ? 'pointer' : 'default',
                padding: '5px 2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minWidth: 0,
                opacity: inProgram ? 1 : 0.28,
                fontFamily: 'inherit',
                transition: 'opacity 0.1s, border-color 0.1s',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                {dateNum}
              </span>
              {inProgram && (
                <>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  {isTraining && (
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: dotColor, textAlign: 'center', lineHeight: 1.25, wordBreak: 'break-word', padding: '0 2px', maxWidth: '100%' }}>
                      {(dayObj?.label ?? '').split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
        {[
          { label: 'Workout', color: 'var(--accent)' },
          { label: 'Completed', color: 'var(--green)' },
          { label: 'Rest', color: 'var(--text-dim)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day's workout — reuses the proven Today card, keyed so it
          remounts cleanly (re-fetches its own lib/logs/completion) per day. */}
      {selected && (
        <div style={{ marginTop: 20 }}>
          {selectedDateLabel && (
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 10 }}>{selectedDateLabel}</p>
          )}
          <CoachedSessionCard key={`${selected.week}-${selected.day}`} weekOverride={selected.week} dayOverride={selected.day} />
        </div>
      )}
    </div>
  )
}
