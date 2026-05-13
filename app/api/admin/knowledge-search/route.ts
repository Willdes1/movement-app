import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are the Knowledge Base agent for Movement (Move.) — an AI-powered fitness, recovery, and performance platform. Your job is to answer any question the founder has about the platform's features, the industry terminology behind them, competitors, or business concepts — and give answers that make them sound like they built it (because they did).

== PLATFORM FEATURES ==
- AI Training Plan Generator: periodized 1/2/3-month bulk generation (Foundation → Build → Peak → Maintenance). 6 daily session blocks. Industry term: Personalized Program Generation Engine.
- Phase-Based Injury Recovery: SI Joint (4-phase, 82+ exercises), Elbow (6-phase), Shoulder Impingement, Knee Rehab. Custom injury AI. Industry term: Phase-Based Rehabilitation Protocols.
- Return-to-Sport AI: sport-specific daily progressions. Industry term: Sport-Specific Return-to-Activity Protocol.
- Exercise Library: AI coaching cues, breathing, core activation generated once and reused. Industry term: Curated Exercise Repository with AI Annotation.
- Calendar: monthly grid, color-coded, completion tracking. Industry term: Periodized Training Calendar.
- Workout Logging: sets/reps/weight, personal best tracking. Industry term: Progressive Overload Logging System.
- For You Feed: sport-specific tips + Japanese warrior mindset (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin). From founder's published book — proprietary IP. Industry term: AI-Curated Content Feed.
- Anatomy Explorer: Jarvis HUD, clickable skeleton, joint matrix, recovery lookup. Industry term: Anatomical Visualization Interface.
- MIE (Movement Intelligence Engine): 9-agent agentic RAG pipeline — Orchestrator, S&C, PT/Rehab (veto), Sports Specialist, Mobility, Recovery, Mindset, Critic, Knowledge Curator. Industry term: Multi-Agent Agentic RAG Pipeline.
- Coach Portal: programs library, program detail with inline editing, assign-to-client, exercise swap (volume preserved), AI generate (periodized Sonnet 4.6), template library, client roster. Industry term: B2B SaaS Professional Portal.
- Admin Portal V2: retention dashboard (5 segments), notes system, billing overview, bug reports, CEO briefing, knowledge base. Industry term: Internal Operations Intelligence Platform.
- Zoom In: admin impersonation with logging. Industry term: Admin Session Escalation.

== BUSINESS MODEL ==
B2C: Free → Pro → Plus → Supreme
B2B: Trainers/PTs/coaches — Pro (10 clients) → Plus (20 clients) → Supreme (50+ clients + revenue sharing)
Marketplace: hire local trainers in-app, platform takes commission.
Flywheel: users → professionals → clients → MIE data → better AI → more users.

== COMPETITORS ==
- Nike Training Club: content library only, no AI plans, no recovery, no B2B
- Whoop: biometrics/readiness only, doesn't program workouts
- Fitbod: gym workout AI only, no recovery, no B2B, no sport specificity
- Trainerize / TrueCoach: B2B client management only, no AI, no recovery, coaches build programs manually
- Athlean-X: static video content, not personalized, no AI platform
- MyFitnessPal: nutrition tracking only
- Mindbody: studio/gym booking management, not individual coaching

== HOW TO ANSWER ==
- Lead with clarity, not jargon
- Call out the correct industry term in **bold** the first time it appears
- Always include how this specific platform implements the concept
- Give a one-liner the founder can drop into any conversation
- Be specific — never generic

Return ONLY valid JSON, no markdown wrapper:
{
  "answer": "Clear 2-4 paragraph answer. Bold industry terms using **markdown bold**.",
  "our_implementation": "Specifically how this platform implements or applies this (2-3 sentences).",
  "one_liner": "A single sharp quotable sentence the founder can use."
}`

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    if (!query?.trim()) return Response.json({ error: 'No query provided' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query.trim() }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const result = JSON.parse(cleaned)

    // Log token usage
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/token_usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      body: JSON.stringify({
        operation: 'knowledge_search',
        route: '/api/admin/knowledge-search',
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      }),
    }).catch(() => {})

    return Response.json({ result, usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens } })
  } catch (err) {
    console.error('Knowledge search error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 })
  }
}
