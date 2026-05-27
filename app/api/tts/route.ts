import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// Male: onyx (deep, soft-spoken American male)
// Female: nova (warm, natural American female)
const ALLOWED_VOICES = ['onyx', 'nova', 'alloy', 'echo', 'fable', 'shimmer']

export async function POST(request: Request) {
  try {
    const { text, voice = 'onyx' } = await request.json()
    if (!text?.trim()) return Response.json({ error: 'text required' }, { status: 400 })
    if (!ALLOWED_VOICES.includes(voice)) return Response.json({ error: 'invalid voice' }, { status: 400 })

    const response = await getOpenAI().audio.speech.create({
      model: 'tts-1',
      voice: voice as 'onyx' | 'nova' | 'alloy' | 'echo' | 'fable' | 'shimmer',
      input: text.slice(0, 4096),
      speed: 0.92,
    })

    const buffer = Buffer.from(await response.arrayBuffer())
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
