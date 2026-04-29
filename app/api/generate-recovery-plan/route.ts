import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a certified physical therapist and sports performance specialist with expertise in injury rehabilitation and return-to-sport progressions.

Generate a personalized multi-phase injury recovery plan. Return ONLY a valid JSON array of phase objects — no explanation, no markdown, no code blocks, no surrounding text.

Each phase object must have EXACTLY these keys:

- "phase": phase number (1-based integer)
- "title": phase name (3-5 words, e.g. "Pain Management & Rest", "Mobility Restoration", "Strength Rebuilding", "Sport Reintroduction", "Full Return")
- "description": 1-2 sentences explaining the goal of this phase and why it matters for healing
- "duration_days": recommended minimum days in this phase (integer, 3-10)
- "exercises": array of 4-7 specific exercises in format "Exercise Name NxReps" or "Exercise Name NxDuration" (e.g. "Supine Knee Hug 3×30 sec", "Glute Bridge 3×15", "Cat-Cow 2×10 slow")
- "coaching": 1-2 sentences — the single most critical cue for this phase plus a pain/load management note
- "readiness_check": one clear yes/no question the athlete answers before advancing to the next phase

PHASE STRUCTURE RULES:
- Phase 1 must be rest-dominant with pain management and gentle mobility only
- Middle phases progressively load tissue and restore range of motion and strength
- Second-to-last phase reintroduces sport-specific movements at low intensity
- Final phase is full return to training/sport at normal load
- Generate 4-6 phases total based on injury severity implied by the input
- Never include exercises that load or stress the injured area in early phases
- If doctor gave specific recommendations, those override your defaults for that phase
- Exercises must be injury-appropriate — no movements contraindicated for the listed area

Return nothing except the raw JSON array of phase objects.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { injury, doctorVisit, doctorRecommendations, sport, age, gender } = body

    if (!injury) return Response.json({ error: 'Injury description is required' }, { status: 400 })

    const lines: string[] = [
      `Generate a recovery plan for the following athlete:`,
      `Injury: ${injury}`,
    ]
    if (doctorVisit && doctorRecommendations) lines.push(`Doctor's recommendations: ${doctorRecommendations}`)
    else if (doctorVisit) lines.push(`Has seen a doctor (no specific notes provided)`)
    else lines.push(`Has not yet seen a doctor — be conservative with loading progression`)
    if (sport) lines.push(`Sport they want to return to: ${sport}`)
    if (age) lines.push(`Age: ${age}`)
    if (gender) lines.push(`Gender: ${gender}`)
    lines.push(`\nGenerate the recovery phase plan now.`)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
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
