import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { situation } = await req.json() as { situation: string }

  // Step 1: Ask Claude to recommend exercise names from our library
  const anthropic = new Anthropic()
  const step1 = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are a physical therapist recommending recovery exercises.

User's situation: "${situation}"

Recommend 5 recovery exercises or mobility drills appropriate for this situation. These should be safe, gentle, and helpful — not a diagnosis.

Return ONLY a JSON array of exercise names (common names, lowercase, no sets/reps info):
["exercise one", "exercise two", "exercise three", "exercise four", "exercise five"]

Focus on mobility, stretching, activation, and recovery movements. No diagnosis, no medical claims.`
    }],
  })

  await logTokens({
    operation: 'ask-recovery-step1',
    route: '/api/user/ask-recovery',
    input_tokens: step1.usage.input_tokens,
    output_tokens: step1.usage.output_tokens,
    user_id: user.id,
  })

  const raw1 = step1.content[0].type === 'text' ? step1.content[0].text.trim() : '[]'
  let exerciseNames: string[] = []
  try {
    const json = raw1.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    exerciseNames = JSON.parse(json)
  } catch {
    exerciseNames = []
  }

  if (exerciseNames.length === 0) {
    return NextResponse.json({ exercises: [], fallback: true })
  }

  // Step 2: Search exercise_library for matching exercises
  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const normalized = exerciseNames.map(n => n.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_'))

  // Try exact match first
  const { data: exact } = await supabase
    .from('exercise_library')
    .select('name_normalized, name_display, how, breathing, core, tip, tts_url_male, tts_url_female')
    .in('name_normalized', normalized)
    .limit(10)

  // For any names not found, do a fuzzy ilike search
  const foundKeys = new Set((exact ?? []).map(e => e.name_normalized))
  const missing = normalized.filter(n => !foundKeys.has(n))

  let fuzzy: typeof exact = []
  if (missing.length > 0) {
    const results = await Promise.all(
      missing.slice(0, 5).map(name =>
        supabase
          .from('exercise_library')
          .select('name_normalized, name_display, how, breathing, core, tip, tts_url_male, tts_url_female')
          .ilike('name_normalized', `%${name.replace(/_/g, '%')}%`)
          .limit(1)
          .then(({ data }) => data ?? [])
      )
    )
    fuzzy = results.flat()
  }

  const all = [...(exact ?? []), ...fuzzy]
  const seen = new Set<string>()
  const exercises = all.filter(e => { if (seen.has(e.name_normalized)) return false; seen.add(e.name_normalized); return true }).slice(0, 5)

  // If we found fewer than 3 from the library, supplement with AI-generated cues
  if (exercises.length < 3) {
    const step2 = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Generate brief recovery exercise coaching for these exercises related to: "${situation}"

Exercises: ${exerciseNames.join(', ')}

Return JSON array (up to 5 items):
[{"name_display":"Exercise Name","how":"How to do it in 1-2 sentences","tip":"Key coaching tip"}]`
      }],
    })

    await logTokens({
      operation: 'ask-recovery-step2',
      route: '/api/user/ask-recovery',
      input_tokens: step2.usage.input_tokens,
      output_tokens: step2.usage.output_tokens,
      user_id: user.id,
    })

    const raw2 = step2.content[0].type === 'text' ? step2.content[0].text.trim() : '[]'
    try {
      const json = raw2.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
      const generated = JSON.parse(json) as { name_display: string; how: string; tip: string }[]
      return NextResponse.json({ exercises: generated, fromLibrary: false })
    } catch {
      return NextResponse.json({ exercises: [], fallback: true })
    }
  }

  return NextResponse.json({ exercises, fromLibrary: true })
}
