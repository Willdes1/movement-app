import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert sports performance specialist and physical therapist with deep experience in return-to-sport progressions.

Generate a personalized 6-9 step return-to-sport progression. Return ONLY a valid JSON array — no explanation, no markdown, no code blocks, no surrounding text.

Each step object must have EXACTLY these keys:

- "step": step number (1-based integer)
- "title": short stage name (2-4 words, e.g. "Ground Control", "Low-Impact Skills", "Full Session")
- "description": 1-2 sentences — what this phase builds and why it matters for safe progression
- "activities": array of 3-6 specific, concrete activities for this stage (sport-specific, not generic)
- "readiness_check": one clear yes/no question the athlete answers before unlocking the next step
- "duration_days": minimum recommended days at this stage before attempting the readiness check (integer, 2-7)

RULES:
- Progression must be genuinely incremental — each step requires mastery of the prior
- Activities must be sport-specific and concrete ("Ollie on flat ground 10x" not "practice basic skills")
- Never include activities that load or stress listed injury/restriction areas
- For impact sports: progress from no-impact → low-impact → moderate → full impact
- For contact sports: non-contact → limited contact → full contact
- For skill sports (skateboarding, gymnastics, martial arts): basics → low-risk tricks → moderate → full repertoire
- Final step must be full return to training/competition at normal intensity
- Return nothing except the raw JSON array`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sport, restrictions = [], injuryArea = '' } = body

    if (!sport) return Response.json({ error: 'Sport is required' }, { status: 400 })

    const lines: string[] = [`Generate a return-to-sport progression for: ${sport}`]
    if (injuryArea) lines.push(`Recovering from: ${injuryArea}`)
    if (restrictions.length > 0) lines.push(`Movement restrictions: ${restrictions.join(', ')}`)
    lines.push(`\nGenerate the step-by-step return to ${sport} protocol now.`)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: lines.join('\n') }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const steps = JSON.parse(cleaned)

    if (!Array.isArray(steps) || steps.length < 4) {
      throw new Error(`Expected steps array, got ${Array.isArray(steps) ? steps.length : typeof steps}`)
    }

    return Response.json({ steps })
  } catch (err) {
    console.error('Return-to-sport generation error:', err)
    return Response.json({ error: 'Failed to generate progression' }, { status: 500 })
  }
}
