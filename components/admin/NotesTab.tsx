'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', amber: '#f59e0b',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

interface NoteRow {
  id: string
  admin_id: string
  user_id: string | null
  title: string | null
  body: string
  is_visible_to_user: boolean
  created_at: string
  updated_at: string
}

type UserRef = { id: string; name: string | null }

const SETUP_SQL = `-- Run once in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS admin_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id            uuid NOT NULL,
  user_id             uuid,
  title               text,
  body                text NOT NULL,
  is_visible_to_user  boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_notes_all" ON admin_notes FOR ALL TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));`

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function NotesTab({ currentAdminId, users }: { currentAdminId: string; users: UserRef[] }) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [filter, setFilter] = useState<'all' | 'platform' | 'user'>('all')
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', user_id: '', type: 'platform' as 'platform' | 'user' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  async function loadNotes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('admin_notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01' || error.message.toLowerCase().includes('does not exist')) {
        setNeedsSetup(true)
      }
    } else {
      setNotes(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadNotes() }, [])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function saveNote() {
    if (!form.body.trim()) return
    setSaving(true)
    const { error } = await supabase.from('admin_notes').insert({
      admin_id: currentAdminId,
      user_id: form.type === 'user' && form.user_id ? form.user_id : null,
      title: form.title.trim() || null,
      body: form.body.trim(),
      is_visible_to_user: false,
    })
    if (!error) {
      setComposing(false)
      setForm({ title: '', body: '', user_id: '', type: 'platform' })
      flash('Note saved')
      await loadNotes()
    } else {
      flash('Failed to save note')
    }
    setSaving(false)
  }

  async function deleteNote(id: string) {
    await supabase.from('admin_notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const userMap = new Map(users.map(u => [u.id, u.name ?? 'Unknown User']))

  const filtered = notes.filter(n => {
    if (filter === 'platform') return n.user_id === null
    if (filter === 'user') return n.user_id !== null
    return true
  })

  const platformCount = notes.filter(n => n.user_id === null).length
  const userCount = notes.filter(n => n.user_id !== null).length

  function copySQL() {
    navigator.clipboard.writeText(SETUP_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (needsSetup) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 16 }}>Admin Notes</h2>
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '20px 24px', maxWidth: 680 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 8 }}>⚠ One-time setup required</p>
          <p style={{ fontSize: 13, color: C.textMid, marginBottom: 16, lineHeight: 1.6 }}>
            Run the following SQL in your <strong style={{ color: C.text }}>Supabase SQL Editor</strong>, then refresh this page:
          </p>
          <div style={{ position: 'relative' }}>
            <pre style={{ fontSize: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', color: C.textMid, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>
              {SETUP_SQL}
            </pre>
            <button
              onClick={copySQL}
              style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inp: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Admin Notes</h2>
          <p style={{ fontSize: 13, color: C.textDim }}>{platformCount} platform · {userCount} user notes</p>
        </div>
        <button
          onClick={() => setComposing(o => !o)}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          + New Note
        </button>
      </div>

      {/* Flash */}
      {msg && (
        <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 13, color: C.green, marginBottom: 16, fontFamily: 'monospace' }}>
          {msg}
        </div>
      )}

      {/* Compose */}
      {composing && (
        <div style={{ background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>New Note</p>

          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['platform', 'user'] as const).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t, user_id: '' }))}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontWeight: 600, fontSize: 12,
                  border: form.type === t ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: form.type === t ? C.accentDim : 'transparent',
                  color: form.type === t ? C.accent : C.textMid,
                  cursor: 'pointer',
                }}
              >
                {t === 'platform' ? '📋 Platform Note' : '👤 User Note'}
              </button>
            ))}
          </div>

          {/* User selector (if user note) */}
          {form.type === 'user' && (
            <div style={{ marginBottom: 14 }}>
              <select
                value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                style={{ ...inp, width: '100%' }}
              >
                <option value="">— Select a user —</option>
                {users.filter(u => u.name).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Title (optional)"
              style={{ ...inp, width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your note…"
              rows={4}
              style={{ ...inp, width: '100%', resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setComposing(false)} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'none', color: C.textMid, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveNote} disabled={saving || !form.body.trim()} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'platform', 'user'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === f ? C.accentBorder : C.border}`,
              background: filter === f ? C.accentDim : 'transparent',
              color: filter === f ? C.accent : C.textMid,
              fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
            }}
          >
            {f === 'all' ? `All (${notes.length})` : f === 'platform' ? `Platform (${platformCount})` : `User Notes (${userCount})`}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {loading ? (
        <p style={{ fontSize: 13, color: C.textDim, padding: '32px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading notes…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', border: `2px dashed ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8 }}>No notes here yet</div>
          <div style={{ fontSize: 11, color: C.textDim }}>Click + New Note to add one</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(note => (
            <div key={note.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: note.user_id ? 'rgba(59,130,246,0.12)' : 'rgba(110,118,129,0.1)', color: note.user_id ? C.accent : C.textDim }}>
                    {note.user_id ? 'User Note' : 'Platform'}
                  </span>
                  {note.user_id && (
                    <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
                      {userMap.get(note.user_id) ?? note.user_id.slice(0, 12) + '…'}
                    </span>
                  )}
                  {note.title && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{note.title}</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{note.body}</p>
                <p style={{ fontSize: 10, color: C.textDim, marginTop: 8, fontFamily: 'monospace' }}>{fmtDate(note.created_at)}</p>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 14, padding: '0 4px', height: 'fit-content', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
