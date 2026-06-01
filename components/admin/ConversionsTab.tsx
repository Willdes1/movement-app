'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ConversionRequest = {
  id: string
  user_id: string
  file_name: string
  storage_path: string
  description: string | null
  status: 'pending' | 'in_review' | 'completed' | 'rejected'
  admin_notes: string | null
  created_at: string
  user_name?: string
  user_email?: string
}

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending',   color: '#f59e0b' },
  { value: 'in_review', label: 'In Review', color: '#3b82f6' },
  { value: 'completed', label: 'Completed', color: '#22c55e' },
  { value: 'rejected',  label: 'Rejected',  color: '#6b7280' },
]

export default function ConversionsTab() {
  const [requests, setRequests] = useState<ConversionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const C = {
    bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
    accent: '#3b82f6', green: '#22c55e', amber: '#f59e0b',
    text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('plan_conversion_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Enrich with user profiles
    const userIds = [...new Set(data.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds)

    const profileMap: Record<string, { name: string; email: string }> = {}
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? '', email: p.email ?? '' } })

    setRequests(data.map(r => ({
      ...r,
      user_name: profileMap[r.user_id]?.name ?? '',
      user_email: profileMap[r.user_id]?.email ?? '',
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveEdit(id: string) {
    setSaving(true)
    await supabase
      .from('plan_conversion_requests')
      .update({
        status: editStatus,
        admin_notes: editNotes || null,
        updated_at: new Date().toISOString(),
        completed_at: editStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', id)
    setSaving(false)
    setEditId(null)
    await load()
  }

  function startEdit(req: ConversionRequest) {
    setEditId(req.id)
    setEditStatus(req.status)
    setEditNotes(req.admin_notes ?? '')
  }

  async function getDownloadUrl(storagePath: string) {
    const { data } = await supabase.storage.from('user-uploads').createSignedUrl(storagePath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.surface2,
    color: C.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Plan Conversions</h2>
          <p style={{ fontSize: 13, color: C.textDim }}>Users who submitted workout PDFs for in-app conversion</p>
        </div>
        {pendingCount > 0 && (
          <div style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, fontWeight: 700, color: C.amber }}>
            {pendingCount} pending
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS].map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: filter === opt.value ? 700 : 400,
              border: `1px solid ${filter === opt.value ? C.accent : C.border}`,
              background: filter === opt.value ? 'rgba(59,130,246,0.12)' : C.surface2,
              color: filter === opt.value ? C.accent : C.textDim,
              cursor: 'pointer',
            }}
          >
            {opt.label}
            {opt.value === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: C.textDim, textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.textDim }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No conversion requests{filter !== 'all' ? ` with status "${filter}"` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(req => {
            const statusInfo = STATUS_OPTIONS.find(s => s.value === req.status)
            const isEditing = editId === req.id

            return (
              <div key={req.id} style={{ padding: '16px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>📄 {req.file_name}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusInfo?.color, background: `${statusInfo?.color}20`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${statusInfo?.color}40` }}>
                        {statusInfo?.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: C.textDim }}>
                      {req.user_name || 'Unknown'} · {req.user_email || req.user_id.slice(0, 8)}
                      <span style={{ marginLeft: 10 }}>·</span>
                      <span style={{ marginLeft: 10 }}>{new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => getDownloadUrl(req.storage_path)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.textMid, fontSize: 12, cursor: 'pointer' }}
                    >
                      Download ↓
                    </button>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(req)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.accent}40`, background: 'rgba(59,130,246,0.1)', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {req.description && (
                  <div style={{ padding: '10px 12px', background: C.surface2, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{req.description}</p>
                  </div>
                )}

                {/* Admin notes (read) */}
                {req.admin_notes && !isEditing && (
                  <div style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Note to User</p>
                    <p style={{ fontSize: 12, color: C.textMid }}>{req.admin_notes}</p>
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setEditStatus(opt.value)}
                            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: editStatus === opt.value ? 700 : 400, border: `1px solid ${editStatus === opt.value ? opt.color : C.border}`, background: editStatus === opt.value ? `${opt.color}20` : C.surface2, color: editStatus === opt.value ? opt.color : C.textDim, cursor: 'pointer' }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Note to User (optional)</p>
                      <textarea
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="e.g. 'Your plan has been converted and is in your Programs library!'"
                        rows={2}
                        style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditId(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(req.id)} disabled={saving} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: saving ? C.surface2 : C.accent, color: saving ? C.textDim : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
