import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert certified strength & conditioning coach with deep knowledge of NSCA/CSCS periodization principles, sport-specific programming, and injury management.

Generate a complete multi-week training program for the athlete profile provided. Return ONLY valid JSON — no markdown, no explanation, no code blocks.

Return this exact shape:
{
  "title": "Program name (descriptive, e.g. '8-Week MMA Strength Foundation')",
  "description": "2-3 sentence overview: methodology, goal, and what the athlete will achieve",
  "weeks_total": <integer>,
  "weeks": [
    {
      "week_number": <integer starting at 1>,
      "label": "Week 1 — Foundation" or "Week 5 — Build Phase" etc.,
      "phase": "Foundation" | "Build" | "Peak" | "Deload" | null,
      "days": [
        {
          "day": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
          "label": "session name (e.g. 'Upper Body Push', 'Lower Pull', 'Sprint Conditioning', 'Rest')",
          "type": "workout" | "rest",
          "movements": ["Exercise Name SetsxReps (e.g. 'Back Squat 4x5', 'DB Row 3x10-12')"],
          "focus": "primary muscle groups or energy system targeted",
          "duration": "estimated session time (e.g. '65 min') or '—' for rest"
        }
      ]
    }
  ]
}

PERIODIZATION RULES:
- Programs 4 weeks: Foundation → Build → Peak → Deload
- Programs 6 weeks: Foundation (2) → Build (2) → Peak → Deload
- Programs 8 weeks: Foundation (2) → Build (3) → Peak (2) → Deload
- Programs 12 weeks: Foundation (3) → Build (4) → Peak (3) → Deload (2)
- Deload weeks: same movements, 40-50% reduced volume (cut sets by half, keep reps same)
- Progressive overload: increase sets, intensity, or complexity each phase

EXERCISE SELECTION RULES:
- Training days must exactly match the days_per_week count (remaining days are rest)
- movements: 5-8 exercises per training day in format "Exercise Name SetsxReps"
- Compound lifts first (squats, deadlifts, presses, rows), accessories after, isolation last
- NEVER program exercises that stress restricted/injured body areas
- ONLY use equipment the athlete has available — if bodyweight only, no barbell exercises
- Deload weeks: same exercise names, write "(deload)" in label, reduce sets (e.g. 4x5 → 2x5)
- Vary exercises across phases — don't repeat identical lineups every week
- Sport-specific: select exercises that transfer to the athlete's sport demands

DAY STRUCTURE:
- Include ALL 7 days Mon–Sun for every week
- Rest days: type="rest", movements=["Full rest"], focus="Recovery", duration="—"
- Spread training days evenly (avoid 3+ consecutive training days when possible)
- Assign heavier compound days earlier in the week when athlete is freshest

QUALITY STANDARDS:
- Rep ranges should match the phase: Foundation (3x12-15 hypertrophy base or 5x5 strength), Build (4x6-8), Peak (5x3-5 heavy), Deload (2-3x8 light)
- Session durations should be realistic for the session length preference
- Program description should explain the WHY behind the programming decisions
- Return nothing except the JSON object`

export interface CoachBrief {
  name: string
  sport: string
  goal: string
  level: 'beginner' | 'intermediate' | 'expert' | 'elite' | 'pro'
  weeks_total: number
  days_per_week: number
  session_length: string
  equipment: string[]
  restrictions: string
  notes: string
  coachId?: string
}

export async function POST(request: Request) {
  try {
    const brief: CoachBrief = await request.json()

    const equipmentStr = brief.equipment.length > 0
      ? brief.equipment.join(', ')
      : 'bodyweight only'

    const levelGuidance: Record<string, string> = {
      beginner:     'Under 1 year of training. Prioritise movement quality. Basic compound patterns, moderate reps, lighter loads. No complex Olympic lifts.',
      intermediate: '1–3 years of training. Familiar with compound lifts. Moderate intensity, some technique complexity. Progressive loading.',
      expert:       '3–5 years. Self-directed athlete. Periodization complexity, heavier loading, advanced technique. Treat as knowledgeable.',
      elite:        'Competitive athlete. Use RPE/RIR language. High intensity appropriate. Sport-specific performance is primary driver.',
      pro:          'Professional or semi-pro athlete. Maximum specificity. Professional-level volume and intensity. No beginner scaffolding.',
    }

    const prompt = [
      `Generate a ${brief.weeks_total}-week training program with the following specifications:`,
      '',
      'ATHLETE PROFILE:',
      `Sport / Activity: ${brief.sport || 'General fitness'}`,
      `Primary goal: ${brief.goal || 'Build overall fitness and strength'}`,
      `Experience level: ${brief.level} — ${levelGuidance[brief.level] ?? ''}`,
      `Training days per week: ${brief.days_per_week}`,
      `Session length preference: ${brief.session_length}`,
      `Available equipment: ${equipmentStr}`,
      brief.restrictions ? `Injury / restriction areas (AVOID loading these): ${brief.restrictions}` : '',
      brief.notes ? `Coach notes / special requirements: ${brief.notes}` : '',
      '',
      `PROGRAM REQUIREMENTS:`,
      `- Exactly ${brief.weeks_total} weeks`,
      `- Exactly ${brief.days_per_week} training days per week (remaining days are rest)`,
      `- All sessions within ${brief.session_length} duration`,
      `- Equipment limited to: ${equipmentStr}`,
      brief.name ? `- Program title should be or closely match: "${brief.name}"` : '',
      '',
      `Generate the complete ${brief.weeks_total}-week program now.`,
    ].filter(Boolean).join('\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const program = JSON.parse(cleaned)

    if (!Array.isArray(program.weeks) || program.weeks.length === 0) {
      throw new Error('AI returned invalid program structure')
    }

    logTokens({ operation: 'coach_generate_program', route: '/api/coach/generate-program', input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens, user_id: brief.coachId ?? null })
    return Response.json({
      program,
      usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
    })
  } catch (err) {
    console.error('Coach generate error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to generate program'
    return Response.json({ error: msg }, { status: 500 })
  }
}
