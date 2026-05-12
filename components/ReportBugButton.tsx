'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const FEATURES = [
  'Training Plan', 'Calendar', 'Workout Log',
  'Recovery / Injury', 'Anatomy Explorer', 'For You Feed',
  'Profile / Settings', 'Coach Portal', 'Account / Billing', 'Other',
]

type Severity = 'annoying' | 'blocks_me' | 'broken'

function computePriority(sev: Severity, role?: string | null): string {
  if (sev === 'broken') return 'critical'
  if (sev === 'blocks_me' && (role === 'coach' || role === 'admin')) return 'high'
  if (sev === 'blocks_me') return 'high'
  return 'medium'
}

export default function ReportBugButton() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [open, setOpen]           = useState(false)
  const [description, setDescription] = useState('')
  const [feature, setFeature]     = useState('')
  const [severity, setSeverity]   = useState<Severity>('annoying')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  // Only show for authenticated users; hide on admin pages
  if (!user || pathname?.startsWith('/admin')) return null

  function resetForm() {
    setDescription(''); setFeature(''); setSeverity('annoying'); setError('')
  }

  async function submit() {
    if (!description.trim() || submitting) return
    setSubmitting(true)
    setError('')

    const profileRes = await supabase.from('profiles').select('role').eq('id', user!.id).single()
    const role = profileRes.data?.role ?? null

    const { error: err } = await supabase.from('bug_reports').insert({
      user_id:       user!.id,
      user_email:    user!.email ?? null,
      user_role:     role,
      page_url:      pathname,
      feature_label: feature || 'Other',
      description:   description.trim(),
      severity,
      priority:      computePriority(severity, role),
    })

    setSubmitting(false)
    if (err) { setError('Failed to submit. Please try again.'); return }
    setDone(true)
    setTimeout(() => { setOpen(false); setDone(false); resetForm() }, 2000)
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Report a problem"
        aria-label="Report a problem"
        style={{
          position: 'fixed', bottom: 84, right: 18,
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(22,27,34,0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)', zIndex: 90,
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          transition: 'all 0.15s', fontFamily: 'monospace',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      >
        ?
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); resetForm() } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 16,
            padding: 28, width: '100%', maxWidth: 460,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>✓</div>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#e6edf3', marginBottom: 6 }}>Report sent</p>
                <p style={{ fontSize: 13, color: '#6e7681' }}>Thanks — we'll look into it.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#e6edf3', marginBottom: 3 }}>Report a Problem</h3>
                    <p style={{ fontSize: 12, color: '#6e7681' }}>Help us fix it fast</p>
                  </div>
                  <button
                    onClick={() => { setOpen(false); resetForm() }}
                    style={{ background: 'none', border: 'none', color: '#6e7681', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                  >×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#b1bac4', display: 'block', marginBottom: 6 }}>
                      What went wrong? <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe what happened…"
                      rows={3}
                      autoFocus
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        border: '1px solid #30363d', background: '#21262d',
                        color: '#e6edf3', fontSize: 13, fontFamily: 'inherit',
                        resize: 'none', outline: 'none', lineHeight: 1.55,
                        boxSizing: 'border-box', transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                      onBlur={e => e.target.style.borderColor = '#30363d'}
                    />
                  </div>

                  {/* Feature */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#b1bac4', display: 'block', marginBottom: 6 }}>
                      Which feature?
                    </label>
                    <select
                      value={feature}
                      onChange={e => setFeature(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid #30363d', background: '#21262d',
                        color: feature ? '#e6edf3' : '#6e7681',
                        fontSize: 13, outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
                      }}
                    >
                      <option value="">Select a feature…</option>
                      {FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Severity */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#b1bac4', display: 'block', marginBottom: 8 }}>
                      How bad is it?
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([
                        { value: 'annoying',  label: '😤 Annoying' },
                        { value: 'blocks_me', label: '🚧 Blocks Me' },
                        { value: 'broken',    label: '🔥 App Broken' },
                      ] as { value: Severity; label: string }[]).map(s => (
                        <button
                          key={s.value}
                          onClick={() => setSeverity(s.value)}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: 8,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            border: severity === s.value ? '1px solid rgba(59,130,246,0.55)' : '1px solid #30363d',
                            background: severity === s.value ? 'rgba(59,130,246,0.12)' : '#21262d',
                            color: severity === s.value ? '#3b82f6' : '#6e7681',
                            transition: 'all 0.15s',
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}

                  <button
                    onClick={submit}
                    disabled={!description.trim() || submitting}
                    style={{
                      width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                      background: description.trim() && !submitting ? '#3b82f6' : '#21262d',
                      color: description.trim() && !submitting ? '#fff' : '#6e7681',
                      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                      cursor: description.trim() && !submitting ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                    }}
                  >
                    {submitting ? 'Sending…' : 'Send Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
