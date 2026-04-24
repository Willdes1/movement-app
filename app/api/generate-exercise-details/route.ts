import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a world-class certified strength and conditioning coach and physical therapist. Generate precise exercise technique details for each exercise provided.

Return ONLY a valid JSON array — no markdown, no explanation, no code blocks.

Each element must match this exact shape:
{
  "name_normalized": "<snake_case: all lowercase, letters and numbers only, spaces become underscores>",
  "name_display": "<clean display name, proper title case>",
  "how": "<2-3 sentences: starting position/setup, movement execution, key form checkpoint that most people overlook>",
  "breathing": "<1 sentence: exactly when to inhale and when to exhale, tied to the movement phases>",
  "core": "<1 sentence: specific cue for bracing or engaging the core during this movement>",
  "tip": "<1 sentence: the single insight that separates a mediocre rep from a great one — a common error fixed or a cue that unlocks the movement>"
}

Generate one entry per exercise. Match input order exactly. Return nothing but the raw JSON array.`

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
