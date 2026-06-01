import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Block = { label: string; duration: string; exercises: string[]; tip?: string }
type Session = { morning?: Block; warmup?: Block; workout?: Block; abs?: Block; cooldown?: Block; evening?: Block }
type DayPlan = {
  day: string; label: string; type: string; movements: string[]; duration: string
  focus?: string; coaching?: string; daily_session?: Session
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anonClient = createClient(SUPA_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { programId, weekNum, dayIdx, situation } = await req.json() as {
    programId: string; weekNum: number; dayIdx: number; situation: string
  }

  const supabase = createClient(SUPA_URL, SERVICE_KEY)
  const { data: weekRow } = await supabase
    .from('weekly_plans')
    .select('id, plan')
    .eq('program_id', programId)
    .eq('week_number', weekNum)
    .single()

  if (!weekRow) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const plan = weekRow.plan as DayPlan[]
  const day = plan[dayIdx]
  if (!day || day.type === 'rest') return NextResponse.json({ error: 'Rest day' }, { status: 400 })

  // Build exercise summary for Claude — only modify training blocks (not morning/evening)
  let exerciseSummary = ''
  const hasSession = !!day.daily_session
  if (hasSession) {
    const blocks = ['warmup', 'workout', 'abs'] as const
    blocks.forEach(bk => {
      const b = day.daily_session![bk]
      if (b?.exercises?.length) exerciseSummary += `\n${bk.toUpperCase()}: ${b.exercises.join(' | ')}`
    })
  } else {
    exerciseSummary = day.movements.join(' | ')
  }

  const prompt = hasSession
    ? `Adapt this workout for: "${situation}"

${day.label}:${exerciseSummary}

Return ONLY JSON (no markdown, no explanation):
{"warmup":["ex1","ex2",...],"workout":["ex1",...],"abs":["ex1",...]}
Only include blocks listed above. Same count of exercises per block. Keep the "Name 3×12" format.`
    : `Adapt this workout for: "${situation}"

${day.label}: ${exerciseSummary}

Return ONLY JSON (no markdown, no explanation):
{"movements":["ex1","ex2","ex3",...]}
Same number of exercises. Keep the "Name 3×12" format.`

  const anthropic = new Anthropic()
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  await logTokens({
    operation: 'travel-adjust',
    route: '/api/user/travel-adjust',
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    user_id: user.id,
  })

  const raw = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
  let parsed: Record<string, string[]>
  try {
    const json = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(json)
  } catch {
    return NextResponse.json({ error: 'Parse error' }, { status: 500 })
  }

  const updatedPlan = structuredClone(plan) as DayPlan[]
  const updatedDay = updatedPlan[dayIdx]

  if (hasSession && updatedDay.daily_session) {
    ;(['warmup', 'workout', 'abs'] as const).forEach(bk => {
      if (parsed[bk] && updatedDay.daily_session![bk]) {
        updatedDay.daily_session![bk]!.exercises = parsed[bk]
      }
    })
  } else if (!hasSession && parsed.movements) {
    updatedDay.movements = parsed.movements
  }

  await supabase.from('weekly_plans').update({ plan: updatedPlan }).eq('id', weekRow.id)

  return NextResponse.json({ day: updatedDay })
}
