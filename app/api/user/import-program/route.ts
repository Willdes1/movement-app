import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PARSE_PROMPT = `You are a strength and conditioning expert parsing a training program document into structured JSON.

Extract the program structure and return ONLY valid JSON — no markdown, no explanation, no code blocks.

Return this exact shape:
{
  "title": "program name (infer from document or use 'Imported Program')",
  "description": "1-2 sentence summary of the program",
  "weeks_total": <integer>,
  "weeks": [
    {
      "week_number": <integer starting at 1>,
      "label": "Week 1",
      "phase": "Foundation" | "Build" | "Peak" | "Deload" | null,
      "days": [
        {
          "day": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun",
          "label": "session name",
          "type": "workout"|"rest",
          "movements": ["Exercise Name NxReps"],
          "focus": "primary muscles",
          "duration": "estimated time or '—'"
        }
      ]
    }
  ]
}

Rules:
- If only one week shown as a template, set weeks_total to 1 and include that week once
- Rest days: type="rest", movements=["Full rest"], focus="Recovery", duration="—"
- Include all days Mon–Sun (fill missing days as rest days)
- week_number starts at 1
- Return nothing except the JSON object`

const SAFETY_PROMPT = `You are an elite physical therapist reviewing a training program for a specific athlete's injury restrictions.

YOUR JOB: Identify exercises that are contraindicated for this athlete's restrictions and replace them with safe alternatives that target the same muscles.

RETURN FORMAT — a JSON object with exactly these keys:
{
  "program": <the full 7-day-per-week JSON array, same structure as input, with unsafe exercises replaced>,
  "changes": [
    {
      "week": <week_number>,
      "day": <"Mon"|"Tue" etc>,
      "original": <original exercise string>,
      "replacement": <new exercise string>,
      "reason": <1 sentence explaining why — be specific to the restriction>
    }
  ]
}

Rules:
- Review EVERY exercise in every week and every day
- Only replace exercises that directly contradict the listed restrictions
- Keep the same sets/reps format on the replacement
- If NO changes needed, return the program unchanged and changes as an empty array []
- Return nothing except the JSON object`

const MIN_TEXT_LENGTH = 80

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── Fetch user profile for safety pass ───────────────────────────────────
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('restriction_areas, restriction_notes, has_restrictions, sport, goal, training_level')
      .eq('id', user.id)
      .single()

    // ── Parse file ────────────────────────────────────────────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx') {
      return Response.json({ error: 'Only PDF and DOCX files are supported' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let rawText = ''
    let usedVision = false

    if (ext === 'docx') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      rawText = result.value ?? ''
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>
        const data = await pdfParse(buffer)
        rawText = data.text ?? ''
      } catch {
        // fall through to vision
      }
    }

    let totalInput = 0
    let totalOutput = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsedProgram: any

    // ── Vision fallback for image-based PDFs ──────────────────────────────────
    if (ext === 'pdf' && rawText.trim().length < MIN_TEXT_LENGTH) {
      usedVision = true
      const base64 = buffer.toString('base64')
      const visionMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: PARSE_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: 'Parse this training program into structured JSON.' },
          ] as any,
        }],
      })
      const raw = visionMsg.content[0].type === 'text' ? visionMsg.content[0].text.trim() : ''
      parsedProgram = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim())
      totalInput += visionMsg.usage.input_tokens
      totalOutput += visionMsg.usage.output_tokens
    } else {
      // ── Text path ─────────────────────────────────────────────────────────
      if (!rawText.trim()) {
        return Response.json({ error: 'Could not extract content from this file.' }, { status: 422 })
      }
      const truncated = rawText.length > 20000 ? rawText.slice(0, 20000) + '\n[truncated]' : rawText
      const parseMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: PARSE_PROMPT,
        messages: [{ role: 'user', content: `Parse this training program:\n\n${truncated}` }],
      })
      const raw = parseMsg.content[0].type === 'text' ? parseMsg.content[0].text.trim() : ''
      parsedProgram = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim())
      totalInput += parseMsg.usage.input_tokens
      totalOutput += parseMsg.usage.output_tokens
    }

    if (!Array.isArray(parsedProgram.weeks) || parsedProgram.weeks.length === 0) {
      throw new Error('Could not find a training program in this file.')
    }
    parsedProgram.raw_text = usedVision ? '[image-based PDF]' : rawText

    // ── PT/Rehab safety pass (only if user has restrictions) ─────────────────
    let finalProgram = parsedProgram
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let changes: any[] = []

    const hasRestrictions = profile?.has_restrictions &&
      Array.isArray(profile?.restriction_areas) &&
      profile.restriction_areas.length > 0

    if (hasRestrictions) {
      const restrictionContext = [
        `ATHLETE RESTRICTIONS:`,
        `Areas: ${JSON.stringify(profile.restriction_areas)}`,
        profile.restriction_notes ? `Notes: ${profile.restriction_notes}` : '',
        profile.sport ? `Sport: ${profile.sport}` : '',
        profile.training_level ? `Level: ${profile.training_level}` : '',
      ].filter(Boolean).join('\n')

      const safetyMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SAFETY_PROMPT,
        messages: [{
          role: 'user',
          content: `${restrictionContext}\n\nPROGRAM TO REVIEW:\n${JSON.stringify(parsedProgram.weeks)}\n\nReturn the safety-reviewed program JSON:`,
        }],
      })
      const safetyRaw = safetyMsg.content[0].type === 'text' ? safetyMsg.content[0].text.trim() : ''
      const safetyResult = JSON.parse(safetyRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim())

      if (Array.isArray(safetyResult.program)) {
        finalProgram = { ...parsedProgram, weeks: safetyResult.program }
        changes = safetyResult.changes ?? []
      }
      totalInput += safetyMsg.usage.input_tokens
      totalOutput += safetyMsg.usage.output_tokens
    }

    logTokens({
      operation: 'user_import_program',
      route: '/api/user/import-program',
      input_tokens: totalInput,
      output_tokens: totalOutput,
      user_id: user.id,
    })

    return Response.json({
      program: finalProgram,
      changes,
      hasChanges: changes.length > 0,
      usedVision,
      fileName: file.name,
    })
  } catch (err) {
    console.error('User import error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to parse program' }, { status: 500 })
  }
}
