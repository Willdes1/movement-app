export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Same generator contract as /api/generate-exercise-details, kept local so we can
// pair results back to OUR normalized names instead of trusting the model's.
const SYSTEM_PROMPT = `You are a world-class certified strength and conditioning coach and physical therapist. Generate precise, exercise-specific technique details for each exercise provided.

Return ONLY a valid JSON array — no markdown, no explanation, no code blocks.

Each element must match this exact shape:
{
  "how": "<2-3 sentences: starting position/setup, movement execution, the key form checkpoint most people overlook on THIS specific exercise>",
  "breathing": "<1 sentence: exactly when to inhale and exhale for THIS movement — tied to the specific push/pull/hinge/rotation phase, never generic>",
  "core": "<1 sentence: the specific bracing or core-position cue that changes the outcome for THIS exercise — not generic 'brace your core'>",
  "tip": "<1 sentence: the single most common mistake on THIS specific exercise and exactly how to fix it — be concrete>"
}

Generate one entry per exercise, in the EXACT same order as the input list. Return nothing but the raw JSON array.`

const PER_RUN_CAP = 32      // exercises generated per click (stay under the 60s wall)
const CHUNK = 8             // exercises per Claude call

function normalizeExerciseName(raw: string): string {
  return raw
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim().toLowerCase().replace(/\s+/g, '_')
}
function toDisplayName(raw: string): string {
  return raw
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .trim().replace(/\b\w/g, c => c.toUpperCase())
}

type Detail = { how: string; breathing: string; core: string; tip: string }

async function generateChunk(displayNames: string[]): Promise<{ details: Detail[]; inTok: number; outTok: number }> {
  const prompt = `Generate exercise details for each of the following:\n\n${displayNames.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const match = raw.match(/\[[\s\S]*\]/)
  const arr = match ? JSON.parse(match[0]) : []
  const details: Detail[] = (Array.isArray(arr) ? arr : []).map((d: Record<string, unknown>) => ({
    how: String(d.how ?? ''), breathing: String(d.breathing ?? ''), core: String(d.core ?? ''), tip: String(d.tip ?? ''),
  }))
  return { details, inTok: message.usage.input_tokens, outTok: message.usage.output_tokens }
}

type Day = { movements?: string[]; type?: string }

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { programId } = await req.json() as { programId: string }

  const { data: prog } = await supabase.from('coach_programs').select('name').eq('id', programId).single()
  const programName = prog?.name ?? null

  const { data: weekRows } = await supabase
    .from('coach_program_weeks').select('days').eq('program_id', programId)
  if (!weekRows?.length) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  // Unique exercises across the program (skip rest days)
  const seen = new Map<string, string>() // name_normalized -> name_display
  for (const w of weekRows) {
    for (const day of ((w as unknown as { days: Day[] }).days ?? [])) {
      if (day.type === 'rest') continue
      for (const m of (day.movements ?? [])) {
        const name = m.trim()
        if (!name || name === 'Rest' || name === 'Full rest') continue
        const key = normalizeExerciseName(name)
        if (key.length > 2 && !seen.has(key)) seen.set(key, toDisplayName(name))
      }
    }
  }
  const all = [...seen.entries()].map(([name_normalized, name_display]) => ({ name_normalized, name_display }))
  if (!all.length) return NextResponse.json({ generated: 0, remaining: 0, total: 0 })

  // Which are missing instructions? (absent from library, or present with empty `how`)
  const { data: libRows } = await supabase
    .from('exercise_library')
    .select('id, name_normalized, how')
    .in('name_normalized', all.map(e => e.name_normalized))
  const libByName = new Map((libRows ?? []).map(r => [r.name_normalized as string, r]))
  const missing = all.filter(e => {
    const row = libByName.get(e.name_normalized)
    return !row || !row.how || String(row.how).trim() === ''
  })

  const batch = missing.slice(0, PER_RUN_CAP)
  if (!batch.length) return NextResponse.json({ generated: 0, remaining: 0, total: all.length })

  // Generate in parallel chunks
  const chunks: typeof batch[] = []
  for (let i = 0; i < batch.length; i += CHUNK) chunks.push(batch.slice(i, i + CHUNK))

  let inTok = 0, outTok = 0, generated = 0
  const results = await Promise.all(chunks.map(async chunk => {
    try {
      const { details, inTok: it, outTok: ot } = await generateChunk(chunk.map(c => c.name_display))
      return { chunk, details, it, ot }
    } catch (err) {
      console.error('generate-program-details chunk failed:', err)
      return { chunk, details: [] as Detail[], it: 0, ot: 0 }
    }
  }))

  for (const { chunk, details, it, ot } of results) {
    inTok += it; outTok += ot
    for (let i = 0; i < chunk.length && i < details.length; i++) {
      const ex = chunk[i]
      const d = details[i]
      if (!d.how) continue
      const row = libByName.get(ex.name_normalized)
      if (row) {
        await supabase.from('exercise_library')
          .update({ how: d.how, breathing: d.breathing, core: d.core, tip: d.tip })
          .eq('id', row.id)
      } else {
        await supabase.from('exercise_library').insert({
          name_normalized: ex.name_normalized, name_display: ex.name_display,
          how: d.how, breathing: d.breathing, core: d.core, tip: d.tip,
          source_program: programName,
        })
      }
      generated++
    }
  }

  if (inTok || outTok) {
    await logTokens({ operation: 'coach_program_exercise_details', route: 'generate-program-details', input_tokens: inTok, output_tokens: outTok, user_id: user.id })
  }

  return NextResponse.json({
    generated,
    remaining: Math.max(0, missing.length - generated),
    total: all.length,
  })
}
