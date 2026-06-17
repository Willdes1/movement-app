'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)', greenBorder: 'rgba(34,197,94,0.25)',
  red: '#ef4444', amber: '#f59e0b',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type Subscriber = { id: string; user_id: string; endpoint: string; created_at: string; name?: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: C.bg,
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
}

export default function PushTab() {
  const [subs, setSubs]       = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [url, setUrl]         = useState('/today')
  const [target, setTarget]   = useState<'all' | 'user'>('all')
  const [targetId, setTargetId] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => { loadSubs() }, [])

  async function loadSubs() {
    setLoading(true)
    const { data: subData } = await supabase.from('push_subscriptions').select('id, user_id, endpoint, created_at')
    const userIds = [...new Set((subData ?? []).map((s: Subscriber) => s.user_id))]
    let nameMap: Record<string, string> = {}
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds)
      nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name ?? p.id.slice(0, 8)]))
    }
    setSubs((subData ?? []).map((s: Subscriber) => ({ ...s, name: nameMap[s.user_id] ?? s.user_id.slice(0, 8) })))
    setLoading(false)
  }

  async function send() {
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return }
    setSending(true); setResult(null); setError(null)
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || '/today',
          ...(target === 'user' && targetId ? { userId: targetId } : {}),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      await loadSubs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const row = (label: string, val: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ width: 80, fontSize: 12, color: C.textDim, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{val}</div>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Push Notifications</h2>
      <p style={{ fontSize: 13, color: C.textDim, marginBottom: 24 }}>
        Send workout reminders or custom messages to subscribed users.
      </p>

      {/* Subscriber count */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <div style={{ padding: '14px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{loading ? '–' : subs.length}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Subscribed devices</div>
        </div>
        <div style={{ padding: '14px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>
            {loading ? '–' : new Set(subs.map(s => s.user_id)).size}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Unique users</div>
        </div>
      </div>

      {/* Compose */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Compose Notification</div>

        {row('Title', <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Atlas Prime — Today's workout is ready" style={inputStyle} />)}
        {row('Body', <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Your AI coach has planned today's session. Tap to see it." rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />)}
        {row('URL', <input value={url} onChange={e => setUrl(e.target.value)} placeholder="/today" style={inputStyle} />)}
        {row('Send to', (
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'user'] as const).map(t => (
              <button key={t} onClick={() => setTarget(t)} style={{
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: target === t ? 700 : 500,
                border: `1px solid ${target === t ? C.accent : C.border}`,
                background: target === t ? C.accentDim : 'transparent',
                color: target === t ? C.accent : C.textMid,
              }}>
                {t === 'all' ? 'All subscribers' : 'Specific user'}
              </button>
            ))}
          </div>
        ))}

        {target === 'user' && row('User ID', (
          <input value={targetId} onChange={e => setTargetId(e.target.value)} placeholder="Paste user UUID" style={inputStyle} />
        ))}

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ padding: '10px 14px', background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 13, color: C.green, marginBottom: 12 }}>
            ✓ Sent to {result.sent}/{result.total} devices{result.failed > 0 ? ` (${result.failed} expired, cleaned up)` : ''}
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !title.trim() || !body.trim()}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: sending || !title.trim() || !body.trim() ? C.surface2 : C.accent,
            color: sending || !title.trim() || !body.trim() ? C.textDim : '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {sending ? 'Sending…' : '▶ Send notification'}
        </button>
      </div>

      {/* Subscriber list */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>Subscribers</div>
        {loading ? (
          <div style={{ color: C.textDim, fontSize: 13 }}>Loading…</div>
        ) : subs.length === 0 ? (
          <div style={{ color: C.textDim, fontSize: 13 }}>No subscribers yet. Users will appear here after enabling notifications.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subs.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.surface2, borderRadius: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.endpoint.slice(0, 60)}…</div>
                </div>
                <div style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
