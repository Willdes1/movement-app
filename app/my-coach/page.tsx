'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached, type CoachLibEntry } from '@/contexts/CoachedContext'

type CoachProgramItem = { assignmentId: string; status: string; isActive: boolean; programName: string | null; weeksTotal: number; resumeWeek: number | null; startDate: string }

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

// Matches CoachedSessionCard / my-program normalization so movements line up with
// the coach's library keys.
function normalizeExName(raw: string) {
  return raw.toLowerCase()
    .replace(/\s+\d+[×x]\d+.*/i, '').replace(/\s+\d+\s+sets?.*/i, '').trim()
    .replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

function weekProgress(startDate: string, total: number): number {
  const week = currentProgramWeek(startDate, total)
  return Math.round((week / total) * 100)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ChatMsg {
  id: string
  sender_id: string
  content: string
  created_at: string
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function dateDivider(iso: string) {
  const d = new Date(iso)
  const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString())  return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function MyCoachInner() {
  const { user } = useAuth()
  const router   = useRouter()
  const searchParams = useSearchParams()

  // Deep link support: /my-coach?tab=messages&draft=<starter text>
  const [tab, setTab]               = useState<'program' | 'messages'>(searchParams.get('tab') === 'messages' ? 'messages' : 'program')
  const [program, setProgram]       = useState<Program | null>(null)
  const [weeks, setWeeks]           = useState<Week[]>([])
  const [assignment, setAssignment] = useState<AssignmentData | null>(null)
  const [coachName, setCoachName]   = useState<string>('')
  const [coachId, setCoachId]       = useState<string | null>(null)
  const [coachLibrary, setCoachLibrary] = useState<Record<string, CoachLibEntry>>({})
  const [coachPrograms, setCoachPrograms] = useState<CoachProgramItem[]>([])
  const [switching, setSwitching]   = useState<string | null>(null)
  const { refresh: refreshCoached } = useCoached()
  const [loading, setLoading]       = useState(true)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())
  const [expandedDays, setExpandedDays]   = useState<Set<string>>(new Set())

  // Messages state
  const [chatMsgs, setChatMsgs]     = useState<ChatMsg[]>([])
  const [chatInput, setChatInput]   = useState(searchParams.get('draft') ?? '')
  const [chatSending, setChatSending] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [unread, setUnread]         = useState(0)
  const chatBottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => { if (user) load() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const res = await fetch('/api/coach/my-program', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    setCoachPrograms(data.coachPrograms ?? [])

    if (data.assignment) {
      setAssignment(data.assignment)
      setProgram(data.program)
      setWeeks(data.weeks)
      setCoachName(data.coachName)
      setCoachId(data.coachId ?? null)
      setCoachLibrary(data.coachLibrary ?? {})

      // Auto-expand current week
      const currWeek = currentProgramWeek(data.assignment.start_date, data.program?.weeks_total ?? 1)
      setExpandedWeeks(new Set([currWeek]))

      // Auto-expand today's day within the current week
      setExpandedDays(new Set([`${currWeek}-${todayDayName()}`]))
    }

    setLoading(false)
  }

  // Switch / resume / restart a coach program, then refresh the app-wide coached state.
  async function switchProgram(assignmentId: string, mode: 'resume' | 'fresh') {
    setSwitching(assignmentId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/coach/activate-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ assignmentId, mode }),
    })
    await load()
    refreshCoached()
    setSwitching(null)
  }

  // Load messages when Messages tab is opened
  useEffect(() => {
    if (tab === 'messages' && coachId && user) loadChat()
  }, [tab, coachId, user])  // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: receive coach messages
  useEffect(() => {
    if (!user || !coachId) return
    const channel = supabase
      .channel(`client_msgs_${user.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'coach_messages',
        filter: `client_id=eq.${user.id}`,
      }, async (payload) => {
        const msg = payload.new as any
        if (tab === 'messages') {
          setChatMsgs(prev => [...prev, { id: msg.id, sender_id: msg.sender_id, content: msg.content, created_at: msg.created_at }])
          await supabase.from('coach_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id)
        } else {
          setUnread(prev => prev + 1)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, coachId, tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs])

  async function loadChat() {
    if (!user || !coachId) return
    setChatLoading(true)
    const { data } = await supabase
      .from('coach_messages')
      .select('id, sender_id, content, created_at')
      .eq('coach_id', coachId)
      .eq('client_id', user.id)
      .order('created_at', { ascending: true })
    setChatMsgs(data ?? [])
    setChatLoading(false)
    setUnread(0)
    // Mark as read
    await supabase
      .from('coach_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('coach_id', coachId)
      .eq('client_id', user.id)
      .is('read_at', null)
      .neq('sender_id', user.id)
  }

  async function sendChat() {
    if (!chatInput.trim() || !user || !coachId || chatSending) return
    const content = chatInput.trim()
    setChatInput('')
    setChatSending(true)
    const { data, error } = await supabase
      .from('coach_messages')
      .insert({ coach_id: coachId, client_id: user.id, sender_id: user.id, content })
      .select('id, sender_id, content, created_at')
      .single()
    if (!error && data) setChatMsgs(prev => [...prev, data])
    setChatSending(false)
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

  // Subtle marker when the coach has their own demo/cues for this exercise.
  function coachBadge(m: string) {
    const c = coachLibrary[normalizeExName(m)]
    if (!c || !(c.video_type || c.instructions || c.notes)) return null
    return (
      <span title={`Coach ${coachName.split(' ')[0] || ''} added a demo & cues — watch it on your Today workout`} style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {c.video_type ? '🎥 ' : ''}★ Coach
      </span>
    )
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

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {([['program', '📋 Program'], ['messages', '💬 Messages']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setTab(id); if (id === 'messages') setUnread(0) }}
            style={{
              padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
              border: `1px solid ${tab === id ? 'var(--accent-border, rgba(59,130,246,0.3))' : 'var(--border)'}`,
              background: tab === id ? 'rgba(59,130,246,0.1)' : 'transparent',
              color: tab === id ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 13, fontWeight: tab === id ? 700 : 500, cursor: 'pointer',
              position: 'relative',
            }}
          >
            {label}
            {id === 'messages' && unread > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── MESSAGES TAB ──────────────────────────────────────────────────────── */}
      {tab === 'messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 400 }}>
          {!coachId ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🏋️</div>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No coach connected</p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>Enter your coach's invite code in Account settings to connect.</p>
              <button onClick={() => router.push('/account')} style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Go to Account
              </button>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '0 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                  {coachName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{coachName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Your Coach</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8 }}>
                {chatLoading ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, marginTop: 40 }}>Loading…</p>
                ) : chatMsgs.length === 0 ? (
                  <div style={{ textAlign: 'center', marginTop: 60 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Say hello to {coachName}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Send your coach a message below.</p>
                  </div>
                ) : (() => {
                  // Group by date
                  const groups: { date: string; msgs: ChatMsg[] }[] = []
                  for (const msg of chatMsgs) {
                    const ds = new Date(msg.created_at).toDateString()
                    const last = groups[groups.length - 1]
                    if (last && last.date === ds) last.msgs.push(msg)
                    else groups.push({ date: ds, msgs: [msg] })
                  }
                  return groups.map(group => (
                    <div key={group.date}>
                      <div style={{ textAlign: 'center', margin: '14px 0 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
                          {dateDivider(group.msgs[0].created_at)}
                        </span>
                      </div>
                      {group.msgs.map((msg, i) => {
                        const isMe    = msg.sender_id === user?.id
                        const showTime = i === group.msgs.length - 1 || group.msgs[i + 1].sender_id !== msg.sender_id
                        return (
                          <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: showTime ? 8 : 2 }}>
                            <div style={{ maxWidth: '75%' }}>
                              <div style={{ padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? 'var(--accent)' : 'var(--surface2)', color: isMe ? '#fff' : 'var(--text)', fontSize: 14, lineHeight: 1.5, border: isMe ? 'none' : '1px solid var(--border)' }}>
                                {msg.content}
                              </div>
                              {showTime && (
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: isMe ? 'right' : 'left', paddingInline: 4 }}>
                                  {msgTime(msg.created_at)}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}
                <div ref={chatBottomRef} />
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder={`Message ${coachName}…`}
                  rows={1}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 100) + 'px' }}
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatSending}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0, background: chatInput.trim() && !chatSending ? 'var(--accent)' : 'var(--surface2)', color: chatInput.trim() && !chatSending ? '#fff' : 'var(--text-dim)', fontSize: 16, cursor: chatInput.trim() && !chatSending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ↑
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PROGRAM TAB ───────────────────────────────────────────────────────── */}
      {tab === 'program' && <>

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

      {/* My Coach Programs — switch / resume / restart (Chunk 5b) */}
      {coachPrograms.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            My Coach Programs
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coachPrograms.map(cp => {
              const busy = switching === cp.assignmentId
              return (
                <div key={cp.assignmentId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: cp.isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface2)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.programName ?? 'Program'}</div>
                    <div style={{ fontSize: 11, color: cp.isActive ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 600 }}>
                      {cp.isActive ? '▶ Active now' : cp.resumeWeek && cp.resumeWeek > 1 ? `Paused at Week ${cp.resumeWeek}` : 'Not started'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {cp.isActive ? (
                      <button onClick={() => { if (confirm('Restart this program from Day 1? Your logged sets/PRs are kept — only the calendar resets.')) switchProgram(cp.assignmentId, 'fresh') }} disabled={busy}
                        style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-mid)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {busy ? '…' : '↺ Restart'}
                      </button>
                    ) : (
                      <>
                        {cp.resumeWeek && cp.resumeWeek > 1 && (
                          <button onClick={() => switchProgram(cp.assignmentId, 'resume')} disabled={busy}
                            style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {busy ? '…' : `Resume · Wk ${cp.resumeWeek}`}
                          </button>
                        )}
                        <button onClick={() => switchProgram(cp.assignmentId, 'fresh')} disabled={busy}
                          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--accent)', background: (cp.resumeWeek && cp.resumeWeek > 1) ? 'transparent' : 'var(--accent)', color: (cp.resumeWeek && cp.resumeWeek > 1) ? 'var(--accent)' : '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {busy ? '…' : 'Start Fresh'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {coachPrograms.length === 1 && coachPrograms[0].isActive && (
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
              When your coach assigns another program, it'll appear here to switch to — your progress on each is saved.
            </p>
          )}
        </div>
      )}

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
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 9 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m}</span>
                {coachBadge(m)}
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
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m}</span>
                                {coachBadge(m)}
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

      </>}
    </div>
  )
}

export default function MyCoachPage() {
  return (
    <Suspense fallback={<div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Loading…</div>}>
      <MyCoachInner />
    </Suspense>
  )
}
