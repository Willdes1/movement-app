'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type FeedCard = {
  type: 'tip' | 'mindset'
  sport?: string
  principle?: string
  title: string
  body: string
  cue?: string
}

function DumbbellSparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="1" y="10" width="3" height="7" rx="1.2"/>
      <rect x="4" y="11.5" width="2" height="4" rx="0.5"/>
      <rect x="6" y="12.5" width="12" height="2" rx="1"/>
      <rect x="18" y="11.5" width="2" height="4" rx="0.5"/>
      <rect x="20" y="10" width="3" height="7" rx="1.2"/>
      <path d="M20 1.5 L20.7 3.3 L22.5 4 L20.7 4.7 L20 6.5 L19.3 4.7 L17.5 4 L19.3 3.3 Z"/>
      <path d="M5 1.5 L5.45 2.55 L6.5 3 L5.45 3.45 L5 4.5 L4.55 3.45 L3.5 3 L4.55 2.55 Z"/>
      <circle cx="22" cy="8" r="0.9"/>
    </svg>
  )
}

const PRINCIPLE_DESC: Record<string, string> = {
  Mushin:   'No-mind · Act without overthinking',
  Kaizen:   'Small gains · Compound over time',
  Shokunin: 'Master the process · Not the result',
  Zanshin:  'Relaxed awareness · Present in every action',
  Fudoshin: 'Immovable mind · Steady under pressure',
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function ForYouPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [cards, setCards] = useState<FeedCard[] | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: profileData }, { data: feedData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('for_you_feed').select('cards, generated_at').eq('user_id', user.id).single(),
    ])
    if (profileData) setProfile(profileData)
    if (feedData) {
      setCards(feedData.cards as FeedCard[])
      setGeneratedAt(feedData.generated_at)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  async function generate() {
    if (!profile) return
    setShowModal(false)
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      if (!res.ok) throw new Error('Failed')
      const { cards: newCards } = await res.json()
      const now = new Date().toISOString()
      await supabase.from('for_you_feed').upsert({
        user_id: user!.id,
        cards: newCards,
        generated_at: now,
        updated_at: now,
      })
      setCards(newCards)
      setGeneratedAt(now)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (authLoading || loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
  }

  const hasProfile = Boolean(profile?.sport || profile?.goal)

  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>For You</h1>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {generatedAt ? `Updated ${daysAgo(generatedAt)}` : 'Sport tips + warrior mindset coaching'}
          </p>
        </div>
        {cards && !generating && (
          <button
            onClick={() => setShowModal(true)}
            title="Refresh feed"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', marginTop: 4 }}
          >
            <DumbbellSparkleIcon size={18}/>
          </button>
        )}
      </div>

      {/* No profile */}
      {!hasProfile && !generating && (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Set up your profile first</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
            Your feed is personalized to your sport and goals. Add those to your profile and come back.
          </p>
          <button
            onClick={() => router.push('/profile')}
            style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Go to Profile →
          </button>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, color: 'var(--accent)' }}>
            <DumbbellSparkleIcon size={48}/>
          </div>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Building your feed…</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
            Personalizing sport tips and warrior mindset coaching. Takes about 10 seconds.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--orange-bg)', border: '1px solid var(--orange-border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* No feed yet */}
      {!cards && !generating && hasProfile && (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18, color: 'var(--accent)' }}>
            <DumbbellSparkleIcon size={44}/>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Your feed is ready to build</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.6 }}>
            Sport-specific performance tips and Japanese warrior mindset coaching — personalized to your profile and goals.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '13px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10 }}
          >
            <DumbbellSparkleIcon size={18}/> Generate My Feed
          </button>
        </div>
      )}

      {/* Feed */}
      {cards && !generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cards.map((card, i) => {
            const isTip = card.type === 'tip'
            const color  = isTip ? 'var(--accent)'        : 'var(--yellow)'
            const bg     = isTip ? 'var(--accent-bg)'     : 'var(--yellow-bg)'
            const border = isTip ? 'var(--accent-border)' : 'var(--yellow-border)'

            return (
              <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: '18px' }}>

                {/* Badge row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--surface)', padding: '3px 9px', borderRadius: 10, border: `1px solid ${border}` }}>
                    {isTip ? `${card.sport ?? 'Sport'} Tip` : card.principle ?? 'Mindset'}
                  </span>
                  {!isTip && card.principle && PRINCIPLE_DESC[card.principle] && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      {PRINCIPLE_DESC[card.principle]}
                    </span>
                  )}
                </div>

                {/* Title */}
                <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, lineHeight: 1.35, color: 'var(--text)' }}>
                  {card.title}
                </p>

                {/* Body */}
                <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.75, marginBottom: card.cue ? 12 : 0 }}>
                  {card.body}
                </p>

                {/* Cue */}
                {card.cue && (
                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2, flexShrink: 0 }}>Cue</span>
                    <span style={{ fontSize: 13, color, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.4 }}>
                      {card.cue}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
              Generated {generatedAt ? formatDate(generatedAt) : ''} · Refreshes monthly
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{ fontSize: 12, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 16, padding: '6px 16px', cursor: 'pointer' }}
            >
              Refresh feed
            </button>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--accent)' }}><DumbbellSparkleIcon size={26}/></span>
              <p style={{ fontSize: 18, fontWeight: 700 }}>
                {cards ? 'Refresh your feed?' : 'Generate your feed?'}
              </p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
              {cards
                ? 'Replaces your current feed with fresh sport tips and warrior mindset coaching based on your profile.'
                : 'Generates personalized performance tips and Japanese warrior mindset coaching based on your sport and goals.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={generate}
                style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                {cards ? 'Refresh →' : 'Generate →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
