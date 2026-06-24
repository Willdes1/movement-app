export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cloneVoice, deleteVoice, isElevenLabsConfigured } from '@/lib/elevenlabs'

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Verify the caller's JWT and confirm they're a coach (or admin). Returns the user id.
async function authCoach(req: NextRequest): Promise<{ id: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return null
  const { data: profile } = await service()
    .from('profiles').select('role, is_admin').eq('id', user.id).single()
  const ok = profile?.role === 'coach' || profile?.role === 'admin' || profile?.is_admin === true
  return ok ? { id: user.id } : null
}

// GET — current voice status for the calling coach.
export async function GET(req: NextRequest) {
  const coach = await authCoach(req)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await service()
    .from('coach_voices')
    .select('voice_id, status, consent_at, error')
    .eq('coach_id', coach.id)
    .single()

  return NextResponse.json({
    configured: isElevenLabsConfigured(),
    status: data?.status ?? 'none',
    hasVoice: !!data?.voice_id,
    consentAt: data?.consent_at ?? null,
    error: data?.error ?? null,
  })
}

// POST — clone the coach's voice from a recorded/uploaded sample (multipart).
export async function POST(req: NextRequest) {
  const coach = await authCoach(req)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { error: 'Voice cloning is being set up — check back soon.', configured: false },
      { status: 503 }
    )
  }

  const form = await req.formData()
  const audio = form.get('audio') as File | null
  const consent = form.get('consent') === 'true'
  const coachName = (form.get('name') as string | null)?.trim() || 'Coach'
  const sampleSecs = parseFloat((form.get('seconds') as string | null) ?? '') || null

  if (!consent) return NextResponse.json({ error: 'Consent is required to clone your voice.' }, { status: 400 })
  if (!audio) return NextResponse.json({ error: 'No audio sample provided.' }, { status: 400 })
  if (audio.size < 10_000) {
    return NextResponse.json({ error: 'That recording is too short — aim for 30–90 seconds of clear speech.' }, { status: 400 })
  }

  const supabase = service()

  // If they already had a voice, delete the old ElevenLabs voice first (re-record).
  const { data: existing } = await supabase
    .from('coach_voices').select('voice_id').eq('coach_id', coach.id).single()
  if (existing?.voice_id) await deleteVoice(existing.voice_id)

  // Mark pending so the UI can reflect "processing" even if the caller navigates away.
  await supabase.from('coach_voices').upsert({
    coach_id: coach.id,
    status: 'pending',
    consent_at: new Date().toISOString(),
    sample_secs: sampleSecs,
    voice_id: null,
    error: null,
    updated_at: new Date().toISOString(),
  })

  try {
    const voiceId = await cloneVoice(`${coachName} — Atlas Prime`, audio, {
      description: 'Coaching voice for Atlas Prime exercise narration (cloned with consent).',
    })
    await supabase.from('coach_voices').update({
      voice_id: voiceId,
      status: 'ready',
      error: null,
      updated_at: new Date().toISOString(),
    }).eq('coach_id', coach.id)

    return NextResponse.json({ status: 'ready', hasVoice: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Voice cloning failed'
    await supabase.from('coach_voices').update({
      status: 'failed', error: msg.slice(0, 500), updated_at: new Date().toISOString(),
    }).eq('coach_id', coach.id)
    console.error('coach voice clone error:', msg)
    return NextResponse.json({ error: 'Voice cloning failed. Try re-recording in a quiet room.' }, { status: 500 })
  }
}

// DELETE — remove the coach's cloned voice + cached audio.
export async function DELETE(req: NextRequest) {
  const coach = await authCoach(req)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = service()
  const { data: existing } = await supabase
    .from('coach_voices').select('voice_id').eq('coach_id', coach.id).single()
  if (existing?.voice_id) await deleteVoice(existing.voice_id)

  // Drop cached clips + their stored files so a future re-clone regenerates fresh.
  const { data: cached } = await supabase
    .from('coach_exercise_audio').select('name_normalized').eq('coach_id', coach.id)
  if (cached?.length) {
    const paths = cached.map(c => `${coach.id}/${c.name_normalized}.mp3`)
    await supabase.storage.from('coach-voice-audio').remove(paths).catch(() => {})
  }
  await supabase.from('coach_exercise_audio').delete().eq('coach_id', coach.id)
  await supabase.from('coach_voices').delete().eq('coach_id', coach.id)

  return NextResponse.json({ status: 'none', hasVoice: false })
}
