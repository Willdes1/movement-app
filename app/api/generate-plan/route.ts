import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'
import { retrieveKnowledge, formatKnowledgeContext } from '@/lib/knowledge-retrieval'

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

// ── Agent runner helper ───────────────────────────────────────────────────────
async function runAgent(
  systemPrompt: string,
  userPrompt: string,
  label: string
): Promise<{ plan: unknown[] | null; inputTokens: number; outputTokens: number }> {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed) || parsed.length !== 7) throw new Error('Invalid array length')
    return { plan: parsed, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
  } catch (err) {
    console.warn(`${label} agent failed, using previous plan:`, err)
    return { plan: null, inputTokens: 0, outputTokens: 0 }
  }
}

// ── Phase 2: PT/Rehab ─────────────────────────────────────────────────────────
const PT_REHAB_SYSTEM_PROMPT = `You are an elite physical therapist and sports rehabilitation specialist with 15+ years of clinical experience. You are reviewing a drafted training plan to ensure athlete safety given their listed injury restrictions.

Your job: identify any exercises that are contraindicated for the athlete's specific restrictions and replace them with safe, effective alternatives that target the same muscle groups and maintain the same training intent.

RULES:
1. Review EVERY exercise in every block (morning, warmup, workout, abs, cooldown, evening)
2. Replace contraindicated exercises with safe alternatives — keep the same rep/set scheme format
3. Maintain the training structure, progressive intent, and session flow
4. Update the coaching cue if the primary movement changed
5. If NO changes are needed, return the plan completely unchanged
6. Return ONLY the valid 7-day JSON array in the exact same format — no explanation, no markdown`

// ── Phase 3: Sports Specialist ────────────────────────────────────────────────
const SPORTS_SPECIALIST_SYSTEM_PROMPT = `You are an elite sports performance specialist with deep expertise in the physical and technical demands of specific sports. You are enhancing a training plan's sport-specific elements.

YOUR SCOPE — modify ONLY these two fields:
1. daily_session.warmup for each training day — make it genuinely sport-specific with real sport movements, drills, terminology, and culture from the athlete's sport. Use actual sport-specific exercises (e.g. for skateboarding: "Ride regular stance 3 min easy", "50-50 grinds 5 reps"; for basketball: "Full-court dribble 3 min", "Defensive slides 3×10 yards"). The tip should use sport culture language.
2. coaching field for each training day — end with one sport-specific technical point relevant to today's primary movement pattern

DO NOT CHANGE: any workout exercises, sets/reps, rest times, movements array, morning/abs/cooldown/evening blocks, rest days, or any field outside daily_session.warmup and coaching.

Return ONLY the complete valid 7-day JSON array — no explanation, no markdown, no code blocks.`

// ── Phase 3: Mobility Agent ───────────────────────────────────────────────────
const MOBILITY_SYSTEM_PROMPT = `You are a world-class movement specialist and corrective exercise expert specializing in mobility, flexibility, and joint health for athletes.

YOUR SCOPE — modify ONLY these three blocks:
1. daily_session.morning for ALL 7 days — tailor exercises to the athlete's sport and address sport-specific tightness patterns (e.g. hip flexors for cyclists, ankle dorsiflexion for skateboarders, thoracic rotation for golfers). Each exercise should be specific and named, not generic.
2. daily_session.cooldown for training days — target the exact primary muscles worked that day. If today was lower body, cooldown is lower body. If upper pull, cooldown is lats/biceps/rear delt.
3. daily_session.evening for ALL 7 days — optimize for parasympathetic activation and next-day preparation. Include legs-up-wall, supine twists, diaphragmatic breathing, progressive muscle relaxation as appropriate.

DO NOT CHANGE: warmup, workout, abs blocks, coaching cues, movements array, duration/label fields unless updating exercise content, or rest day structure.

Return ONLY the complete valid 7-day JSON array — no explanation, no markdown, no code blocks.`

// ── Phase 3: Mindset Agent ────────────────────────────────────────────────────
const MINDSET_SYSTEM_PROMPT = `You are a sports psychologist and elite performance mindset coach specializing in Japanese warrior philosophy applied to modern athletic performance.

The five principles you apply:
- Mushin (無心): action without overthinking — automatic execution, no fear-freeze, full commitment
- Kaizen (改善): small daily improvements compounding — 1% better every session beats intensity spikes
- Shokunin (職人): master the process not the result — fall in love with the rep, the drill, the detail
- Zanshin (残心): relaxed sustained awareness — fully present before, during, and after every action
- Fudoshin (不動心): immovable mind under pressure — emotionally steady after mistakes or failure

YOUR SCOPE — modify ONLY these two fields on TRAINING DAYS (not rest days):
1. coaching — append one sentence applying the most relevant principle directly to today's session and movement pattern. Be specific, not generic. E.g. "Mushin — when the bar gets heavy, stop thinking and trust the pattern your body has built."
2. daily_session.warmup.tip — replace with a sport-specific mental preparation cue using one of the five principles applied to the athlete's sport culture

DO NOT CHANGE: any exercises, sets/reps, block structure, rest day content, or any field outside coaching and daily_session.warmup.tip.

Return ONLY the complete valid 7-day JSON array — no explanation, no markdown, no code blocks.`

// ── Phase 3: Recovery Agent ───────────────────────────────────────────────────
const RECOVERY_SYSTEM_PROMPT = `You are a recovery science and periodization specialist with deep expertise in optimizing athlete recovery, deload protocols, and rest day programming.

YOUR SCOPE — modify ONLY rest day content:
1. daily_session on rest days (morning, abs, evening blocks) — replace generic content with evidence-based recovery modalities: contrast breathing sequences, progressive muscle relaxation, parasympathetic activation, gentle sport-specific mobility flows. Each exercise should be specific and named.
2. coaching on rest days — replace with specific actionable recovery guidance tied to the previous day's training load and tomorrow's demands
3. focus on rest days — update to reflect the specific recovery priority (e.g. "CNS recovery + hip mobility" rather than "Active recovery")

DO NOT CHANGE: any training day content, warmup/workout/abs/cooldown blocks on training days, coaching on training days, or the training day structure.

Return ONLY the complete valid 7-day JSON array — no explanation, no markdown, no code blocks.`

function buildRehabPrompt(
  profile: Record<string, unknown>,
  draftPlan: unknown[],
  rehabKnowledge: string
): string {
  const lines: string[] = []
  lines.push('ATHLETE INJURY RESTRICTIONS:')
  if (profile.restriction_areas) lines.push(`Areas: ${JSON.stringify(profile.restriction_areas)}`)
  if (profile.restriction_notes) lines.push(`Notes: ${profile.restriction_notes}`)
  if (rehabKnowledge) {
    lines.push('\n' + rehabKnowledge)
  }
  lines.push('\nDRAFTED TRAINING PLAN TO REVIEW:')
  lines.push(JSON.stringify(draftPlan))
  lines.push('\nReturn the safe, modified 7-day plan as a raw JSON array:')
  return lines.join('\n')
}

function buildPrompt(profile: Record<string, unknown>, weekNumber: number, phaseLabel: string, intensity: string, instructions = '', knowledgeContext = ''): string {
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
  if (profile.sport_schedule) lines.push(`Sport schedule: ${JSON.stringify(profile.sport_schedule)}`)
  if (profile.workout_location) lines.push(`Workout location: ${profile.workout_location}`)
  if (profile.home_equipment && Array.isArray(profile.home_equipment) && (profile.home_equipment as string[]).length > 0) {
    lines.push(`Available home equipment: ${(profile.home_equipment as string[]).join(', ')}`)
    lines.push(`IMPORTANT: Only program exercises that use the equipment listed above. Do not program exercises requiring equipment not on this list.`)
  }

  // Training background — injected from profiles.training_level / workout_background / activities
  if (profile.training_level) {
    lines.push('')
    lines.push('TRAINING BACKGROUND:')
    lines.push(`Experience level: ${profile.training_level}`)
    const levelGuidance: Record<string, string> = {
      beginner:     'Under 1 year of consistent training. Prioritise movement quality over load. Use basic compound patterns, higher reps, lower intensity. Avoid technical Olympic lifts.',
      intermediate: '1–3 years of training. Familiar with compound lifts. Can handle moderate intensity and some technique complexity. Progress load systematically.',
      expert:       '3–5 years. Programs their own training. Can handle periodization complexity, heavier loading, advanced technique cues. Treat as knowledgeable athlete.',
      elite:        'Competitive athlete. Use periodization language (mesocycles, RIR, RPE). High intensity appropriate. Sport-specific performance is primary driver.',
      pro:          'Professional or semi-professional athlete. Maximum specificity. Programming should reflect professional-level volume and intensity. No beginner scaffolding.',
    }
    if (levelGuidance[profile.training_level as string]) {
      lines.push(`Level guidance: ${levelGuidance[profile.training_level as string]}`)
    }
  }
  if (profile.workout_background) {
    lines.push(`Training history: ${profile.workout_background}`)
  }
  if (profile.activities && Array.isArray(profile.activities) && (profile.activities as { name: string; level: string }[]).length > 0) {
    const activityList = (profile.activities as { name: string; level: string }[])
      .map(a => `${a.name} (${a.level})`)
      .join(', ')
    lines.push(`Sport/activity background: ${activityList}`)
    lines.push(`Incorporate movement patterns and physical demands relevant to these activities where appropriate.`)
  }

  if (profile.improvement_notes) {
    lines.push('')
    lines.push(`IMPROVEMENT FOCUS — what the athlete wants to get better at: ${profile.improvement_notes}`)
    lines.push(`Target these specific limitations in sport-specific warmup drills, conditioning, and mobility blocks. Do not ignore this — it is the athlete's primary performance gap.`)
  }

  if (instructions?.trim()) {
    lines.push('')
    lines.push(`SPECIFIC INSTRUCTIONS FROM USER: ${instructions.trim()}`)
    lines.push('Apply these instructions precisely — they override general defaults.')
  }

  // Inject restriction notes (previously missing from prompt)
  if (profile.has_restrictions) {
    if (profile.restriction_areas) lines.push(`Injury/restriction areas: ${JSON.stringify(profile.restriction_areas)}`)
    if (profile.restriction_notes) lines.push(`Restriction notes from athlete: ${profile.restriction_notes}`)
  }

  if (knowledgeContext) {
    lines.push('\n' + knowledgeContext)
  }

  lines.push(`\nGenerate the 7-day plan for Week ${weekNumber} now.`)
  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { profile, weekNumber = 1, phaseLabel = 'Foundation Phase', intensity = 'RPE 6-7. Build base fitness and movement quality.', instructions = '' } = body

    if (!profile) return Response.json({ error: 'Profile is required' }, { status: 400 })

    // ── APIE Phase 1: Retrieve relevant domain knowledge ──────────────────────
    let knowledgeContext = ''
    let rehabKnowledge = ''
    try {
      const queryParts = [
        profile.sport ?? '',
        profile.goal ?? '',
        phaseLabel,
        profile.training_level ?? '',
      ].filter(Boolean).join(' ')

      const [generalItems, rehabItems] = await Promise.all([
        retrieveKnowledge(queryParts, 10, 0.45),
        profile.has_restrictions && profile.restriction_areas
          ? retrieveKnowledge(
              `${JSON.stringify(profile.restriction_areas)} rehabilitation injury protocol`,
              6,
              0.4
            )
          : Promise.resolve([]),
      ])
      knowledgeContext = formatKnowledgeContext(generalItems)
      rehabKnowledge = formatKnowledgeContext(rehabItems as Awaited<ReturnType<typeof retrieveKnowledge>>)
    } catch (ragErr) {
      console.warn('RAG retrieval failed, proceeding without knowledge context:', ragErr)
    }

    const prompt = buildPrompt(profile, weekNumber, phaseLabel, intensity, instructions, knowledgeContext)

    // ── APIE Phase 2 — Agent 1: S&C Agent drafts the plan ────────────────────
    const scMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const scRaw = scMessage.content[0].type === 'text' ? scMessage.content[0].text.trim() : ''
    const scCleaned = scRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let plan = JSON.parse(scCleaned)

    if (!Array.isArray(plan) || plan.length !== 7) {
      throw new Error(`Expected 7-day array, got ${Array.isArray(plan) ? plan.length : typeof plan}`)
    }
    const missingDs = plan.findIndex((d: Record<string, unknown>) => !d.daily_session)
    if (missingDs !== -1) {
      throw new Error(`Day at index ${missingDs} is missing daily_session`)
    }

    let totalInput = scMessage.usage.input_tokens
    let totalOutput = scMessage.usage.output_tokens

    // ── APIE Phase 2 — Agent 2: PT/Rehab Agent reviews for safety ────────────
    // Only runs when athlete has documented injury restrictions
    if (profile.has_restrictions && Array.isArray(profile.restriction_areas) && profile.restriction_areas.length > 0) {
      try {
        const rehabPrompt = buildRehabPrompt(profile, plan, rehabKnowledge)
        const ptMessage = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system: PT_REHAB_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: rehabPrompt }],
        })
        const ptRaw = ptMessage.content[0].type === 'text' ? ptMessage.content[0].text.trim() : ''
        const ptCleaned = ptRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
        const reviewedPlan = JSON.parse(ptCleaned)
        if (Array.isArray(reviewedPlan) && reviewedPlan.length === 7) {
          plan = reviewedPlan
          totalInput += ptMessage.usage.input_tokens
          totalOutput += ptMessage.usage.output_tokens
        }
      } catch (ptErr) {
        console.warn('PT/Rehab agent failed, using S&C draft:', ptErr)
      }
    }

    // ── APIE Phase 3 — Full Agent Council ─────────────────────────────────────
    const athleteContext = [
      `Sport: ${profile.sport ?? 'General fitness'}`,
      `Goal: ${profile.goal ?? 'General fitness'}`,
      `Week: ${weekNumber} — ${phaseLabel}`,
      profile.age ? `Age: ${profile.age}` : '',
      profile.training_level ? `Experience: ${profile.training_level}` : '',
      profile.improvement_notes ? `Improvement focus: ${profile.improvement_notes}` : '',
    ].filter(Boolean).join('\n')

    // Agent 3: Sports Specialist — enhances warmup blocks + coaching cues
    const sportsResult = await runAgent(
      SPORTS_SPECIALIST_SYSTEM_PROMPT,
      `ATHLETE:\n${athleteContext}\n\nSPORT KNOWLEDGE:\n${knowledgeContext}\n\nCURRENT PLAN:\n${JSON.stringify(plan)}\n\nEnhance warmup blocks and coaching cues for sport-specificity. Return the complete modified 7-day JSON array:`,
      'SportsSpecialist'
    )
    if (sportsResult.plan) { plan = sportsResult.plan; totalInput += sportsResult.inputTokens; totalOutput += sportsResult.outputTokens }

    // Agent 4: Mobility Agent — enhances morning/cooldown/evening blocks
    const mobilityResult = await runAgent(
      MOBILITY_SYSTEM_PROMPT,
      `ATHLETE:\n${athleteContext}\n${profile.restriction_areas ? `Restrictions: ${JSON.stringify(profile.restriction_areas)}` : ''}\n\nCURRENT PLAN:\n${JSON.stringify(plan)}\n\nEnhance morning, cooldown, and evening mobility blocks. Return the complete modified 7-day JSON array:`,
      'Mobility'
    )
    if (mobilityResult.plan) { plan = mobilityResult.plan; totalInput += mobilityResult.inputTokens; totalOutput += mobilityResult.outputTokens }

    // Agent 5: Mindset Agent — adds mindset layer to coaching cues + warmup tips
    const mindsetResult = await runAgent(
      MINDSET_SYSTEM_PROMPT,
      `ATHLETE:\n${athleteContext}\n\nCURRENT PLAN:\n${JSON.stringify(plan)}\n\nAdd the mindset layer to training day coaching cues and warmup tips. Return the complete modified 7-day JSON array:`,
      'Mindset'
    )
    if (mindsetResult.plan) { plan = mindsetResult.plan; totalInput += mindsetResult.inputTokens; totalOutput += mindsetResult.outputTokens }

    // Agent 6: Recovery Agent — optimizes rest day programming
    const recoveryResult = await runAgent(
      RECOVERY_SYSTEM_PROMPT,
      `ATHLETE:\n${athleteContext}\n\nCURRENT PLAN:\n${JSON.stringify(plan)}\n\nOptimize the rest day programming with evidence-based recovery content. Return the complete modified 7-day JSON array:`,
      'Recovery'
    )
    if (recoveryResult.plan) { plan = recoveryResult.plan; totalInput += recoveryResult.inputTokens; totalOutput += recoveryResult.outputTokens }

    logTokens({
      operation: 'generate_plan',
      route: '/api/generate-plan',
      input_tokens: totalInput,
      output_tokens: totalOutput,
      user_id: profile?.id ?? null,
    })
    return Response.json({ plan, usage: { input_tokens: totalInput, output_tokens: totalOutput } })
  } catch (err) {
    console.error('Plan generation error:', err)
    return Response.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
