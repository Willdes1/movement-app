'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const TOPICS = ['Question', 'Account', 'Billing', 'Bug / Something broke', 'Feature request', 'Other']

// Lightweight support form. Writes into the existing bug_reports pipeline (which
// the admin Bug Reports tab already triages) so support reaches us with zero
// email exposed to the user. RLS lets a signed-in user insert their own row.
export default function ContactSupportModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [topic, setTopic] = useState('Question')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!message.trim() || submitting || !user) return
    setSubmitting(true); setError('')

    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profileRes.data?.role ?? null

    const { error: err } = await supabase.from('bug_reports').insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_role: role,
      page_url: '/account',
      feature_label: `Support · ${topic}`,
      description: message.trim(),
      severity: 'annoying',
      priority: 'medium',
    })

    setSubmitting(false)
    if (err) { setError('Could not send. Please try again.'); return }
    setDone(true)
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Message sent</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>Thanks for reaching out — we read every message and will get back to you.</p>
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Contact Support</h3>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>We usually reply within a day.</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>Topic</label>
                <select value={topic} onChange={e => setTopic(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>How can we help? <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what's going on…" rows={4} autoFocus style={{ ...field, resize: 'vertical', lineHeight: 1.55 }} />
              </div>
              {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
              <button onClick={submit} disabled={!message.trim() || submitting} style={{ width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: message.trim() && !submitting ? 'var(--accent)' : 'var(--surface2)', color: message.trim() && !submitting ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: message.trim() && !submitting ? 'pointer' : 'not-allowed' }}>
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
