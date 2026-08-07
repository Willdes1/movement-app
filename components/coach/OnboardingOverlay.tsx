'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SPORTS, joinSports } from '@/lib/sports'

const STORAGE_KEY = (id: string) => `coach_onboarded_${id}`

export default function OnboardingOverlay() {
  const { user } = useAuth()
  const router   = useRouter()

  const [visible, setVisible]     = useState(false)
  const [step, setStep]           = useState(1)        // 1 welcome · 2 self-training · 3 invite · 4 done
  const [name, setName]           = useState('')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]       = useState(false)

  // Coach self-training. A coaching account also comes with the athlete app, so
  // we ask once whether they train themselves. Answering yes lets APIE build
  // THEM a real program instead of guessing from an empty profile. Saying no is
  // a real answer, recorded, so we stop asking.
  const [selfTrains, setSelfTrains] = useState<boolean | null>(null)
  const [sports, setSports]         = useState<string[]>([])
  const [customSport, setCustomSport] = useState('')
  const [savingSelf, setSavingSelf] = useState(false)
  const [selfError, setSelfError]   = useState<string | null>(null)

  const toggleSport = (s: string) =>
    setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem(STORAGE_KEY(user.id))) return
    loadData()
  }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const [profileRes, codesRes] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', user!.id).single(),
      supabase.from('coach_invite_codes').select('code').eq('coach_id', user!.id).eq('active', true).limit(1),
    ])
    setName(profileRes.data?.name?.split(' ')[0] ?? 'Coach')
    if (codesRes.data?.length) setInviteCode(codesRes.data[0].code)
    setVisible(true)
  }

  function dismiss() {
    if (user) localStorage.setItem(STORAGE_KEY(user.id), '1')
    setVisible(false)
  }

  async function generateCode() {
    setGenerating(true)
    await supabase.from('coach_invite_codes').update({ active: false }).eq('coach_id', user!.id)
    const code = (Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6)).toUpperCase()
    const { error } = await supabase.from('coach_invite_codes').insert({ coach_id: user!.id, code, active: true })
    if (!error) setInviteCode(code)
    setGenerating(false)
  }

  async function copyCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function goBuilder() {
    dismiss()
    router.push('/coach/builder')
  }

  /**
   * Saves the coach's own training answers, then moves on.
   *
   * Writes profiles.sport in the same ", "-joined shape the athlete
   * questionnaire uses, so the plan generator and the sport-specialist agent
   * read it identically for a coach and for a client.
   *
   * onboarding_status records that we asked, so a coach who says "no" is not
   * asked again on their next device. Tolerates the column not existing yet, so
   * this ships safely before 20260807_onboarding_status.sql is run.
   */
  async function saveSelfTraining(next: number) {
    if (!user) return
    setSavingSelf(true)
    setSelfError(null)

    const base: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() }
    if (selfTrains) {
      const joined = joinSports(sports, customSport)
      if (joined) base.sport = joined
    }
    const withStatus = {
      ...base,
      onboarding_status: selfTrains ? 'completed' : 'skipped',
      onboarding_updated_at: new Date().toISOString(),
    }

    let { error } = await supabase.from('profiles').upsert(withStatus, { onConflict: 'id' })
    if (error && /onboarding_status|onboarding_updated_at/.test(error.message)) {
      ({ error } = await supabase.from('profiles').upsert(base, { onConflict: 'id' }))
    }
    setSavingSelf(false)

    // Surfaced rather than swallowed: a silent failure here is how the athlete
    // questionnaire ended up asking the same person the same things forever.
    if (error) { setSelfError(error.message); return }
    setStep(next)
  }

  if (!visible) return null

  const totalSteps = 4

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 300,
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 520,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '40px 40px 32px',
        zIndex: 301,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 36 }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              width: i + 1 === step ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background: i + 1 <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* ── STEP 1: WELCOME ───────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🏋️</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>
              Welcome, {name}!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 32, maxWidth: 380, margin: '0 auto 32px' }}>
              Your Coach Portal is ready. In three quick steps we'll set up your own training, generate your client invite code, and build your first program. Takes about 2 minutes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '14px', borderRadius: 12, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Get Started →
              </button>
              <button onClick={dismiss} style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
                Skip setup — take me to the dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: DO YOU TRAIN YOURSELF? ────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Step 1 of 3
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 10 }}>
              Do you train yourself too?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
              Your coaching account includes the full athlete app, so you can run your own training here alongside your clients.
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
              <strong style={{ color: 'var(--text-mid)' }}>Why we ask:</strong> you are the professional here, so this is not a fitness quiz. It is the only thing the AI needs in order to write <em>you</em> a real program instead of a generic one. Two ways to train yourself, and you can use either: let the AI build it from your sports below, or build a program by hand in the builder and assign it to yourself. Nothing here affects your clients.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {[
                { val: true,  label: 'Yes, I train too', sub: 'Set up my own plan' },
                { val: false, label: 'No, clients only', sub: 'Skip this' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => { setSelfTrains(opt.val); setSelfError(null) }}
                  style={{
                    flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    border: `1.5px solid ${selfTrains === opt.val ? 'var(--accent)' : 'var(--border)'}`,
                    background: selfTrains === opt.val ? 'rgba(255,92,53,0.10)' : 'var(--surface2)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: selfTrains === opt.val ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            {selfTrains === true && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                  What do you train for? Pick as many as apply
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {SPORTS.map(s => {
                    const on = sports.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSport(s)}
                        style={{
                          padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 13, fontWeight: on ? 700 : 500, transition: 'all 0.15s',
                          border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                          background: on ? 'rgba(255,92,53,0.12)' : 'var(--surface2)',
                          color: on ? 'var(--accent)' : 'var(--text-mid)',
                        }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
                {sports.includes('Other') && (
                  <input
                    value={customSport}
                    onChange={e => setCustomSport(e.target.value)}
                    placeholder="e.g. Powerlifting, Rock climbing…"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--surface2)',
                      color: 'var(--text)', fontSize: 16, outline: 'none',
                      fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                )}
                <p style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 12 }}>
                  You can add height, weight, injuries and training history anytime in your Profile. The more it knows, the better your own programming gets.
                </p>
              </div>
            )}

            {selfError && (
              <p style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5, marginBottom: 14, fontFamily: 'monospace' }}>
                Could not save: {selfError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Back
              </button>
              <button
                onClick={() => selfTrains === null ? setStep(3) : saveSelfTraining(3)}
                disabled={savingSelf}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: savingSelf ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingSelf ? 0.7 : 1 }}
              >
                {savingSelf ? 'Saving…' : selfTrains === null ? 'Skip for now →' : 'Continue →'}
              </button>
            </div>
            <button onClick={dismiss} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 0', width: '100%' }}>
              Skip setup
            </button>
          </div>
        )}

        {/* ── STEP 3: INVITE CODE ───────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Step 2 of 3
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 10 }}>
              Your client invite code
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24 }}>
              Share this code with your clients. They enter it in their Account page and instantly appear on your roster. You can regenerate it anytime.
            </p>

            {inviteCode ? (
              <>
                <div style={{
                  background: 'var(--surface2)', border: '1px solid var(--accent-border, rgba(59,130,246,0.3))',
                  borderRadius: 14, padding: '20px', marginBottom: 14, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Your Code
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.2em', fontFamily: 'monospace', color: 'var(--accent)', marginBottom: 16 }}>
                    {inviteCode}
                  </div>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: '10px 24px', borderRadius: 9, border: 'none',
                      background: copied ? '#22c55e' : 'var(--accent)', color: '#fff',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {copied ? '✓ Copied!' : 'Copy Code'}
                  </button>
                </div>
                <button
                  onClick={generateCode}
                  disabled={generating}
                  style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 20 }}
                >
                  {generating ? 'Regenerating…' : '↺ Regenerate code'}
                </button>
              </>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={generateCode}
                  disabled={generating}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4,
                  }}
                >
                  {generating ? 'Generating…' : '+ Generate My Invite Code'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(2)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {inviteCode ? 'Continue →' : 'Skip for now →'}
              </button>
            </div>
            <button onClick={dismiss} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 0', width: '100%' }}>
              Skip setup
            </button>
          </div>
        )}

        {/* ── STEP 4: BUILD FIRST PROGRAM ───────────────────────────────────── */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 12 }}>
              You're all set!
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 8 }}>
              {inviteCode
                ? <>Your code is <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{inviteCode}</strong> — share it with clients. </>
                : ''}
              Now build your first program so you're ready to assign it the moment a client joins.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: selfTrains ? 12 : 32, lineHeight: 1.6 }}>
              The AI builder can generate a full periodized program in 30 seconds. Or you can build one manually, your choice.
            </p>
            {selfTrains && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 32, lineHeight: 1.6, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
                Training yourself works the same way: build a program here and pick <strong style={{ color: 'var(--text-mid)' }}>yourself</strong> when you assign it. It shows up in your own app under My Coach. Or let the AI write you one from the sports you just picked.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={goBuilder}
                style={{
                  padding: '14px', borderRadius: 12, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                🛠 Build First Program
              </button>
              <button
                onClick={dismiss}
                style={{
                  padding: '12px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-dim)', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
