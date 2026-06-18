'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── PALETTE (matches the admin portal) ───────────────────────────────────────
const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)',
  red: '#ef4444', purple: '#a78bfa',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

// ─── TAXONOMY (ids MUST match server DOMAIN_LABELS) ───────────────────────────
const DOMAINS: { id: string; label: string; color: string }[] = [
  { id: 'strength_training',    label: 'Strength Training',     color: C.accent },
  { id: 'exercise_physiology',  label: 'Exercise Physiology',   color: C.green },
  { id: 'biomechanics',         label: 'Biomechanics',          color: C.purple },
  { id: 'rehab',                label: 'PT / Rehab',            color: '#2dd4bf' },
  { id: 'athletic_performance', label: 'Athletic Performance',  color: C.amber },
  { id: 'nutrition',            label: 'Nutrition',             color: '#f472b6' },
  { id: 'program_design',       label: 'Program Design',        color: '#60a5fa' },
  { id: 'general',              label: 'General',               color: C.textDim },
]
const domainMeta = (id: string) => DOMAINS.find(d => d.id === id) ?? DOMAINS[DOMAINS.length - 1]

const FORMATS: { id: string; label: string; hint: string }[] = [
  { id: 'mixed',      label: 'Full Study Unit', hint: 'Summary + concepts + quiz + flashcards' },
  { id: 'concept',    label: 'Concepts',        hint: 'Deep conceptual teaching' },
  { id: 'summary',    label: 'Summary',         hint: 'High-yield recap + key points' },
  { id: 'quiz',       label: 'Quiz',            hint: 'Exam-style multiple choice' },
  { id: 'flashcards', label: 'Flashcards',      hint: 'Active-recall deck' },
]

// ─── TYPES ────────────────────────────────────────────────────────────────────
type KB = {
  id: string; title: string; domain: string; description: string | null
  scope_prompt: string | null; cert_goal: string; target_units: number
  created_at: string; updated_at: string; entry_count: number; mastered_count: number
}
type Concept = { term: string; explanation: string }
type QuizItem = { question: string; options: string[]; answer_index: number; explanation?: string }
type Flashcard = { front: string; back: string }
type EntryContent = { summary?: string; key_points?: string[]; concepts?: Concept[]; quiz?: QuizItem[]; flashcards?: Flashcard[] }
type Entry = {
  id: string; kb_id: string; title: string; topic: string | null; format: string
  content: EntryContent; body_md: string | null; tags: string[]; status: string
  version: number; created_at: string; updated_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

async function authFetch(input: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init?.headers ?? {}) },
  })
}

// ─── KB CREATE / EDIT MODAL ───────────────────────────────────────────────────
function KbModal({ kb, onSave, onClose }: { kb: KB | null; onSave: (form: Partial<KB>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(kb?.title ?? '')
  const [domain, setDomain] = useState(kb?.domain ?? 'strength_training')
  const [description, setDescription] = useState(kb?.description ?? '')
  const [scopePrompt, setScopePrompt] = useState(kb?.scope_prompt ?? '')
  const [certGoal, setCertGoal] = useState(kb?.cert_goal ?? 'ISSA CFT')
  const [targetUnits, setTargetUnits] = useState(String(kb?.target_units ?? 25))

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 5 }
  const field: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{kb ? 'Edit Knowledge Base' : 'New Knowledge Base'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>Title <span style={{ color: C.red }}>*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Resistance Training Foundations" style={field} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Domain</label>
              <select value={domain} onChange={e => setDomain(e.target.value)} style={field}>
                {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Certification Goal</label>
              <input value={certGoal} onChange={e => setCertGoal(e.target.value)} placeholder="ISSA CFT" style={field} />
            </div>
          </div>
          <div>
            <label style={label}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this knowledge base covers" style={field} />
          </div>
          <div>
            <label style={label}>Scoped Context / System Prompt <span style={{ fontWeight: 400 }}>(keeps the tutor focused on this subject)</span></label>
            <textarea value={scopePrompt} onChange={e => setScopePrompt(e.target.value)} rows={3} placeholder="e.g. Stay focused on barbell & dumbbell resistance training mechanics, programming variables, and safe loading progressions for general-population clients." style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div style={{ width: 160 }}>
            <label style={label}>Goal: # study units</label>
            <input type="number" min={1} value={targetUnits} onChange={e => setTargetUnits(e.target.value)} style={field} />
          </div>
          <button
            onClick={() => { if (title.trim()) onSave({ title: title.trim(), domain, description: description.trim(), scope_prompt: scopePrompt.trim(), cert_goal: certGoal.trim() || 'ISSA CFT', target_units: parseInt(targetUnits) || 25 }) }}
            disabled={!title.trim()}
            style={{ padding: '11px', borderRadius: 9, border: 'none', background: title.trim() ? C.accent : C.surface2, color: title.trim() ? '#fff' : C.textDim, fontSize: 14, fontWeight: 700, cursor: title.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
          >
            {kb ? 'Save Changes' : 'Create Knowledge Base'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ENTRY CARD (expandable, renders structured content) ──────────────────────
function EntryCard({ entry, onSetStatus, onDelete }: {
  entry: Entry
  onSetStatus: (e: Entry, status: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const c = entry.content ?? {}
  const fmt = FORMATS.find(f => f.id === entry.format)
  const mastered = entry.status === 'mastered'

  const toggle = (set: Set<number>, i: number, fn: (s: Set<number>) => void) => {
    const n = new Set(set); n.has(i) ? n.delete(i) : n.add(i); fn(n)
  }

  return (
    <div style={{ border: `1px solid ${mastered ? 'rgba(34,197,94,0.35)' : C.border}`, borderRadius: 12, background: C.surface, overflow: 'hidden' }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, background: C.accentDim, color: C.accent }}>{fmt?.label ?? entry.format}</span>
            {mastered && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, background: C.greenDim, color: C.green }}>✓ Mastered</span>}
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>v{entry.version} · {fmtDate(entry.created_at)}</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{entry.title}</p>
          {entry.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {entry.tags.map(t => <span key={t} style={{ fontSize: 10, color: C.textDim, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1px 8px' }}>#{t}</span>)}
            </div>
          )}
        </div>
        <span style={{ fontSize: 12, color: C.textDim, flexShrink: 0, marginTop: 2 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {c.summary && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>Summary</p>
              <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7 }}>{c.summary}</p>
            </div>
          )}

          {!!c.key_points?.length && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>Key Points</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {c.key_points.map((k, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: C.accent, fontSize: 9, marginTop: 5 }}>●</span>
                    <span style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!c.concepts?.length && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>Concepts</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.concepts.map((co, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{co.term}</p>
                    <p style={{ fontSize: 12.5, color: C.textMid, lineHeight: 1.65 }}>{co.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!c.quiz?.length && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>Quiz</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {c.quiz.map((q, i) => {
                  const show = revealed.has(i)
                  return (
                    <div key={i} style={{ padding: '12px 14px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{i + 1}. {q.question}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {(q.options ?? []).map((o, j) => {
                          const correct = show && j === q.answer_index
                          return (
                            <div key={j} style={{ fontSize: 12.5, color: correct ? C.green : C.textMid, fontWeight: correct ? 700 : 400, padding: '5px 9px', borderRadius: 6, background: correct ? C.greenDim : 'transparent', border: `1px solid ${correct ? 'rgba(34,197,94,0.3)' : 'transparent'}` }}>
                              {String.fromCharCode(65 + j)}) {o}{correct ? '  ✓' : ''}
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => toggle(revealed, i, setRevealed)} style={{ marginTop: 8, fontSize: 11, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                        {show ? '▲ Hide answer' : '▼ Reveal answer'}
                      </button>
                      {show && q.explanation && <p style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic', marginTop: 6, lineHeight: 1.6 }}>{q.explanation}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!!c.flashcards?.length && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 8 }}>Flashcards <span style={{ fontWeight: 400, textTransform: 'none' }}>(tap to flip)</span></p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {c.flashcards.map((f, i) => {
                  const flip = flipped.has(i)
                  return (
                    <div key={i} onClick={() => toggle(flipped, i, setFlipped)} style={{ minHeight: 76, padding: '12px 14px', background: flip ? C.accentDim : C.surface2, border: `1px solid ${flip ? C.accentBorder : C.border}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      <span style={{ fontSize: 12.5, color: flip ? C.text : C.textMid, fontWeight: flip ? 500 : 700, lineHeight: 1.5 }}>{flip ? f.back : f.front}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: `1px solid ${C.border}`, marginTop: 2 }}>
            <button onClick={() => onSetStatus(entry, mastered ? 'active' : 'mastered')} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${mastered ? C.border : 'rgba(34,197,94,0.35)'}`, background: mastered ? 'transparent' : C.greenDim, color: mastered ? C.textDim : C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }}>
              {mastered ? '↩ Mark Active' : '✓ Mark Mastered'}
            </button>
            <button onClick={() => onDelete(entry.id)} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid rgba(239,68,68,0.25)`, background: 'transparent', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function StudyHubTab() {
  const [kbs, setKbs] = useState<KB[]>([])
  const [loadingKbs, setLoadingKbs] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  const [showKbModal, setShowKbModal] = useState(false)
  const [editingKb, setEditingKb] = useState<KB | null>(null)

  // Generation panel
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState('mixed')
  const [instructions, setInstructions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  // Filters
  const [filter, setFilter] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const selected = kbs.find(k => k.id === selectedId) ?? null

  const loadKbs = useCallback(async () => {
    setLoadingKbs(true)
    try {
      const res = await authFetch('/api/admin/study/kbs')
      const data = await res.json()
      if (res.ok) setKbs(data.kbs ?? [])
    } finally { setLoadingKbs(false) }
  }, [])

  const loadEntries = useCallback(async (kbId: string) => {
    setLoadingEntries(true)
    try {
      const res = await authFetch(`/api/admin/study/entries?kbId=${kbId}`)
      const data = await res.json()
      if (res.ok) setEntries(data.entries ?? [])
    } finally { setLoadingEntries(false) }
  }, [])

  useEffect(() => { loadKbs() }, [loadKbs])
  useEffect(() => { if (selectedId) { loadEntries(selectedId); setFilter(''); setTagFilter(null) } }, [selectedId, loadEntries])

  async function saveKb(form: Partial<KB>) {
    if (editingKb) {
      await authFetch('/api/admin/study/kbs', { method: 'PATCH', body: JSON.stringify({ id: editingKb.id, ...form }) })
    } else {
      await authFetch('/api/admin/study/kbs', { method: 'POST', body: JSON.stringify(form) })
    }
    setShowKbModal(false); setEditingKb(null)
    await loadKbs()
  }

  async function deleteKb(id: string) {
    if (!confirm('Delete this knowledge base and all its study material? This cannot be undone.')) return
    await authFetch('/api/admin/study/kbs', { method: 'DELETE', body: JSON.stringify({ id }) })
    if (selectedId === id) setSelectedId(null)
    await loadKbs()
  }

  async function generate() {
    if (!selectedId || !topic.trim() || generating) return
    setGenerating(true); setGenError('')
    try {
      const res = await authFetch('/api/admin/study/generate', { method: 'POST', body: JSON.stringify({ kbId: selectedId, topic: topic.trim(), format, instructions: instructions.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setEntries(prev => [data.entry, ...prev])
      setTopic(''); setInstructions('')
      loadKbs() // refresh counts
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally { setGenerating(false) }
  }

  async function setEntryStatus(entry: Entry, status: string) {
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status } : e))
    await authFetch('/api/admin/study/entries', { method: 'PATCH', body: JSON.stringify({ id: entry.id, status }) })
    loadKbs()
  }

  async function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
    await authFetch('/api/admin/study/entries', { method: 'DELETE', body: JSON.stringify({ id }) })
    loadKbs()
  }

  // ─── KB LIST VIEW ───────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Admin Study Hub</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginBottom: 4 }}>Knowledge Bases</h2>
            <p style={{ fontSize: 13, color: C.textDim, maxWidth: 620, lineHeight: 1.5 }}>Subject-scoped study hubs for certification prep. Each base keeps its own focus and context, and generates original study material at ISSA CFT depth from our domain engine.</p>
          </div>
          <button onClick={() => { setEditingKb(null); setShowKbModal(true) }} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>+ New Knowledge Base</button>
        </div>

        {loadingKbs ? (
          <p style={{ fontSize: 13, color: C.textDim, padding: '40px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading…</p>
        ) : kbs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px', border: `1px dashed ${C.border}`, borderRadius: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No knowledge bases yet</p>
            <p style={{ fontSize: 13, color: C.textDim, marginBottom: 18 }}>Create your first subject to start building ISSA CFT study material.</p>
            <button onClick={() => { setEditingKb(null); setShowKbModal(true) }} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Knowledge Base</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {kbs.map(kb => {
              const dm = domainMeta(kb.domain)
              const pct = kb.target_units > 0 ? Math.min(Math.round((kb.mastered_count / kb.target_units) * 100), 100) : 0
              return (
                <div key={kb.id} onClick={() => setSelectedId(kb.id)} style={{ padding: '18px', borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer', borderTop: `2px solid ${dm.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: dm.color }}>{dm.label}</span>
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{kb.cert_goal}</span>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>{kb.title}</p>
                  {kb.description && <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.55, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{kb.description}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                    <div style={{ flex: 1, height: 5, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: dm.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', flexShrink: 0 }}>{kb.mastered_count}/{kb.target_units} · {kb.entry_count} units</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showKbModal && <KbModal kb={editingKb} onSave={saveKb} onClose={() => { setShowKbModal(false); setEditingKb(null) }} />}
      </div>
    )
  }

  // ─── KB DETAIL VIEW ─────────────────────────────────────────────────────────
  const dm = domainMeta(selected.domain)
  const masteredLive = entries.filter(e => e.status === 'mastered').length
  const pct = selected.target_units > 0 ? Math.min(Math.round((masteredLive / selected.target_units) * 100), 100) : 0
  const allTags = Array.from(new Set(entries.flatMap(e => e.tags ?? []))).sort()
  const visible = entries.filter(e => {
    if (tagFilter && !(e.tags ?? []).includes(tagFilter)) return false
    if (!filter.trim()) return true
    const q = filter.toLowerCase()
    return [e.title, e.topic, e.body_md, ...(e.tags ?? [])].some(f => f?.toLowerCase().includes(q))
  })

  return (
    <div>
      {/* Back + header */}
      <button onClick={() => setSelectedId(null)} style={{ fontSize: 12, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' }}>← All Knowledge Bases</button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: dm.color }}>{dm.label}</span>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{selected.cert_goal}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{selected.title}</h2>
          {selected.description && <p style={{ fontSize: 13, color: C.textDim, marginTop: 4, maxWidth: 640, lineHeight: 1.5 }}>{selected.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => { setEditingKb(selected); setShowKbModal(true) }} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
          <button onClick={() => deleteKb(selected.id)} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid rgba(239,68,68,0.25)`, background: 'transparent', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
        </div>
      </div>

      {/* Progress strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20, marginTop: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>Cert Progress</span>
        <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: dm.color, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>{masteredLive}/{selected.target_units} mastered · {pct}%</span>
      </div>

      {/* Generation panel */}
      <div style={{ padding: '18px', background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 14, marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.accent, marginBottom: 12 }}>⚡ Generate Study Material</p>
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) generate() }} placeholder="Topic — e.g. Muscle fiber types and their training implications" style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)} title={f.hint} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${format === f.id ? C.accentBorder : C.border}`, background: format === f.id ? C.accentDim : 'transparent', color: format === f.id ? C.accent : C.textMid, fontSize: 12, fontWeight: format === f.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{f.label}</button>
          ))}
        </div>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} placeholder="Optional: extra instructions (depth, focus, examples to include)…" style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
        {genError && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: C.red, marginBottom: 12 }}>{genError}</div>}
        <button onClick={generate} disabled={!topic.trim() || generating} style={{ padding: '11px 20px', borderRadius: 9, border: 'none', background: topic.trim() && !generating ? C.accent : C.surface2, color: topic.trim() && !generating ? '#fff' : C.textDim, fontSize: 14, fontWeight: 700, cursor: topic.trim() && !generating ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          {generating ? 'Generating study material…' : 'Generate →'}
        </button>
        <p style={{ fontSize: 11, color: C.textDim, marginTop: 10, lineHeight: 1.5 }}>Original content only — grounded in our domain engine, never copied from any certification's course materials.</p>
      </div>

      {/* Filter bar */}
      {entries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={`Search ${entries.length} study units…`} style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: allTags.length ? 10 : 0 }} />
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allTags.map(t => (
                <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: `1px solid ${tagFilter === t ? C.accentBorder : C.border}`, background: tagFilter === t ? C.accentDim : 'transparent', color: tagFilter === t ? C.accent : C.textDim, cursor: 'pointer', fontFamily: 'inherit' }}>#{t}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Entry list */}
      {loadingEntries ? (
        <p style={{ fontSize: 13, color: C.textDim, padding: '32px 0', textAlign: 'center', fontFamily: 'monospace' }}>Loading study material…</p>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: `1px dashed ${C.border}`, borderRadius: 12 }}>
          <p style={{ fontSize: 14, color: C.textMid, marginBottom: 4 }}>No study material yet.</p>
          <p style={{ fontSize: 12, color: C.textDim }}>Enter a topic above and hit Generate to build your first study unit.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(e => <EntryCard key={e.id} entry={e} onSetStatus={setEntryStatus} onDelete={deleteEntry} />)}
          {visible.length === 0 && <p style={{ fontSize: 13, color: C.textDim, padding: '24px 0', textAlign: 'center' }}>No units match your filter.</p>}
        </div>
      )}

      {showKbModal && <KbModal kb={editingKb} onSave={saveKb} onClose={() => { setShowKbModal(false); setEditingKb(null) }} />}
    </div>
  )
}
