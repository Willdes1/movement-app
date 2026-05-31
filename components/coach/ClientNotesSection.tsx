'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Note {
  id: string
  note: string
  session_date: string
  created_at: string
}

export default function ClientNotesSection({
  coachId,
  clientId,
  clientName,
}: {
  coachId: string
  clientId: string
  clientName: string
}) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const finalRef = useRef('')

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('coach_client_notes')
      .select('id, note, session_date, created_at')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setNotes((data as Note[]) ?? [])
    setLoading(false)
  }, [coachId, clientId])

  useEffect(() => { load() }, [load])

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    finalRef.current = draft

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalRef.current += e.results[i][0].transcript + ' '
        } else {
          interim = e.results[i][0].transcript
        }
      }
      setDraft(finalRef.current + interim)
    }
    rec.onend = () => { setListening(false); setDraft(finalRef.current) }
    rec.onerror = () => { setListening(false) }
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function saveNote() {
    if (!draft.trim()) return
    setSaving(true)
    await supabase.from('coach_client_notes').insert({
      coach_id: coachId,
      client_id: clientId,
      note: draft.trim(),
      session_date: sessionDate,
    })
    setDraft('')
    finalRef.current = ''
    setSessionDate(new Date().toISOString().split('T')[0])
    setAdding(false)
    await load()
    setSaving(false)
  }

  async function deleteNote(id: string) {
    setDeletingId(id)
    await supabase.from('coach_client_notes').delete().eq('id', id).eq('coach_id', coachId)
    setNotes(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  function fmtDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function cancelAdd() {
    if (listening) stopListening()
    setDraft('')
    finalRef.current = ''
    setAdding(false)
  }

  const mostRecent = notes[0]
  const visibleNotes = showAll ? notes : notes.slice(0, 5)

  return (
    <div style={{ marginTop: 28 }}>
      {/* Section header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(59,130,246,0.06) 100%)',
        border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 14,
        padding: '22px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: loading ? 0 : (mostRecent || adding) ? 20 : 0, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(167,139,250,0.9)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
              Coach Notes
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Get to Know Your Client
            </h3>
            {notes.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
                {notes.length} note{notes.length !== 1 ? 's' : ''} on {clientName.split(' ')[0]}
              </div>
            )}
          </div>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              style={{
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: 'rgba(167,139,250,0.15)', color: 'rgba(167,139,250,1)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              + Add Note
            </button>
          )}
        </div>

        {/* Last session reminder */}
        {!adding && mostRecent && (
          <div style={{
            background: 'rgba(167,139,250,0.07)',
            border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: notes.length > 1 ? 16 : 0,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(167,139,250,0.8)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6 }}>
              🔔 Last Session Reminder — {fmtDate(mostRecent.session_date)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              {mostRecent.note}
            </div>
          </div>
        )}

        {/* Add note form */}
        {adding && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px' }}>
            {/* Date row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 12,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={draft}
                onChange={e => { setDraft(e.target.value); finalRef.current = e.target.value }}
                placeholder={`e.g. "${clientName.split(' ')[0]} was overusing traps on dips today — watch form next session. Left hip flexor still tight."`}
                rows={4}
                style={{
                  width: '100%', padding: '12px 44px 12px 14px',
                  borderRadius: 9, border: `1px solid ${listening ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                  background: listening ? 'rgba(239,68,68,0.04)' : 'var(--surface)',
                  color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
              {/* Mic button */}
              {speechSupported && (
                <button
                  onClick={listening ? stopListening : startListening}
                  title={listening ? 'Stop recording' : 'Dictate note (Chrome/Edge)'}
                  style={{
                    position: 'absolute', right: 10, top: 10,
                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: listening ? 'rgba(239,68,68,0.15)' : 'var(--surface2)',
                    color: listening ? '#ef4444' : 'var(--text-dim)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, transition: 'all 0.2s',
                  }}
                >
                  {listening ? '⏹' : '🎙️'}
                </button>
              )}
            </div>

            {/* Recording indicator */}
            {listening && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  background: '#ef4444', animation: 'pulse 1s infinite',
                }} />
                Listening… speak now. Click ⏹ to stop.
              </div>
            )}
            {speechSupported === false && (
              <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-dim)' }}>
                Voice dictation requires Chrome or Edge.
              </div>
            )}

            {/* Char count + buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
              <span style={{ fontSize: 11, color: draft.length > 1800 ? '#ef4444' : 'var(--text-dim)' }}>
                {draft.length} / 2000
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={cancelAdd}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-dim)', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveNote}
                  disabled={saving || !draft.trim()}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: saving || !draft.trim() ? 'var(--surface2)' : 'rgba(167,139,250,1)',
                    color: saving || !draft.trim() ? 'var(--text-dim)' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: saving || !draft.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes list */}
        {!loading && notes.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-dim)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No notes yet</div>
            <div style={{ fontSize: 12 }}>Add a note after each session and the system will remind you next time.</div>
          </div>
        )}

        {!loading && notes.length > 1 && (
          <div style={{ marginTop: adding ? 16 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              All Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleNotes.map((n, i) => (
                <div
                  key={n.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    opacity: i === 0 && !adding ? 0.6 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
                      {fmtDate(n.session_date)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {n.note}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteNote(n.id)}
                    disabled={deletingId === n.id}
                    title="Delete note"
                    style={{
                      flexShrink: 0, background: 'none', border: 'none',
                      color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13,
                      padding: '2px 4px', borderRadius: 4, opacity: deletingId === n.id ? 0.4 : 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {notes.length > 5 && (
              <button
                onClick={() => setShowAll(v => !v)}
                style={{
                  marginTop: 10, width: '100%', padding: '9px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-dim)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {showAll ? 'Show less' : `Show ${notes.length - 5} more note${notes.length - 5 !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
