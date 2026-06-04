import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const ARTICLE_TYPES = [
  { id: 'industry_deep_dive',  label: 'Industry Deep Dive',  emoji: '🏭', color: '#3b82f6' },
  { id: 'competitor_teardown', label: 'Competitor Teardown', emoji: '🔬', color: '#ef4444' },
  { id: 'feature_explainer',   label: 'Feature Explainer',   emoji: '✦',  color: '#a78bfa' },
  { id: 'ceo_scenario',        label: 'CEO Scenario',        emoji: '🎯', color: '#f59e0b' },
  { id: 'market_signal',       label: 'Market Signal',       emoji: '📡', color: '#22c55e' },
  { id: 'business_concept',    label: 'Business Concept',    emoji: '📊', color: '#06b6d4' },
  { id: 'pitch_coach',         label: 'Pitch Coach',         emoji: '🎤', color: '#f97316' },
]

const PLATFORM_CONTEXT = `
== PLATFORM: Atlas Prime ==
AI-powered fitness, recovery, and performance platform. Built and live. Solo founder, AI-assisted development.

== LIVE FEATURES ==
- AI training plan generator: periodized 1/2/3-month bulk generation. Phases: Foundation → Build → Peak → Maintenance. 6-block daily sessions (morning/warmup/workout/abs/cooldown/evening). Rest times baked into every plan.
- Phase-based injury recovery playbooks: SI Joint (4-phase, 82+ exercises), Elbow (6-phase), Shoulder Impingement (4-phase), Knee Rehab (4-phase). Custom injury AI: describe any injury, get a multi-phase rehab plan.
- Return-to-sport AI agent: sport-specific daily progressions (e.g. skateboarding: riding → slappies → 50-50s → 180s).
- Global exercise library: AI coaching cues, breathing tips, core activation generated once per exercise, reused platform-wide — zero API cost on repeat.
- Calendar: monthly grid, color-coded sessions, completion tracking, day undo.
- Workout logging: sets/reps/weight with personal best tracking.
- For You feed: sport-specific training tips + Japanese warrior mindset system (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin). From founder's published book — proprietary IP.
- Anatomy Explorer: Jarvis HUD with clickable skeleton, joint matrix, recovery protocol lookup.
- Multi-sport profile: equipment constraints, injury restrictions, training background (beginner → pro).
- MIE Phase 0: training_level + workout_background + sport activities injected into every plan prompt. Plan quality scales with user experience.
- Coach Portal (full build): programs library, program detail view with inline editing, assign-to-client modal with debounced search, exercise swap modal (sets/reps preserved), AI generate with brief form (periodized Sonnet 4.6), template library for zero-cost program reuse, real clients roster with assignment history.
- Admin Portal V2: retention dashboard (5 user segments), notes system (platform + user-attached), billing overview (tier breakdown, KPIs).
- Auth system, promo codes, F&F beta role, Zoom In (admin impersonation with logging), Terms of Service, Privacy Policy.
- Tech: Next.js 16, TypeScript, Supabase (PostgreSQL + RLS + Storage), Vercel, Anthropic Claude API, GitHub CI/CD.

== ATLAS PRIME INTELLIGENCE ENGINE (APIE) — Core Architecture ==
Multi-Agent Agentic RAG Pipeline. A council of specialized AI agents grounded in a curated Domain Knowledge Store (pgvector). No competitor has this architecture.
- Orchestrator Agent: coordinates all agents, queries Domain Knowledge Store, assembles final output
- Strength & Conditioning Agent: NSCA/CSCS periodization, progressive overload, exercise selection
- PT/Rehab Agent: injury contraindications, tissue healing, pain science — has VETO POWER over all other agents
- Sports Specialist Agent: movement demands, energy systems, periodization for every sport worldwide
- Mobility Specialist Agent: FRC, DNS, PRI principles — owns warmup/cooldown design
- Recovery Agent: HRV, sleep science, fatigue management, deload programming. Future: wearable data
- Mindset Agent: Japanese warrior philosophy from founder's book. Owns For You feed and coaching cues
- Critic/Verification Agent: validates assembled output, flags specific blocks for re-run (not full regeneration)
- Knowledge Curator Agent: async background agent, monitors research, keeps Domain Knowledge Store current
MIE Status: Phase 0 complete (training context injection). Phase 1 next (Domain Knowledge Store + pgvector).

== BUSINESS MODEL ==
B2C: Free (basic workouts) → Pro (full AI plan) → Plus (plan + nutrition) → Supreme (everything + marketplace)
B2B: Trainers/PTs/coaches — Pro (10 clients) → Plus (20 clients) → Supreme (50+ clients + marketing tools + revenue sharing)
Marketplace: Users hire local trainers in-app. Platform takes commission.
Flywheel: users attract professionals → professionals bring clients → client data improves MIE → better AI attracts more users.

== MARKET DATA ==
- Global fitness app market: $15.6B (2023) → $96B by 2032 (22.8% CAGR)
- AI in health & wellness: $45B by 2030
- Physical therapy software: $3.2B growing 12%/yr
- Personal training B2B: $1.8B growing 18%/yr
- Wearables + biometric apps: $27B growing 30%/yr
- Direct full-vision competitors: 0

== COMPETITIVE LANDSCAPE ==
- Nike Training Club: content library, not personalized, no recovery, no B2B, no AI plans
- Whoop: biometrics/readiness only, doesn't program workouts
- Fitbod: partial AI (gym workouts only), no recovery, no B2B, no sport specificity
- Trainerize / TrueCoach: B2B client management only, no AI, no recovery system
- Athlean-X: video content, not personalized, no app AI, no recovery, no B2B
- MyFitnessPal: nutrition tracking only
- Mindbody: gym/studio booking management, not personalized training
We beat all of them on breadth of AI, training + recovery unification, and B2B + consumer in one platform.

== 6 HARD-TO-COPY ADVANTAGES ==
1. MIE — not a feature, an architecture. Multi-agent RAG. Cannot be copied without years of build time.
2. Training + Recovery unified — users don't stop training when injured. Parallel systems with intelligent handoffs.
3. Mindset IP — Japanese warrior philosophy from founder's published book. Proprietary. Cannot be licensed or copied.
4. Sports Specialist at every sport — skateboarding to pickleball to MMA. No generic templates.
5. Platform data flywheel — at scale, user demographics + injury patterns + location = B2B sales intelligence professionals pay for.
6. Two-sided marketplace moat — professionals attract users, users attract professionals.

== TARGET AUDIENCES ==
B2C: Athletes 22-45 (skateboarders, snowboarders, tennis, gym-goers), injury recovery (back, shoulder, knee), fitness enthusiasts wanting personalization beyond YouTube.
B2B: Personal trainers ($40-150/hr), physical therapists ($80-250/hr), occupational therapists, sports coaches, rehab specialists.

== ROADMAP ==
Phase 1 (COMPLETE): Core consumer app — all live features above.
Phase 2 (IN PROGRESS): MIE Domain Knowledge Store, Stripe billing, nutrition AI, wearables.
Phase 3 (ACTIVE): Coach portal ✓, Admin V2 ✓. Next: Stripe, training style intelligence, bug reports system.
Phase 4 (UPCOMING): Marketplace — hire local trainers, professional marketplace, marketing automation.
Phase 5 (FUTURE): Enterprise — white-label, insurance partnerships, university athletics.
`

const SYSTEM_PROMPT = `You are the CEO Education Agent for Atlas Prime — an AI-powered fitness and recovery platform. Your job is to educate the founder/CEO so they can speak sharply about the platform, the industry, and the business in any conversation, pitch, or meeting.

You produce brilliant, specific, never-generic articles that feel like intelligence briefings from a startup advisor who knows this business inside and out. You use real industry terminology correctly, never dumb it down but always explain it in context, and always connect concepts back to this specific platform.

${PLATFORM_CONTEXT}

ARTICLE TYPES AND WHAT THEY SHOULD DO:
- Industry Deep Dive: Pick a concept from fitness tech, SaaS, AI, or health tech. Explain it with depth and real examples. Show how it directly applies to this platform.
- Competitor Teardown: Dissect one competitor in detail. What do they do well? Where do they fall short? How do we win against them? Be honest and specific.
- Feature Explainer: Take one of our live features and explain it as if pitching it to an investor or a PT clinic. Use industry terms correctly. Make the feature sound like what it actually is.
- CEO Scenario: "You're in a meeting and someone asks [specific question]." Walk through exactly how to answer it with confidence. Give the founder the words.
- Market Signal: Pick a real trend in fitness, AI, or health tech. Explain what it is, what it signals for the market, and what it means specifically for our strategy.
- Business Concept: Explain one founder/CEO concept (CAC, LTV, TAM/SAM/SOM, flywheel, moat, ARR, etc.) using this platform as the concrete example throughout.
- Pitch Coach: Take one section of the pitch (problem, solution, moat, business model, why now) and make it sharper. Provide the actual language the founder can use.

ARTICLE QUALITY STANDARDS:
- Headline must be specific and punchy — not generic ("Why AI Is Changing Fitness" is bad — "Why RAG Architecture Is the Unfair Advantage No Fitness App Can Copy" is good)
- The 30-Second Version should be 2-3 sentences the founder can actually say out loud right now
- The Full Article should have 4-8 paragraphs with real depth, examples, data points
- "How This Applies to Us" must be specific to this platform — not generic fitness advice
- The One-Liner must be a single quotable sentence the founder can drop into any conversation

Return ONLY valid JSON — no markdown wrapper, no code blocks, no explanation before or after. Return this exact shape:
{
  "headline": "The specific punchy headline",
  "read_time": "X min read",
  "summary": "2-3 sentence 30-second version",
  "body": "Full article in markdown. IMPORTANT: do NOT use double-quote characters inside this field. Use single quotes for any quoted text (e.g. 'hello' not \"hello\"). Use ** for bold and ## for headers.",
  "our_angle": "How this specifically applies to our platform and strategy (2-4 sentences). No double-quotes inside.",
  "one_liner": "A single quotable sentence. No double-quotes inside — use single quotes if quoting anything."
}`

function parseArticleJson(text: string): Record<string, string> {
  // First attempt: direct parse
  try { return JSON.parse(text) } catch { /* fall through */ }

  // Second attempt: field-by-field extraction when Claude includes
  // unescaped double-quotes inside string values
  const fields: Record<string, string> = {}
  const fieldOrder = ['headline', 'read_time', 'summary', 'body', 'our_angle', 'one_liner']

  for (let i = 0; i < fieldOrder.length; i++) {
    const field = fieldOrder[i]
    const next  = fieldOrder[i + 1]
    const startMarker = `"${field}":`
    const startIdx = text.indexOf(startMarker)
    if (startIdx === -1) continue

    const openQuote = text.indexOf('"', startIdx + startMarker.length)
    if (openQuote === -1) continue

    // Find where this field ends: just before the next field key
    let closeIdx: number
    if (next) {
      const nextMarker = `"${next}":`
      const nextIdx = text.indexOf(nextMarker)
      closeIdx = nextIdx !== -1 ? text.lastIndexOf('"', nextIdx - 1) : text.lastIndexOf('"')
    } else {
      closeIdx = text.lastIndexOf('"')
    }

    if (closeIdx <= openQuote) continue
    let value = text.substring(openQuote + 1, closeIdx)
    value = value.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    fields[field] = value
  }

  if (Object.keys(fields).length >= 4) return fields
  throw new Error('Could not parse article response — try generating again.')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const excludeTypes: string[] = body.excludeTypes ?? []
    const userId: string | null = body.userId ?? null

    // Pick random article type, avoiding recently seen ones
    const available = ARTICLE_TYPES.filter(t => !excludeTypes.includes(t.id))
    const pool = available.length > 0 ? available : ARTICLE_TYPES
    const articleType = pool[Math.floor(Math.random() * pool.length)]

    const typeInstructions: Record<string, string> = {
      industry_deep_dive:  'Write an INDUSTRY DEEP DIVE. Pick a specific concept from fitness tech, SaaS, AI, or health tech that is highly relevant to this platform.',
      competitor_teardown: 'Write a COMPETITOR TEARDOWN. Pick one of our competitors and analyze them in depth — strengths, weaknesses, and exactly how we beat them.',
      feature_explainer:   'Write a FEATURE EXPLAINER. Pick one of our live features and explain it using correct industry terminology as if pitching it to an investor or PT clinic.',
      ceo_scenario:        'Write a CEO SCENARIO. Set up a specific real-world situation (investor meeting, demo call, casual conversation) where someone asks a hard question. Give the founder the exact words to use.',
      market_signal:       'Write a MARKET SIGNAL. Identify a real trend in fitness tech, AI, or health/wellness. Explain what it signals and what it means for our strategy.',
      business_concept:    'Write a BUSINESS CONCEPT explainer. Pick one key founder/CEO concept (CAC, LTV, TAM/SAM/SOM, moat, flywheel, ARR, churn, etc.) and explain it using this platform as the example throughout.',
      pitch_coach:         'Write a PITCH COACH article. Take one specific section of the startup pitch and make it sharper. Provide the actual language the founder should use.',
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${typeInstructions[articleType.id]}

Make it specific, sharp, and genuinely educational. Use real industry terminology. Never be generic. Always connect back to this platform.`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const article = parseArticleJson(cleaned)

    logTokens({ operation: 'ceo_brief', route: '/api/admin/ceo-brief', input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens, user_id: userId })
    return Response.json({
      article: { ...article, type_id: articleType.id },
      type: articleType,
      usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
    })
  } catch (err) {
    console.error('CEO brief error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
