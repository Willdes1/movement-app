'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Program {
  id: string
  name: string
  status: string
  source: string
  weeks_total: number
  import_filename: string | null
  notes: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  published: 'Published',
  archived: 'Archived',
  paused: 'Paused',
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f59e0b18', color: '#f59e0b' },
  active:    { bg: '#22c55e18', color: '#22c55e' },
  published: { bg: '#3b82f618', color: '#3b82f6' },
  archived:  { bg: '#6b728018', color: '#9ca3af' },
  paused:    { bg: '#ef444418', color: '#ef4444' },
}

const SOURCE_EMOJI: Record<string, string> = {
  import:       '📄',
  ai_generated: '🤖',
  manual:       '✏️',
}

export default function CoachProgramsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    fetchPrograms()
  }, [user])

  async function fetchPrograms() {
    setLoading(true)
    const { data, error } = await supabase
      .from('coach_programs')
      .select('id, name, status, source, weeks_total, import_filename, notes, created_at')
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setPrograms(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    setActionLoading(id + newStatus)
    const { error } = await supabase
      .from('coach_programs')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('coach_id', user!.id)

    if (error) {
      setError(error.message)
    } else {
      setPrograms(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    }
    setActionLoading(null)
  }

  async function deleteProgram(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setActionLoading(id + 'delete')
    const { error } = await supabase
      .from('coach_programs')
      .delete()
      .eq('id', id)
      .eq('coach_id', user!.id)

    if (error) {
      setError(error.message)
    } else {
      setPrograms(prev => prev.filter(p => p.id !== id))
    }
    setActionLoading(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="coach-page">
      {/* Header */}
      <div className="coach-page-header">
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Atlas Prime
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>My Programs</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 6 }}>
            {programs.length} program{programs.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={() => router.push('/coach/builder')}
          style={{
            padding: '11px 22px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + New Program
        </button>
      </div>

      {error && (
        <div style={{ background: '#ff3b3020', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', color: '#ff3b30', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-dim)', fontSize: 14 }}>
          Loading programs…
        </div>
      ) : programs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 40px',
          border: '2px dashed var(--border)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No programs yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
            Import a PDF or DOCX to get started
          </div>
          <button
            onClick={() => router.push('/coach/builder')}
            style={{
              padding: '10px 24px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Import Your First Program
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {programs.map(prog => {
            const statusStyle = STATUS_COLOR[prog.status] ?? STATUS_COLOR.draft
            const isActioning = actionLoading?.startsWith(prog.id)
            return (
              <div
                key={prog.id}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '20px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  opacity: isActioning ? 0.6 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s',
                  cursor: 'pointer',
                }}
                onClick={e => {
                  // Don't navigate when clicking action buttons
                  if ((e.target as HTMLElement).closest('button')) return
                  router.push(`/coach/programs/${prog.id}`)
                }}
                onMouseEnter={e => { if (!isActioning) e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {/* Source icon */}
                <div style={{ fontSize: 26, flexShrink: 0, width: 36, textAlign: 'center' }}>
                  {SOURCE_EMOJI[prog.source] ?? '📋'}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                      {prog.name}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      padding: '3px 9px',
                      borderRadius: 20,
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      flexShrink: 0,
                    }}>
                      {STATUS_LABEL[prog.status] ?? prog.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {prog.weeks_total} week{prog.weeks_total !== 1 ? 's' : ''}
                    </span>
                    {prog.import_filename && (
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        {prog.import_filename}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {formatDate(prog.created_at)}
                    </span>
                  </div>
                  {prog.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                      {prog.notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                  {prog.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(prog.id, 'active')}
                      disabled={!!isActioning}
                      style={{
                        padding: '7px 16px',
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: isActioning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Publish
                    </button>
                  )}
                  {prog.status === 'active' && (
                    <button
                      onClick={() => updateStatus(prog.id, 'archived')}
                      disabled={!!isActioning}
                      style={{
                        padding: '7px 16px',
                        background: 'var(--surface)',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: isActioning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Archive
                    </button>
                  )}
                  {prog.status === 'archived' && (
                    <button
                      onClick={() => updateStatus(prog.id, 'active')}
                      disabled={!!isActioning}
                      style={{
                        padding: '7px 16px',
                        background: 'var(--surface)',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: isActioning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Restore
                    </button>
                  )}
                  <button
                    onClick={() => deleteProgram(prog.id, prog.name)}
                    disabled={!!isActioning}
                    style={{
                      padding: '7px 14px',
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid #ef444440',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: isActioning ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
