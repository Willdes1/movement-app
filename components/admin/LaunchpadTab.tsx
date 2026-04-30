'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GIT_STATS from '@/lib/git-stats.json'

// ─── PALETTE (matches admin portal) ──────────────────────────────────────────
const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.1)', greenBorder: 'rgba(34,197,94,0.25)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.1)', amberBorder: 'rgba(245,158,11,0.25)',
  red: '#ef4444', purple: '#a78bfa', purpleDim: 'rgba(167,139,250,0.1)',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

// ─── ASSET CATEGORIES ────────────────────────────────────────────────────────
const ASSET_CATS = ['All', 'Logos', 'Marketing', 'Legal', 'Pitch Deck', 'Research', 'Nutrition', 'Other']
const UPLOAD_CATS = ASSET_CATS.filter(c => c !== 'All')

type AssetRow = { id: string; name: string; category: string; storage_path: string; url: string | null; size: number | null; mime_type: string | null; notes: string | null; created_at: string }

// ─── PROMPTS DATA ─────────────────────────────────────────────────────────────
const PROMPTS = [
  {
    id: 'logo',
    title: 'Logo & Visual Identity',
    category: 'Branding',
    color: C.accent,
    colorDim: C.accentDim,
    body: `I'm building a fitness and recovery app called [working title: Move.]. The app uses Claude AI to generate personalized 13-week training programs, manages injury recovery through a 4-phase system, and coaches athletes through Japanese warrior philosophy (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin). Target users: serious athletes, active people recovering from injuries, and fitness professionals (trainers, physical therapists, coaches).

Design aesthetic: Dark background (#0c0c0f), bold orange-red accent (#FF5C35), high energy, precision, warrior mindset — inspired by Nike Training Club x Athlean-X x Japanese martial arts.

Please help me brainstorm:
1. Logo concepts — wordmark vs. icon vs. combination mark. What visual metaphors work? (movement, fire, flow, warrior, precision). How does each look as an app icon (small square)?
2. Name ideas — we're open to changing from "Move." Something short, memorable, powerful, domain-available. Think: what's the Notion, Figma, or Arc of fitness apps? Avoid generic words like FitLife, GymPro.
3. Midjourney/DALL-E prompts — write 5 specific image generation prompts to explore logo directions.
4. Visual system — suggest a full color palette, typography direction, and icon style that works across dark mode mobile app, marketing materials, and a professional B2B portal.`,
  },
  {
    id: 'naming',
    title: 'Business Name & Trademark',
    category: 'Legal',
    color: C.amber,
    colorDim: C.amberDim,
    body: `I need to choose a final business name for a fitness + recovery AI app. Current working name is "Move." but I want to explore options before trademark filing.

App overview: AI-generated personalized workout plans, phase-based injury recovery, sport-specific programming, Japanese warrior mindset coaching. Two revenue streams: B2C subscriptions and B2B SaaS for trainers/physical therapists/coaches.

Please help me:
1. Generate 30 potential business names — short (1-2 syllables preferred), memorable, not already a major fitness brand, appropriate for trademark. Consider English, Japanese (given the warrior philosophy), and invented words.
2. For each name, rate: memorability (1-10), fitness relevance (1-10), trademark risk estimate (low/med/high), domain availability likelihood.
3. Highlight your top 5 with reasoning.
4. Suggest which trademark classes to file under (International Class 41 for fitness services? Class 44 for health services? Both?).
5. Note any naming pitfalls specific to health/fitness apps we should avoid legally.`,
  },
  {
    id: 'legal',
    title: 'Legal, Disclaimers & Compliance',
    category: 'Legal',
    color: C.red,
    colorDim: 'rgba(239,68,68,0.1)',
    body: `I'm building a fitness and recovery app that generates AI-powered workout plans and injury recovery protocols. I need help drafting key legal language. Here's the full picture:

What the app does: Generates 13-week personalized training programs using Claude AI. Offers phase-based injury recovery playbooks (currently: SI Joint 4-phase, 82 exercises). Will add an AI nutrition agent (3-month meal plans). Will include a B2B portal where trainers and physical therapists manage client/patient profiles. Will eventually include a marketplace where users hire local trainers through the platform.

Legal areas I need help with:
1. Medical disclaimer — clear UI and ToS language protecting us from liability while being honest (fitness guidance, not medical treatment).
2. Professional liability — language for the B2B portal making clear that trainers/PTs are the responsible practitioners, not the platform.
3. Privacy policy outline — GDPR + CCPA considerations for health data (injury type, body metrics), activity data, workout logs, and wearable data (Oura Ring, Apple Watch).
4. AI-generated content disclaimer — who owns the AI-generated workout plans? What should our ToS say?
5. Marketplace liability — when a user hires a trainer through our platform and something goes wrong, what does our liability clause need to say?
6. Subscription and refund policy — required language for App Store and Google Play distribution.

Please draft sample language for each section and flag areas where I must consult a licensed attorney before publishing.`,
  },
  {
    id: 'marketing',
    title: 'Marketing Strategy & Growth',
    category: 'Marketing',
    color: C.green,
    colorDim: C.greenDim,
    body: `I'm building an AI fitness and recovery app. Full context: personalized 13-week training plans, 4-phase injury recovery, sport-specific programming, Japanese warrior mindset coaching, B2C subscriptions + B2B SaaS for fitness professionals, and eventually a marketplace where users hire trainers in-app.

Target audiences:
- Consumer: Athletes (skateboarders, snowboarders, tennis players, gym-goers), people recovering from injuries (back pain, shoulder, knee), fitness enthusiasts who want personalization beyond YouTube
- Professional: Personal trainers, physical therapists, occupational therapists, sports coaches

Current stage: Working product live, beta testing, pre-revenue. Building toward public launch.

Please build me a detailed go-to-market strategy:
1. Pre-launch community strategy — specific subreddits, Facebook groups, Discord servers, and online communities to target. What content to post? What NOT to do?
2. Content marketing plan — blog post topics, YouTube video ideas, TikTok/Instagram content angles. Include 10 specific post/video titles.
3. Influencer strategy — what type of creators to partner with? How to structure deals at pre-revenue stage?
4. Professional seeding strategy — how to get PTs and trainers to adopt the platform before the B2B portal is publicly launched?
5. Paid acquisition — which channels, audiences, and ad creative angles work best? Include specific Facebook/Meta audience targeting suggestions.
6. LLM/AI search visibility — how do I make sure the app appears in AI-generated search results (ChatGPT, Perplexity, Claude) when people ask for personalized workout apps or injury recovery apps?`,
  },
  {
    id: 'investor',
    title: 'Investor Pitch & Business Plan',
    category: 'Strategy',
    color: C.purple,
    colorDim: C.purpleDim,
    body: `I'm preparing materials to attract seed-stage investors and strategic partners for a fitness tech startup. Full company context:

Product: AI-powered fitness and recovery platform. Built and live. Core features: Claude AI generates personalized 13-week workout plans, 4-phase injury recovery system (82+ exercises), global exercise library with AI cues, sport-specific programming, Japanese warrior mindset coaching, workout logging, calendar, admin portal.

Business model:
- B2C: Free (basic workouts) → Pro (AI plans) → Plus (plans + nutrition) → Supreme (plans + nutrition + professional content + marketplace)
- B2B: Trainers/PTs/coaches get a professional portal. Pro (10 clients) → Plus (20 clients) → Supreme (50+ clients + marketing tools + revenue-sharing)
- Marketplace: Users hire local trainers in-app. Platform takes a commission.

Market: Global fitness app market projected $96B by 2032 (22.8% CAGR). Physical therapy software $3.2B. AI in health/wellness $45B by 2030.

Competitive position: No direct competitor combines AI-personalized training + phase-based recovery + professional B2B + consumer marketplace in one platform.

Unique assets:
- Founder's published book on Japanese warrior philosophy is the IP behind the mindset AI agent
- Proprietary "Nuggets" advanced module system (like Athlean-X but AI-generated and personalized)
- Platform data at scale becomes a sales tool for professionals (demographics, location, injury patterns)
- Two-sided marketplace flywheel: more users → attracts professionals → professionals bring clients → client data improves AI

Please help me:
1. Write a compelling executive summary (200 words) for a pitch deck cover slide
2. Draft a problem/solution slide narrative
3. Identify the most compelling investor hook for a seed round — what makes this fundable?
4. Suggest metrics I should track and present to investors at pre-revenue stage
5. Identify potential strategic acquirers and explain why each would want this platform
6. Draft 3 cold outreach email subjects to get a first meeting with a fitness-focused angel investor`,
  },
  {
    id: 'pricing',
    title: 'Pricing Strategy',
    category: 'Strategy',
    color: C.amber,
    colorDim: C.amberDim,
    body: `I need to finalize pricing for a fitness AI app with two revenue streams: a consumer subscription and a B2B SaaS tier for fitness professionals.

Consumer tiers: Free (basic workouts) → Pro (full AI plan) → Plus (AI plan + nutrition) → Supreme (everything + professional content marketplace)

Professional B2B tiers: Free trial → Pro (10 client profiles) → Plus (20 clients) → Supreme (50+ clients + marketing tools + marketplace listing + revenue share)

Context:
- Target consumer: athletes and active people, 22–45 years old, willing to invest in fitness
- Target professional: personal trainers ($40-150/hr), physical therapists ($80-250/hr) — software must feel like an investment, not an expense
- Competitors: Nike Training Club (free/ads), Fitbod ($12.99/mo), Trainerize ($10-20/mo per trainer), TrueCoach ($19-199/mo), Whoop ($30/mo)
- Our product is more capable than any single competitor — it deserves premium pricing

Please:
1. Recommend specific price points for all consumer and B2B tiers with reasoning
2. Suggest monthly vs. annual pricing for each segment (and what discount to offer for annual)
3. Design a promo code strategy for beta users that protects revenue while rewarding early adopters
4. Recommend a freemium conversion strategy — what's the right free tier limit to make the upgrade feel necessary?
5. Estimate realistic ARPU for consumer and B2B segments at steady state`,
  },
]

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────
function Label({ children, color = C.textDim }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>{children}</span>
}
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', ...style }}>{children}</div>
}

// ─── SUB-TAB NAV ──────────────────────────────────────────────────────────────
type SubTab = 'overview' | 'prompts' | 'assets' | 'ai'
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'prompts', label: '💬 Prompts' },
  { id: 'assets', label: '📁 Assets' },
  { id: 'ai', label: '✦ AI Generate' },
]

// ─── OVERVIEW SECTION ────────────────────────────────────────────────────────
function OverviewSection() {
  const BUILT = [
    'AI plan generator — 1/2/3-month bulk generation, all weeks built at once with live progress screen',
    'Phase-based training: Foundation → Build → Peak → Maintenance with per-phase intensity + rest times',
    'Rest times baked into every plan (between_sets + between_rounds, scaled by phase and load type)',
    'Daily session blocks — 6-block training days (morning/warmup/workout/abs/cooldown/evening), 3-block rest days',
    'SI Joint 4-phase recovery playbook (82+ exercises, dynamic theming)',
    'Elbow recovery 6-phase playbook (RICE → Passive ROM → Active ROM → Isometric → Progressive → Sport Return)',
    'Shoulder impingement 4-phase playbook (Posture reset, mobility, rotator cuff, return to function)',
    'Knee rehab 4-phase playbook (Protect, stability, strength, return to sport — includes hop test clearance)',
    'Custom injury recovery AI — describe any injury, get a multi-phase rehab plan with 6-block daily sessions',
    'Return-to-sport AI agent — sport-specific phase-by-phase return-to-play progression',
    'Global exercise library — AI cues + breathing tips generated once, reused platform-wide',
    'Calendar with 6-block expandable daily session view + day completion + Undo',
    'Workout logging (sets / reps / weight per exercise with personal best tracking)',
    'For You feed — sport tips + Japanese warrior mindset AI agent (Mushin, Kaizen, Zanshin)',
    'Multi-sport profile, equipment constraints, injury restrictions, home/gym awareness',
    'Anatomy Explorer — Jarvis HUD with clickable skeleton, joint matrix, recovery protocols',
    'Responsive desktop sidebar + mobile bottom nav with active state routing',
    'Admin Mission Control portal (analytics, users, todos, ideas, promos, launchpad)',
    'Auth gates, promo code system, F&F beta role, Vercel + Supabase + GitHub CI/CD',
    'Admin user impersonation — view the full app as any user via sessionStorage, red sticky banner, exit button',
    'Health Monitor — one-click scan of all pages, API routes, and DB tables with copy-paste Claude Code fix prompts',
  ]
  const COMING = [
    'Injury → training handoff: AI-modified safe training plan that runs alongside recovery',
    'Nutrition AI: 3-month meal plan synced to training phases + macro targets',
    'Stripe billing: Free → Pro → Plus → Supreme consumer tiers',
    'Professional B2B portal (trainers, PTs, coaches manage client profiles)',
    'Client portal: AI-assigned exercises, mobility, nutrition, accountability',
    'Health Monitor — auto-scans all routes, APIs, and DB tables with copy-paste fix prompts',
    'Wearable integration: Oura Ring, Apple Watch, Samsung Health',
    'Native iOS + Android via Capacitor wrapper',
    'Push notifications, streak system, accountability nudges',
  ]
  const MARKETS = [
    { label: 'Global Fitness App Market', val: '$96B by 2032', pct: 88, color: C.accent },
    { label: 'AI Health & Wellness', val: '$45B by 2030', pct: 70, color: C.purple },
    { label: 'Physical Therapy Software', val: '$3.2B growing 12%', pct: 32, color: C.green },
    { label: 'Personal Training B2B', val: '$1.8B growing 18%', pct: 20, color: C.amber },
  ]
  const COMPETITORS = [
    { name: 'Nike Training', aiPlan: '✗', recovery: '✗', b2b: '✗', mindset: '✗', nutrition: '✗', market: '✗' },
    { name: 'Whoop', aiPlan: '✗', recovery: '~ readiness', b2b: '✗', mindset: '✗', nutrition: '✗', market: '✗' },
    { name: 'Fitbod', aiPlan: '~ partial', recovery: '✗', b2b: '✗', mindset: '✗', nutrition: '✗', market: '✗' },
    { name: 'Trainerize', aiPlan: '✗', recovery: '✗', b2b: '✓', mindset: '✗', nutrition: '✗', market: '✗' },
    { name: 'Athlean-X', aiPlan: '✗', recovery: '✗', b2b: '✗', mindset: '✗', nutrition: '~ basic', market: '✗' },
  ]
  const ROADMAP = [
    { phase: 'Phase 1', label: 'Core Consumer App', status: 'done', items: 'AI plan generator (bulk 1/2/3-month) · Phase-based training with rest times · 6-block daily sessions · Exercise library · SI Joint + custom injury recovery · Return-to-sport agent · Calendar + undo completion · Workout logging · For You feed · Anatomy Explorer · Auth · Admin portal · CI/CD' },
    { phase: 'Phase 2', label: 'AI Agents + Monetization', status: 'active', items: 'Injury→training handoff (AI-modified safe plan during rehab) · Nutrition AI (3-month meal plan) · Stripe billing · Push notifications · Native iOS/Android · Wearable integration (Oura, Apple Watch)' },
    { phase: 'Phase 3', label: 'Professional B2B Portal', status: 'upcoming', items: 'Trainer/PT/coach accounts · Client profile management · Client portal · Admin impersonation (beta support) · Professional analytics dashboard · Engagement tracking' },
    { phase: 'Phase 4', label: 'Marketplace + Scale', status: 'upcoming', items: 'Hire local trainers in-app · Marketplace listings · Built-in marketing automation · Revenue-sharing · Platform data as B2B sales intelligence' },
    { phase: 'Phase 5', label: 'Enterprise + Partnerships', status: 'upcoming', items: 'White-label options · Insurance partnerships · University athletics licensing · International expansion · Strategic acquisition potential' },
  ]

  const dotColor = (s: string) => s === 'done' ? C.green : s === 'active' ? C.accent : C.border

  return (
    <div>
      {/* Dev Build Stats */}
      <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(167,139,250,0.07) 100%)', border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim, marginBottom: 4 }}>Built Solo · 1 Dev · 1 AI</p>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: C.text }}>{GIT_STATS.totalHours}<span style={{ fontSize: 16, fontWeight: 600, color: C.textMid, marginLeft: 4 }}>hrs logged</span></div>
        </div>
        <div style={{ width: 1, height: 44, background: C.border, flexShrink: 0 }} />
        {[
          { label: 'Coding Sessions', val: String(GIT_STATS.sessions), color: C.accent },
          { label: 'Active Days', val: String(GIT_STATS.activeDays), color: C.purple },
          { label: 'Total Commits', val: String(GIT_STATS.totalCommits), color: C.green },
          { label: 'Started', val: new Date(GIT_STATS.firstCommit + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: C.amber },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', minWidth: 60 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>Auto-updated on every build</div>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', marginTop: 2 }}>Last: {GIT_STATS.lastUpdated}</div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Addressable Market', val: '$96B', color: C.accent },
          { label: 'Market CAGR', val: '22.8%', color: C.green },
          { label: 'Revenue Streams', val: 'B2C + B2B', color: C.purple },
          { label: 'Direct Full-Vision Competitors', val: '0', color: C.amber },
        ].map(k => (
          <div key={k.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, borderTop: `2px solid ${k.color}` }}>
            <Label>{k.label}</Label>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginTop: 8, letterSpacing: '-0.02em' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Market bars */}
      <Panel style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Market Size at a Glance</h3>
        {MARKETS.map(m => (
          <div key={m.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <Label>{m.label}</Label>
              <Label color={m.color}>{m.val}</Label>
            </div>
            <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </Panel>

      {/* Built vs Coming */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <Panel style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <Label color={C.green}>Live & Working</Label>
          </div>
          {BUILT.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
              <span style={{ color: C.green, fontSize: 11, flexShrink: 0, marginTop: 2 }}>✓</span>
              <span style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </Panel>
        <Panel style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, boxShadow: `0 0 6px ${C.accent}` }} />
            <Label color={C.accent}>Building Next</Label>
          </div>
          {COMING.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
              <span style={{ color: C.accent, fontSize: 11, flexShrink: 0, marginTop: 2 }}>→</span>
              <span style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* Competitor table */}
      <Panel style={{ marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <Label>Competitive Landscape</Label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                {['Competitor', 'AI Plans', 'Recovery', 'B2B Portal', 'Mindset', 'Nutrition', 'Marketplace'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textDim, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
              <tr style={{ background: `rgba(59,130,246,0.08)` }}>
                <td style={{ padding: '10px 12px', fontWeight: 800, color: C.accent, borderBottom: `1px solid ${C.border}` }}>Move. (Us)</td>
                {['Full AI', '4-Phase', 'Planned', 'Unique IP', 'In Build', 'Planned'].map(v => (
                  <td key={v} style={{ padding: '10px 12px', color: C.green, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>✓ {v}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((comp, i) => (
                <tr key={comp.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}` }}>{comp.name}</td>
                  {[comp.aiPlan, comp.recovery, comp.b2b, comp.mindset, comp.nutrition, comp.market].map((v, vi) => (
                    <td key={vi} style={{ padding: '9px 12px', color: v === '✗' ? C.textDim : C.amber, borderBottom: `1px solid ${C.border}` }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Roadmap */}
      <Panel style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 20 }}>Platform Roadmap</h3>
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{ position: 'absolute', left: 6, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${C.green} 0%, ${C.accent} 30%, ${C.border} 50%, ${C.border} 100%)`, borderRadius: 1 }} />
          {ROADMAP.map((r, i) => (
            <div key={r.phase} style={{ position: 'relative', marginBottom: i < ROADMAP.length - 1 ? 24 : 0 }}>
              <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12, borderRadius: '50%', background: dotColor(r.status), border: `2px solid ${C.bg}`, boxShadow: r.status !== 'upcoming' ? `0 0 8px ${dotColor(r.status)}` : 'none' }} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: dotColor(r.status), marginBottom: 3 }}>{r.phase} — {r.status === 'done' ? 'Complete' : r.status === 'active' ? 'In Progress' : 'Upcoming'}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>{r.items}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Why this wins */}
      <Panel style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Why This Wins — 5 Hard-to-Copy Advantages</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { emoji: '🧠', title: 'AI at the Core — Not a Feature', desc: 'Plan generation, exercise cues, injury handoff, return-to-sport, nutrition — every piece is AI-native, not AI-bolted-on.' },
            { emoji: '🩹', title: 'Training + Recovery in One System', desc: 'Users don\'t stop training when injured. Recovery and training run in parallel with intelligent handoffs between states.' },
            { emoji: '⚔️', title: 'Mindset System — Published IP', desc: 'Japanese warrior philosophy from the founder\'s book powers the mindset AI agent. Proprietary. Cannot be copied without the source.' },
            { emoji: '📊', title: 'Platform Data as a Business Asset', desc: 'At scale, user demographics + injury patterns + location = B2B sales intelligence professionals will pay for.' },
            { emoji: '🌐', title: 'Two-Sided Marketplace Flywheel', desc: 'More users → attracts professionals → professionals bring clients → client data improves AI → better AI attracts more users.' },
          ].map(w => (
            <div key={w.title} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{w.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{w.title}</div>
              <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{w.desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ─── PROMPTS SECTION ─────────────────────────────────────────────────────────
function PromptsSection() {
  const [copied, setCopied] = useState<string | null>(null)

  function copyPrompt(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>
        Copy any prompt and paste it directly into ChatGPT, Claude, or Gemini. Each is a standalone session starter.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PROMPTS.map(p => (
          <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${p.color}20`, color: p.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{p.category}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.title}</span>
              </div>
              <button
                onClick={() => copyPrompt(p.id, p.body)}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${copied === p.id ? C.green : C.border}`, background: copied === p.id ? C.greenDim : C.surface, color: copied === p.id ? C.green : C.textMid, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                {copied === p.id ? '✓ Copied!' : 'Copy Prompt'}
              </button>
            </div>
            {/* Body */}
            <div style={{ padding: '16px', background: '#0a0d14' }}>
              <pre style={{ fontSize: 12, color: '#8fbbff', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: '"SF Mono", "Fira Code", Consolas, monospace', margin: 0, maxHeight: 240, overflowY: 'auto' }}>
                {p.body}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ASSETS SECTION ──────────────────────────────────────────────────────────
function AssetsSection() {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('Logos')
  const [filter, setFilter] = useState('All')
  const [notes, setNotes] = useState('')
  const [flash, setFlash] = useState('')
  const [bucketError, setBucketError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function showFlash(m: string) { setFlash(m); setTimeout(() => setFlash(''), 3000) }

  const loadAssets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('launchpad_assets').select('*').order('created_at', { ascending: false })
    if (!error && data) setAssets(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${category}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, '_')}`

    const { error: storageErr } = await supabase.storage.from('launchpad').upload(path, file)
    if (storageErr) {
      if (storageErr.message?.includes('bucket')) setBucketError(true)
      showFlash(`Upload failed: ${storageErr.message}`)
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const { data: urlData } = supabase.storage.from('launchpad').getPublicUrl(path)

    await supabase.from('launchpad_assets').insert({
      name: file.name,
      category,
      storage_path: path,
      url: urlData.publicUrl,
      size: file.size,
      mime_type: file.type,
      notes: notes.trim() || null,
    })

    setNotes('')
    if (fileRef.current) fileRef.current.value = ''
    await loadAssets()
    showFlash('File uploaded successfully')
    setUploading(false)
  }

  async function handleDelete(asset: AssetRow) {
    await supabase.storage.from('launchpad').remove([asset.storage_path])
    await supabase.from('launchpad_assets').delete().eq('id', asset.id)
    await loadAssets()
    showFlash('File deleted')
  }

  function fmtSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }
  function isImage(mime: string | null) { return mime?.startsWith('image/') ?? false }
  function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) }

  const filtered = filter === 'All' ? assets : assets.filter(a => a.category === filter)
  const grouped = UPLOAD_CATS.reduce<Record<string, AssetRow[]>>((acc, cat) => {
    const items = assets.filter(a => a.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <div>
      {/* Bucket error notice */}
      {bucketError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 16, lineHeight: 1.6 }}>
          <strong>Storage bucket not found.</strong> Go to Supabase Dashboard → Storage → New Bucket → name it <code style={{ background: 'rgba(239,68,68,0.15)', padding: '0 4px', borderRadius: 3 }}>launchpad</code> → set to Public → Save.
        </div>
      )}

      {/* Flash */}
      {flash && (
        <div style={{ padding: '10px 14px', background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 13, color: C.green, marginBottom: 16 }}>{flash}</div>
      )}

      {/* Upload area */}
      <Panel style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Upload Asset</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Category</div>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {UPLOAD_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Notes (optional)</div>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Midjourney v4 attempt #3"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: uploading ? C.surface2 : C.accent, color: uploading ? C.textDim : '#fff', fontWeight: 700, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
          >
            {uploading ? 'Uploading…' : '+ Upload File'}
          </button>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip" />
        </div>
      </Panel>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {ASSET_CATS.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${filter === c ? C.accentBorder : C.border}`, background: filter === c ? C.accentDim : 'transparent', color: filter === c ? C.accent : C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {c}
            {c !== 'All' && assets.filter(a => a.category === c).length > 0 && (
              <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>{assets.filter(a => a.category === c).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      {loading ? (
        <p style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: 32 }}>Loading assets…</p>
      ) : filtered.length === 0 ? (
        <Panel>
          <p style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: '40px 20px' }}>
            No assets in {filter === 'All' ? 'any category' : filter} yet. Upload your first file above.
          </p>
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {filtered.map(asset => (
            <div key={asset.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Preview */}
              {isImage(asset.mime_type) && asset.url ? (
                <a href={asset.url} target="_blank" rel="noreferrer">
                  <div style={{ height: 110, overflow: 'hidden', background: '#000' }}>
                    <img src={asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </a>
              ) : (
                <a href={asset.url ?? '#'} target="_blank" rel="noreferrer">
                  <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface2, fontSize: 36 }}>
                    {asset.mime_type?.includes('pdf') ? '📄' : asset.mime_type?.includes('presentation') || asset.name.endsWith('.pptx') ? '📊' : asset.mime_type?.includes('word') ? '📝' : '📎'}
                  </div>
                </a>
              )}
              {/* Info */}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.name}>
                  {asset.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: asset.notes ? 6 : 0 }}>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: C.accentDim, color: C.accent, fontWeight: 700 }}>{asset.category}</span>
                  <span style={{ fontSize: 10, color: C.textDim }}>{fmtSize(asset.size)}</span>
                </div>
                {asset.notes && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>{asset.notes}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>{fmtDate(asset.created_at)}</span>
                  <button onClick={() => handleDelete(asset)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit' }} title="Delete">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── QUICK PROMPTS ───────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Angel Investor Summary', prompt: 'Generate a compelling 1-page angel investor summary document for Move. Include: the problem we solve, our solution, market opportunity ($96B TAM), what\'s already built and working, business model overview, our key differentiators, and a closing call to action. Write it as a polished document ready to share.' },
  { label: 'Marketing Roadmap', prompt: 'Generate a detailed marketing roadmap document for the Move. marketing team. Include: phase 1 pre-launch community strategy (specific subreddits, communities, content types), phase 2 professional seeding strategy (how to get trainers and PTs on the platform), phase 3 paid acquisition plan (channels, audiences, budgets), and content calendar framework. Make it actionable with specific steps.' },
  { label: 'Operations Roadmap', prompt: 'Generate an operations roadmap document for Move. Include the 5 development phases with specific deliverables, technology decisions, team roles needed as we scale, infrastructure milestones, and key operational risks with mitigation plans. Format as a structured document for internal team use.' },
  { label: 'Competitive Analysis', prompt: 'Generate a thorough competitive analysis document for Move. Compare us in detail against Nike Training Club, Whoop, Fitbod, Trainerize, TrueCoach, Athlean-X, and MyFitnessPal. For each competitor: strengths, weaknesses, pricing, user base, and why our platform outperforms them. Include our positioning statement.' },
  { label: 'Business Model Breakdown', prompt: 'Generate a detailed business model document for Move. Cover: all consumer tiers (Free/Pro/Plus/Supreme) with value props, all B2B professional tiers with value props, the marketplace commission model, the Nuggets module system, revenue projections framework, and the two-sided marketplace flywheel. Include ARPU targets and LTV considerations.' },
  { label: 'Legal & Compliance Checklist', prompt: 'Generate a legal and compliance checklist document for Move. Cover: medical disclaimer requirements, fitness vs medical advice distinctions, PT/trainer liability language for the B2B portal, privacy policy requirements (GDPR/CCPA), health data handling, App Store and Google Play policy requirements, trademark filing priorities, and AI-generated content ownership. Flag what requires a licensed attorney.' },
  { label: 'Pitch Deck Outline', prompt: 'Generate a complete pitch deck outline for Move. — 12-15 slides. For each slide: the slide title, key message, bullet points to include, and what visual/chart would work best. Cover: title, problem, solution, product demo narrative, market size, business model, competitive advantage, traction, roadmap, team slide placeholder, financials framework, and the ask.' },
  { label: 'Partnership Proposal', prompt: 'Generate a partnership proposal document for approaching physical therapy clinics and personal training studios about the Move. professional platform. Cover: the value proposition for their practice, how the B2B portal works, client profile tiers, built-in marketing benefits, revenue-sharing model, onboarding process, and success metrics. Make it persuasive and professional.' },
]

// ─── MARKDOWN → HTML (lightweight converter) ─────────────────────────────────
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[h|u|l|h|e])(.*\S.*)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/\n{2,}/g, '')
}

// ─── PDF EXPORT ──────────────────────────────────────────────────────────────
function exportToPDF(title: string, content: string) {
  const html = mdToHtml(content)
  const win = window.open('', '_blank')
  if (!win) { alert('Allow popups to export PDF'); return }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} — Move.</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1a1a;
      line-height: 1.7;
      padding: 56px 72px;
      max-width: 860px;
      margin: 0 auto;
    }
    .doc-header {
      border-bottom: 3px solid #FF5C35;
      padding-bottom: 20px;
      margin-bottom: 36px;
    }
    .doc-brand {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #FF5C35;
      margin-bottom: 8px;
    }
    .doc-title {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0d0d0f;
      margin-bottom: 6px;
    }
    .doc-date {
      font-size: 12px;
      color: #888;
    }
    h1 { font-size: 22px; font-weight: 800; color: #111; margin: 32px 0 12px; }
    h2 { font-size: 18px; font-weight: 700; color: #222; margin: 28px 0 10px; border-left: 3px solid #FF5C35; padding-left: 12px; }
    h3 { font-size: 15px; font-weight: 700; color: #333; margin: 20px 0 8px; }
    p { font-size: 14px; color: #333; margin-bottom: 12px; }
    ul { margin: 10px 0 16px 20px; }
    li { font-size: 14px; color: #333; margin-bottom: 6px; line-height: 1.6; }
    strong { color: #111; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
    .doc-footer {
      margin-top: 60px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      font-size: 11px;
      color: #aaa;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-brand">Move. — Confidential</div>
    <div class="doc-title">${title}</div>
    <div class="doc-date">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  </div>
  <div class="doc-body">${html}</div>
  <div class="doc-footer">Move. — AI-Powered Movement & Recovery Platform &nbsp;|&nbsp; Confidential &nbsp;|&nbsp; ${new Date().getFullYear()}</div>
  <script>setTimeout(() => window.print(), 400)</script>
</body>
</html>`)
  win.document.close()
}

// ─── AI GENERATE SECTION ─────────────────────────────────────────────────────
function AIGenerateSection() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function generate(customPrompt?: string) {
    const p = (customPrompt ?? prompt).trim()
    if (!p) return
    setLoading(true)
    setResult('')
    setError('')
    setDocTitle(p.slice(0, 60) + (p.length > 60 ? '…' : ''))

    try {
      const res = await fetch('/api/launchpad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  function useQuickPrompt(qp: typeof QUICK_PROMPTS[0]) {
    setPrompt(qp.prompt)
    setDocTitle(qp.label)
    generate(qp.prompt)
  }

  function copyResult() {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Render markdown for preview
  function renderMd(md: string) {
    return md
      .replace(/^### (.+)$/gm, `<div style="font-size:14px;font-weight:700;color:${C.text};margin:18px 0 6px">$1</div>`)
      .replace(/^## (.+)$/gm, `<div style="font-size:16px;font-weight:800;color:${C.text};margin:22px 0 8px;padding-left:10px;border-left:2px solid ${C.accent}">$1</div>`)
      .replace(/^# (.+)$/gm, `<div style="font-size:20px;font-weight:900;color:${C.text};margin:24px 0 10px">$1</div>`)
      .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.text}">$1</strong>`)
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid ${C.border};margin:20px 0">`)
      .replace(/^[-•] (.+)$/gm, `<div style="display:flex;gap:8px;margin-bottom:5px"><span style="color:${C.accent};flex-shrink:0;margin-top:1px">→</span><span style="font-size:13px;color:${C.textMid};line-height:1.6">$1</span></div>`)
      .replace(/^\d+\. (.+)$/gm, `<div style="display:flex;gap:8px;margin-bottom:5px"><span style="color:${C.accent};flex-shrink:0;font-weight:700;margin-top:1px">·</span><span style="font-size:13px;color:${C.textMid};line-height:1.6">$1</span></div>`)
      .replace(/^(?!<div)(.*\S.*)$/gm, `<p style="font-size:13px;color:${C.textMid};line-height:1.75;margin-bottom:8px">$1</p>`)
      .replace(/<p style[^>]+><\/p>/g, '')
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>
        Ask anything about the business, request a specific document, or search for information. The AI knows everything about Move. — the product, market, competitors, roadmap, and strategy.
      </p>

      {/* Search / prompt bar */}
      <div style={{ background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: `0 0 0 3px ${C.accentDim}` }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
          placeholder='Ask anything — e.g. "Write an updated angel investor summary" or "What are our top 3 competitive advantages?" or "Draft a cold email to a PT clinic"'
          rows={3}
          style={{
            width: '100%', background: 'none', border: 'none', outline: 'none',
            color: C.text, fontSize: 14, lineHeight: 1.6, resize: 'none',
            fontFamily: 'inherit', marginBottom: 12,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textDim }}>⌘ + Enter to generate</span>
          <button
            onClick={() => generate()}
            disabled={loading || !prompt.trim()}
            style={{
              padding: '8px 20px', borderRadius: 7, border: 'none',
              background: loading || !prompt.trim() ? C.surface2 : C.accent,
              color: loading || !prompt.trim() ? C.textDim : '#fff',
              fontWeight: 700, fontSize: 13, cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 10, height: 10, border: `2px solid ${C.textDim}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Generating…
              </>
            ) : '✦ Generate'}
          </button>
        </div>
      </div>

      {/* Quick prompt chips */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Documents</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map(qp => (
            <button
              key={qp.label}
              onClick={() => useQuickPrompt(qp)}
              disabled={loading}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${C.border}`,
                background: C.surface2,
                color: C.textMid, fontSize: 12, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.accent, marginBottom: 10 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${C.accentBorder}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Generating your document…</span>
          </div>
          <p style={{ fontSize: 12, color: C.textDim }}>Claude is reading the full business context and drafting your response.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 13, color: C.red }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Result header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Generated Document</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{docTitle}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copyResult}
                style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${copied ? C.green : C.border}`, background: copied ? C.greenDim : 'transparent', color: copied ? C.green : C.textMid, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {copied ? '✓ Copied' : 'Copy Text'}
              </button>
              <button
                onClick={() => exportToPDF(docTitle, result)}
                style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                ↓ Export PDF
              </button>
            </div>
          </div>

          {/* Rendered content */}
          <div
            style={{ padding: '24px 28px', maxHeight: 640, overflowY: 'auto' }}
            dangerouslySetInnerHTML={{ __html: renderMd(result) }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function LaunchpadTab() {
  const [subTab, setSubTab] = useState<SubTab>('overview')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>Business Strategy</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.text }}>Launchpad</h2>
        <p style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>Business brief, LLM prompts, and uploaded assets — all in one place.</p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 1 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: subTab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: 'none',
              color: subTab === t.id ? C.accent : C.textDim,
              fontSize: 13,
              fontWeight: subTab === t.id ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'overview' && <OverviewSection />}
      {subTab === 'prompts' && <PromptsSection />}
      {subTab === 'assets' && <AssetsSection />}
      {subTab === 'ai' && <AIGenerateSection />}
    </div>
  )
}
