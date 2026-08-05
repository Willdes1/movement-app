'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { localDateKey } from '@/lib/program-progress'

// The two free ways back onto an existing program after a break.
//
// Both are a shift of start_date, so neither spends a token or throws away the
// plan the athlete already has. Building a brand new block is a third, paid
// action and deliberately lives elsewhere.

export default function ProgramResumeActions({
  onDone, showNewBlock = true,
}: {
  onDone?: () => void
  /** Offer the paid "generate a new block" route alongside the free ones. */
  showNewBlock?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'resume' | 'fresh' | null>(null)
  const [confirmFresh, setConfirmFresh] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(mode: 'resume' | 'fresh') {
    setBusy(mode)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/user/program-restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        // The athlete's own date. The server runs in UTC, so without this an
        // evening resume in the Americas would start the program tomorrow.
        body: JSON.stringify({ mode, today: localDateKey() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.complete
          ? 'Every week of this program is finished. Build a new block to keep going.'
          : 'That did not work. Try again in a moment.')
        return
      }
      onDone?.()
      router.refresh()
      router.push('/today')
    } catch {
      setError('That did not work. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  const primary: React.CSSProperties = {
    padding: '15px 20px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
    color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer',
    fontFamily: 'inherit', boxShadow: '0 6px 24px var(--accent-shadow)',
  }
  const secondary: React.CSSProperties = {
    padding: '13px 20px', borderRadius: 12, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-mid)', fontWeight: 700,
    fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380, margin: '0 auto', width: '100%' }}>
      <button onClick={() => run('resume')} disabled={!!busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>
        {busy === 'resume' ? 'Setting your dates…' : 'Pick up where I left off →'}
      </button>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: -4, lineHeight: 1.5 }}>
        Puts the week you stopped on back onto today. Keeps your plan and your progress. Free.
      </p>

      {!confirmFresh ? (
        <button onClick={() => setConfirmFresh(true)} disabled={!!busy} style={secondary}>
          Restart this plan from day one
        </button>
      ) : (
        <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>Start this plan again from week 1?</p>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 10 }}>
            Today becomes day one. Your workouts stay exactly as they are, but the days you
            already ticked off will be cleared so you can do them again. Your logged sets and
            history are not touched.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmFresh(false)} disabled={!!busy} style={{ ...secondary, flex: 1, padding: '9px' }}>Cancel</button>
            <button onClick={() => run('fresh')} disabled={!!busy} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {busy === 'fresh' ? 'Resetting…' : 'Yes, start over'}
            </button>
          </div>
        </div>
      )}

      {showNewBlock && (
        <button onClick={() => router.push('/plan')} disabled={!!busy} style={{ ...secondary, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13 }}>
          Or build me a brand new block
        </button>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--accent)', textAlign: 'center', lineHeight: 1.5 }}>{error}</p>}
    </div>
  )
}
