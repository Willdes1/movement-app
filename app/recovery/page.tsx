'use client'
import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const playbooks = [
  { href: '/recovery/si-joint',    title: 'SI Joint Recovery',      desc: 'Sacroiliac joint dysfunction — 4-phase return-to-sport protocol', phase: '4 Phases', exercises: '80+ exercises', color: 'var(--orange)' },
  { href: '/recovery/elbow',       title: 'Elbow Recovery',          desc: 'Hyperextended or sprained elbow — 6-phase RICE to full sport return', phase: '6 Phases', exercises: '40+ exercises', color: 'var(--accent)' },
  { href: '/recovery/shoulder',    title: 'Shoulder Impingement',    desc: 'Subacromial impingement — 4-phase rotator cuff & scapular protocol', phase: '4 Phases', exercises: '35+ exercises', color: '#00d4aa' },
  { href: '/recovery/knee',        title: 'Knee Rehab',              desc: 'General knee rehabilitation — 4-phase return-to-sport protocol', phase: '4 Phases', exercises: '40+ exercises', color: '#a78bfa' },
]

type RecoveryExercise = {
  name_display: string
  name_normalized?: string
  how: string
  breathing?: string
  tip: string
  tts_url_male?: string | null
  tts_url_female?: string | null
  fromLibrary?: boolean
}

export default function RecoveryPage() {
  const [askOpen, setAskOpen] = useState(false)
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [exercises, setExercises] = useState<RecoveryExercise[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [fromLibrary, setFromLibrary] = useState(false)

  async function handleAskAI() {
    if (!situation.trim()) return
    setLoading(true)
    setExercises([])
    setExpandedIdx(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/user/ask-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ situation }),
      })
      const data = await resp.json()
      setExercises(data.exercises ?? [])
      setFromLibrary(data.fromLibrary ?? false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Recovery</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>Structured return-to-sport playbooks</p>

      {/* Ask AI Section */}
      <div style={{ marginBottom: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <button
          onClick={() => setAskOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,180,255,0.1)', border: '1px solid rgba(0,180,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Ask AI</p>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'rgba(0,180,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,180,255,0.2)' }}>AI</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Pain, soreness, tightness? Describe it — get 5 targeted recovery drills.</p>
          </div>
          <span style={{ fontSize: 16, color: 'var(--text-dim)', transform: askOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</span>
        </button>

        {askOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px 18px' }}>
            <textarea
              value={situation}
              onChange={e => setSituation(e.target.value)}
              placeholder="e.g. 'hip flexors tight after skating yesterday' or 'lower back tight, pain when bending forward'"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: 10, lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {exercises.length > 0 && (
                <button
                  onClick={handleAskAI}
                  disabled={loading || !situation.trim()}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-mid)', fontSize: 12, cursor: loading || !situation.trim() ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  {loading ? '…' : '🔄 Refresh'}
                </button>
              )}
              <button
                onClick={handleAskAI}
                disabled={loading || !situation.trim()}
                style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: loading || !situation.trim() ? 'var(--surface2)' : 'var(--accent)', color: loading || !situation.trim() ? 'var(--text-dim)' : '#fff', fontSize: 13, cursor: loading || !situation.trim() ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
              >
                {loading ? 'Finding exercises…' : 'Get Recovery Drills'}
              </button>
            </div>

            {/* Results */}
            {exercises.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {fromLibrary ? 'From your exercise library' : 'AI Recommendations'}
                </p>
                {exercises.map((ex, i) => (
                  <div key={i} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <p style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ex.name_display}</p>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', transform: expandedIdx === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                    </button>
                    {expandedIdx === i && (
                      <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ex.how && (
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>HOW TO DO IT</p>
                            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.how}</p>
                          </div>
                        )}
                        {ex.tip && (
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>COACHING TIP</p>
                            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.tip}</p>
                          </div>
                        )}
                        {ex.breathing && (
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>BREATHING</p>
                            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{ex.breathing}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playbooks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {playbooks.map(pb => (
          <Link
            key={pb.href}
            href={pb.href}
            style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px', textDecoration: 'none', color: 'var(--text)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: pb.color, flexShrink: 0 }} />
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>{pb.title}</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12 }}>{pb.desc}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{pb.phase}</span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>{pb.exercises}</span>
            </div>
          </Link>
        ))}

        {/* Return to Sport */}
        <Link
          href="/recovery/return-to-sport"
          style={{ display: 'block', background: 'linear-gradient(135deg, rgba(120,60,0,0.35) 0%, rgba(60,25,0,0.55) 100%)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: 14, padding: '18px', textDecoration: 'none', color: 'var(--text)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(255,140,0,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 8px var(--orange)', flexShrink: 0 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--orange)' }}>Injury Recovery Plan</h2>
            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,140,0,0.12)', color: 'var(--orange)', border: '1px solid rgba(255,140,0,0.22)' }}>AI</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 12 }}>
            Tell us what you hurt and what your doctor said. Atlas Prime AI builds a custom phase-by-phase recovery protocol.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', color: 'var(--orange)' }}>Injury intake</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', color: 'var(--orange)' }}>Phased</span>
          </div>
        </Link>

        {/* Anatomy Explorer */}
        <Link
          href="/recovery/anatomy"
          style={{ display: 'block', background: 'linear-gradient(135deg, rgba(0,40,120,0.45) 0%, rgba(0,20,60,0.6) 100%)', border: '1px solid rgba(0,180,255,0.22)', borderRadius: 14, padding: '18px', textDecoration: 'none', color: 'var(--text)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(0,180,255,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', flexShrink: 0 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>Anatomy Explorer</h2>
            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(0,180,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,180,255,0.2)' }}>Beta</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 12 }}>
            Interactive 3D body map — explore bones, joints, muscles, and recovery protocols.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.18)', color: 'var(--accent)' }}>206 Bones</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.18)', color: 'var(--accent)' }}>360 Joints</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.18)', color: '#00ff88' }}>SI Joint Live</span>
          </div>
        </Link>
      </div>

      <div style={{ marginTop: 24, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>More playbooks coming soon.<br />Hip flexor, hamstring, ankle, and wrist protocols in development.</p>
      </div>
    </div>
  )
}
