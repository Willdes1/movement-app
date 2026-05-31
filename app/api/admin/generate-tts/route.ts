export const maxDuration = 60
export const runtime = 'nodejs'

import OpenAI from 'openai'

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

function buildSpeechText(ex: { name_display: string; how?: string; breathing?: string; core?: string; tip?: string }): string {
  const parts = [ex.name_display]
  if (ex.how) parts.push(ex.how)
  if (ex.breathing) parts.push('Breathing: ' + ex.breathing)
  if (ex.core) parts.push('Core engagement: ' + ex.core)
  if (ex.tip) parts.push('Coaching tip: ' + ex.tip)
  return parts.join('. ')
}

async function generateAndUpload(
  supabase: any,
  ex: { name_normalized: string; name_display: string; how?: string; breathing?: string; core?: string; tip?: string },
  voice: 'onyx' | 'nova'
): Promise<boolean> {
  try {
    const text = buildSpeechText(ex)
    const response = await getOpenAI().audio.speech.create({
      model: 'tts-1',
      voice,
      input: text.slice(0, 4096),
      speed: 0.92,
    })
    const buffer = Buffer.from(await response.arrayBuffer())
    const path = `${voice}/${ex.name_normalized}.mp3`

    const { error: uploadErr } = await supabase.storage
      .from('exercise-tts')
      .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })

    if (uploadErr) { console.warn(`Upload failed for ${ex.name_normalized}:`, uploadErr); return false }

    const { data: urlData } = supabase.storage.from('exercise-tts').getPublicUrl(path)
    const col = voice === 'nova' ? 'tts_url_female' : 'tts_url_male'

    await supabase
      .from('exercise_library')
      .update({ [col]: urlData.publicUrl })
      .eq('name_normalized', ex.name_normalized)

    return true
  } catch (err) {
    console.warn(`TTS generation failed for ${ex.name_normalized}:`, err)
    return false
  }
}

export async function POST() {
  try {
    const supabase = getSupabase() as any
    const BATCH = 20
    const CONCURRENCY = 4

    // Fetch exercises missing male TTS (prioritise those with coaching content)
    const { data: exercises, error } = await supabase
      .from('exercise_library')
      .select('name_normalized, name_display, how, breathing, core, tip')
      .is('tts_url_male', null)
      .not('how', 'is', null)
      .order('name_normalized')
      .limit(BATCH)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!exercises || exercises.length === 0) {
      return Response.json({ message: 'All exercises already have TTS audio', generated: 0 })
    }

    let maleOk = 0
    let femaleOk = 0
    let failed = 0

    for (let i = 0; i < exercises.length; i += CONCURRENCY) {
      const chunk = exercises.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        chunk.map(ex => Promise.all([
          generateAndUpload(supabase, ex, 'onyx'),
          generateAndUpload(supabase, ex, 'nova'),
        ]))
      )
      for (const [m, f] of results) {
        if (m) maleOk++; else failed++
        if (f) femaleOk++
      }
    }

    // Total remaining
    const { count } = await supabase
      .from('exercise_library')
      .select('id', { count: 'exact', head: true })
      .is('tts_url_male', null)

    return Response.json({
      message: `Generated ${maleOk} male + ${femaleOk} female audio files. ${failed} failed. ${count ?? '?'} exercises remaining.`,
      generated: maleOk,
      remaining: count ?? 0,
    })
  } catch (err) {
    console.error('TTS batch generation error:', err)
    return Response.json({ error: 'Generation failed' }, { status: 500 })
  }
}
