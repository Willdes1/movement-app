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

const ALLOWED_VOICES = ['onyx', 'nova', 'alloy', 'echo', 'fable', 'shimmer']

export async function POST(request: Request) {
  try {
    const { text, voice = 'onyx', name_normalized } = await request.json()
    if (!text?.trim()) return Response.json({ error: 'text required' }, { status: 400 })
    if (!ALLOWED_VOICES.includes(voice)) return Response.json({ error: 'invalid voice' }, { status: 400 })

    // Generate audio
    const response = await getOpenAI().audio.speech.create({
      model: 'tts-1',
      voice: voice as 'onyx' | 'nova' | 'alloy' | 'echo' | 'fable' | 'shimmer',
      input: text.slice(0, 4096),
      speed: 0.92,
    })

    const buffer = Buffer.from(await response.arrayBuffer())

    // Auto-save to Supabase Storage if exercise key provided
    if (name_normalized) {
      try {
        const supabase = getSupabase() as any
        const col = voice === 'nova' ? 'tts_url_female' : 'tts_url_male'
        const path = `${voice}/${name_normalized}.mp3`

        const { error: uploadErr } = await supabase.storage
          .from('exercise-tts')
          .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('exercise-tts').getPublicUrl(path)
          await supabase
            .from('exercise_library')
            .update({ [col]: urlData.publicUrl })
            .eq('name_normalized', name_normalized)
        }
      } catch (saveErr) {
        console.warn('TTS auto-save failed (audio still returned):', saveErr)
      }
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('TTS error:', err)
    return Response.json({ error: 'TTS failed' }, { status: 500 })
  }
}
