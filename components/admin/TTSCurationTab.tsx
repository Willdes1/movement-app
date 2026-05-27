'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TTSCurationTab() {
  const [total, setTotal] = useState(0)
  const [withTTS, setWithTTS] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function loadStats() {
    setLoading(true)
    const [totalRes, withRes] = await Promise.all([
      supabase.from('exercise_library').select('id', { count: 'exact', head: true }),
      supabase.from('exercise_library').select('id', { count: 'exact', head: true }).not('tts_url_male', 'is', null),
    ])
    setTotal(totalRes.count ?? 0)
    setWithTTS(withRes.count ?? 0)
    setLoading(false)
  }

  useEffect(() => { loadStats() }, [])

  async function runGeneration() {
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/generate-tts', { method: 'POST' })
      const data = await res.json()
      setResult(data.message ?? data.error ?? 'Done')
      await loadStats()
    } catch (e) {
      setResult(String(e))
    } finally {
      setGenerating(false)
    }
  }

  const pct = total > 0 ? Math.round((withTTS / total) * 100) : 0
  const remaining = total - withTTS
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
          TTS Audio Library
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Pre-generates OpenAI TTS audio (onyx male + nova female) for every exercise. Once generated,
          audio serves from CDN with zero lag. Users who trigger missing exercises auto-backfill the library.
        </p>
      </div>

      {/* Progress panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        {/* Ring */}
        <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
          <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--surface2)" strokeWidth={8} />
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--accent)" strokeWidth={8}
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{loading ? '…' : `${pct}%`}</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            TTS Coverage
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)', marginBottom: 4 }}>
            {loading ? '…' : withTTS}
            <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, marginLeft: 6 }}>of {total} exercises</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {loading ? '' : `${remaining} remaining · ~${Math.ceil(remaining / 25)} runs at 25/batch`}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={runGeneration}
          disabled={generating || remaining === 0}
          style={{
            padding: '12px 20px', borderRadius: 10, border: 'none', fontFamily: 'inherit',
            background: generating || remaining === 0 ? 'var(--surface2)' : 'var(--accent)',
            color: generating || remaining === 0 ? 'var(--text-dim)' : '#fff',
            fontWeight: 700, fontSize: 13, cursor: generating || remaining === 0 ? 'not-allowed' : 'pointer',
            opacity: generating ? 0.7 : 1, flexShrink: 0,
          }}
        >
          {generating ? 'Generating…' : remaining === 0 ? '✓ All Done' : '🎙 Generate 25'}
        </button>
      </div>

      {result && (
        <div style={{ padding: '12px 14px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 10, fontSize: 12, color: 'var(--green)', marginBottom: 20, lineHeight: 1.6 }}>
          {result}
        </div>
      )}

      {/* How it works */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          How It Works
        </div>
        {[
          { icon: '🎙', title: 'Pre-generate (admin)', desc: 'Click "Generate 25" daily to batch-process exercises. Each run generates both male (onyx) and female (nova) voices and uploads to Supabase Storage.' },
          { icon: '⚡', title: 'Instant playback', desc: 'When an exercise has a pre-generated URL, tapping the speaker plays instantly from CDN — zero API call, zero lag.' },
          { icon: '🔄', title: 'Auto-backfill by users', desc: 'If a user taps the speaker on an exercise not yet generated, the real-time API generates it, saves it to storage, and updates the library. The next listener gets it instantly.' },
          { icon: '💰', title: 'One-time cost', desc: 'Each exercise is generated once. Total cost for the full 752-exercise library: ~$7 for both voices. Storage: ~100MB, well within Supabase free tier.' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
