import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert certified personal trainer, strength and conditioning coach, and sports performance specialist with deep knowledge of ISSA CFT principles, physical therapy, and kinesiology.

Generate a personalized 7-day weekly training plan for the specified week of a 13-week program. Return ONLY a valid JSON array — no explanation, no markdown, no code blocks, no surrounding text whatsoever.

The array must contain exactly 7 objects (Monday through Sunday), each with these exact keys:
- "day": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
- "label": short workout name (3-4 words max)
- "type": one of: "workout" | "warmup" | "cooldown" | "morning" | "rest" | "abs" | "evening"
- "movements": array of 4-6 strings describing exercises with sets/reps (e.g. "Goblet Squat 3×8")
- "duration": estimated time string (e.g. "45 min") or "—" for rest days

Rules:
- Active training days must match the user's days_per_week count; remaining days are rest
- NEVER include exercises that load or stress any restricted or injured body areas
- For sport athletes, include sport-specific conditioning relevant to their sport(s)
- Session duration must match sessionLength or session_length preference
- Apply the intensity guidance for the current phase precisely
- Each week should feel progressively different from the previous — vary exercises, not just intensity
- Rest days: type "rest", movements ["Full rest", "Light walk optional", "Sleep 8+ hours"], duration "—"
- Return nothing except the raw JSON array`

function buildPrompt(profile: Record<string, unknown>, weekNumber: number, phaseLabel: string, intensity: string): string {
  const lines: string[] = [
    `PROGRAM CONTEXT: Week ${weekNumber} of 13 — ${phaseLabel}`,
    `INTENSITY GUIDANCE: ${intensity}`,
    '',
    'ATHLETE PROFILE:',
  ]

  if (profile.name) lines.push(`Name: ${profile.name}`)
  if (profile.gender) lines.push(`Gender: ${profile.gender}`)
  if (profile.age) lines.push(`Age: ${profile.age}`)
  if (profile.sport) lines.push(`Primary sport(s): ${profile.sport}`)
  if (profile.goal) lines.push(`Goal(s): ${profile.goal}`)
  if (profile.goal_notes) lines.push(`Goal description: ${profile.goal_notes}`)
  if (profile.days_per_week) lines.push(`Training days per week: ${profile.days_per_week}`)
  if (profile.session_length) lines.push(`Session length: ${profile.session_length}`)
  if (profile.wants_morning) lines.push(`Prefers morning workouts: yes`)
  if (profile.wants_evening) lines.push(`Prefers evening workouts: yes`)
  if (profile.mobility_time) lines.push(`Mobility time: ${profile.mobility_time}`)
  if (profile.has_restrictions) {
    if (profile.restriction_areas) lines.push(`Injury/restriction areas: ${JSON.stringify(profile.restriction_areas)}`)
  }
  if (profile.sport_schedule) lines.push(`Sport schedule: ${JSON.stringify(profile.sport_schedule)}`)

  lines.push(`\nGenerate the 7-day plan for Week ${weekNumber} now.`)
  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { profile, weekNumber = 1, phaseLabel = 'Foundation Phase', intensity = 'RPE 6-7. Build base fitness and movement quality.' } = body

    const prompt = buildPrompt(profile, weekNumber, phaseLabel, intensity)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const plan = JSON.parse(cleaned)

    if (!Array.isArray(plan) || plan.length !== 7) {
      throw new Error(`Expected 7-day array, got ${Array.isArray(plan) ? plan.length : typeof plan}`)
    }

    return Response.json({ plan })
  } catch (err) {
    console.error('Plan generation error:', err)
    return Response.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
