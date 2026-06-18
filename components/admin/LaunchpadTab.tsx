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
    body: `I'm building a fitness and recovery app called Atlas Prime. The app uses Claude AI to generate personalized 13-week training programs, manages injury recovery through a 4-phase system, and coaches athletes through Japanese warrior philosophy (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin). Target users: serious athletes, active people recovering from injuries, and fitness professionals (trainers, physical therapists, coaches).

Design aesthetic: Dark background (#0c0c0f), bold orange-red accent (#FF5C35), high energy, precision, warrior mindset — inspired by Nike Training Club x Athlean-X x Japanese martial arts.

Please help me brainstorm:
1. Logo concepts — wordmark vs. icon vs. combination mark. What visual metaphors work? (movement, fire, flow, warrior, precision). How does each look as an app icon (small square)?
2. Name ideas — Something short, memorable, powerful, domain-available. Think: what's the Notion, Figma, or Arc of fitness apps? Avoid generic words like FitLife, GymPro.
3. Midjourney/DALL-E prompts — write 5 specific image generation prompts to explore logo directions.
4. Visual system — suggest a full color palette, typography direction, and icon style that works across dark mode mobile app, marketing materials, and a professional B2B portal.`,
  },
  {
    id: 'naming',
    title: 'Business Name & Trademark',
    category: 'Legal',
    color: C.amber,
    colorDim: C.amberDim,
    body: `I need to finalize branding for a fitness + recovery AI app called Atlas Prime. Looking for trademark filing guidance.

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
- Atlas Prime Intelligence Engine (APIE): a multi-agent Agentic RAG Pipeline — a council of specialized AI agents (Strength & Conditioning, PT/Rehab, Sports Specialist, Mobility, Recovery, Mindset, Critic/Verification, Knowledge Curator) each grounded in a curated Domain Knowledge Store. No competitor has this architecture. Plans are generated by multiple expert agents collaborating, not a single generalist AI call.
- Founder's published book on Japanese warrior philosophy is the IP behind the Mindset Agent (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin)
- Sports Specialist Agent: trained on the movement demands, injury patterns, and periodization requirements of every major sport worldwide
- Platform data at scale becomes a sales tool for professionals (demographics, location, injury patterns)
- Two-sided marketplace flywheel: more users → attracts professionals → professionals bring clients → client data improves APIE → better plans attract more users

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

// ─── READINESS DATA ──────────────────────────────────────────────────────────
const READINESS_DATA = [
  {
    label: 'F&F Beta',
    sublabel: 'Consumer App',
    meterLabel: 'Beta Readiness',
    color: C.green,
    colorDim: C.greenDim,
    colorBorder: C.greenBorder,
    fullWidth: false,
    items: [
      { label: 'AI plan generator (bulk 1/2/3-month)', done: true },
      { label: 'Phase-based training (Foundation → Maintenance)', done: true },
      { label: 'Exercise library with AI cues', done: true },
      { label: 'Calendar + session completion + Undo', done: true },
      { label: 'Workout logging (sets / reps / weight + PRs)', done: true },
      { label: 'For You feed + mindset agent', done: true },
      { label: 'Anatomy Explorer', done: true },
      { label: 'Multi-sport profile + injury + equipment', done: true },
      { label: 'Training background profile (beginner → pro)', done: true },
      { label: 'Auth gates + promo code system', done: true },
      { label: 'F&F beta role + access control', done: true },
      { label: 'Terms of Service + Privacy Policy', done: true },
      { label: 'Bug reports system', done: true },
      { label: 'RLS security hardening', done: true },
      { label: 'Exercise videos curated (80%+ of library)', done: false },
      { label: 'Mobile UX polish', done: true },
      { label: 'New user onboarding flow', done: true },
      { label: 'Push notifications', done: true },
      { label: 'Final QA — no critical bugs', done: true },
    ],
  },
  {
    label: 'Coach Portal',
    sublabel: 'Professional Platform',
    meterLabel: 'Beta Readiness',
    color: C.accent,
    colorDim: C.accentDim,
    colorBorder: C.accentBorder,
    fullWidth: false,
    items: [
      { label: 'Programs library', done: true },
      { label: 'Program detail (inline editing + status)', done: true },
      { label: 'Assign-to-client (search + date picker)', done: true },
      { label: 'Exercise swap modal (sets/reps preserved)', done: true },
      { label: 'AI generate (periodized plans)', done: true },
      { label: 'Template library (zero-cost reuse)', done: true },
      { label: 'Client roster + assignment history', done: true },
      { label: 'Client portal (clients see assigned plans)', done: true },
      { label: 'Client notes & analysis — "Get to Know Your Client"', done: true },
      { label: 'Coach onboarding flow', done: true },
      { label: 'Coach analytics dashboard', done: true },
      { label: 'In-app coach ↔ client messaging', done: true },
      { label: 'PDF export of programs', done: true },
      { label: 'Manual program builder', done: true },
      { label: 'PDF/DOCX import (text + image PDFs)', done: true },
      { label: 'Coach exercise library (YouTube clip trimming + video upload)', done: true },
      { label: 'Coach portal mobile responsive layout', done: true },
      { label: 'Stripe billing for coach tiers', done: false },
      { label: 'Coach affiliate / referral system', done: false },
    ],
  },
  {
    label: 'App Store Launch',
    sublabel: 'Apple • Google Play • Public',
    meterLabel: 'Launch Readiness',
    color: C.amber,
    colorDim: C.amberDim,
    colorBorder: C.amberBorder,
    fullWidth: true,
    items: [
      // Legal & Business
      { label: 'App name finalized + trademark search done', done: false },
      { label: 'Domain secured for final brand name', done: true },
      { label: 'LLC / business entity registered', done: true },
      { label: 'Apple Developer Program enrolled ($99/yr — requires LLC)', done: false },
      { label: 'Google Play Developer account created ($25 one-time)', done: false },
      // App Identity & Store Assets
      { label: 'App icon 1024×1024 created (App Store requirement)', done: false },
      { label: 'App Store screenshots — iPhone 6.7" + 6.1" + iPad 12.9"', done: false },
      { label: 'Google Play screenshots — phone + 7" tablet', done: false },
      { label: 'App Store title, subtitle, description + keywords written', done: false },
      { label: 'Age rating questionnaire completed (likely 4+)', done: false },
      // Technical Compliance (CRITICAL)
      { label: 'Sign in with Apple implemented (required if Google OAuth offered)', done: true },
      { label: 'In-app account deletion (Apple requirement — Guideline 5.1.1)', done: true },
      { label: 'In-app support contact channel (Apple requirement)', done: true },
      { label: 'Apple IAP / RevenueCat for iOS subscriptions (Stripe alone = rejection)', done: false },
      { label: 'Google Play Billing / RevenueCat for Android subscriptions', done: false },
      { label: 'App wrapped with Capacitor (PWA → native iOS + Android)', done: false },
      { label: 'Bundle ID registered (e.g. com.brandname.app)', done: false },
      { label: 'Universal Links (iOS) + App Links (Android) configured', done: false },
      { label: 'Push notifications — APNs certificate configured for iOS', done: false },
      // Content & Legal
      { label: 'Privacy Policy at public URL (/legal/privacy)', done: true },
      { label: 'Terms of Service at public URL (/legal/terms)', done: true },
      { label: 'App Store privacy nutrition labels declared', done: false },
      { label: 'Google Play data safety section completed', done: false },
      { label: '"Restore Purchases" button added (required for subscription apps)', done: false },
      // Beta Testing
      { label: 'TestFlight internal testing (≥10 testers)', done: false },
      { label: 'TestFlight external beta (up to 10k testers, 90 days)', done: false },
      { label: 'Firebase App Distribution beta (Android)', done: false },
      { label: 'Crash rate < 1% across all core flows on real devices', done: false },
      { label: 'App passes review on real iPhone (not simulator)', done: false },
    ],
  },
]

function ReadinessPanel() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      {READINESS_DATA.map(portal => {
        const done = portal.items.filter(i => i.done).length
        const total = portal.items.length
        const pct = Math.round((done / total) * 100)
        const r = 42
        const circ = 2 * Math.PI * r
        const offset = circ * (1 - pct / 100)
        return (
          <div key={portal.label} style={{ background: `linear-gradient(135deg, ${portal.colorDim} 0%, ${C.surface} 60%)`, border: `1px solid ${portal.colorBorder}`, borderRadius: 12, padding: 20, gridColumn: portal.fullWidth ? '1 / -1' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              {/* Progress ring */}
              <div style={{ position: 'relative', flexShrink: 0, width: 100, height: 100 }}>
                <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={50} cy={50} r={r} fill="none" stroke={C.surface2} strokeWidth={8} />
                  <circle
                    cx={50} cy={50} r={r}
                    fill="none"
                    stroke={portal.color}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: portal.color, letterSpacing: '-0.03em' }}>{pct}%</span>
                </div>
              </div>
              {/* Label block */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: portal.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{portal.meterLabel}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 2 }}>{portal.label}</div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{portal.sublabel}</div>
                <div style={{ fontSize: 12, color: C.textMid }}>
                  <span style={{ color: portal.color, fontWeight: 700 }}>{done}</span>
                  <span> of {total} items complete</span>
                </div>
              </div>
            </div>
            {/* Checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: portal.fullWidth ? '1fr 1fr' : '1fr', gap: '2px 24px' }}>
              {portal.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
                  <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1, color: item.done ? portal.color : C.textDim }}>{item.done ? '✓' : '○'}</span>
                  <span style={{ fontSize: 11, color: item.done ? C.textMid : C.textDim, lineHeight: 1.5 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── OVERVIEW SECTION ────────────────────────────────────────────────────────
function OverviewSection() {
  const BUILT = [
    'Account deletion + Contact Support (App Store compliance) — in-app "Delete My Account" with a churn-saving funnel (intent → reason capture → tailored save offer with "take a break" + contact-support deflection + discount placeholder for when billing is live → type-DELETE confirm), server route securely wipes the user\'s data + auth record (self-only via JWT); anonymous deletion reasons logged to account_deletion_feedback for product insight. New "Contact Support" form on the Account page writes into the existing bug-reports pipeline (no email exposed). Closes the Apple Guideline 5.1.1 account-deletion + support-contact requirements and makes the legal docs truthful. SQL: 20260618_account_deletion.sql',
    'Admin partner permissions — owner (Will) vs partner admins. New owner-only Access Control tab (🔑) to grant a partner access to specific admin sections and revoke/suspend anytime; private sections (user data, money, controls) are never grantable. Partners are driven by the admin_permissions table (not profiles.is_admin), so they can never read owner-only data. Nav filters by granted sections; server routes enforce per-tab access via verifyAdmin(req, tab)/verifyOwner. Admin portal stays private at App Store/Play submission. SQL: 20260618_admin_permissions.sql (profiles.is_owner + admin_permissions)',
    'Admin Study Hub — admin-only certification-prep study hub (ISSA CFT depth). Multiple subject-scoped Knowledge Bases, each keeping its own context + scoped system prompt layered on the APIE engine; one-tap generation of original structured study material (concepts / summaries / key points / quizzes / flashcards) grounded in our pgvector domain store; tag/search, mastered/active status, and progress tracking toward the cert goal. Server-only access (JWT → service-role → is_admin gate, RLS deny-by-default). Tables: study_kbs / study_entries',
    'Workout flow UX pass — dashboard is a clean heads-up card (looping video removed); Start Session opens a focused single-day view (month grid hidden, one-tap "View Calendar"); day view leads with a read-before-you-start overview (assembled instructions + equipment + rest-by-type) and a durable "Week X · Day Y" header; progressive disclosure makes the workout the hero with optional morning/abs/cooldown/evening as friendly collapsed invitation cards revealed one-at-a-time on scroll (never a stacked column); coached card gets the same overview + an optional coach per-day walkthrough video set in the program builder',
    'Workout UX restructure + set tracking — clean dashboard summary (time/equipment/preview/For-You note); calendar day view with inline looping previews + per-exercise Coaching Cues, Day-N header, equipment + rest-by-type guidance box; reusable ExerciseDetailModal (Common Mistakes mapped to the tip field) with per-set Track Workout (reps/weight/notes, duplicate/add set, opt-in left/right → exercise_set_logs table) + a per-exercise History tab; dismissible tracking tips (Dismiss / not-for-this-workout / never)',
    'Movement Preview (GIF-style loops) — admin loop trimmer in Video Curation (YouTube IFrame scrubber, draggable in/out handles, live loop preview, saved as loop_start/end metadata) + user-facing muted auto-looping previews on the exercises page, Today/calendar exercise modal, and coached workout rows (inline GIF thumbnails); IntersectionObserver lazy-mount + concurrent-player cap for mobile; tap → full original video',
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
    'Admin Mission Control portal (analytics, users, todos, ideas, promos, launchpad, zoom log)',
    'Auth gates, promo code system, F&F beta role, Vercel + Supabase + GitHub CI/CD',
    'Zoom In (admin impersonation V2) — ZoomIn modal with duration + reason, red countdown banner, auto-exit timer, full write logging, soft-delete queue, 30-day reversal UI in Zoom Log tab',
    'Coach portal — full build: programs library, program detail view (inline title editing + status management), assign-to-client modal with debounced search + date picker, exercise swap modal with sets/reps preservation, AI generate with brief form (periodized Claude Sonnet 4.6), template library (zero-cost program reuse per coach account), real clients roster with assignment history',
    'Admin Portal V2 — Retention dashboard (5 auto-calculated user segments: Active / At Risk / Churned / Plan-No-Log / No-Plan, drill-down lists + CSV export per segment); Notes system (platform notes + user-attached notes with setup SQL inline); Billing overview (tier breakdown bar chart, engagement KPIs, Stripe integration roadmap)',
    'CEO Education Agent — Admin Strategy tab with Daily Brief (7 rotating article types: industry deep dives, competitor teardowns, feature explainers, CEO scenarios, market signals, business concepts, pitch coach); Ask Me Anything conversational AI with full platform context; Article Library (saved to DB with timestamps, click-to-read); PDF export on every article; sessionStorage caching (zero token cost on revisit)',
    'Bug Reports system — floating "?" button on all user-facing pages; modal with description, feature dropdown, severity rating; auto-computes priority (Critical/High/Medium/Low) based on severity + user role; Admin portal queue with filter tabs, expandable cards, status workflow (New → In Review → Fixed → Won\'t Fix), admin notes, red badge showing new count',
    'Knowledge Base — admin Strategy tab with 35 built-in entries across Features (12), Industry Terms (16), Competitors (7); fully filterable client-side; custom entries via CRUD modal stored in DB; AI search bar powered by claude-sonnet-4-6 returning answer + implementation context + one-liner',
    'Per-user token usage tracking — every API route now logs tokens + user_id via shared logTokens() helper; UserDetailPanel shows full call history (operation, tokens, cost per call, running total); Retention tab shows Total API Spend / Avg Cost / Users with Activity KPIs',
    'Spend Tracker — admin Revenue tab; AI token costs auto-calculated from token_usage by operation; manual expense logging with category, amount, vendor, receipt photo upload to Supabase storage; KPI strip (total/AI/manual/monthly); CSV export',
    'CEO Brief cache fix — switched from sessionStorage to localStorage so article persists across tabs and browser sessions; removed 24h TTL so article only regenerates on manual "New Article" click',
    'DB safety layer — protect_admin_role trigger (blocks accidental admin demotion at DB level), SECURITY DEFINER admin read-all RLS pattern, role column default removed',
    'Health Monitor — one-click scan of all pages, API routes, and DB tables with copy-paste Claude Code fix prompts',
    'Training Background profile — training level (beginner→pro), workout history, sport/activity background with skill levels; all fields stored in profiles and fed to AI at plan generation',
    'RLS security hardening — privilege escalation guards on profiles INSERT + UPDATE; impersonation table policies upgraded to is_admin_user() SECURITY DEFINER pattern',
    'Terms of Service + Privacy Policy — admin impersonation disclosure, health/AI disclaimer, user rights, TOS consent gate on signup (email + Google OAuth)',
    'APIE Phase 0 — training_level, workout_background, sport activities injected into plan generator prompt with per-level guidance; plan quality now scales with user experience',
    'Exercise Video Curation system — AI auto-discovers fitness YouTube channels (channels.list), scores quality via Claude Haiku, stores approved list; curation pipeline searches 2 channels per exercise (search.list + videos.list), scores 3 candidates per exercise, admin reviews + approves 1; approved video embeds inline in client calendar via YouTube iframe; exercises from real client plans bubble to top of curation queue; 752-exercise library populating at ~50/day within free API quota',
    'YouTube Shorts support — vertical 9:16 player, autoplay muted loop (no tap needed), 🔇/🔊 audio toggle for voiced Shorts, sticky player stays visible while scrolling coaching cues; Shorts URLs now accepted in admin video paste input',
    '"Get to Know Your Client" — coach client notes system: session-dated notes, last-session reminder card, voice dictation via Web Speech API (Chrome/Edge), notes history with show more/less, per-note delete',
    'PDF export of programs — Export PDF button on program detail page; opens clean printable HTML in new tab with embedded print trigger; includes all weeks, days, movements, phases, coach notes, and footer; zero dependencies',
    'PDF/DOCX import on Builder page — coaches upload existing programs; mammoth extracts DOCX text, pdf-parse extracts PDF text; Claude Haiku normalizes to structured JSON; preview step before saving to coach_program_weeks; handles image-based PDF gracefully with error message',
    'Manual program builder — setup form (name/weeks/days-per-week/client), week accordion with label+phase, per-day exercise list with @dnd-kit drag-to-reorder, autocomplete from exercise_library, client notes reminders surfaced inline as you type exercises, copy-week-to-all, saves to same schema as AI/import paths',
    'User PDF program import — hamburger menu entry at /import-program; upload PDF/DOCX (text or scanned via Claude vision); PT/Rehab safety pass checks exercises against user injury profile and shows diff of changes; activate immediately or save for later; ImportedProgramBanner with Leave Plan flow (save progress or exit) mirrors RecoveryBanner pattern',
    'APIE Phase 1 — Domain Knowledge Store: pgvector + OpenAI embeddings + 784 items seeded (15 training principles, 10 sport protocols, 7 rehab protocols, 752 exercises); RAG retrieval wired into plan generation; ivfflat index (lists=30)',
    'APIE Phase 2 — Agent Council v1: S&C Agent drafts full 7-day plan using retrieved knowledge; PT/Rehab Agent runs safety review pass for restricted athletes with veto logic; token usage tracked across both agents',
    'APIE Phase 3 — Full Agent Council: Sports Specialist Agent (sport-specific warmups + coaching cues), Mobility Agent (morning/cooldown/evening blocks), Mindset Agent (Mushin/Kaizen/Shokunin/Zanshin/Fudoshin layer on coaching + warmup tips), Recovery Agent (evidence-based rest day programming); all 4 agents sequential, non-fatal fallback',
    'APIE Phase 4 — Knowledge Curator Agent: weekly Vercel cron reviews 60 items/pass (least-recently-reviewed first); Claude flags outdated/inaccurate items with suggested replacements; admin accepts (re-embeds + increments version) or dismisses; full review UI in admin APIE tab',
    'Push notifications — VAPID keys configured, service worker live, PushNotificationBanner on Today page, admin send UI; web push delivery to subscribed devices',
    'Travel adjustment — ✈️ "Need modifications?" button on any workout day in Calendar; user describes situation (hotel gym, no equipment, park); Claude Haiku patches warmup/workout/abs blocks or movements array; saves back to DB; resets on day change',
    'Ask AI Recovery — 🤖 "Ask AI" collapsible card at top of Recovery page; user describes pain/soreness/tightness; two-step AI pipeline recommends 5 exercises (library lookup first, AI-generated cues as fallback); inline expandable cards with how-to + coaching tip + breathing; Refresh button for new set',
    'Missed session / Skip — "Couldn\'t make it?" button on past uncompleted workout days in Calendar; expands to option: "Skip this day — mark done and move on"; writes day_completions with skipped:true; resets on day change',
    'Auto-capture prompt — After tapping ✓ Complete Day, green "Nice work!" prompt appears reminding user to tap any exercise above to log sets; dismissible with ×',
    'Saved Programs Library — /programs page listing every training_programs record for the user in reverse-chronological order; shows start date, date range, weeks built, phase; Active badge on current program; View Plan button; linked from both MobileMenu and Sidebar',
    'Browse & Learn — /browse page rebuilt with live exercise_library data; searchable across 750+ exercises; load-more pagination (30/page); inline expandable coaching cards (how-to, breathing, coaching tip) on tap; video indicator badges',
    'Mobility tab — /mobility page with 12 body-area chips (Hip Flexors, Hamstrings, T-Spine, Shoulders, Calves, Quads, Glutes, Core, Chest, Hips, Neck, Ankles); text search; keyword filter of exercise_library; expandable coaching cards; MobileMenu + Sidebar',
    'Read-aloud workout instructions — 🔈 speaker button on every exercise in Today page workout blocks; reads name + how-to + coaching tip via TTS; pre-loads exercise library after plan loads for instant response',
    'Targeted anatomy exercises — anatomy page restructured: 55vh iframe + Targeted Exercises section below; 12 muscle group chips; keyword filter of exercise_library; expandable inline coaching cards',
    'Nutrition profile enhancements — added wake time, first meal time, IF preference (5 options), health conditions multi-select (10 conditions); all passed to AI generation',
    'Custom plan conversion — /convert-plan concierge page + admin Conversions tab; drag-drop PDF/DOCX upload; status tracker; admin can download + review + update status + send note to user',
    'Platform program sharing — coach_programs.shared_with_roles; admin toggle in coach portal; Featured Programs section in /programs for admin+ff roles; Activate button copies program to user_imported_programs; seed exercises to library with source_program tagging',
    'Video Curation Priority Lanes — replaced blind batch with 3 lanes (User Plans / Program / Backlog); each shows pending count + Run 10/25; manual URL bug fixed (supersedes candidates on save); Approve All skips already-approved exercises',
    'Coach Exercise Library — /coach/library tab; YouTube URL with ✂️ clip trimming (M:SS start/end, live preview); own video upload (MP4/MOV/WebM to Supabase storage, with format guidelines); instructions + sets/reps + rest time; expandable list view',
    'YouTube clip trimming in Video Curation — paste URL section expanded with start/end time inputs + live preview + usage guide; clips saved as youtube_start_sec/youtube_end_sec on exercise_library; VideoPlayer in calendar + exercises pages applies ?start=N&end=N embed params',
    'APIE questionnaire enhancement — 7 new profile fields: sex assigned at birth (Oura-style "Why we ask" explanation), age, height/weight, training level (5-tier Beginner→Pro), training history, sport-specific improvement focus ("What do you want to get better at?"), per-sport skill level chips; all fields wired into APIE buildPrompt + Phase 3 athleteContext',
    'Video curation approved-exercise edit panel — ✏ Edit button on every approved row opens inline panel: current video preview, Replace URL with ✂️ clip trimming (regular + Shorts 9:16), Regenerate button clears approval + reruns fresh AI search',
    'Video Library — Programs drill-down — collapsible per-program section shows ✓/○/✗ per exercise with progress bar; ✗ rows get inline Run + paste URL; ○ rows jump search to proposals; programs disappear from Priority Lanes at 100%; plan generation queue shown separately',
    'TTS batch 504 fix — BATCH reduced 20→10, per-call 10s timeout via Promise.race; per-row 🎙 Generate button in Library tab generates both voices for a specific exercise on demand without a full-batch run',
    'Atlas Prime rebrand — full rename from Movement/Move./MIE to Atlas Prime/APIE across all user-facing surfaces, legal pages, AI prompts, PWA manifest, push notifications, admin/coach portals; MIETab.tsx→APIETab.tsx; placeholder Logo component (components/ui/Logo.tsx) wires all 5 brand surfaces (Sidebar, MobileMenu, coach layout, admin portal, mockup) to a single swappable file',
    'Onboarding modal fixes — admin guard timing bug resolved (setShow(false) on role load); DB fallback check prevents re-showing on new browser/device; Step 1 sex field updated to "Sex assigned at birth" with Male/Female + Why we ask collapsible',
    'Coach note dictation — replaced Web Speech API (Chrome-only) with MediaRecorder + OpenAI Whisper; works on all browsers and devices including iOS Safari, Firefox, Android; mic button records audio, sends to /api/coach/transcribe, appends transcript to draft',
    'Coach notes edit + delete — ✏️ edit and ✕ delete on every note including single-note Last Session Reminder card; inline edit form with date + textarea, saves via UPDATE; delete requires inline "Delete? Yes / No" confirmation before firing',
    'Business formation — Atlas Prime Labs LLC filed with CA Secretary of State (2026-06-06, $75); domains atlasprime.app + atlasprime.fit + atlasprime.health registered on Namecheap ($29.54); expenses logged in Spend Tracker',
    'EIN obtained (2026-06-09) — IRS Employer Identification Number issued for Atlas Prime Labs LLC; confirmation letter saved to Google Drive; Mercury business bank account approved (2026-06-10)',
    'Mobile nav unification (2026-06-11) — athlete app + coach portal share one nav language: fixed dark header bar with boxed hamburger + logo on every mobile page, full-screen slide-out drawer (portal-rendered past blurred headers), coach bottom nav rebuilt as 4 SVG-icon tabs (Dashboard/Clients/Messages/Analytics) matching athlete BottomNav; Coach Portal menu item added to athlete drawer for coach/admin roles with impersonation guard; sticky video players pinned below header; safe-area insets for notched phones',
    'Coach self-assignment (2026-06-11) — Assign-to-myself quick-pick in program assign modal; skips coach_clients roster so coaches never appear in their own client list; program surfaces in athlete app via My Coach',
    'Coached Mode Phase 1 (2026-06-11) — active coach assignment becomes the main program: Today page shows coach workout as main session card (Programmed by Coach X badge, per-exercise set logging into workout_logs with last-session display, TTS read-aloud, Complete Day into coach_day_completions); AI Generate CTAs + Import a Program + Convert My Plan + Featured Programs all hidden while coached; CoachedContext follows effectiveUserId so Zoom In sees the client experience; SQL: coach_day_completions table',
    'Coached Mode Phase 2 (2026-06-11) — replace-program confirmation in assign modal (amber warning naming current program; retires old assignments to status replaced, one active per client); coach win-back funnel (once-per-ended-assignment "Are you still working with a coach?" bottom sheet → Atlas Prime AI program pitch → Generate CTA); "Need changes? Message coach" on coached Today card deep-links to My Coach messages with pre-filled draft',
    'Coach vanity join links + pending clients (2026-06-11) — atlasprime.app/join/{slug}: coach sets brand slug on Dashboard (Your Join Link card, auto-suggested, unique); public branded landing page; slug survives signup via localStorage + JoinLinkRedeemer (works with OAuth) → auto-connects to roster with confirmation modal; + Add Client on Clients page creates pending clients (name/email/private note) that auto-claim by email match on signup; SQL: profiles.coach_slug + coach_pending_clients',
    'In-person session logging (2026-06-11) — coach logs the workout on the client behalf from client detail page: per-exercise sets/reps/weight prefilled from programmed scheme, client self-logs preload with edit-or-leave badge, per-exercise + session notes into coach_client_notes, Complete & Log writes workout_logs (logged_by) + coach_day_completions (completed_by); client gets push notification + Good job celebration banner + Completed with Coach X state; SQL: logged_by/completed_by columns',
    'Coach desktop layout fix (2026-06-11) — coach pages sat 460px from the left (athlete layout reserved 230px for its hidden sidebar + coach layout added 230px); AppMain route-aware wrapper applies athlete spacing only on athlete routes; also fixed doubled mobile header padding and off-center /auth + /join on desktop',
    'Custom domain live (2026-06-12) — atlasprime.app pointed to Vercel (A @ 216.198.79.1 + CNAME www); www + atlasprime.fit + atlasprime.health 308-redirect to apex; old movement-app-three.vercel.app 308-redirects too; Supabase auth Site URL + redirect URLs updated; Stripe webhook endpoint URL moved to atlasprime.app/api/stripe/webhook (same signing secret); coach join links now publicly shareable',
    'Coach Portal mobile UX overhaul — fixed mobile layout across all 10 coach pages: Atlas Prime header bar on mobile, icons-only bottom nav (9 items), responsive padding (.coach-page 16px mobile/40px desktop), .coach-page-header stacks title+button on mobile, .coach-grid-2/.coach-grid-3 responsive grids, messages height fix, overflow-x: hidden safety net; all "Coach Portal" eyebrow text → "Atlas Prime"',
  ]
  const COMING = [
    'Injury → training handoff: AI-modified safe training plan that runs alongside recovery',
    'Nutrition AI: 3-month meal plan synced to training phases + macro targets',
    'Stripe billing: Free → Pro → Plus → Supreme consumer tiers',
    'Coach portal affiliate system — referral tracking, revenue-sharing per referral, coach analytics dashboard',
    'Wearable integration: Oura Ring, Apple Watch, Samsung Health — feeds APIE Recovery Agent',
    'Native iOS + Android via Capacitor wrapper',
    'Streak system + accountability nudges',
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
    { phase: 'Phase 1', label: 'Core Consumer App', status: 'done', items: 'AI plan generator (bulk 1/2/3-month) · Phase-based training with rest times · 6-block daily sessions · Exercise library · SI Joint + custom injury recovery · Return-to-sport agent · Calendar + undo completion · Workout logging · For You feed · Anatomy Explorer · Auth · Admin portal · CI/CD · Training background profile · TOS/Privacy + RLS security hardening' },
    { phase: 'Phase 2', label: 'Atlas Prime Intelligence Engine (APIE)', status: 'done', items: '✓ Domain Knowledge Store — pgvector + 784 items (training principles, sport protocols, rehab protocols, exercises) + RAG retrieval · ✓ S&C Agent + PT/Rehab Agent (veto logic) · ✓ Sports Specialist + Mobility + Mindset + Recovery agents (full council) · ✓ Knowledge Curator Agent — weekly cron, auto-flags outdated content, version tracking' },
    { phase: 'Phase 3', label: 'Monetization + Professional Portal', status: 'active', items: '✓ Coach portal: programs library, assign-to-client, AI generate, exercise swap modal, template library, clients roster · ✓ Admin Portal V2: retention dashboard, notes system, billing overview · ✓ Push notifications: VAPID + service worker + admin send UI · Stripe billing (Free → Pro → Plus → Supreme) · Coach affiliate system · Injury→training AI handoff · Nutrition AI (3-month meal plan) · Native iOS/Android · Wearable integration' },
    { phase: 'Phase 4', label: 'Marketplace + Scale', status: 'upcoming', items: 'Hire local trainers in-app · Marketplace listings · Built-in marketing automation · Revenue-sharing · Platform data as B2B sales intelligence · Client portal' },
    { phase: 'Phase 5', label: 'Enterprise + Partnerships', status: 'upcoming', items: 'White-label options · Insurance partnerships · University athletics licensing · International expansion · Strategic acquisition potential' },
    { phase: 'Deferred', label: 'Exercise Video Curation', status: 'upcoming', items: 'YouTube Data API + AI candidate scoring + admin review UI · Trigger: stable platform checkpoint before content spend' },
  ]

  const dotColor = (s: string) => s === 'done' ? C.green : s === 'active' ? C.accent : C.border

  return (
    <div>
      <ReadinessPanel />

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
                <td style={{ padding: '10px 12px', fontWeight: 800, color: C.accent, borderBottom: `1px solid ${C.border}` }}>Atlas Prime (Us)</td>
                {['Full AI', '4-Phase', 'Built', 'Unique IP', 'Planned', 'Planned'].map(v => (
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

      {/* APIE Architecture Panel */}
      <Panel style={{ padding: 20, marginBottom: 24, border: `1px solid ${C.accentBorder}`, background: `linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(167,139,250,0.04) 100%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
          <Label color={C.accent}>Atlas Prime Intelligence Engine — APIE</Label>
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Multi-Agent Agentic RAG Pipeline</h3>
        <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.7, marginBottom: 18 }}>
          The APIE is the architectural backbone that makes every plan feel like it was built by a council of credentialed experts — because it is. Instead of a single AI call generating everything from scratch, the APIE uses Retrieval-Augmented Generation (RAG) to pull from a curated Domain Knowledge Store, then routes context through specialized agents before assembling the final output.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Orchestrator Agent', desc: 'Central coordinator. Queries Domain Knowledge Store, routes to specialists, assembles output.', color: C.accent },
            { label: 'Strength & Conditioning', desc: 'NSCA/CSCS principles, periodization, progressive overload, exercise selection.', color: C.green },
            { label: 'PT / Rehab Agent', desc: 'Injury contraindications, tissue healing, pain science. Has veto power over all other agents.', color: C.red },
            { label: 'Sports Specialist', desc: 'Movement demands, energy systems, periodization for every sport and activity worldwide.', color: C.purple },
            { label: 'Mobility Specialist', desc: 'FRC, DNS, PRI principles. Owns warmup and cooldown block design.', color: C.amber },
            { label: 'Recovery Agent', desc: 'HRV, sleep science, fatigue management, deload programming. Future: wearable data input.', color: C.accent },
            { label: 'Mindset Agent', desc: 'Japanese warrior philosophy (Mushin, Kaizen, Zanshin). Owns For You feed and coaching cues.', color: C.textMid },
            { label: 'Critic / Verification', desc: 'Validates assembled output against ruleset. Flags specific blocks for re-run — not full regeneration.', color: C.amber },
            { label: 'Knowledge Curator', desc: 'Async background agent. Monitors research sources, flags updates, keeps DKS current.', color: C.green },
          ].map(a => (
            <div key={a.label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: a.color, marginBottom: 4, letterSpacing: '0.02em' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Architecture Type', val: 'Multi-Agent Agentic RAG Pipeline' },
            { label: 'Knowledge Retrieval', val: 'pgvector semantic search — Domain Knowledge Store (DKS)' },
            { label: 'Token Efficiency', val: 'RAG retrieval replaces long prompts; Critic patches blocks, not full plan' },
          ].map(f => (
            <div key={f.label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textDim, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{f.val}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Why this wins */}
      <Panel style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Why This Wins — 6 Hard-to-Copy Advantages</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { emoji: '🧠', title: 'Atlas Prime Intelligence Engine — Not a Feature', desc: 'The APIE is a multi-agent RAG pipeline. A council of specialized AI agents — each grounded in a curated Domain Knowledge Store — collaborates on every plan. No competitor has this architecture.' },
            { emoji: '🩹', title: 'Training + Recovery in One System', desc: 'Users don\'t stop training when injured. Recovery and training run in parallel with intelligent handoffs between states.' },
            { emoji: '⚔️', title: 'Mindset System — Published IP', desc: 'Japanese warrior philosophy from the founder\'s book powers the Mindset Agent. Proprietary. Cannot be copied without the source.' },
            { emoji: '📊', title: 'Platform Data as a Business Asset', desc: 'At scale, user demographics + injury patterns + location = B2B sales intelligence professionals will pay for.' },
            { emoji: '🌐', title: 'Two-Sided Marketplace Flywheel', desc: 'More users → attracts professionals → professionals bring clients → client data improves APIE → better plans attract more users.' },
            { emoji: '🏋️', title: 'Sports Specialist at Every Sport', desc: 'The Sports Specialist Agent covers every sport worldwide — skateboarding to pickleball to combat sports. Programming adjusts to real sport demands, not generic templates.' },
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
  { label: 'Angel Investor Summary', prompt: 'Generate a compelling 1-page angel investor summary document for Atlas Prime. Include: the problem we solve, our solution, market opportunity ($96B TAM), what\'s already built and working, business model overview, our key differentiators, and a closing call to action. Write it as a polished document ready to share.' },
  { label: 'Marketing Roadmap', prompt: 'Generate a detailed marketing roadmap document for the Atlas Prime marketing team. Include: phase 1 pre-launch community strategy (specific subreddits, communities, content types), phase 2 professional seeding strategy (how to get trainers and PTs on the platform), phase 3 paid acquisition plan (channels, audiences, budgets), and content calendar framework. Make it actionable with specific steps.' },
  { label: 'Operations Roadmap', prompt: 'Generate an operations roadmap document for Atlas Prime. Include the 5 development phases with specific deliverables, technology decisions, team roles needed as we scale, infrastructure milestones, and key operational risks with mitigation plans. Format as a structured document for internal team use.' },
  { label: 'Competitive Analysis', prompt: 'Generate a thorough competitive analysis document for Atlas Prime. Compare us in detail against Nike Training Club, Whoop, Fitbod, Trainerize, TrueCoach, Athlean-X, and MyFitnessPal. For each competitor: strengths, weaknesses, pricing, user base, and why our platform outperforms them. Include our positioning statement.' },
  { label: 'Business Model Breakdown', prompt: 'Generate a detailed business model document for Atlas Prime. Cover: all consumer tiers (Free/Pro/Plus/Supreme) with value props, all B2B professional tiers with value props, the marketplace commission model, the Nuggets module system, revenue projections framework, and the two-sided marketplace flywheel. Include ARPU targets and LTV considerations.' },
  { label: 'Legal & Compliance Checklist', prompt: 'Generate a legal and compliance checklist document for Atlas Prime. Cover: medical disclaimer requirements, fitness vs medical advice distinctions, PT/trainer liability language for the B2B portal, privacy policy requirements (GDPR/CCPA), health data handling, App Store and Google Play policy requirements, trademark filing priorities, and AI-generated content ownership. Flag what requires a licensed attorney.' },
  { label: 'Pitch Deck Outline', prompt: 'Generate a complete pitch deck outline for Atlas Prime — 12-15 slides. For each slide: the slide title, key message, bullet points to include, and what visual/chart would work best. Cover: title, problem, solution, product demo narrative, market size, business model, competitive advantage, traction, roadmap, team slide placeholder, financials framework, and the ask.' },
  { label: 'Partnership Proposal', prompt: 'Generate a partnership proposal document for approaching physical therapy clinics and personal training studios about the Atlas Prime professional platform. Cover: the value proposition for their practice, how the B2B portal works, client profile tiers, built-in marketing benefits, revenue-sharing model, onboarding process, and success metrics. Make it persuasive and professional.' },
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
  <title>${title} — Atlas Prime</title>
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
    <div class="doc-brand">Atlas Prime — Confidential</div>
    <div class="doc-title">${title}</div>
    <div class="doc-date">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  </div>
  <div class="doc-body">${html}</div>
  <div class="doc-footer">Atlas Prime — AI-Powered Performance Training & Recovery &nbsp;|&nbsp; Confidential &nbsp;|&nbsp; ${new Date().getFullYear()}</div>
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
        Ask anything about the business, request a specific document, or search for information. The AI knows everything about Atlas Prime — the product, market, competitors, roadmap, and strategy.
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
