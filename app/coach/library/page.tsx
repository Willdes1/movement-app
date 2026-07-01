'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type VideoType = 'youtube' | 'shorts' | 'upload' | null

type CoachExercise = {
  id: string
  name: string
  name_normalized: string
  instructions: string | null
  sets_reps: string | null
  rest_between_sets: string | null
  notes: string | null
  how: string | null
  breathing: string | null
  core: string | null
  tip: string | null
  custom_fields: CustomField[] | null
  video_type: VideoType
  youtube_url: string | null
  youtube_start_sec: number | null
  youtube_end_sec: number | null
  storage_path: string | null
  video_url: string | null
  created_at: string
}

type CustomField = { label: string; text: string }

type FormState = {
  name: string
  instructions: string
  sets_reps: string
  rest_between_sets: string
  notes: string
  how: string
  breathing: string
  core: string
  tip: string
  custom_fields: CustomField[]
  video_tab: 'none' | 'youtube' | 'upload'
  youtube_url: string
  start_mmss: string
  end_mmss: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeName(n: string) {
  return n.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_')
}

function extractYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null
}

function isShort(url: string) { return url.includes('/shorts/') }

function parseMMSS(mmss: string): number | null {
  const t = mmss.trim()
  if (!t) return null
  const parts = t.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (isNaN(m) || isNaN(s)) return null
    return m * 60 + s
  }
  const n = parseInt(t, 10)
  return isNaN(n) ? null : n
}

function secondsToMMSS(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function buildEmbedUrl(url: string, startSec: number | null, endSec: number | null): string {
  const id = extractYouTubeId(url)
  if (!id) return ''
  const short = isShort(url)
  let src = short
    ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
    : `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
  if (startSec != null && startSec > 0) src += `&start=${startSec}`
  if (endSec != null) src += `&end=${endSec}`
  return src
}

const BLANK_FORM: FormState = {
  name: '', instructions: '', sets_reps: '', rest_between_sets: '', notes: '',
  how: '', breathing: '', core: '', tip: '', custom_fields: [],
  video_tab: 'none', youtube_url: '', start_mmss: '', end_mmss: '',
}

// ─── VideoPlayer component ────────────────────────────────────────────────────
function VideoPreview({ ex, compact = false }: { ex: CoachExercise; compact?: boolean }) {
  if (ex.video_type === 'youtube' || ex.video_type === 'shorts') {
    const src = buildEmbedUrl(ex.youtube_url ?? '', ex.youtube_start_sec, ex.youtube_end_sec)
    if (!src) return null
    const isS = ex.video_type === 'shorts'
    return (
      <div style={{ borderRadius: compact ? 8 : 12, overflow: 'hidden', background: '#000', width: '100%' }}>
        <div style={{ position: 'relative', paddingBottom: isS ? '177.78%' : '56.25%', height: 0 }}>
          <iframe
            src={src}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {(ex.youtube_start_sec != null || ex.youtube_end_sec != null) && (
          <div style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.1)', display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>
              ✂️ Clip: {secondsToMMSS(ex.youtube_start_sec) || '0:00'} → {secondsToMMSS(ex.youtube_end_sec) || 'end'}
            </span>
          </div>
        )}
      </div>
    )
  }
  if (ex.video_type === 'upload' && ex.video_url) {
    return (
      <div style={{ borderRadius: compact ? 8 : 12, overflow: 'hidden', background: '#000', width: '100%' }}>
        <video
          src={ex.video_url}
          controls
          style={{ width: '100%', display: 'block', maxHeight: compact ? 200 : 400 }}
        />
      </div>
    )
  }
  return null
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CoachLibraryPage() {
  const { user } = useAuth()

  const [exercises, setExercises] = useState<CoachExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CoachExercise | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Instruction fields
  const [autofilling, setAutofilling] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [showManual, setShowManual] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('coach_exercise_library')
      .select('*')
      .eq('coach_id', user.id)
      .order('name', { ascending: true })
    setExercises((data ?? []) as CoachExercise[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(BLANK_FORM)
    setPreviewUrl(null)
    setSaveError('')
    setShowModal(true)
  }

  function openEdit(ex: CoachExercise) {
    setEditing(ex)
    const videoTab =
      ex.video_type === 'upload' ? 'upload'
      : (ex.video_type === 'youtube' || ex.video_type === 'shorts') ? 'youtube'
      : 'none'
    setForm({
      name: ex.name,
      instructions: ex.instructions ?? '',
      sets_reps: ex.sets_reps ?? '',
      rest_between_sets: ex.rest_between_sets ?? '',
      notes: ex.notes ?? '',
      how: ex.how ?? '',
      breathing: ex.breathing ?? '',
      core: ex.core ?? '',
      tip: ex.tip ?? '',
      custom_fields: Array.isArray(ex.custom_fields) ? ex.custom_fields : [],
      video_tab: videoTab,
      youtube_url: ex.youtube_url ?? '',
      start_mmss: secondsToMMSS(ex.youtube_start_sec),
      end_mmss: secondsToMMSS(ex.youtube_end_sec),
    })
    setPreviewUrl(ex.video_url)
    setSaveError('')
    setShowModal(true)
  }

  async function handleUpload(file: File) {
    if (!user) return
    setUploading(true)
    setUploadProgress('Uploading…')
    const ext = file.name.split('.').pop() ?? 'mp4'
    const path = `coach-videos/${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('user-uploads').upload(path, file, {
      contentType: file.type || 'video/mp4',
    })
    if (error) {
      setUploadProgress('Upload failed: ' + error.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path)
    setPreviewUrl(urlData.publicUrl)
    setForm(f => ({ ...f, video_tab: 'upload' }))
    setUploadProgress('✓ Uploaded successfully')
    setUploading(false)
  }

  async function handleSave() {
    if (!user || !form.name.trim()) { setSaveError('Exercise name is required'); return }
    setSaving(true)
    setSaveError('')

    const startSec = parseMMSS(form.start_mmss)
    const endSec = parseMMSS(form.end_mmss)
    const ytUrl = form.youtube_url.trim()
    const ytId = ytUrl ? extractYouTubeId(ytUrl) : null

    let video_type: VideoType = null
    let youtube_url = null
    let youtube_start_sec = null
    let youtube_end_sec = null
    let storage_path = null
    let video_url = null

    if (form.video_tab === 'youtube' && ytId) {
      video_type = isShort(ytUrl) ? 'shorts' : 'youtube'
      youtube_url = ytUrl
      youtube_start_sec = startSec
      youtube_end_sec = endSec
    } else if (form.video_tab === 'upload' && previewUrl) {
      video_type = 'upload'
      video_url = previewUrl
    }

    const row = {
      coach_id: user.id,
      name: form.name.trim(),
      name_normalized: normalizeName(form.name),
      instructions: form.instructions.trim() || null,
      sets_reps: form.sets_reps.trim() || null,
      rest_between_sets: form.rest_between_sets.trim() || null,
      notes: form.notes.trim() || null,
      how: form.how.trim() || null,
      breathing: form.breathing.trim() || null,
      core: form.core.trim() || null,
      tip: form.tip.trim() || null,
      custom_fields: form.custom_fields
        .map(f => ({ label: f.label.trim(), text: f.text.trim() }))
        .filter(f => f.label && f.text),
      video_type,
      youtube_url,
      youtube_start_sec,
      youtube_end_sec,
      storage_path,
      video_url,
      updated_at: new Date().toISOString(),
    }

    const { error } = editing
      ? await supabase.from('coach_exercise_library').update(row).eq('id', editing.id)
      : await supabase.from('coach_exercise_library').insert(row)

    if (error) {
      setSaveError(error.message)
    } else {
      setShowModal(false)
      await load()
    }
    setSaving(false)
  }

  // Fill the standard fields for FREE from our global exercise library (only fills
  // blanks — never overwrites what the coach already wrote).
  async function autofillFromLibrary() {
    if (!form.name.trim()) { setAiNote('Enter the exercise name first.'); return }
    setAutofilling(true); setAiNote('')
    const { data } = await supabase
      .from('exercise_library')
      .select('how, breathing, core, tip')
      .eq('name_normalized', normalizeName(form.name))
      .single()
    if (data && (data.how || data.breathing || data.core || data.tip)) {
      setForm(f => ({
        ...f,
        how: f.how || data.how || '',
        breathing: f.breathing || data.breathing || '',
        core: f.core || data.core || '',
        tip: f.tip || data.tip || '',
      }))
      setAiNote('Filled from the library — edit anything you like.')
    } else {
      setAiNote('Not in the library yet — try Generate with AI.')
    }
    setAutofilling(false)
  }

  // AI-generate the standard fields for this one exercise.
  async function generateWithAI() {
    if (!form.name.trim()) { setAiNote('Enter the exercise name first.'); return }
    setAiGenerating(true); setAiNote('')
    try {
      const res = await fetch('/api/generate-exercise-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises: [form.name.trim()] }),
      })
      const d = (await res.json())?.details?.[0]
      if (d?.how) {
        setForm(f => ({ ...f, how: d.how, breathing: d.breathing || f.breathing, core: d.core || f.core, tip: d.tip || f.tip }))
        setAiNote('Generated — edit anything you like.')
      } else setAiNote('Generation failed — try again.')
    } catch { setAiNote('Generation failed — try again.') }
    setAiGenerating(false)
  }

  const addCustomField    = () => setForm(f => ({ ...f, custom_fields: [...f.custom_fields, { label: '', text: '' }] }))
  const removeCustomField = (i: number) => setForm(f => ({ ...f, custom_fields: f.custom_fields.filter((_, idx) => idx !== i) }))
  const updateCustomField = (i: number, patch: Partial<CustomField>) =>
    setForm(f => ({ ...f, custom_fields: f.custom_fields.map((c, idx) => idx === i ? { ...c, ...patch } : c) }))

  async function handleDelete(id: string) {
    if (!confirm('Delete this exercise from your library?')) return
    setDeleting(id)
    await supabase.from('coach_exercise_library').delete().eq('id', id)
    setDeleting(null)
    await load()
  }

  const filtered = exercises.filter(e =>
    !search.trim() || e.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="coach-page" style={{ maxWidth: 900 }}>

      {/* Header */}
      <div className="coach-page-header">
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Atlas Prime</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>Exercise Library</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Your personal exercise database — with videos, instructions, and coaching notes.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + Add Exercise
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-dim)', pointerEvents: 'none' }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises…"
          style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Exercises', value: exercises.length, color: 'var(--text)' },
          { label: 'With Video', value: exercises.filter(e => e.video_type).length, color: 'var(--accent)' },
          { label: 'YouTube', value: exercises.filter(e => e.video_type === 'youtube' || e.video_type === 'shorts').length, color: '#ef4444' },
          { label: 'Uploaded', value: exercises.filter(e => e.video_type === 'upload').length, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Exercise list */}
      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', border: '2px dashed var(--border)', borderRadius: 14, color: 'var(--text-dim)' }}>
          {exercises.length === 0 ? (
            <>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Your library is empty</p>
              <p style={{ fontSize: 13, marginBottom: 20 }}>Add your first exercise with a YouTube video, trimmed clip, or uploaded video.</p>
              <button onClick={openAdd} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                + Add First Exercise
              </button>
            </>
          ) : (
            <p style={{ fontSize: 14 }}>No exercises match &quot;{search}&quot;</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(ex => {
            const open = expandedId === ex.id
            return (
              <div key={ex.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                  {/* Video badge */}
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: ex.video_type ? 'rgba(239,68,68,0.1)' : 'var(--surface2)', border: `1px solid ${ex.video_type ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {ex.video_type === 'youtube' || ex.video_type === 'shorts' ? '▶' : ex.video_type === 'upload' ? '🎥' : '📝'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{ex.name}</span>
                      {ex.video_type === 'shorts' && <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.25)' }}>SHORT</span>}
                      {ex.video_type === 'youtube' && (ex.youtube_start_sec != null || ex.youtube_end_sec != null) && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--accent-border)' }}>
                          ✂️ {secondsToMMSS(ex.youtube_start_sec) || '0:00'}→{secondsToMMSS(ex.youtube_end_sec) || 'end'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {ex.sets_reps && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ex.sets_reps}</span>}
                      {ex.rest_between_sets && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>· {ex.rest_between_sets} rest</span>}
                      {!ex.sets_reps && !ex.rest_between_sets && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No sets/rest configured</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {ex.video_type && (
                      <button
                        onClick={() => setExpandedId(open ? null : ex.id)}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: open ? 'var(--accent-bg)' : 'var(--surface2)', color: open ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}
                      >
                        {open ? 'Hide' : '▶ Preview'}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(ex)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ex.id)}
                      disabled={deleting === ex.id}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {deleting === ex.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Expanded video + instructions */}
                {open && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', display: 'grid', gridTemplateColumns: ex.video_type ? '1fr 1fr' : '1fr', gap: 20 }}>
                    <VideoPreview ex={ex} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {ex.instructions && (
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Instructions</p>
                          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ex.instructions}</p>
                        </div>
                      )}
                      {ex.notes && (
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Coach Notes</p>
                          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{editing ? 'Edit Exercise' : 'Add Exercise'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Modal body — scrollable */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Name */}
              <div>
                <Label>Exercise Name *</Label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Incline Dumbbell Press"
                  style={inputStyle}
                />
              </div>

              {/* Sets + Rest row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Sets × Reps</Label>
                  <input value={form.sets_reps} onChange={e => setForm(f => ({ ...f, sets_reps: e.target.value }))} placeholder="e.g. 4×10" style={inputStyle} />
                </div>
                <div>
                  <Label>Rest Between Sets</Label>
                  <input value={form.rest_between_sets} onChange={e => setForm(f => ({ ...f, rest_between_sets: e.target.value }))} placeholder="e.g. 90 sec" style={inputStyle} />
                </div>
              </div>

              {/* Coaching instructions — the standard fields the athlete sees */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <Label>Coaching Instructions</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={autofillFromLibrary} disabled={autofilling || aiGenerating}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-mid)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {autofilling ? '…' : '✨ Autofill (free)'}
                    </button>
                    <button type="button" onClick={generateWithAI} disabled={autofilling || aiGenerating}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {aiGenerating ? 'Generating…' : '🧠 Generate with AI'}
                    </button>
                  </div>
                </div>
                {aiNote && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{aiNote}</p>}
                {([
                  ['how', 'How to Perform'],
                  ['breathing', 'Breathing'],
                  ['core', 'Core Engagement'],
                  ['tip', 'Common Mistakes'],
                ] as const).map(([k, label]) => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
                    <textarea
                      value={form[k]}
                      onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder={`${label}…`}
                      rows={k === 'how' ? 3 : 2}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                    />
                  </div>
                ))}

                {/* Custom fields — "take over fully manually" with your own headers */}
                {!showManual && form.custom_fields.length === 0 ? (
                  <button type="button" onClick={() => { setShowManual(true); addCustomField() }}
                    style={{ padding: '4px 0', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Add your own field (e.g. Heart Rate)
                  </button>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Your Custom Fields</p>
                    {form.custom_fields.map((cf, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                        <input value={cf.label} onChange={e => updateCustomField(i, { label: e.target.value })} placeholder="Label" style={{ ...inputStyle, flex: '0 0 36%' }} />
                        <textarea value={cf.text} onChange={e => updateCustomField(i, { text: e.target.value })} placeholder="What to tell the athlete…" rows={2} style={{ ...inputStyle, flex: 1, resize: 'vertical', lineHeight: 1.5 }} />
                        <button type="button" onClick={() => removeCustomField(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '6px 2px' }}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={addCustomField}
                      style={{ padding: '4px 0', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Add another field
                    </button>
                  </div>
                )}
              </div>

              {/* Coach notes */}
              <div>
                <Label>Coach Notes <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span></Label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Cues, common mistakes, client-specific notes…"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>

              {/* ── Video section ──────────────────────────────────────────── */}
              <div>
                <Label>Video</Label>
                {/* Video type tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {([
                    { id: 'none', label: 'No Video' },
                    { id: 'youtube', label: '▶ YouTube / Short' },
                    { id: 'upload', label: '🎥 Upload My Video' },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setForm(f => ({ ...f, video_tab: t.id }))}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: form.video_tab === t.id ? 700 : 400, border: `1px solid ${form.video_tab === t.id ? 'var(--accent)' : 'var(--border)'}`, background: form.video_tab === t.id ? 'var(--accent-bg)' : 'var(--surface2)', color: form.video_tab === t.id ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* YouTube panel */}
                {form.video_tab === 'youtube' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <Label>YouTube URL</Label>
                      <input
                        value={form.youtube_url}
                        onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                        placeholder="https://www.youtube.com/watch?v=... or /shorts/..."
                        style={inputStyle}
                      />
                      {form.youtube_url && !extractYouTubeId(form.youtube_url) && (
                        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Couldn't parse a YouTube video ID from this URL.</p>
                      )}
                      {form.youtube_url && isShort(form.youtube_url) && (
                        <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>✓ Detected as a YouTube Short — vertical 9:16 player will be used.</p>
                      )}
                    </div>

                    {/* Clip trimming */}
                    <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>✂️ Clip Trimming <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span></p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                        Only want 1 minute of a 20-minute video? Set start and end times. The embed will play only that section. Format: <strong style={{ color: 'var(--text)' }}>M:SS</strong> or <strong style={{ color: 'var(--text)' }}>MM:SS</strong>
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <Label>Start Time</Label>
                          <input
                            value={form.start_mmss}
                            onChange={e => setForm(f => ({ ...f, start_mmss: e.target.value }))}
                            placeholder="0:00"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <Label>End Time</Label>
                          <input
                            value={form.end_mmss}
                            onChange={e => setForm(f => ({ ...f, end_mmss: e.target.value }))}
                            placeholder="1:30 (leave blank = play to end)"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live preview */}
                    {extractYouTubeId(form.youtube_url) && (() => {
                      const startSec = parseMMSS(form.start_mmss)
                      const endSec = parseMMSS(form.end_mmss)
                      const src = buildEmbedUrl(form.youtube_url, startSec, endSec)
                      const short = isShort(form.youtube_url)
                      return (
                        <div>
                          <Label>Preview</Label>
                          <div style={{ borderRadius: 10, overflow: 'hidden', background: '#000', maxWidth: short ? 280 : '100%' }}>
                            <div style={{ position: 'relative', paddingBottom: short ? '177.78%' : '56.25%', height: 0 }}>
                              <iframe key={src} src={src} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                          </div>
                          {(startSec != null || endSec != null) && (
                            <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
                              ✂️ Playing {startSec != null ? secondsToMMSS(startSec) : '0:00'} → {endSec != null ? secondsToMMSS(endSec) : 'end'}
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Upload panel */}
                {form.video_tab === 'upload' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Instructions box */}
                    <div style={{ padding: '14px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>📋 Upload Guidelines</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {[
                          ['Format', 'MP4 (recommended) · MOV · WebM'],
                          ['Resolution', '720p or 1080p for best quality'],
                          ['Duration', 'Under 5 minutes recommended'],
                          ['File size', 'Up to 200MB per video'],
                          ['Pro tip', 'Trim first in iMovie, CapCut, or Clipchamp — then upload the clean clip'],
                        ].map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', minWidth: 70, flexShrink: 0 }}>{label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-mid)' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Drop zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '24px', borderRadius: 12, border: `2px dashed ${previewUrl ? 'var(--green)' : 'var(--border)'}`, background: previewUrl ? 'rgba(34,197,94,0.05)' : 'var(--surface2)', textAlign: 'center', cursor: 'pointer' }}
                    >
                      {previewUrl ? (
                        <>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>✓ Video uploaded</p>
                          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Click to replace</p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: 28, marginBottom: 8 }}>🎥</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Click to upload your video</p>
                          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>MP4, MOV, or WebM · Max 200MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
                      style={{ display: 'none' }}
                    />
                    {uploadProgress && (
                      <p style={{ fontSize: 12, color: uploadProgress.startsWith('✓') ? 'var(--green)' : uploadProgress.startsWith('Upload failed') ? '#ef4444' : 'var(--accent)', fontWeight: 600 }}>
                        {uploading ? '⏳ ' : ''}{uploadProgress}
                      </p>
                    )}

                    {/* Preview uploaded */}
                    {previewUrl && (
                      <div style={{ borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                        <video src={previewUrl} controls style={{ width: '100%', display: 'block', maxHeight: 300 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {saveError && (
                <p style={{ fontSize: 13, color: '#ef4444', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                  {saveError}
                </p>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: saving || uploading ? 'var(--surface2)' : 'var(--accent)', color: saving || uploading ? 'var(--text-dim)' : '#fff', fontWeight: 700, fontSize: 14, cursor: saving || uploading ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Exercise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
      {children}
    </p>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
