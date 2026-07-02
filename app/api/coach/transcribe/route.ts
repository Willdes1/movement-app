export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { logTokens } from '@/lib/log-tokens'
import { whisperCostUsd } from '@/lib/ai-costs'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const audioFile = formData.get('audio') as File | null
  if (!audioFile) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  // verbose_json returns audio `duration` (seconds) so we can bill accurately.
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'en',
    response_format: 'verbose_json',
  })

  const seconds = (transcription as { duration?: number }).duration ?? 0
  await logTokens({
    operation: 'whisper_transcribe',
    route: '/api/coach/transcribe',
    input_tokens: Math.round(seconds),
    cost_usd: whisperCostUsd(seconds),
    provider: 'openai',
    model: 'whisper-1',
  })

  return NextResponse.json({ text: transcription.text })
}
