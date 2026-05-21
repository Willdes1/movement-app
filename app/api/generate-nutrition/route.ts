import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an elite sports nutritionist and registered dietitian with expertise in performance nutrition for athletes. You create personalized nutrition plans synced to 13-week periodized training programs.

Return ONLY valid JSON — no explanation, no markdown, no code blocks. The JSON must exactly match this schema:

{
  "summary": "2-3 sentence personalized overview mentioning the athlete's sport and goals",
  "dailyCalories": { "training": number, "rest": number },
  "macros": {
    "training": { "protein": number, "carbs": number, "fat": number },
    "rest":     { "protein": number, "carbs": number, "fat": number }
  },
  "phases": [
    { "name": "Foundation (Weeks 1–4)", "calorieNote": "e.g. Baseline intake", "focus": "1 sentence", "keyFoods": ["food1","food2","food3"] },
    { "name": "Build (Weeks 5–8)",      "calorieNote": "e.g. +200 cal on training days", "focus": "1 sentence", "keyFoods": ["food1","food2","food3"] },
    { "name": "Peak (Weeks 9–10)",      "calorieNote": "e.g. +300 cal on training days", "focus": "1 sentence", "keyFoods": ["food1","food2","food3"] },
    { "name": "Maintenance (Weeks 11–13)", "calorieNote": "e.g. Return to baseline", "focus": "1 sentence", "keyFoods": ["food1","food2","food3"] }
  ],
  "meals": {
    "training": [
      { "name": "Breakfast", "time": "7:00 AM", "description": "Specific real foods with portions", "protein": number, "carbs": number, "fat": number, "calories": number }
    ],
    "rest": [
      { "name": "Breakfast", "time": "7:00 AM", "description": "Specific real foods with portions", "protein": number, "carbs": number, "fat": number, "calories": number }
    ]
  },
  "hydration": "1-2 sentences with specific daily targets",
  "supplements": ["supplement + dose", "supplement + dose"],
  "shopping": ["ingredient1", "ingredient2"],
  "tips": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}

RULES:
- Macros must sum correctly to calories (protein×4 + carbs×4 + fat×9 ≈ dailyCalories)
- Meal macros must sum to daily totals
- Include exactly the number of meals requested (meals_per_day)
- Use real specific foods with portions (e.g. "150g chicken breast, 1 cup brown rice, 2 cups broccoli")
- Account for dietary preferences and allergies strictly
- Sync carb timing: higher carbs pre/post workout on training days
- Rest days: -15 to -20% calories, lower carbs, same protein`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { profile, nutritionSetup } = body

    const { age, weightLbs, heightIn, dietaryPref, allergies, mealsPerDay } = nutritionSetup

    const heightFt = heightIn ? Math.floor(heightIn / 12) : null
    const heightInRem = heightIn ? heightIn % 12 : null
    const heightStr = heightFt ? `${heightFt}'${heightInRem}"` : 'not provided'
    const weightStr = weightLbs ? `${weightLbs} lbs` : 'not provided'

    const prompt = `Generate a personalized nutrition plan for this athlete:

ATHLETE PROFILE:
- Sport(s): ${profile.sport ?? 'General fitness'}
- Goal(s): ${profile.goal ?? 'General health'}
- Training days/week: ${profile.daysPerWeek ?? 4}
- Session length: ${profile.sessionLength ?? '60 min'}
- Training level: ${profile.training_level ?? 'intermediate'}
- Workout location: ${profile.workoutLocation ?? 'gym'}

BODY STATS:
- Age: ${age ?? 'not provided'}
- Weight: ${weightStr}
- Height: ${heightStr}

NUTRITION PREFERENCES:
- Dietary preference: ${dietaryPref ?? 'omnivore'}
- Allergies/restrictions: ${allergies?.trim() || 'none'}
- Meals per day: ${mealsPerDay ?? 4}

TRAINING PROGRAM CONTEXT:
This is a 13-week periodized program with 4 phases:
- Foundation (Weeks 1–4): Base building, RPE 6-7, moderate volume
- Build (Weeks 5–8): Progressive overload, RPE 7-8, high volume
- Peak (Weeks 9–10): Maximum intensity, RPE 9-10, peak stimulus
- Maintenance (Weeks 11–13): Consolidation, RPE 6-7, reduced volume

Generate the complete nutrition plan JSON now.`

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    let plan
    try {
      plan = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) return Response.json({ error: 'Failed to parse nutrition plan' }, { status: 500 })
      plan = JSON.parse(match[0])
    }

    logTokens({
      operation: 'generate_nutrition',
      route: '/api/generate-nutrition',
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      user_id: profile?.id ?? null,
    })

    return Response.json({ plan, usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens } })
  } catch (err) {
    console.error('generate-nutrition error:', err)
    return Response.json({ error: 'Generation failed' }, { status: 500 })
  }
}
