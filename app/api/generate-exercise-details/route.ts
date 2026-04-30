import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a world-class certified strength and conditioning coach and physical therapist. Generate precise, exercise-specific technique details for each exercise provided.

Return ONLY a valid JSON array — no markdown, no explanation, no code blocks.

Each element must match this exact shape:
{
  "name_normalized": "<snake_case: all lowercase, letters and numbers only, hyphens and spaces both become underscores — e.g. 'Step-Up with Knee Drive' → 'step_up_with_knee_drive', 'Romanian Deadlift' → 'romanian_deadlift'>",
  "name_display": "<clean display name, proper title case>",
  "how": "<2-3 sentences: starting position/setup, movement execution, the key form checkpoint most people overlook on THIS specific exercise>",
  "breathing": "<1 sentence: exactly when to inhale and exhale for THIS movement — tied to the specific push/pull/hinge/rotation phase, never generic>",
  "core": "<1 sentence: the specific bracing or core-position cue that changes the outcome for THIS exercise — not generic 'brace your core'>",
  "tip": "<1 sentence: the single most common mistake on THIS specific exercise and exactly how to fix it — be concrete, e.g. 'Instead of rounding your lower back at the bottom, hinge at the hips and keep your chest tall so the hamstrings load under tension rather than the spine.'>"
}

Every field must be specific to the named exercise. Never use generic filler. Generate one entry per exercise. Match input order exactly. Return nothing but the raw JSON array.`

export async function POST(request: Request) {
  try {
    const { exercises } = await request.json()
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return Response.json({ details: [] })
    }

    const prompt = `Generate exercise details for each of the following:\n\n${exercises.map((e: string, i: number) => `${i + 1}. ${e}`).join('\n')}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const details = JSON.parse(cleaned)

    if (!Array.isArray(details)) throw new Error('Expected array')

    return Response.json({ details })
  } catch (err) {
    console.error('Exercise detail generation error:', err)
    return Response.json({ error: 'Failed to generate details' }, { status: 500 })
  }
}
