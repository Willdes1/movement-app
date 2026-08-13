export const maxDuration = 60
export const runtime = 'nodejs'

import OpenAI from 'openai'
import { logTokens } from '@/lib/log-tokens'
import { ttsCostUsd } from '@/lib/ai-costs'

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

const ALLOWED_VOICES = ['onyx', 'nova', 'alloy', 'echo', 'fable', 'shimmer']

// Read-through cache. When the caller names an exercise we already voiced, the
// file is sitting in storage and there is no reason to pay OpenAI for it again.
// Until this existed the only thing preventing a double charge was the client
// remembering to pass preGeneratedUrl, so every caller that did not know the URL
// re-billed the whole narration on every tap.
async function cachedAudio(name_normalized: string, voice: string): Promise<ArrayBuffer | null> {
  try {
    const supabase = getSupabase() as any
    const col = voice === 'nova' ? 'tts_url_female' : 'tts_url_male'
    const { data } = await supabase
      .from('exercise_library')
      .select(col)
      .eq('name_normalized', name_normalized)
      .maybeSingle()

    const url = data?.[col]
    if (!url) return null

    const res = await fetch(url)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    // Never let the cache path break playback: fall through and generate.
    return null
  }
}

export async function POST(request: Request) {
  try {
    const { text, voice = 'onyx', name_normalized } = await request.json()
    if (!text?.trim()) return Response.json({ error: 'text required' }, { status: 400 })
    if (!ALLOWED_VOICES.includes(voice)) return Response.json({ error: 'invalid voice' }, { status: 400 })

    // Safe because callers only pass name_normalized alongside the canonical
    // full narration (lib/speech-text.ts). Partial reads must omit it.
    if (name_normalized) {
      const hit = await cachedAudio(name_normalized, voice)
      if (hit) {
        return new Response(hit, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'private, max-age=3600',
            'X-TTS-Cache': 'hit',
          },
        })
      }
    }

    // Generate audio
    const sent = text.slice(0, 4096)
    // maxRetries 0: the SDK retries twice by default, and OpenAI bills each
    // synthesis, so one logical request could be charged three times with only
    // one line landing in `token_usage`. One attempt, one charge, one log.
    const response = await getOpenAI().audio.speech.create({
      model: 'tts-1',
      voice: voice as 'onyx' | 'nova' | 'alloy' | 'echo' | 'fable' | 'shimmer',
      input: sent,
      speed: 0.92,
    }, { maxRetries: 0 })

    const buffer = Buffer.from(await response.arrayBuffer())

    // Track OpenAI TTS spend (billed per character of input).
    await logTokens({
      operation: 'tts_realtime',
      route: '/api/tts',
      input_tokens: sent.length,
      cost_usd: ttsCostUsd(sent.length),
      provider: 'openai',
      model: 'tts-1',
    })

    // Auto-save to Supabase Storage if exercise key provided
    if (name_normalized) {
      try {
        const supabase = getSupabase() as any
        const col = voice === 'nova' ? 'tts_url_female' : 'tts_url_male'
        const path = `${voice}/${name_normalized}.mp3`

        const { error: uploadErr } = await supabase.storage
          .from('exercise-tts')
          .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })

        if (uploadErr) {
          console.warn(`[TTS] upload failed for ${name_normalized} (${voice}):`, uploadErr)
        } else {
          const { data: urlData } = supabase.storage.from('exercise-tts').getPublicUrl(path)
          // CHECKED. supabase-js returns errors instead of throwing, so this
          // used to fail silently: the audio was paid for and uploaded, the URL
          // never landed, and every later tap on that exercise re-billed the
          // whole narration because the read-through cache still saw null.
          const { error: updErr } = await supabase
            .from('exercise_library')
            .update({ [col]: urlData.publicUrl })
            .eq('name_normalized', name_normalized)
          if (updErr) {
            console.error(`[TTS] PAID AND ORPHANED: ${path} uploaded but exercise_library.${col} not set:`, updErr)
          }
        }
      } catch (saveErr) {
        console.warn('TTS auto-save failed (audio still returned):', saveErr)
      }
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
        'X-TTS-Cache': 'miss',
      },
    })
  } catch (err) {
    console.error('TTS error:', err)
    return Response.json({ error: 'TTS failed' }, { status: 500 })
  }
}
