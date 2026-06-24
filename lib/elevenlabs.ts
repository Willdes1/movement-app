// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs client wrapper — Instant Voice Cloning + TTS.
// Server-only (uses ELEVENLABS_API_KEY). Keep all ElevenLabs calls behind this
// module so swapping models / endpoints is a one-file change.
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://api.elevenlabs.io/v1'

// Turbo = ~half the character cost of multilingual_v2 with near-equal quality —
// the right default for cached one-shot exercise cues. Bump to eleven_multilingual_v2
// if a coach voice ever sounds off.
const TTS_MODEL = 'eleven_turbo_v2_5'

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY
}

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY
  if (!k) throw new Error('ELEVENLABS_API_KEY not configured')
  return k
}

/**
 * Create an Instant Voice Clone from one or more audio samples.
 * Returns the new ElevenLabs voice_id.
 */
export async function cloneVoice(
  name: string,
  sample: File | Blob,
  opts?: { description?: string }
): Promise<string> {
  const form = new FormData()
  form.append('name', name.slice(0, 100))
  if (opts?.description) form.append('description', opts.description.slice(0, 500))
  // ElevenLabs accepts the field name "files" (repeatable). One sample is enough for IVC.
  form.append('files', sample, 'sample.webm')

  const res = await fetch(`${API}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': key() },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`ElevenLabs clone failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  const data = (await res.json()) as { voice_id?: string }
  if (!data.voice_id) throw new Error('ElevenLabs clone returned no voice_id')
  return data.voice_id
}

/**
 * Synthesize speech with a cloned voice. Returns mp3 bytes.
 */
export async function synthesize(voiceId: string, text: string): Promise<Buffer> {
  const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key(),
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      model_id: TTS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.1 },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Delete a cloned voice (best-effort; used when a coach re-records or removes theirs).
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  await fetch(`${API}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': key() },
  }).catch(() => {})
}
