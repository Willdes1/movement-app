import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert certified personal trainer, strength and conditioning coach, and sports performance specialist with deep knowledge of ISSA CFT principles, physical therapy, and kinesiology.

Generate a personalized 7-day weekly training plan for the specified week of a 13-week program. Return ONLY a valid JSON array — no explanation, no markdown, no code blocks, no surrounding text whatsoever.

CRITICAL: Every day object MUST include a "daily_session" key with the full structured block format defined below. Any response missing "daily_session" on any day is invalid and will be rejected by the server.

The array must contain exactly 7 objects (Monday through Sunday), each with EXACTLY these keys:

- "day": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
- "label": workout name (3-5 words, descriptive — e.g. "Lower Body Power", "Upper Pull + Core")
- "type": one of: "workout" | "warmup" | "cooldown" | "morning" | "rest" | "abs" | "evening"
- "movements": array of 5-8 strings (the main workout exercises) in format "Exercise Name NxReps". These must EXACTLY match the exercises in daily_session.workout.exercises. For rest days: ["Full rest", "Light walk optional", "Sleep 8+ hours"].
- "duration": estimated total session time including all blocks (e.g. "75 min") or "—" for rest days
- "focus": 1 concise phrase describing the primary muscle groups and training system targeted
- "rest": object with exactly two keys:
    - "between_sets": rest time between sets of the same exercise (e.g. "60 sec", "90 sec", "2 min") — scale by phase intensity and load type
    - "between_rounds": rest between circuits, supersets, or after all sets of a major compound before moving on (e.g. "90 sec", "2 min", "3 min")
- "coaching": 1-2 sentences — the single most important technical cue for this session, plus an explicit breathing cue. Always include: exhale on exertion (concentric), inhale on eccentric/lowering. Example: "Keep your chest tall and drive through the heel on every squat. Exhale forcefully as you stand; inhale slowly as you descend."
- "daily_session": structured 6-block day (training) or 3-block day (rest) — see DAILY SESSION STRUCTURE below

DAILY SESSION STRUCTURE:

TRAINING days — daily_session must have EXACTLY these 6 keys:
  "morning":  { "label": "Morning Mobility",    "duration": "X min", "exercises": [3-4 strings] }
  "warmup":   { "label": "<Sport>-specific name", "duration": "X min", "exercises": [3-5 strings], "tip": "sport culture mindset cue, 1-2 sentences" }
  "workout":  { "label": same as the day label,  "duration": "X min", "exercises": [5-8 strings — SAME as movements array] }
  "abs":      { "label": "Core / Abs",           "duration": "X min", "exercises": [3-5 strings] }
  "cooldown": { "label": "Cool-Down",            "duration": "X min", "exercises": [3-4 strings] }
  "evening":  { "label": "Evening Mobility",     "duration": "X min", "exercises": [3-4 strings] }

REST days — daily_session must have EXACTLY these 3 keys:
  "morning":  { "label": "Morning Mobility",       "duration": "8 min", "exercises": [3-4 gentle exercises] }
  "abs":      { "label": "Core / Abs (Optional)",  "duration": "8 min", "exercises": [2-3 gentle stability exercises: dead bugs, diaphragmatic breathing, gentle plank] }
  "evening":  { "label": "Evening Stretch",        "duration": "8 min", "exercises": [3-4 pre-sleep stretches] }

BLOCK CONTENT RULES:
Morning (all days): Gentle joint circles, cat-cow, hip/spine openers. No load. Address morning stiffness — athlete wakes stiff every day.
Warmup (training days): SPORT-SPECIFIC. Use real sport terminology and movements that prepare the athlete for today's session:
  • Skateboarding: "Ride regular stance 3 min easy", "50-50 grinds 5 reps flow pace", "Backside 180 5 reps", "Ankle circles 2×15"
    tip: "Mushin — empty mind, be present. One trick at a time. Let the board do the work."
  • Basketball: "Full-court dribble 3 min", "Defensive slide 3×10 yards", "Form shooting 2×10"
    tip: "IQ over ego. Read the defense before you move the ball."
  • Soccer: "Juggling 3×30 touches", "Rondo 2×2 min", "Dynamic calf raises 2×15"
    tip: "First touch decides everything. Control before pace."
  • Running/Track: "Easy jog 5 min Z1", "A-skips 3×20m", "High knees 3×20m", "Strides 3×60m"
    tip: "Stay in your zone. RPE is your compass — trust it over pace."
  • Cycling: "Easy spin 10 min Z1", "Single-leg drill 4×30 sec each", "Seated spin-ups 3×1 min"
    tip: "Cadence before power. Smooth circles before force."
  • General/Gym/No sport: "Jump rope 3 min", "Band pull-apart 2×20", "Leg swings 2×15 each"
    tip: "Set your intention before the bar touches you. Every rep is a deliberate choice."
Workout (training days): Main training exercises — MUST be identical to the movements array.
Core / Abs (training days): 3-5 injury-appropriate exercises, 8-12 min. Never load spine if spine is the injury site.
Core / Abs (rest days — label "Core / Abs (Optional)"): 2-3 gentle stability only — dead bugs, diaphragmatic breathing, gentle plank.
Cooldown (training days): 3-4 stretches targeting primary muscles worked today, 6-10 min.
Evening (all days): Pre-sleep gentle mobility — legs up wall, supine twists, breathwork. 6-8 min.

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

For rest days: type="rest", movements=["Full rest", "Light walk optional", "Sleep 8+ hours"], duration="—", focus="Active recovery", rest={"between_sets":"—","between_rounds":"—"}, coaching="Today is about repair. Stay hydrated, get 8+ hours of sleep, and take a 10-20 min walk if you feel restless — movement aids recovery without taxing the system.", daily_session={"morning":{...},"abs":{...},"evening":{...}} — use the 3-block rest day format defined above

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
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const plan = JSON.parse(cleaned)

    if (!Array.isArray(plan) || plan.length !== 7) {
      throw new Error(`Expected 7-day array, got ${Array.isArray(plan) ? plan.length : typeof plan}`)
    }

    const missingDs = plan.findIndex((d: Record<string, unknown>) => !d.daily_session)
    if (missingDs !== -1) {
      throw new Error(`Day at index ${missingDs} is missing daily_session`)
    }

    return Response.json({ plan })
  } catch (err) {
    console.error('Plan generation error:', err)
    return Response.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
