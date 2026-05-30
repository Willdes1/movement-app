'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const STORAGE_KEY = (id: string) => `coach_onboarded_${id}`

export default function OnboardingOverlay() {
  const { user } = useAuth()
  const router   = useRouter()

  const [visible, setVisible]     = useState(false)
  const [step, setStep]           = useState(1)        // 1 welcome · 2 invite · 3 done
  const [name, setName]           = useState('')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]       = useState(false)

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

  if (!visible) return null

  const totalSteps = 3

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
              Your Coach Portal is ready. In two quick steps you'll generate your client invite code and build your first program. Takes about 2 minutes.
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

        {/* ── STEP 2: INVITE CODE ───────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Step 1 of 2
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
                onClick={() => setStep(1)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
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

        {/* ── STEP 3: BUILD FIRST PROGRAM ───────────────────────────────────── */}
        {step === 3 && (
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
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 32, lineHeight: 1.6 }}>
              The AI builder can generate a full periodized program in 30 seconds. Or you can build one manually — your choice.
            </p>

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
