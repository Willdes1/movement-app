'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Client {
  id: string
  name: string
  lastMessage: string | null
  lastAt: string | null
  unread: number
}

interface Msg {
  id: string
  sender_id: string
  content: string
  created_at: string
}

function timeLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)        return 'just now'
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000)    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dateDivider(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yest  = new Date(); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString())  return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function CoachMessagesPage() {
  const { user } = useAuth()

  const [clients, setClients]       = useState<Client[]>([])
  const [selected, setSelected]     = useState<Client | null>(null)
  const [messages, setMessages]     = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [showThread, setShowThread] = useState(false)  // mobile toggle

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const loadClients = useCallback(async () => {
    const { data: roster } = await supabase
      .from('coach_clients')
      .select('client_id, profiles!coach_clients_client_id_fkey(id, name)')
      .eq('coach_id', user!.id)
      .eq('status', 'active')

    if (!roster?.length) { setLoading(false); return }

    const clientIds = (roster as any[]).map(r => r.client_id)

    const { data: msgs } = await supabase
      .from('coach_messages')
      .select('client_id, sender_id, content, created_at, read_at')
      .eq('coach_id', user!.id)
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })

    const msgMap = new Map<string, { last: any; unread: number }>()
    for (const msg of (msgs ?? [])) {
      if (!msgMap.has(msg.client_id)) msgMap.set(msg.client_id, { last: msg, unread: 0 })
      if (!msg.read_at && msg.sender_id !== user!.id) msgMap.get(msg.client_id)!.unread++
    }

    const list: Client[] = (roster as any[]).map(r => {
      const profile = (r.profiles as { id: string; name: string }[] | null)?.[0]
      const m = msgMap.get(r.client_id)
      return {
        id:          r.client_id,
        name:        profile?.name ?? 'Unknown',
        lastMessage: m?.last?.content ?? null,
        lastAt:      m?.last?.created_at ?? null,
        unread:      m?.unread ?? 0,
      }
    }).sort((a, b) => {
      if (!a.lastAt && !b.lastAt) return a.name.localeCompare(b.name)
      if (!a.lastAt) return 1
      if (!b.lastAt) return -1
      return b.lastAt.localeCompare(a.lastAt)
    })

    setClients(list)
    setLoading(false)
  }, [user])

  useEffect(() => { if (user) loadClients() }, [user, loadClients])

  // Real-time: listen for new messages in coach's threads
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`coach_msgs_${user.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'coach_messages',
        filter: `coach_id=eq.${user.id}`,
      }, async (payload) => {
        const msg = payload.new as any
        if (selected?.id === msg.client_id) {
          setMessages(prev => [...prev, { id: msg.id, sender_id: msg.sender_id, content: msg.content, created_at: msg.created_at }])
          if (msg.sender_id !== user.id) {
            await supabase.from('coach_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id)
          }
        }
        loadClients()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, selected, loadClients])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function selectClient(client: Client) {
    setSelected(client)
    setShowThread(true)
    setThreadLoading(true)
    setMessages([])

    const { data } = await supabase
      .from('coach_messages')
      .select('id, sender_id, content, created_at')
      .eq('coach_id', user!.id)
      .eq('client_id', client.id)
      .order('created_at', { ascending: true })

    setMessages(data ?? [])
    setThreadLoading(false)

    // Mark incoming messages as read
    await supabase
      .from('coach_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('coach_id', user!.id)
      .eq('client_id', client.id)
      .is('read_at', null)
      .neq('sender_id', user!.id)

    setClients(prev => prev.map(c => c.id === client.id ? { ...c, unread: 0 } : c))
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function send() {
    if (!input.trim() || !selected || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    const { data, error } = await supabase
      .from('coach_messages')
      .insert({ coach_id: user!.id, client_id: selected.id, sender_id: user!.id, content })
      .select('id, sender_id, content, created_at')
      .single()

    if (!error && data) setMessages(prev => [...prev, data])
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Group messages by date for dividers
  function buildGroups(msgs: Msg[]) {
    const groups: { date: string; msgs: Msg[] }[] = []
    for (const msg of msgs) {
      const dateStr = new Date(msg.created_at).toDateString()
      const last = groups[groups.length - 1]
      if (last && last.date === dateStr) last.msgs.push(msg)
      else groups.push({ date: dateStr, msgs: [msg] })
    }
    return groups
  }

  const totalUnread = clients.reduce((s, c) => s + c.unread, 0)
  const groups      = buildGroups(messages)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── CLIENT LIST ──────────────────────────────────────────────────────── */}
      <div style={{
        width: 300, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        // On mobile, hide list when thread is showing
        ...(showThread ? { display: 'none' } : {}),
      }}
        className="coach-msg-list"
      >
        {/* Header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Coach Portal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Messages</h1>
            {totalUnread > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'var(--accent)', color: '#fff' }}>
                {totalUnread}
              </span>
            )}
          </div>
        </div>

        {/* Client list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-dim)' }}>Loading…</p>
          ) : clients.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>No clients yet</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Share your invite code to add clients. They'll appear here once they join.
              </p>
            </div>
          ) : clients.map(client => (
            <button
              key={client.id}
              onClick={() => selectClient(client)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px', border: 'none', textAlign: 'left', fontFamily: 'inherit',
                cursor: 'pointer',
                background: selected?.id === client.id ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'transparent',
                borderLeft: selected?.id === client.id ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, position: 'relative',
              }}>
                {initials(client.name)}
                {client.unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 9, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--surface)',
                  }}>
                    {client.unread > 9 ? '9+' : client.unread}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: client.unread > 0 ? 800 : 600, color: 'var(--text)' }}>
                    {client.name}
                  </span>
                  {client.lastAt && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                      {timeLabel(client.lastAt)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: client.unread > 0 ? 'var(--text)' : 'var(--text-dim)', fontWeight: client.unread > 0 ? 600 : 400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {client.lastMessage ?? 'No messages yet'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── THREAD PANEL ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Select a client to start messaging</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {/* Mobile back button */}
              <button
                onClick={() => { setShowThread(false); setSelected(null) }}
                className="coach-msg-back"
                style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '0 4px 0 0' }}
              >
                ←
              </button>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {initials(selected.name)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Client</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {threadLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, marginTop: 40 }}>Loading messages…</p>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: 60 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                  <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Start the conversation</p>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Send {selected.name} a message below.</p>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.date}>
                    {/* Date divider */}
                    <div style={{ textAlign: 'center', margin: '16px 0 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
                        {dateDivider(group.msgs[0].created_at)}
                      </span>
                    </div>

                    {group.msgs.map((msg, i) => {
                      const isCoach  = msg.sender_id === user?.id
                      const showTime = i === group.msgs.length - 1 || group.msgs[i + 1].sender_id !== msg.sender_id
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isCoach ? 'flex-end' : 'flex-start', marginBottom: showTime ? 8 : 2 }}>
                          <div style={{ maxWidth: '70%' }}>
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: isCoach ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              background: isCoach ? 'var(--accent)' : 'var(--surface2)',
                              color: isCoach ? '#fff' : 'var(--text)',
                              fontSize: 14, lineHeight: 1.5,
                              border: isCoach ? 'none' : '1px solid var(--border)',
                            }}>
                              {msg.content}
                            </div>
                            {showTime && (
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: isCoach ? 'right' : 'left', paddingInline: 4 }}>
                                {msgTime(msg.created_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Message ${selected.name}…`}
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 20,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
                  resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: input.trim() && !sending ? 'var(--accent)' : 'var(--surface2)',
                  color: input.trim() && !sending ? '#fff' : 'var(--text-dim)',
                  fontSize: 16, cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                ↑
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
