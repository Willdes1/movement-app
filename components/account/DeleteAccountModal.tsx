'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BILLING_LIVE } from '@/lib/flags'

type Step = 'intent' | 'reason' | 'offer' | 'confirm'
type Reason = 'no_time' | 'too_pricey' | 'not_for_me' | 'technical' | 'privacy' | 'other'

const REASONS: { id: Reason; label: string }[] = [
  { id: 'no_time',    label: "I don't have time right now" },
  { id: 'too_pricey', label: 'Too expensive' },
  { id: 'not_for_me', label: "It's just not for me" },
  { id: 'technical',  label: 'Technical issues / bugs' },
  { id: 'privacy',    label: 'Privacy concerns' },
  { id: 'other',      label: 'Other' },
]

export default function DeleteAccountModal({ onClose, onTakeBreak, onContactSupport, onDeleted }: {
  onClose: () => void
  onTakeBreak: () => void
  onContactSupport: () => void
  onDeleted: () => void
}) {
  const [step, setStep] = useState<Step>('intent')
  const [reason, setReason] = useState<Reason | null>(null)
  const [detail, setDetail] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function doDelete() {
    setDeleting(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ reason, detail: detail.trim() || null }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error ?? 'Could not delete your account. Please try again.'); setDeleting(false); return }
    onDeleted()
  }

  // Contextual save offer per reason.
  const offer = (() => {
    switch (reason) {
      case 'no_time':
        return { icon: '⏸️', title: 'Life gets busy — you don\'t have to delete', body: 'Take a break instead. Everything stays exactly as you left it — your program, history, and streak — ready whenever you come back.', cta: { label: 'Take a break instead', onClick: onTakeBreak } }
      case 'too_pricey':
        return BILLING_LIVE
          ? { icon: '🎁', title: 'Wait — here\'s something for you', body: 'We\'d love to keep you. Claim a special discount and stay on your current plan.', cta: { label: 'See my offer', onClick: onClose } }
          : { icon: '💛', title: 'You\'re not being charged anything', body: 'Atlas Prime is free for you right now — there\'s no subscription to cancel. You\'re welcome to keep training at no cost.', cta: { label: 'Keep my free account', onClick: onClose } }
      case 'technical':
        return { icon: '🛠️', title: 'Let us fix it before you go', body: 'Most issues are quick for us to sort out. Tell us what broke and we\'ll make it right — you don\'t have to lose your progress over a bug.', cta: { label: 'Get help — Contact Support', onClick: onContactSupport } }
      case 'privacy':
        return { icon: '🔒', title: 'Your data is yours', body: 'We never sell your data, and admin access is fully logged. You can read exactly how it\'s handled before deciding.', cta: { label: 'Keep my account', onClick: onClose } }
      case 'not_for_me':
        return { icon: '🙏', title: 'Mind telling us what missed?', body: 'A quick note helps us build something you\'d actually love. We read every message.', cta: { label: 'Share feedback & stay', onClick: onContactSupport } }
      default:
        return { icon: '⏸️', title: 'You can step away without deleting', body: 'Take a break and keep everything — your program, history, and streak stay safe until you return.', cta: { label: 'Take a break instead', onClick: onTakeBreak } }
    }
  })()

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 26, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }
  const muted: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0' }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !deleting) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={card}>

        {/* ── Step 1: intent ── */}
        {step === 'intent' && (
          <>
            <Head title="Leaving already?" sub="Choose what works for you — nothing is locked in." onClose={onClose} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              <Choice icon="⏸️" title="Take a break" sub="Sign out and keep everything. Come back anytime — your data is saved." onClick={onTakeBreak} />
              <Choice icon="🗑️" title="Delete my account" sub="Permanently erase your account and all your data." danger onClick={() => setStep('reason')} />
            </div>
          </>
        )}

        {/* ── Step 2: reason ── */}
        {step === 'reason' && (
          <>
            <Head title="Why are you leaving?" sub="This helps us improve — it takes one tap." onBack={() => setStep('intent')} onClose={onClose} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {REASONS.map(r => (
                <button key={r.id} onClick={() => setReason(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, border: `1px solid ${reason === r.id ? 'var(--accent-border)' : 'var(--border)'}`, background: reason === r.id ? 'var(--accent-bg)' : 'var(--surface2)', color: reason === r.id ? 'var(--accent)' : 'var(--text)' }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${reason === r.id ? 'var(--accent)' : 'var(--border)'}`, background: reason === r.id ? 'var(--accent)' : 'transparent' }} />
                  {r.label}
                </button>
              ))}
              <textarea value={detail} onChange={e => setDetail(e.target.value)} placeholder="Anything else you'd like us to know? (optional)" rows={2} style={{ marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <button onClick={() => setStep('offer')} disabled={!reason} style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: reason ? 'var(--accent)' : 'var(--surface2)', color: reason ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: 700, cursor: reason ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Continue</button>
          </>
        )}

        {/* ── Step 3: tailored save offer ── */}
        {step === 'offer' && (
          <>
            <Head title="" onBack={() => setStep('reason')} onClose={onClose} />
            <div style={{ textAlign: 'center', padding: '4px 4px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>{offer.icon}</div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>{offer.title}</p>
              <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.65, marginBottom: 8 }}>{offer.body}</p>
              {reason === 'privacy' && (
                <Link href="/legal/privacy" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Read our Privacy Policy →</Link>
              )}
            </div>
            <button onClick={offer.cta.onClick} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{offer.cta.label}</button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => setStep('confirm')} style={muted}>No thanks, continue to delete →</button>
            </div>
          </>
        )}

        {/* ── Step 4: final confirm ── */}
        {step === 'confirm' && (
          <>
            <Head title="Delete account permanently?" onBack={() => setStep('offer')} onClose={() => !deleting && onClose()} />
            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65, marginBottom: 8 }}>This permanently erases your account and <strong style={{ color: 'var(--text)' }}>everything in it</strong>:</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['Your training program & calendar', 'All workout logs & history', 'Recovery progress & streak', 'Your profile & settings'].map(i => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>{i}</li>
                ))}
              </ul>
              <p style={{ fontSize: 12.5, color: 'rgba(255,120,120,0.95)', fontWeight: 600, marginTop: 10 }}>This cannot be undone.</p>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)', display: 'block', margin: '16px 0 6px' }}>Type <strong style={{ color: 'var(--text)' }}>DELETE</strong> to confirm</label>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE" disabled={deleting} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: '0.1em' }} />

            {error && <p style={{ fontSize: 12.5, color: '#ef4444', marginTop: 10 }}>{error}</p>}

            <button onClick={doDelete} disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deleting} style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 9, border: 'none', background: confirmText.trim().toUpperCase() === 'DELETE' && !deleting ? '#ef4444' : 'var(--surface2)', color: confirmText.trim().toUpperCase() === 'DELETE' && !deleting ? '#fff' : 'var(--text-dim)', fontSize: 15, fontWeight: 800, cursor: confirmText.trim().toUpperCase() === 'DELETE' && !deleting ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {deleting ? 'Deleting your account…' : 'Delete my account forever'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => !deleting && onClose()} style={muted}>Keep my account</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Head({ title, sub, onBack, onClose }: { title: string; sub?: string; onBack?: () => void; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>}
        {title && (
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{title}</h3>
            {sub && <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</p>}
          </div>
        )}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  )
}

function Choice({ icon, title, sub, onClick, danger = false }: { icon: string; title: string; sub: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, background: 'var(--surface2)' }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: danger ? 'rgba(255,120,120,0.95)' : 'var(--text)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.45 }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--text-dim)', fontSize: 16 }}>›</span>
    </button>
  )
}
