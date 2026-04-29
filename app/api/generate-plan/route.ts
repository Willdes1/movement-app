import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert certified personal trainer, strength and conditioning coach, and sports performance specialist with deep knowledge of ISSA CFT principles, physical therapy, and kinesiology.

Generate a personalized 7-day weekly training plan for the specified week of a 13-week program. Return ONLY a valid JSON array — no explanation, no markdown, no code blocks, no surrounding text whatsoever.

The array must contain exactly 7 objects (Monday through Sunday), each with EXACTLY these keys:

- "day": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
- "label": workout name (3-5 words, descriptive — e.g. "Lower Body Power", "Upper Pull + Core")
- "type": one of: "workout" | "warmup" | "cooldown" | "morning" | "rest" | "abs" | "evening"
- "movements": array of 5-8 strings, each in format "Exercise Name NxReps" (e.g. "Barbell Back Squat 4×5", "Single-Leg RDL 3×10 each side"). Include appropriate warm-up sets notation where needed.
- "duration": estimated time string (e.g. "50 min") or "—" for rest days
- "focus": 1 concise phrase describing the primary muscle groups and training system targeted (e.g. "Quad strength · posterior chain", "Push power · shoulder stability")
- "rest": object with exactly two keys:
    - "between_sets": rest time between sets of the same exercise (e.g. "60 sec", "90 sec", "2 min") — scale by phase intensity and load type
    - "between_rounds": rest between circuits, supersets, or after all sets of a major compound before moving on (e.g. "90 sec", "2 min", "3 min")
- "coaching": 1-2 sentences — the single most important technical cue for this session, plus an explicit breathing cue. Always include: exhale on exertion (concentric), inhale on eccentric/lowering. Example: "Keep your chest tall and drive through the heel on every squat. Exhale forcefully as you stand; inhale slowly as you descend."

REST TIME GUIDELINES BY PHASE AND LOAD:
- Foundation (weeks 1-4): moderate loads — 60-90 sec between sets, 90 sec between rounds
- Build (weeks 5-8): heavier compound work — 90 sec-2 min between sets, 2 min between rounds
- Peak (weeks 9-10): maximal intensity — 2-3 min between heavy compound sets, 90 sec between accessory sets
- Maintenance (weeks 11-13): moderate — 60-90 sec between sets, 90 sec between rounds
- HIIT/conditioning sessions: 20-30 sec between exercises, 90 sec-2 min between full rounds
- Superset pairs (A/B): 0 sec between A and B, 60-90 sec after completing the full pair

EXERCISE ORDERING RULES:
1. Always order: compound multi-joint lifts first (squats, deadlifts, presses, rows) → accessory work → isolation/corrective
2. Place bilateral before unilateral versions of the same pattern
3. Pair antagonist muscles in supersets when session type calls for density
4. Never place two heavy spinal-loading exercises back to back without a core/mobility buffer

COACHING NOTE RULES:
- The coaching cue must be specific to THIS session's primary movement pattern — not generic
- Always end with or include a breathing cue (exhale on effort, inhale on descent/recovery)
- For sessions with rotational or overhead movements, add a core bracing reminder
- For athletes with listed injury restrictions, include a compensation cue for the restricted area

For rest days: type="rest", movements=["Full rest", "Light walk optional", "Sleep 8+ hours"], duration="—", focus="Active recovery", rest={"between_sets":"—","between_rounds":"—"}, coaching="Today is about repair. Stay hydrated, get 8+ hours of sleep, and take a 10-20 min walk if you feel restless — movement aids recovery without taxing the system."

Additional rules:
- Active training days must match the user's days_per_week count; remaining days are rest
- NEVER include exercises that load or stress any restricted or injured body areas
- For sport athletes, include sport-specific conditioning relevant to their sport(s)
- Session duration must match sessionLength or session_length preference
- Apply the intensity guidance for the current phase precisely
- Each week should feel progressively different from previous weeks — vary exercises, not just intensity
- Return nothing except the raw JSON array`

function buildPrompt(profile: Record<string, unknown>, weekNumber: number, phaseLabel: string, intensity: string, instructions = ''): string {
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
  if (profile.prior_programs) lines.push(`Prior training programs/styles they enjoyed: ${profile.prior_programs}`)
  if (profile.days_per_week) lines.push(`Training days per week: ${profile.days_per_week}`)
  if (profile.session_length) lines.push(`Session length: ${profile.session_length}`)
  if (profile.wants_morning) lines.push(`Prefers morning workouts: yes`)
  if (profile.wants_evening) lines.push(`Prefers evening workouts: yes`)
  if (profile.mobility_time) lines.push(`Mobility time: ${profile.mobility_time}`)
  if (profile.has_restrictions) {
    if (profile.restriction_areas) lines.push(`Injury/restriction areas: ${JSON.stringify(profile.restriction_areas)}`)
  }
  if (profile.sport_schedule) lines.push(`Sport schedule: ${JSON.stringify(profile.sport_schedule)}`)
  if (profile.workout_location) lines.push(`Workout location: ${profile.workout_location}`)
  if (profile.home_equipment && Array.isArray(profile.home_equipment) && (profile.home_equipment as string[]).length > 0) {
    lines.push(`Available home equipment: ${(profile.home_equipment as string[]).join(', ')}`)
    lines.push(`IMPORTANT: Only program exercises that use the equipment listed above. Do not program exercises requiring equipment not on this list.`)
  }

  if (instructions?.trim()) {
    lines.push('')
    lines.push(`SPECIFIC INSTRUCTIONS FROM USER: ${instructions.trim()}`)
    lines.push('Apply these instructions precisely — they override general defaults.')
  }

  lines.push(`\nGenerate the 7-day plan for Week ${weekNumber} now.`)
  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { profile, weekNumber = 1, phaseLabel = 'Foundation Phase', intensity = 'RPE 6-7. Build base fitness and movement quality.', instructions = '' } = body

    const prompt = buildPrompt(profile, weekNumber, phaseLabel, intensity, instructions)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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
