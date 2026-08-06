import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ALL_STARTER_EXERCISES, normalizeExerciseName } from '@/lib/coach-starter-library'
import { scoreName } from '@/lib/fuzzy-search'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ─────────────────────────────────────────────────────────────────────────────
//  Put the standard movements into a coach's library so they never open an
//  empty screen.
//
//  Costs nothing. Every one of these already exists in exercise_library with
//  written cues and narration audio we have already paid for, so this is a copy,
//  not a generation. Nothing here calls Claude or OpenAI.
//
//  Video is deliberately left blank. Will's decision: coaches pick their own
//  demos, and handing them ours would leave them clearing out choices they never
//  made.
//
//  Everything inserted is an editable example. A coach can rewrite the cues,
//  rename it, or delete it outright.
// ─────────────────────────────────────────────────────────────────────────────

type LibRow = {
  name_normalized: string
  name_display: string
  how: string | null
  breathing: string | null
  core: string | null
  tip: string | null
}

const PAGE = 1000

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(SUPA_URL, SERVICE_KEY)

  // Always the caller's own library. Never a coach id from the request body.
  const { data: existing } = await supabase
    .from('coach_exercise_library')
    .select('name_normalized, name')
    .eq('coach_id', user.id)

  const have = new Set((existing ?? []).map(r =>
    (r.name_normalized as string | null) ?? normalizeExerciseName(r.name as string)))

  // Pull the library once and resolve names the same way the admin audit does:
  // exact key first, then fuzzy. Without the fuzzy pass a plural or a reordered
  // word reads as missing and the coach gets a bare row instead of the real
  // exercise with its cues.
  const all: LibRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('name_normalized, name_display, how, breathing, core, tip')
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) break
    all.push(...(data as LibRow[]))
    if (data.length < PAGE) break
  }
  const byKey = new Map(all.map(r => [r.name_normalized, r]))

  function resolve(name: string): LibRow | null {
    const exact = byKey.get(normalizeExerciseName(name))
    if (exact) return exact
    let best: { row: LibRow; score: number } | null = null
    for (const row of all) {
      const { score } = scoreName(name, row.name_display)
      if (score > 0 && (!best || score > best.score)) best = { row, score }
    }
    return best && best.score >= 0.45 ? best.row : null
  }

  const rows: Record<string, unknown>[] = []
  const skipped: string[] = []
  const unresolved: string[] = []

  for (const name of ALL_STARTER_EXERCISES) {
    const row = resolve(name)
    if (!row) { unresolved.push(name); continue }
    if (have.has(row.name_normalized)) { skipped.push(row.name_display); continue }
    have.add(row.name_normalized)
    rows.push({
      coach_id: user.id,
      // The library's own name, so coach and athlete call it the same thing.
      name: row.name_display,
      name_normalized: row.name_normalized,
      how: row.how,
      breathing: row.breathing,
      core: row.core,
      tip: row.tip,
      custom_fields: [],
    })
  }

  if (rows.length) {
    const { error } = await supabase.from('coach_exercise_library').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    added: rows.length,
    already_had: skipped.length,
    unresolved,
  })
}
