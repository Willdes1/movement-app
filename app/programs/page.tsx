'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Program = {
  id: string
  start_date: string
  created_at: string
  week_count: number
  is_current: boolean
}

function getPhase(week: number) {
  if (week <= 4) return 'Foundation'
  if (week <= 8) return 'Build'
  if (week <= 10) return 'Peak'
  return 'Maintenance'
}

function programLabel(prog: Program) {
  const start = new Date(prog.start_date)
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Program'
}

function programRange(prog: Program) {
  const start = new Date(prog.start_date)
  const end = new Date(start)
  end.setDate(end.getDate() + prog.week_count * 7 - 1)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ProgramsPage() {
  const { user, loading: authLoading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { data: progs } = await supabase
        .from('training_programs')
        .select('id, start_date, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!progs?.length) { setLoading(false); return }

      const { data: weekRows } = await supabase
        .from('weekly_plans')
        .select('program_id')
        .in('program_id', progs.map(p => p.id))

      const countMap: Record<string, number> = {}
      weekRows?.forEach(w => { countMap[w.program_id] = (countMap[w.program_id] ?? 0) + 1 })

      setPrograms(progs.map((p, i) => ({
        ...p,
        week_count: countMap[p.id] ?? 0,
        is_current: i === 0,
      })))
      setLoading(false)
    }
    load()
  }, [user, userId])

  if (authLoading || loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 20 }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Your Programs</h1>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>Every program you&apos;ve generated.</p>

      {programs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No programs yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>Generate your first program from the Home tab.</p>
          <button
            onClick={() => router.push('/today')}
            style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Go to Home →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {programs.map(prog => (
            <div
              key={prog.id}
              style={{
                padding: '16px 18px',
                background: prog.is_current ? 'var(--accent-bg)' : 'var(--surface)',
                border: `1.5px solid ${prog.is_current ? 'var(--accent-border)' : 'var(--border)'}`,
                borderRadius: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{programLabel(prog)}</p>
                    {prog.is_current && (
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                        Active
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{programRange(prog)}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                      {prog.week_count} / 13 weeks built
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                      {getPhase(Math.min(prog.week_count, 13))} Phase
                    </span>
                  </div>
                </div>
              </div>
              {prog.is_current && (
                <button
                  onClick={() => router.push('/plan')}
                  style={{ marginTop: 4, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'transparent', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                >
                  View Plan →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Full program switching coming soon. Programs auto-save every time you generate.
        </p>
      </div>
    </div>
  )
}
