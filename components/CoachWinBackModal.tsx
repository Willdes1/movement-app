'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCoached } from '@/contexts/CoachedContext'

// Shown once per ended coach assignment: "Are you still working with a coach?"
// "No" pitches the Atlas Prime AI program — the app becomes their coach.

export default function CoachWinBackModal() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, effectiveUserId, role } = useAuth()
  const { coached, loading, endedAssignment } = useCoached()
  const userId = effectiveUserId ?? user?.id ?? ''

  const [show, setShow] = useState(false)
  const [step, setStep] = useState<'ask' | 'pitch'>('ask')

  useEffect(() => {
    if (loading || coached || !endedAssignment || !userId) { setShow(false); return }
    if (role === 'coach') return // coaches manage their own programming
    if (
      pathname.startsWith('/admin') || pathname.startsWith('/auth') ||
      pathname.startsWith('/coach') || pathname.startsWith('/legal')
    ) return
    const key = `coach_winback_${userId}_${endedAssignment.id}`
    if (localStorage.getItem(key)) return
    setStep('ask')
    setShow(true)
  }, [loading, coached, endedAssignment, userId, role, pathname])

  function dismiss() {
    if (endedAssignment && userId) {
      localStorage.setItem(`coach_winback_${userId}_${endedAssignment.id}`, '1')
    }
    setShow(false)
  }

  function goGenerate() {
    dismiss()
    router.push('/plan')
  }

  if (!show || !endedAssignment) return null

  const coachFirst = endedAssignment.coachName.split(' ')[0] || 'your coach'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 36px', width: '100%', maxWidth: 480, border: '1px solid var(--border)', borderBottom: 'none' }}>

        {step === 'ask' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
            <p style={{ fontSize: 21, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Are you still working with a coach?
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
              Your program{endedAssignment.programName ? ` "${endedAssignment.programName}"` : ''} with Coach {coachFirst} has ended.
            </p>
            <button
              onClick={() => setStep('pitch')}
              style={{ display: 'block', width: '100%', padding: '15px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 10, fontFamily: 'inherit' }}
            >
              No — I&apos;m training on my own now
            </button>
            <button
              onClick={dismiss}
              style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Yes — still with my coach
            </button>
          </>
        )}

        {step === 'pitch' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
            <p style={{ fontSize: 21, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Let Atlas Prime be your coach.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.6 }}>
              Get a personalized training program built around your sport, goals, schedule, and injury history — generated in about 2 minutes, with new workouts every week.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {[
                'Programs tailored to your profile',
                'Daily workouts with coaching cues & read-aloud',
                'Progress tracking, streaks & personal bests',
              ].map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-mid)' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 900 }}>✓</span> {line}
                </div>
              ))}
            </div>
            <button
              onClick={goGenerate}
              style={{ display: 'block', width: '100%', padding: '15px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 10, fontFamily: 'inherit', boxShadow: '0 6px 24px var(--accent-shadow)' }}
            >
              Generate My Program →
            </button>
            <button
              onClick={dismiss}
              style={{ display: 'block', width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', color: 'var(--text-dim)', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  )
}
