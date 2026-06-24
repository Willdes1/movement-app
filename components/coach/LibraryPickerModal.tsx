'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export type LibraryItem = {
  id: string
  name: string
  sets_reps: string | null
  rest_between_sets: string | null
  instructions: string | null
  video_type: 'youtube' | 'shorts' | 'upload' | null
}

// Browse + multi-select exercises from the coach's own library, then add them to
// a day in the program builder. Each picked item carries its saved sets×reps so
// the builder row autofills (e.g. "Incline DB Press 4×10").
export default function LibraryPickerModal({ coachId, onAdd, onClose }: {
  coachId: string
  onAdd: (items: LibraryItem[]) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('coach_exercise_library')
      .select('id, name, sets_reps, rest_between_sets, instructions, video_type')
      .eq('coach_id', coachId)
      .order('name', { ascending: true })
    setItems((data ?? []) as LibraryItem[])
    setLoading(false)
  }, [coachId])
  useEffect(() => { load() }, [load])

  const filtered = items.filter(i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  function confirm() {
    const chosen = items.filter(i => picked.has(i.id))
    if (chosen.length) onAdd(chosen)
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>📚 From Your Library</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Pick exercises to add to this day — your saved sets &amp; reps come with them.</p>
        </div>

        {/* Search */}
        {items.length > 0 && (
          <div style={{ padding: '12px 22px', flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your library…" autoFocus
              style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 12px' }}>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>Loading…</p>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', border: '2px dashed var(--border)', borderRadius: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Your library is empty</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>Add exercises (with videos, cues, and sets/reps) to your library, then pull them straight into any program.</p>
              <Link href="/coach/library" style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Go to Exercise Library →</Link>
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0' }}>No exercises match &quot;{search}&quot;</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(it => {
                const on = picked.has(it.id)
                return (
                  <button key={it.id} onClick={() => toggle(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-bg)' : 'var(--surface2)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{it.name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                        {it.sets_reps && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{it.sets_reps}</span>}
                        {it.rest_between_sets && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>· {it.rest_between_sets} rest</span>}
                      </div>
                    </div>
                    {it.video_type && <span title="Has video" style={{ fontSize: 13, flexShrink: 0 }}>{it.video_type === 'upload' ? '🎥' : '▶'}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{picked.size} selected</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirm} disabled={picked.size === 0} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: picked.size ? 'var(--accent)' : 'var(--surface2)', color: picked.size ? '#fff' : 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: picked.size ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                Add{picked.size ? ` ${picked.size}` : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
