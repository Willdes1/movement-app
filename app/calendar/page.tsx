'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type DayPlan = {
  day: string
  label: string
  type: string
  movements: string[]
  duration: string
}

type Program = {
  id: string
  startDate: string
}

const TOTAL_WEEKS = 13
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const TYPE_COLOR: Record<string, string> = {
  workout: 'var(--accent)', warmup: 'var(--orange)', cooldown: 'var(--yellow)',
  morning: 'var(--green)', abs: 'var(--accent)', evening: 'var(--orange)', rest: 'var(--text-dim)',
}
const TYPE_BG: Record<string, string> = {
  workout: 'var(--accent-bg)', warmup: 'var(--orange-bg)', cooldown: 'var(--yellow-bg)',
  morning: 'var(--green-bg)', abs: 'var(--accent-bg)', evening: 'var(--orange-bg)',
  rest: 'rgba(120,130,148,0.05)',
}

function getPhaseInfo(week: number) {
  if (week <= 4) return { label: 'Foundation', color: 'var(--green)' }
  if (week <= 8) return { label: 'Build', color: 'var(--accent)' }
  if (week <= 10) return { label: 'Peak', color: 'var(--orange)' }
  return { label: 'Maintenance', color: 'var(--yellow)' }
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function planDayToDate(startDate: string, weekNum: number, dayIndex: number): Date {
  const start = new Date(startDate)
  const d = new Date(start)
  d.setDate(d.getDate() + (weekNum - 1) * 7 + dayIndex)
  return d
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [program, setProgram] = useState<Program | null>(null)
  const [weekPlans, setWeekPlans] = useState<Record<number, DayPlan[]>>({})
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: prog } = await supabase
      .from('training_programs')
      .select('id, start_date')
      .eq('user_id', user.id)
      .single()

    if (!prog) { setLoading(false); return }

    const program: Program = { id: prog.id, startDate: prog.start_date }
    setProgram(program)
    setViewMonth(new Date(prog.start_date))

    const { data: plans } = await supabase
      .from('weekly_plans')
      .select('week_number, plan')
      .eq('program_id', prog.id)

    const map: Record<number, DayPlan[]> = {}
    plans?.forEach(p => { map[p.week_number] = p.plan as DayPlan[] })
    setWeekPlans(map)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  // Build date → plan day map from all generated weeks
  const dayMap: Record<string, { day: DayPlan; weekNum: number }> = {}
  if (program) {
    Object.entries(weekPlans).forEach(([weekStr, plan]) => {
      const weekNum = Number(weekStr)
      plan.forEach((day, idx) => {
        const key = dateKey(planDayToDate(program.startDate, weekNum, idx))
        dayMap[key] = { day, weekNum }
      })
    })
  }

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const todayKey = dateKey(new Date())

  const programEnd = program
    ? (() => { const d = new Date(program.startDate); d.setDate(d.getDate() + TOTAL_WEEKS * 7 - 1); return d })()
    : null

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedEntry = selectedKey ? dayMap[selectedKey] : null

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  if (!program) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No program yet</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Generate your 13-week program first, then your full calendar will appear here.
        </p>
        <button
          onClick={() => router.push('/plan')}
          style={{ padding: '13px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Go to Your Plan →
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Calendar</h1>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
        13-week program · tap any day for details
      </p>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <button
          onClick={() => { setViewMonth(new Date(year, month - 1, 1)); setSelectedKey(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer', padding: '2px 8px', fontWeight: 700 }}
        >←</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{MONTHS[month]} {year}</span>
        <button
          onClick={() => { setViewMonth(new Date(year, month + 1, 1)); setSelectedKey(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer', padding: '2px 8px', fontWeight: 700 }}
        >→</button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', padding: '3px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((dateNum, i) => {
          if (dateNum === null) return <div key={i} style={{ minHeight: 54 }} />

          const cellDate = new Date(year, month, dateNum)
          const key = dateKey(cellDate)
          const entry = dayMap[key]
          const isToday = key === todayKey
          const isSelected = key === selectedKey
          const inProgram = programEnd && cellDate >= new Date(program.startDate) && cellDate <= programEnd
          const isPast = cellDate < new Date() && !isToday
          const typeColor = entry ? (TYPE_COLOR[entry.day.type] ?? 'var(--text-dim)') : null
          const typeBg = entry ? (TYPE_BG[entry.day.type] ?? 'var(--surface)') : 'var(--surface)'

          return (
            <button
              key={i}
              onClick={() => setSelectedKey(isSelected ? null : key)}
              style={{
                minHeight: 54,
                borderRadius: 8,
                border: `1.5px solid ${isSelected ? typeColor ?? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected || (isToday && !entry) ? 'var(--accent-bg)' : entry ? typeBg : 'var(--surface)',
                cursor: 'pointer',
                padding: '5px 2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                opacity: !inProgram ? 0.28 : isPast && entry?.day.type === 'rest' ? 0.45 : isPast ? 0.65 : 1,
                transition: 'opacity 0.1s, border-color 0.1s',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                {dateNum}
              </span>
              {entry && (
                <>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: typeColor ?? 'var(--text-dim)', flexShrink: 0 }} />
                  {entry.day.type !== 'rest' && (
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: typeColor ?? 'var(--text-dim)', textAlign: 'center', lineHeight: 1.25, wordBreak: 'break-word', padding: '0 2px', maxWidth: '100%' }}>
                      {entry.day.label.split(' ').slice(0, 2).join(' ')}
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
          { label: 'Workout / Abs', color: 'var(--accent)' },
          { label: 'Warmup / Evening', color: 'var(--orange)' },
          { label: 'Morning', color: 'var(--green)' },
          { label: 'Rest', color: 'var(--text-dim)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedEntry && selectedKey && (
        <div style={{
          marginTop: 20,
          padding: '18px',
          background: TYPE_BG[selectedEntry.day.type] ?? 'var(--surface)',
          border: `1.5px solid ${TYPE_COLOR[selectedEntry.day.type] ?? 'var(--border)'}`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 3 }}>
                {new Date(selectedKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <p style={{ fontWeight: 800, fontSize: 17 }}>{selectedEntry.day.label}</p>
                {selectedEntry.day.duration !== '—' && (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{selectedEntry.day.duration}</span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: getPhaseInfo(selectedEntry.weekNum).color }}>
                Week {selectedEntry.weekNum} · {getPhaseInfo(selectedEntry.weekNum).label} Phase
              </span>
            </div>
            <button
              onClick={() => setSelectedKey(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-dim)', cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}
            >×</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selectedEntry.day.movements.map((m, i) => (
              <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weeks not yet generated notice */}
      {Object.keys(weekPlans).length < TOTAL_WEEKS && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          Weeks generate automatically as you progress. Navigate to <span style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }} onClick={() => router.push('/plan')}>Your Plan</span> to view or generate any week.
        </div>
      )}
    </div>
  )
}
