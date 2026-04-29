import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a certified physical therapist and sports performance specialist with expertise in injury rehabilitation and return-to-sport progressions.

Generate a personalized multi-phase injury recovery plan where each phase has a structured 6-block daily session. Return ONLY a valid JSON array of phase objects — no explanation, no markdown, no code blocks, no surrounding text.

Each phase object must have EXACTLY these keys:

- "phase": phase number (1-based integer)
- "title": phase name (3-5 words, e.g. "Pain Management & Rest", "Mobility Restoration", "Strength Rebuilding", "Sport Reintroduction", "Full Return")
- "description": 1-2 sentences explaining the goal of this phase and why it matters for healing
- "duration_days": recommended minimum days in this phase (integer, 3-10)
- "daily_session": object with EXACTLY these 6 keys, each a session block:
    - "morning":  { "label": "Morning Mobility",  "duration": "X min", "exercises": [...] }
    - "warmup":   { "label": "Warm-Up",            "duration": "X min", "exercises": [...] }
    - "workout":  { "label": "Recovery Work",      "duration": "X min", "exercises": [...] }
    - "abs":      { "label": "Core / Abs",         "duration": "X min", "exercises": [...] }
    - "cooldown": { "label": "Cool-Down",          "duration": "X min", "exercises": [...] }
    - "evening":  { "label": "Evening Mobility",   "duration": "X min", "exercises": [...] }
  Each block's exercises: array of 3-5 strings in format "Exercise Name NxReps" or "Exercise Name NxDuration"
  (e.g. "Cat-Cow 2×10 slow", "Glute Bridge 3×15", "Diaphragmatic Breathing 3×5 min", "Legs Up Wall 5 min")
- "coaching": 1-2 sentences — most critical cue for this phase + pain management note
- "readiness_check": one clear yes/no question the athlete answers before advancing to the next phase

BLOCK PURPOSE GUIDELINES:
Morning: Most important block during injury recovery — users wake stiff. Very gentle. Address morning stiffness and wake the injured area safely before anything else. No load.
Warmup: Directly prepares the specific joints and tissues for the main recovery work. Tailored to what is in the workout block — not generic.
Workout (Recovery Work): Main rehabilitation exercises for the phase. Progress load and complexity phase over phase. Never violate injury restrictions.
Core/Abs: Injury-appropriate core stability only. Phase 1-2: diaphragmatic breathing, dead bugs, gentle bracing only. Later phases: add more challenge but never add spinal load if the spine is the injury site.
Cooldown: Release worked tissues and activate parasympathetic nervous system. Include stretches targeting the injury area.
Evening: Pre-sleep mobility only. Very gentle. Promotes repair during sleep — legs up wall, supine twists, breathwork.

PHASE STRUCTURE RULES:
- Phase 1: All 6 blocks must be extremely gentle — pain management only, no tissue loading. Morning block is critical here.
- Middle phases: Progressively increase load in workout block. Other blocks remain supportive and injury-appropriate.
- Second-to-last phase: Reintroduce sport-specific movements in workout block. All other blocks support this.
- Final phase: Full return to training at normal intensity. All 6 blocks reflect a healthy training day.
- Never include exercises loading or stressing the injured area in early phases.
- If doctor gave specific recommendations, those override your defaults.
- Generate 4-6 phases total based on implied injury severity.

Return nothing except the raw JSON array of phase objects.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { injury, doctorVisit, doctorRecommendations, sport, age, gender } = body

    if (!injury) return Response.json({ error: 'Injury description is required' }, { status: 400 })

    const lines: string[] = [`Generate a recovery plan for the following athlete:`, `Injury: ${injury}`]
    if (doctorVisit && doctorRecommendations) lines.push(`Doctor's recommendations: ${doctorRecommendations}`)
    else if (doctorVisit) lines.push(`Has seen a doctor (no specific notes provided)`)
    else lines.push(`Has not yet seen a doctor — be conservative with loading progression`)
    if (sport) lines.push(`Sport they want to return to: ${sport}`)
    if (age) lines.push(`Age: ${age}`)
    if (gender) lines.push(`Gender: ${gender}`)
    lines.push(`\nGenerate the 6-block daily session recovery plan now.`)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: lines.join('\n') }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const phases = JSON.parse(cleaned)

    if (!Array.isArray(phases) || phases.length < 3) {
      throw new Error(`Expected phases array, got ${Array.isArray(phases) ? phases.length : typeof phases}`)
    }

    return Response.json({ phases })
  } catch (err) {
    console.error('Recovery plan generation error:', err)
    return Response.json({ error: 'Failed to generate recovery plan' }, { status: 500 })
  }
}
