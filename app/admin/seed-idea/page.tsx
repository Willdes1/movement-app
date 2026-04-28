'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const CONTENT = `Platform Concept: Trainers, Therapists & Coaches — B2B SaaS Layer

PROFESSIONAL TIER MODEL
Every trainer/therapist starts on a free version. They generate plans for clients by having each person fill out a profile. Free = lighter basic plans. Pro/Plus/Supreme unlock advanced AI-powered programming. Advanced modules branded as "Nuggets" — Athlean-X quality, our own unique system.

CLIENT PROFILE TIERS (professionals)
- Pro: up to 10 client/patient profiles
- Plus: up to 20 profiles
- Supreme: 50+ profiles
Supreme should be the aspirational top tier. Continue brainstorming pricing and limits.

CLIENT PORTAL
Each client/patient gets their own portal with daily goals: exercises, mobility work, water intake, diet guidance — all assigned by trainer or therapist. Professional admin panel tracks missed days, incomplete tasks, engagement metrics. Mission: give great trainers and therapists an easier way to coach people consistently, with AI behind the scenes.

CONSUMER TIERS
- Free: basic workouts (push-ups, pull-ups, jumping jacks) — taste of the platform
- Pro: customized workout plan
- Plus: customized workout plan + nutrition plan
- Supreme: workout + nutrition + premium professional content

PROFESSIONAL CONTENT MARKETPLACE (Supreme tier)
AI recommends videos, programs, and experts based on user's sports and goals. Users can hire a personal trainer in their area directly through the platform.

MARKETPLACE GROWTH STRATEGY
Build millions of users, then sell the platform to professionals using real metrics: active users, demographics, age ranges, income brackets, geographic hotspots. Example: high-income users in Irvine searching for PT → local professionals acquire those clients through platform data.

BUILT-IN MARKETING FOR PROFESSIONALS
Metrics: profile clicks, leads generated, user inquiries, conversion rates, traffic source.
Automation features: intro emails, goal intake forms, pricing walkthroughs, automated follow-up systems. Professionals generate clients while automating their sales funnel through the platform.

EXPANSION OPPORTUNITIES
Occupational therapists, rehab specialists, mental performance coaches, sports recovery experts, climbing coaches, doctors using movement-based rehab. All rely on repeatable exercises and progress tracking — AI improves all of it.`

export default function SeedIdeaPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  if (!isAdmin) return (
    <div style={{ padding: 40, color: '#ef4444' }}>Access denied — admin only.</div>
  )

  async function save() {
    setStatus('saving')
    const { error } = await supabase.from('ideas').insert({
      content: CONTENT,
      category: 'Business Model',
    })
    if (error) { console.error(error); setStatus('error') }
    else setStatus('done')
  }

  return (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Seed Idea — One-time use</h1>
      <p style={{ color: '#6e7681', fontSize: 13, marginBottom: 24 }}>
        This will insert the Platform Concept idea into the ideas table.
      </p>

      <pre style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
        padding: 20, fontSize: 12, color: '#b1bac4', whiteSpace: 'pre-wrap',
        lineHeight: 1.6, marginBottom: 24, maxHeight: 400, overflowY: 'auto',
      }}>
        {CONTENT}
      </pre>

      {status === 'idle' && (
        <button
          onClick={save}
          style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          Save to Ideas Table
        </button>
      )}
      {status === 'saving' && <p style={{ color: '#3b82f6' }}>Saving…</p>}
      {status === 'done' && (
        <div>
          <p style={{ color: '#22c55e', fontWeight: 700, marginBottom: 12 }}>Saved. You can delete this page now.</p>
          <button onClick={() => router.push('/admin')} style={{ padding: '10px 20px', background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Back to Admin →
          </button>
        </div>
      )}
      {status === 'error' && <p style={{ color: '#ef4444', fontWeight: 700 }}>Error — check console.</p>}
    </div>
  )
}
