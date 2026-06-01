import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a strength and conditioning expert parsing a training program document into structured JSON.

Extract the program structure and return ONLY valid JSON — no markdown, no explanation, no code blocks.

Return this exact shape:
{
  "title": "program name (infer from document or use 'Imported Program')",
  "description": "1-2 sentence summary of the program",
  "weeks_total": <integer — total number of weeks in the program>,
  "weeks": [
    {
      "week_number": <integer starting at 1>,
      "label": "Week 1" or "Foundation Week 1" or similar,
      "phase": "Foundation" | "Build" | "Peak" | "Deload" | null,
      "days": [
        {
          "day": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
          "label": "day/session name (e.g. 'Upper Body Push', 'Lower Pull', 'Rest')",
          "type": "workout" | "rest",
          "movements": ["Exercise Name NxReps or description — one string per exercise"],
          "focus": "primary muscle groups or energy system",
          "duration": "estimated session length or '—' for rest days"
        }
      ]
    }
  ]
}

Rules:
- If the document shows only one week as a repeating template, set weeks_total to 1 and include that week once
- If the document shows multiple weeks, include each week as a separate entry
- Rest days: type="rest", movements=["Full rest"], focus="Recovery", duration="—"
- Keep movements as-is from the document — do not invent or add exercises
- If sets/reps are missing, include just the exercise name
- Include all days Mon–Sun (fill missing days as rest days)
- week_number must start at 1 and increment by 1
- Return nothing except the JSON object`

// Minimum character count to consider text extraction successful.
// Image-based PDFs return a few stray characters or nothing at all.
const MIN_TEXT_LENGTH = 80

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const coachId = formData.get('coachId') as string | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

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
      rawText = result.value
    } else {
      // Try text extraction first (fast + cheap)
      try {
        // Lazy require keeps pdf-parse out of module scope — prevents Vercel
        // from crashing the route on load due to pdfjs-dist canvas dependencies.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>
        const data = await pdfParse(buffer)
        rawText = data.text ?? ''
      } catch {
        // pdf-parse can throw on malformed PDFs — fall through to vision path
      }
    }

    // ── Vision fallback for image-based PDFs ─────────────────────────────────
    // Scanned/image PDFs yield no extractable text. Send the raw PDF bytes to
    // Claude Sonnet as a native document — it converts pages to images internally
    // and reads the content visually. DOCX files always yield text so never reach here.
    if (ext === 'pdf' && rawText.trim().length < MIN_TEXT_LENGTH) {
      usedVision = true
      const base64 = buffer.toString('base64')

      const visionMessage = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as Parameters<typeof client.messages.create>[0]['messages'][0]['content'][0],
            {
              type: 'text',
              text: 'Parse this training program into structured JSON as specified.',
            },
          ],
        }],
      })

      const visionRaw = visionMessage.content[0].type === 'text' ? visionMessage.content[0].text.trim() : ''
      const visionCleaned = visionRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const program = JSON.parse(visionCleaned)

      if (!Array.isArray(program.weeks) || program.weeks.length === 0) {
        throw new Error('Could not read a training program from this file. Make sure it contains a structured workout plan.')
      }

      program.raw_text = '[image-based PDF — read via vision]'

      logTokens({
        operation: 'coach_import_program_vision',
        route: '/api/coach/import-program',
        input_tokens: visionMessage.usage.input_tokens,
        output_tokens: visionMessage.usage.output_tokens,
        user_id: coachId,
      })

      return Response.json({
        program,
        usedVision,
        usage: { input_tokens: visionMessage.usage.input_tokens, output_tokens: visionMessage.usage.output_tokens },
      })
    }

    // ── Text path (DOCX or text-based PDF) ───────────────────────────────────
    if (!rawText.trim()) {
      return Response.json(
        { error: 'Could not extract any content from this file.' },
        { status: 422 }
      )
    }

    const truncated = rawText.length > 20000 ? rawText.slice(0, 20000) + '\n[document truncated]' : rawText

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Parse this training program into structured JSON:\n\n${truncated}` }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const program = JSON.parse(cleaned)

    if (!Array.isArray(program.weeks) || program.weeks.length === 0) {
      throw new Error('AI returned invalid program structure')
    }

    program.raw_text = rawText

    logTokens({
      operation: 'coach_import_program',
      route: '/api/coach/import-program',
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      user_id: coachId,
    })

    return Response.json({
      program,
      usedVision,
      usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
    })
  } catch (err) {
    console.error('Import error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to parse program'
    return Response.json({ error: msg }, { status: 500 })
  }
}
