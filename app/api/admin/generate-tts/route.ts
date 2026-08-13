export const maxDuration = 60
export const runtime = 'nodejs'

import OpenAI from 'openai'
import { logTokens } from '@/lib/log-tokens'
import { ttsCostUsd } from '@/lib/ai-costs'

// BILLING CORRECTNESS (2026-08-12)
// --------------------------------
// OpenAI bills tts-1 per character of INPUT, the moment it synthesises. Anything
// that happens after that on our side (a timeout we impose, a failed upload, a
// failed DB write) does not un-bill the call. So every path here is written so
// that a character we paid for is either (a) turned into a saved file, or
// (b) recorded as waste. What is NOT allowed is paying twice for the same
// audio, or paying and never telling the Spend Tracker.
//
// Four ways this route used to over-bill or under-report:
//   1. An 8s race timeout abandoned the promise WITHOUT cancelling the HTTP
//      request. OpenAI kept generating and kept billing; we threw the audio
//      away and, because the row stayed null, paid for it again next round.
//      Now an AbortController actually tears the request down, and the budget
//      is derived from the time left rather than a flat 8s (real narration is
//      ~1,150 chars, which legitimately takes longer than 8s under load).
//   2. The SDK retries twice by default, so one logical call could be billed
//      three times invisibly. maxRetries is now 0: one attempt, one charge,
//      one log line. Retrying is the next round's job, where it is counted.
//   3. A failed call reported `chars: 0`, so spend OpenAI had really charged
//      never reached `token_usage`. The dashboard could therefore exceed the
//      Spend Tracker with no way to see why. Billed characters are now always
//      reported, and the wasted portion is logged as its own operation so the
//      two rows still sum to the real bill.
//   4. The post-upload `.update()` error was never checked. supabase-js returns
//      errors, it does not throw, so a failed URL write left the row null and
//      the next round re-generated and re-paid for audio already sitting in
//      storage. It is checked and retried now.
//
// Also fixed: the candidate query filtered on `tts_url_male IS NULL` only, so a
// row that got a male file but failed on female dropped out of the queue
// permanently and could never be completed. It now looks for either voice
// missing, and generates ONLY the voice that is actually missing, so completing
// one voice never re-bills the one that already exists.

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

let _supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    const { createClient } = require('@supabase/supabase-js')
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase!
}

// Timing. Vercel's wall is 60s; everything below is measured against a single
// round deadline so no individual call can push us past it.
const WALL_MS = 55_000          // hard stop for the whole round
const MAX_CALL_MS = 20_000      // outlier guard on one OpenAI call
const UPLOAD_MS = 8_000         // storage upload budget
const TAIL_MS = 2_500           // reserved for the DB update + logging
const MIN_CALL_MS = 4_000       // below this it is not worth starting a call
const BILLED_INFLIGHT_MS = 1_000 // see wasBilled()

// A call that failed within a second almost certainly failed BEFORE synthesis
// (auth, 429, connection refused) and cost nothing. Past that it was in flight
// long enough that OpenAI likely generated, and therefore billed. We assume
// billed in the ambiguous case: over-reporting our own spend is recoverable,
// silently under-reporting it is the thing that made this invisible before.
function wasBilled(inflightMs: number): boolean {
  return inflightMs >= BILLED_INFLIGHT_MS
}

type VoiceOutcome = {
  saved: boolean
  billedChars: number
  wastedChars: number
  reason?: string
}

const SKIPPED: VoiceOutcome = { saved: false, billedChars: 0, wastedChars: 0, reason: 'no_time' }

function buildSpeechText(ex: { name_display: string; how?: string | null; breathing?: string | null; core?: string | null; tip?: string | null }): string {
  const parts = [ex.name_display]
  if (ex.how) parts.push(ex.how)
  if (ex.breathing) parts.push('Breathing: ' + ex.breathing)
  if (ex.core) parts.push('Core engagement: ' + ex.core)
  if (ex.tip) parts.push('Coaching tip: ' + ex.tip)
  return parts.join('. ')
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

async function generateAndUpload(
  supabase: any,
  ex: { name_normalized: string; name_display: string; how?: string | null; breathing?: string | null; core?: string | null; tip?: string | null },
  voice: 'onyx' | 'nova',
  deadlineAt: number
): Promise<VoiceOutcome> {
  const sent = buildSpeechText(ex).slice(0, 4096)

  // Derive this call's budget from the time actually left in the round. A flat
  // timeout either kills legitimate work (the old 8s) or overruns the wall.
  const budget = Math.min(MAX_CALL_MS, deadlineAt - Date.now() - UPLOAD_MS - TAIL_MS)
  if (budget < MIN_CALL_MS) return SKIPPED

  const ac = new AbortController()
  const killer = setTimeout(() => ac.abort(), budget)
  const startedAt = Date.now()

  let buffer: Buffer
  try {
    const response = await getOpenAI().audio.speech.create(
      { model: 'tts-1', voice, input: sent, speed: 0.92 },
      // signal: actually cancels at the socket, unlike the old promise race.
      // maxRetries 0: one attempt = one charge = one log line.
      { signal: ac.signal, maxRetries: 0 }
    )
    buffer = Buffer.from(await response.arrayBuffer())
  } catch (err) {
    const inflight = Date.now() - startedAt
    const billed = wasBilled(inflight) ? sent.length : 0
    console.warn(`TTS generation failed for ${ex.name_normalized} (${voice}) after ${inflight}ms, billed=${billed}:`, err)
    return { saved: false, billedChars: billed, wastedChars: billed, reason: 'generate_failed' }
  } finally {
    clearTimeout(killer)
  }

  // Past this point the characters are definitely paid for. Every remaining
  // failure is waste, not a reason to pretend the spend did not happen.
  const path = `${voice}/${ex.name_normalized}.mp3`
  const col = voice === 'nova' ? 'tts_url_female' : 'tts_url_male'

  // Upload retry uses the buffer we ALREADY paid for. Re-generating instead
  // (what the old code forced by returning early) meant paying twice for one file.
  let uploaded = false
  for (let attempt = 0; attempt < 2 && !uploaded; attempt++) {
    if (Date.now() > deadlineAt - TAIL_MS) break
    const { error: uploadErr } = await withTimeout<{ error: unknown }>(
      supabase.storage.from('exercise-tts').upload(path, buffer, { contentType: 'audio/mpeg', upsert: true }),
      UPLOAD_MS,
      'upload'
    ).catch((e) => ({ error: e }))
    if (!uploadErr) { uploaded = true; break }
    console.warn(`Upload attempt ${attempt + 1} failed for ${ex.name_normalized} (${voice}):`, uploadErr)
  }
  if (!uploaded) {
    return { saved: false, billedChars: sent.length, wastedChars: sent.length, reason: 'upload_failed' }
  }

  const { data: urlData } = supabase.storage.from('exercise-tts').getPublicUrl(path)

  // CHECKED, and retried. An unchecked failure here left the row null with the
  // file already in storage, so the next round paid for identical audio again.
  let recorded = false
  for (let attempt = 0; attempt < 2 && !recorded; attempt++) {
    const { error: updErr } = await supabase
      .from('exercise_library')
      .update({ [col]: urlData.publicUrl })
      .eq('name_normalized', ex.name_normalized)
    if (!updErr) { recorded = true; break }
    console.error(`[TTS] URL write failed for ${ex.name_normalized} (${voice}), attempt ${attempt + 1}:`, updErr)
  }
  if (!recorded) {
    // The file IS in storage under a deterministic path, so this is recoverable
    // without paying again, but it needs a human. Loud on purpose.
    console.error(`[TTS] PAID AND ORPHANED: ${path} uploaded but exercise_library.${col} not set.`)
    return { saved: false, billedChars: sent.length, wastedChars: sent.length, reason: 'db_write_failed' }
  }

  return { saved: true, billedChars: sent.length, wastedChars: 0 }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase() as any
    const BATCH = 24            // max candidates fetched per round
    const CONCURRENCY = 6       // exercises processed in parallel
    const roundStart = Date.now()
    const deadlineAt = roundStart + WALL_MS

    const body = await request.json().catch(() => ({}))
    const targets: string[] | undefined = body?.targets
    // Default is missing-voices-only so a re-click can never re-bill audio we
    // already hold. `force` is the explicit opt-in for a deliberate redo.
    const force: boolean = body?.force === true

    let dbQuery = supabase
      .from('exercise_library')
      .select('name_normalized, name_display, how, breathing, core, tip, tts_url_male, tts_url_female')

    if (targets && targets.length > 0) {
      dbQuery = dbQuery.in('name_normalized', targets)
    } else {
      // Either voice missing. The old filter looked at male only, so a row with
      // male but no female was invisible to this query forever.
      dbQuery = dbQuery
        .or('tts_url_male.is.null,tts_url_female.is.null')
        .not('how', 'is', null)
        .order('name_normalized')
        .limit(BATCH)
    }

    const { data: exercises, error } = await dbQuery

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!exercises || exercises.length === 0) {
      return Response.json({ message: 'All exercises already have TTS audio', generated: 0, remaining: 0, fetched: 0 })
    }

    type ExRow = {
      name_normalized: string; name_display: string
      how: string | null; breathing: string | null; core: string | null; tip: string | null
      tts_url_male: string | null; tts_url_female: string | null
    }
    const typedExercises = exercises as ExRow[]

    let maleOk = 0
    let femaleOk = 0
    let failed = 0
    let advanced = 0        // exercises that gained at least one voice this round
    let billedChars = 0     // everything OpenAI charged us for
    let wastedChars = 0     // charged, but produced no saved file

    for (let i = 0; i < typedExercises.length; i += CONCURRENCY) {
      // Stop launching once there is not enough left for a call plus its upload.
      if (Date.now() > deadlineAt - (MIN_CALL_MS + UPLOAD_MS + TAIL_MS)) break
      const chunk = typedExercises.slice(i, i + CONCURRENCY)

      const results = await Promise.all(chunk.map(async (ex) => {
        // Only the voice that is actually missing. Generating both because one
        // was missing is how the female-gap rows would have been re-billed.
        const needMale = force || !ex.tts_url_male
        const needFemale = force || !ex.tts_url_female
        const [m, f] = await Promise.all([
          needMale ? generateAndUpload(supabase, ex, 'onyx', deadlineAt) : Promise.resolve(null),
          needFemale ? generateAndUpload(supabase, ex, 'nova', deadlineAt) : Promise.resolve(null),
        ])
        return { m, f }
      }))

      for (const { m, f } of results) {
        for (const r of [m, f]) {
          if (!r) continue
          billedChars += r.billedChars
          wastedChars += r.wastedChars
          if (!r.saved && r.reason !== 'no_time') failed++
        }
        if (m?.saved) maleOk++
        if (f?.saved) femaleOk++
        if (m?.saved || f?.saved) advanced++
      }
    }

    // Two rows so the Spend Tracker tells the truth AND shows the waste. They
    // sum to what OpenAI actually charged, which is the number that has to match
    // the OpenAI dashboard.
    const goodChars = billedChars - wastedChars
    if (goodChars > 0) {
      await logTokens({
        operation: 'tts_generate',
        route: '/api/admin/generate-tts',
        input_tokens: goodChars,
        cost_usd: ttsCostUsd(goodChars),
        provider: 'openai',
        model: 'tts-1',
      })
    }
    if (wastedChars > 0) {
      await logTokens({
        operation: 'tts_generate_wasted',
        route: '/api/admin/generate-tts',
        input_tokens: wastedChars,
        cost_usd: ttsCostUsd(wastedChars),
        provider: 'openai',
        model: 'tts-1',
      })
    }

    const { count } = await supabase
      .from('exercise_library')
      .select('id', { count: 'exact', head: true })
      .or('tts_url_male.is.null,tts_url_female.is.null')

    const wasteNote = wastedChars > 0 ? ` ${(wastedChars / 1000).toFixed(1)}k characters billed but not saved ($${ttsCostUsd(wastedChars).toFixed(4)}).` : ''

    return Response.json({
      message: `Generated ${maleOk} male + ${femaleOk} female audio files. ${failed} failed. ${count ?? '?'} exercises remaining.${wasteNote}`,
      generated: advanced,
      remaining: count ?? 0,
      fetched: typedExercises.length,
      billed_chars: billedChars,
      wasted_chars: wastedChars,
      cost_usd: Number(ttsCostUsd(billedChars).toFixed(4)),
    })
  } catch (err) {
    console.error('TTS batch generation error:', err)
    return Response.json({ error: 'Generation failed' }, { status: 500 })
  }
}
