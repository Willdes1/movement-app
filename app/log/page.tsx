'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type LogRow = {
  id: string
  exercise_normalized: string
  sets: number | null
  reps: number | null
  weight: number | null
  weight_unit: string
  logged_at: string
}

type GroupedDay = {
  date: string
  label: string
  logs: (LogRow & { name_display: string })[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function logSummary(log: LogRow): string {
  const parts: string[] = []
  if (log.sets) parts.push(`${log.sets} sets`)
  if (log.reps) parts.push(`× ${log.reps} reps`)
  if (log.weight) parts.push(`@ ${log.weight} ${log.weight_unit ?? 'lbs'}`)
  return parts.length > 0 ? parts.join(' ') : 'Logged'
}

export default function LogPage() {
  const { user, loading: authLoading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const router = useRouter()
  const [groups, setGroups] = useState<GroupedDay[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadLogs = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: logs }, { data: library }] = await Promise.all([
      supabase
        .from('workout_logs')
        .select('id, exercise_normalized, sets, reps, weight, weight_unit, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(300),
      supabase.from('exercise_library').select('name_normalized, name_display'),
    ])

    if (!logs?.length) { setLoading(false); return }

    const nameMap = new Map(library?.map(l => [l.name_normalized, l.name_display]) ?? [])

    // Group by calendar date
    const dayMap = new Map<string, (LogRow & { name_display: string })[]>()
    for (const log of logs) {
      const dateKey = new Date(log.logged_at).toDateString()
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, [])
      dayMap.get(dateKey)!.push({
        ...log,
        name_display: nameMap.get(log.exercise_normalized) ?? log.exercise_normalized.replace(/_/g, ' '),
      })
    }

    setGroups([...dayMap.entries()].map(([date, dayLogs]) => ({
      date,
      label: formatDate(dayLogs[0].logged_at),
      logs: dayLogs,
    })))
    setTotal(logs.length)
    setLoading(false)
  }, [user, userId])

  useEffect(() => { if (user) loadLogs() }, [user, loadLogs])

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading…</div>
  }

  return (
    <div className="page-content" style={{ paddingBottom: 100 }}>
      <div style={{ padding: '24px 16px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
          Workout History
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em' }}>
          Your Logs
        </h1>
        {total > 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            {total} sets logged across {groups.length} session{groups.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {groups.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>No logs yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Tap an exercise in your plan to log sets, reps, and weight. They&apos;ll show up here.
          </p>
        </div>
      )}

      <div style={{ padding: '8px 0' }}>
        {groups.map(group => (
          <div key={group.date} style={{ marginBottom: 8 }}>
            {/* Day header */}
            <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{group.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{group.logs.length} exercise{group.logs.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Log entries */}
            <div style={{ margin: '0 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {group.logs.map((log, i) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: i < group.logs.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, textTransform: 'capitalize' }}>
                      {log.name_display}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                      {logSummary(log)}
                    </p>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, marginLeft: 12 }}>
                    {formatTime(log.logged_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
