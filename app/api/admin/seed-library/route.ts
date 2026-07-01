export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdmin } from '@/lib/admin-auth'
import { logTokens } from '@/lib/log-tokens'

// Admin "Library Builder" — bulk-generate real exercises (with full instructions)
// for any sport or training category, de-dupe against exercise_library, insert the
// new ones, and queue them for the Video Curator. TTS auto-picks them up because
// they arrive with `how` populated. Feeds both content pipelines so the platform
// is preloaded and the YouTube curator always has a backlog. Cheap by design —
// defaults to Haiku, generates + instructs in a single batched call, and never
// spends a token regenerating an exercise we already have.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL_IDS: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
}

// Shared with seed-program-exercises / curate-all-instructions so dedup keys match.
function normalizeExerciseName(raw: string): string {
  return raw
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}
function toDisplayName(raw: string): string {
  return raw
    .replace(/\s+\d+\s*[x×]\s*[\d][\d\-–]*.*/i, '')
    .replace(/\s+\d+\s+sets?.*/i, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

const SYSTEM_PROMPT = `You are a world-class certified strength and conditioning coach and physical therapist building an exercise library. Given a training CATEGORY, output distinct, real, commonly-programmed exercises or drills for it — the kind a knowledgeable coach or athlete in that discipline would actually use.

Return ONLY a valid JSON array — no markdown, no code fences, no explanation.

Each element must match this exact shape:
{
  "name": "<the standard, widely-recognized name of the exercise or drill — no sets, reps, weights, or numbers>",
  "how": "<2-3 sentences: setup, execution, and the key form checkpoint most people overlook on THIS specific movement>",
  "breathing": "<1 sentence: exactly when to inhale and exhale for THIS movement, tied to its push/pull/hinge/rotation phase — never generic>",
  "core": "<1 sentence: the specific bracing or core-position cue that changes the outcome for THIS movement — not generic 'brace your core'>",
  "tip": "<1 sentence: the single most common mistake on THIS movement and exactly how to fix it — be concrete>"
}

Rules:
- Every entry must be DISTINCT — no near-duplicates, no left/right variants of the same movement.
- Use real, established movements only — never invent names.
- Names must be clean and library-ready (e.g. "Bulgarian Split Squat", not "Bulgarian Split Squat 3x10").
- Return exactly the number requested, unless you genuinely run out of distinct, quality movements for the category.
- Output nothing but the raw JSON array.`

type GenItem = { name: string; how: string; breathing: string; core: string; tip: string }

async function generate(model: string, category: string, count: number, avoid: string[]) {
  const avoidBlock = avoid.length
    ? `\n\nWe ALREADY have these for this category — generate DIFFERENT ones, do not repeat any of them:\n${avoid.slice(0, 150).join(', ')}`
    : ''
  const prompt = `CATEGORY: ${category}\n\nGenerate ${count} distinct exercises or drills for this category, each with full instructions.${avoidBlock}`
  const message = await anthropic.messages.create({
    model,
    max_tokens: Math.min(count * 260 + 500, 16000),
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  let raw = ''
  for (const block of message.content) {
    if (block.type === 'text') { raw = block.text.trim(); break }
  }
  const match = raw.match(/\[[\s\S]*\]/)
  const arr = match ? JSON.parse(match[0]) : []
  const items: GenItem[] = (Array.isArray(arr) ? arr : []).map((d: Record<string, unknown>) => ({
    name: String(d.name ?? '').trim(),
    how: String(d.how ?? '').trim(),
    breathing: String(d.breathing ?? '').trim(),
    core: String(d.core ?? '').trim(),
    tip: String(d.tip ?? '').trim(),
  })).filter(d => d.name && d.how)
  return { items, inTok: message.usage.input_tokens, outTok: message.usage.output_tokens }
}

// GET — live pipeline counters for the panel dashboard.
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'seed')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth
  const [totalRes, videoRes, ttsRes] = await Promise.all([
    supabase.from('exercise_library').select('id', { count: 'exact', head: true }),
    supabase.from('exercise_library').select('id', { count: 'exact', head: true }).is('video_url', null),
    supabase.from('exercise_library').select('id', { count: 'exact', head: true }).is('tts_url_male', null).not('how', 'is', null),
  ])
  return NextResponse.json({
    total: totalRes.count ?? 0,
    needVideo: videoRes.count ?? 0,
    needTts: ttsRes.count ?? 0,
  })
}

// POST — generate one batch for a category, then insert + queue the new ones.
export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'seed')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, userId } = auth

  const body = await req.json().catch(() => ({})) as { category?: string; count?: number; model?: string }
  const category = (body.category ?? '').trim()
  const count = Math.max(1, Math.min(Math.round(Number(body.count) || 20), 40))
  const model = body.model === 'sonnet' ? MODEL_IDS.sonnet : MODEL_IDS.haiku
  if (!category) return NextResponse.json({ error: 'Pick a sport or category first.' }, { status: 400 })

  const sourceLabel = `seed:${category}`

  // Names we already generated for this category — so we don't burn tokens
  // regenerating them run after run.
  const { data: catRows } = await supabase
    .from('exercise_library')
    .select('name_display')
    .eq('source_program', sourceLabel)
    .limit(300)
  const avoid = (catRows ?? []).map(r => r.name_display as string).filter(Boolean)

  let gen: { items: GenItem[]; inTok: number; outTok: number }
  try {
    gen = await generate(model, category, count, avoid)
  } catch (err) {
    console.error('seed-library generation failed:', err)
    return NextResponse.json({ error: 'Generation failed — try again in a moment.' }, { status: 502 })
  }

  if (gen.inTok || gen.outTok) {
    await logTokens({ operation: 'seed_library', route: 'seed-library', input_tokens: gen.inTok, output_tokens: gen.outTok, user_id: userId })
  }

  // Normalize + de-dupe within the generated batch
  const seen = new Set<string>()
  const candidates = gen.items.map(d => ({
    name_normalized: normalizeExerciseName(d.name),
    name_display: toDisplayName(d.name),
    how: d.how, breathing: d.breathing, core: d.core, tip: d.tip,
  })).filter(d => {
    if (d.name_normalized.length <= 2 || seen.has(d.name_normalized)) return false
    seen.add(d.name_normalized)
    return true
  })

  if (!candidates.length) {
    return NextResponse.json({ category, requested: count, generated: gen.items.length, added: 0, skipped: 0, queued: 0 })
  }

  // De-dupe against the existing library
  const { data: existing } = await supabase
    .from('exercise_library')
    .select('name_normalized')
    .in('name_normalized', candidates.map(c => c.name_normalized))
  const existingSet = new Set((existing ?? []).map(e => e.name_normalized as string))
  const toInsert = candidates.filter(c => !existingSet.has(c.name_normalized))

  // Insert the new exercises (with instructions + a stable source tag)
  const insertedIds: string[] = []
  if (toInsert.length) {
    const { data: inserted, error } = await supabase
      .from('exercise_library')
      .insert(toInsert.map(c => ({
        name_normalized: c.name_normalized,
        name_display: c.name_display,
        how: c.how, breathing: c.breathing, core: c.core, tip: c.tip,
        source_program: sourceLabel,
      })))
      .select('id')
    if (!error && inserted) inserted.forEach(r => insertedIds.push(r.id as string))
  }

  // Queue the new rows for the Video Curator (they have no video_url yet)
  let queued = 0
  if (insertedIds.length) {
    const { error: qErr } = await supabase
      .from('exercise_video_candidates')
      .insert(insertedIds.map(exercise_id => ({ exercise_id, status: 'queued', source_label: sourceLabel })))
    if (!qErr) queued = insertedIds.length
  }

  return NextResponse.json({
    category,
    requested: count,
    generated: gen.items.length,
    added: insertedIds.length,
    skipped: candidates.length - toInsert.length,
    queued,
  })
}
