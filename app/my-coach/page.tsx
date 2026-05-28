'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ParsedDay {
  day: string
  label: string
  type: string
  movements: string[]
  focus: string
  duration: string
}

interface Week {
  id: string
  week_number: number
  label: string
  phase: string | null
  days: ParsedDay[]
  coach_notes: string
}

interface Program {
  id: string
  name: string
  weeks_total: number
  notes: string | null
  description: string | null
}

interface AssignmentData {
  id: string
  start_date: string
  status: string
}

const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

function todayDayName(): string {
  return DOW_ORDER[(new Date().getDay() + 6) % 7]
}

function currentProgramWeek(startDate: string, weeksTotal: number): number {
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), weeksTotal)
}

function weekProgress(startDate: string, total: number): number {
  const week = currentProgramWeek(startDate, total)
  return Math.round((week / total) * 100)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MyCoachPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [program, setProgram]       = useState<Program | null>(null)
  const [weeks, setWeeks]           = useState<Week[]>([])
  const [assignment, setAssignment] = useState<AssignmentData | null>(null)
  const [coachName, setCoachName]   = useState<string>('')
  const [loading, setLoading]       = useState(true)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())
  const [expandedDays, setExpandedDays]   = useState<Set<string>>(new Set())

  useEffect(() => { if (user) load() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const res = await fetch('/api/coach/my-program', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()

    if (data.assignment) {
      setAssignment(data.assignment)
      setProgram(data.program)
      setWeeks(data.weeks)
      setCoachName(data.coachName)

      // Auto-expand current week
      const currWeek = currentProgramWeek(data.assignment.start_date, data.program?.weeks_total ?? 1)
      setExpandedWeeks(new Set([currWeek]))

      // Auto-expand today's day within the current week
      setExpandedDays(new Set([`${currWeek}-${todayDayName()}`]))
    }

    setLoading(false)
  }

  function toggleWeek(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  function toggleDay(key: string) {
    setExpandedDays(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (loading) return (
    <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
      Loading your program…
    </div>
  )

  // Empty state — no active assignment
  if (!assignment || !program) return (
    <div style={{ padding: '60px 20px 100px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🏋️</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 10 }}>
        No Coach Program Yet
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 28 }}>
        Ask your coach for their invite code, then enter it in your Account page to join their roster and receive a program.
      </p>
      <button
        onClick={() => router.push('/account')}
        style={{ padding: '13px 28px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Go to Account
      </button>
    </div>
  )

  const currWeekNum = currentProgramWeek(assignment.start_date, program.weeks_total)
  const pct         = weekProgress(assignment.start_date, program.weeks_total)
  const today       = todayDayName()
  const currWeek    = weeks.find(w => w.week_number === currWeekNum)
  const todayDay    = currWeek?.days.find(d => d.day === today)

  return (
    <div style={{ padding: '24px 20px 100px', maxWidth: 640, margin: '0 auto' }}>

      {/* Coach + program header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Coach: {coachName}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 6px' }}>
          {program.name}
        </h1>
        {program.description && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>{program.description}</p>
        )}
      </div>

      {/* Progress card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Week {currWeekNum} of {program.weeks_total}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Started {fmtDate(assignment.start_date)}</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{pct}%</div>
        </div>
        <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
        </div>
        {currWeek?.phase && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
            Phase: {currWeek.phase}
          </div>
        )}
      </div>

      {/* Today's workout — prominent if it's a training day */}
      {todayDay && todayDay.type === 'workout' && (
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Today · {DOW_FULL[today]}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{todayDay.label}</div>
          {todayDay.focus && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>Focus: {todayDay.focus}{todayDay.duration && todayDay.duration !== '—' ? ` · ${todayDay.duration}` : ''}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayDay.movements.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 9 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rest day notice */}
      {todayDay && todayDay.type === 'rest' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>😴</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rest Day</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Today is scheduled recovery. You've earned it.</div>
        </div>
      )}

      {/* Not in program yet / already done */}
      {!todayDay && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {currWeekNum > program.weeks_total ? 'Program complete — great work!' : 'No workout scheduled for today in this week.'}
          </div>
        </div>
      )}

      {/* Week accordion */}
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Full Program
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {weeks.map(week => {
          const isCurrentWeek = week.week_number === currWeekNum
          const isExpanded    = expandedWeeks.has(week.week_number)
          const trainingDays  = week.days?.filter(d => d.type === 'workout') ?? []

          return (
            <div
              key={week.id}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isCurrentWeek ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.week_number)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isCurrentWeek && (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Current
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{week.label}</span>
                  {week.phase && (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>· {week.phase}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {trainingDays.length} session{trainingDays.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 16, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    ↓
                  </span>
                </div>
              </button>

              {/* Week days */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {week.coach_notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4 }}>
                      Coach note: {week.coach_notes}
                    </div>
                  )}
                  {(DOW_ORDER.map(d => week.days?.find(day => day.day === d)).filter(Boolean) as ParsedDay[]).map(day => {
                    const dayKey    = `${week.week_number}-${day.day}`
                    const isDayOpen = expandedDays.has(dayKey)
                    const isToday   = isCurrentWeek && day.day === today
                    const isRest    = day.type === 'rest'

                    return (
                      <div key={day.day} style={{ border: `1px solid ${isToday ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: isToday ? 'rgba(59,130,246,0.04)' : 'transparent' }}>
                        <button
                          onClick={() => !isRest && toggleDay(dayKey)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', background: 'none', border: 'none',
                            cursor: isRest ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          {/* Day chip */}
                          <span style={{ fontSize: 10, fontWeight: 800, width: 30, textAlign: 'center', padding: '3px 0', borderRadius: 6, background: isToday ? 'var(--accent)' : 'var(--surface2)', color: isToday ? '#fff' : 'var(--text-dim)', flexShrink: 0 }}>
                            {day.day}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: isRest ? 500 : 700, color: isRest ? 'var(--text-dim)' : 'var(--text)' }}>
                              {isRest ? 'Rest' : day.label}
                            </div>
                            {!isRest && (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                                {day.movements.length} exercise{day.movements.length !== 1 ? 's' : ''}{day.duration && day.duration !== '—' ? ` · ${day.duration}` : ''}
                              </div>
                            )}
                          </div>
                          {!isRest && (
                            <span style={{ fontSize: 13, color: 'var(--text-dim)', transform: isDayOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>↓</span>
                          )}
                        </button>

                        {/* Exercise list */}
                        {isDayOpen && !isRest && (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {day.movements.map((m, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m}</span>
                              </div>
                            ))}
                            {day.focus && (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '6px 10px', marginTop: 2 }}>
                                Focus: {day.focus}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
