'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/track'
import { useCoached } from '@/contexts/CoachedContext'

// Chunk 5a — when a coach assigns a program, the athlete sees this prompt and
// taps Activate (no more silent auto-takeover). Activating retires their current
// coach program (progress kept) and makes this one active.
export default function CoachAssignmentPrompt() {
  const { pendingAssignment, coached, refresh } = useCoached()
  const [dismissed, setDismissed] = useState(false)
  const [activating, setActivating] = useState(false)

  if (!pendingAssignment || dismissed) return null
  const p = pendingAssignment
  const coachFirst = p.coachName.split(' ')[0] || 'Your coach'

  async function activate() {
    setActivating(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/coach/activate-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ assignmentId: p.id }),
    })
    if (res.ok) { trackEvent('program_activated', { source: 'coach' }); await refresh(); setDismissed(true) }
    else setActivating(false)
  }

  return (
    <div style={{ padding: '0 16px', marginTop: 12 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent2, var(--accent)) 10%, transparent))', border: '1px solid var(--accent)', borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>
              Coach {coachFirst} assigned you {p.programName ? `"${p.programName}"` : 'a program'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>
              {coached
                ? 'Activating makes it your program and saves your current coach program — you can come back to it anytime.'
                : 'Activate to start. Your current plan is saved in the background — you can return to it whenever you like.'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={activate} disabled={activating}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: activating ? 'default' : 'pointer', fontFamily: 'inherit', opacity: activating ? 0.7 : 1 }}>
                {activating ? 'Activating…' : 'Activate Program'}
              </button>
              <button onClick={() => setDismissed(true)} disabled={activating}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
