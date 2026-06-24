export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { synthesize, isElevenLabsConfigured } from '@/lib/elevenlabs'

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Returns an audio URL of `text` spoken in the relevant coach's cloned voice.
// Cached once per (coach, exercise) — repeat taps are free (served from CDN).
//
// Whose voice?
//   • preview === true  → the calling coach's OWN voice (Coach Portal preview).
//   • otherwise         → the coach on the caller's ACTIVE assignment (athlete playback).
// The coach id is resolved server-side, never trusted from the body, so a client
// can't run up another coach's bill.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = await anon.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!isElevenLabsConfigured()) {
      return NextResponse.json({ error: 'not configured', configured: false }, { status: 503 })
    }

    const { text, name_normalized, preview } = await req.json()
    if (!text?.trim() || !name_normalized?.trim()) {
      return NextResponse.json({ error: 'text and name_normalized required' }, { status: 400 })
    }

    const supabase = service()

    // Resolve which coach's voice to use.
    let coachId: string | null = null
    if (preview === true) {
      coachId = user.id
    } else {
      const { data: assignment } = await supabase
        .from('coach_program_assignments')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      coachId = assignment?.coach_id ?? null
    }
    if (!coachId) return NextResponse.json({ error: 'No coach voice available' }, { status: 404 })

    // The coach must have a ready cloned voice.
    const { data: voice } = await supabase
      .from('coach_voices').select('voice_id, status').eq('coach_id', coachId).single()
    if (voice?.status !== 'ready' || !voice.voice_id) {
      return NextResponse.json({ error: 'Coach voice not ready' }, { status: 404 })
    }

    const cacheKey = (name_normalized as string).slice(0, 200)

    // Cache hit → return immediately, no ElevenLabs spend.
    const { data: cached } = await supabase
      .from('coach_exercise_audio')
      .select('audio_url')
      .eq('coach_id', coachId)
      .eq('name_normalized', cacheKey)
      .single()
    if (cached?.audio_url) return NextResponse.json({ url: cached.audio_url, cached: true })

    // Cache miss → synthesize, store, cache.
    const buffer = await synthesize(voice.voice_id, text)
    const path = `${coachId}/${cacheKey}.mp3`

    const { error: upErr } = await supabase.storage
      .from('coach-voice-audio')
      .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`)

    const { data: urlData } = supabase.storage.from('coach-voice-audio').getPublicUrl(path)
    const url = urlData.publicUrl

    await supabase.from('coach_exercise_audio').upsert(
      { coach_id: coachId, name_normalized: cacheKey, audio_url: url, char_count: (text as string).length },
      { onConflict: 'coach_id,name_normalized' }
    )

    return NextResponse.json({ url, cached: false })
  } catch (err) {
    console.error('coach voice speak error:', err)
    return NextResponse.json({ error: 'Voice synthesis failed' }, { status: 500 })
  }
}
