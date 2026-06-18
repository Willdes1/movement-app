import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdmin } from '@/lib/admin-auth'
import { retrieveKnowledge, formatKnowledgeContext } from '@/lib/knowledge-retrieval'
import { logTokens } from '@/lib/log-tokens'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DOMAIN_LABELS: Record<string, string> = {
  strength_training: 'Strength & Resistance Training',
  exercise_physiology: 'Exercise Physiology',
  biomechanics: 'Biomechanics & Kinesiology',
  rehab: 'Physical Therapy & Rehabilitation',
  athletic_performance: 'Athletic Performance & Conditioning',
  nutrition: 'Nutrition Fundamentals',
  program_design: 'Program Design & Periodization',
  general: 'General Fitness Science',
}

const FORMAT_GUIDANCE: Record<string, string> = {
  concept: 'Focus on deep conceptual teaching: clear explanations of each concept with the underlying "why". Populate concepts[] richly; include a few key_points. quiz[] and flashcards[] may be short or empty.',
  summary: 'Focus on a tight, high-yield summary with key_points the learner must remember. Keep concepts[] brief.',
  quiz: 'Focus on a rigorous multiple-choice quiz (6–10 questions) at certification-exam depth, each with 4 options, the correct answer index, and an explanation. Populate quiz[] heavily.',
  flashcards: 'Focus on a strong flashcard deck (10–16 cards) of term/definition or question/answer pairs for active recall. Populate flashcards[] heavily.',
  mixed: 'Produce a complete study unit: a summary, key_points, several taught concepts, a short multiple-choice quiz (4–6 questions), and a handful of flashcards.',
}

// COPYRIGHT GUARDRAIL — baked into every generation.
const COPYRIGHT_RULE = `CRITICAL — ORIGINAL CONTENT ONLY: Generate original educational material that teaches the underlying exercise science in your own words and structure. Do NOT reproduce, quote, transcribe, or closely paraphrase any specific copyrighted certification course materials — including ISSA, Dr. Fred Hatfield / "Dr. Squat" coursework, NASM, ACE, NSCA textbooks, or any published curriculum. Never claim to be quoting an official course. Teach the established, public scientific principles (which are not copyrightable) using your own explanations and examples.`

function buildBodyMd(c: GeneratedContent): string {
  const parts: string[] = []
  if (c.summary) parts.push(`## Summary\n${c.summary}`)
  if (c.key_points?.length) parts.push(`## Key Points\n${c.key_points.map(k => `- ${k}`).join('\n')}`)
  if (c.concepts?.length) parts.push(`## Concepts\n${c.concepts.map(co => `**${co.term}** — ${co.explanation}`).join('\n\n')}`)
  if (c.quiz?.length) parts.push(`## Quiz\n${c.quiz.map((q, i) => `${i + 1}. ${q.question}\n${(q.options ?? []).map((o, j) => `   ${String.fromCharCode(65 + j)}) ${o}`).join('\n')}\n   Answer: ${String.fromCharCode(65 + (q.answer_index ?? 0))}${q.explanation ? ` — ${q.explanation}` : ''}`).join('\n\n')}`)
  if (c.flashcards?.length) parts.push(`## Flashcards\n${c.flashcards.map(f => `- **${f.front}** → ${f.back}`).join('\n')}`)
  return parts.join('\n\n')
}

type Concept = { term: string; explanation: string }
type QuizItem = { question: string; options: string[]; answer_index: number; explanation?: string }
type Flashcard = { front: string; back: string }
type GeneratedContent = {
  title?: string
  topic?: string
  tags?: string[]
  summary?: string
  key_points?: string[]
  concepts?: Concept[]
  quiz?: QuizItem[]
  flashcards?: Flashcard[]
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'study')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, userId } = auth

  const body = await req.json().catch(() => ({}))
  const kbId = body.kbId as string | undefined
  const topic = (body.topic ?? '').trim()
  const format = (body.format ?? 'mixed') as keyof typeof FORMAT_GUIDANCE
  const instructions = (body.instructions ?? '').trim()
  if (!kbId) return NextResponse.json({ error: 'kbId is required' }, { status: 400 })
  if (!topic) return NextResponse.json({ error: 'A topic is required' }, { status: 400 })

  // Load the KB for its scoped context.
  const { data: kb } = await supabase.from('study_kbs').select('*').eq('id', kbId).single()
  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })

  const domainLabel = DOMAIN_LABELS[kb.domain] ?? DOMAIN_LABELS.general

  // Ground generation in our own Domain Knowledge Store (APIE / pgvector RAG).
  let knowledgeContext = ''
  try {
    const items = await retrieveKnowledge(`${kb.title} ${domainLabel} ${topic}`, 10, 0.4)
    knowledgeContext = formatKnowledgeContext(items)
  } catch { /* non-fatal — generation still proceeds without retrieved context */ }

  const system = `You are the Study Hub tutor for Atlas Prime — an expert strength & conditioning educator producing certification-prep study material at ISSA Certified Fitness Trainer depth.

SUBJECT SCOPE (stay strictly within this — this Knowledge Base is dedicated to it):
- Knowledge Base: "${kb.title}"
- Primary domain: ${domainLabel}
- Certification goal: ${kb.cert_goal}
${kb.description ? `- About this KB: ${kb.description}` : ''}
${kb.scope_prompt ? `- Scoped instructions for this KB: ${kb.scope_prompt}` : ''}

${COPYRIGHT_RULE}

OUTPUT FORMAT for this request (${format}): ${FORMAT_GUIDANCE[format] ?? FORMAT_GUIDANCE.mixed}

Write at certification-course depth: precise, evidence-based, and practical. Define terms, explain mechanisms, and connect theory to coaching application. Stay within the subject scope above.

${knowledgeContext ? `${knowledgeContext}\n\n(Use the retrieved domain knowledge above to stay accurate and consistent with the platform, but expand it into full original teaching material.)\n` : ''}
Return ONLY valid JSON (no markdown fences) matching this shape:
{
  "title": "Concise title for this study unit",
  "topic": "The sub-topic within the KB",
  "tags": ["3-6 lowercase tags"],
  "summary": "1-2 paragraph high-level overview",
  "key_points": ["the most important takeaways"],
  "concepts": [{ "term": "...", "explanation": "thorough explanation with the why" }],
  "quiz": [{ "question": "...", "options": ["A","B","C","D"], "answer_index": 0, "explanation": "why this is correct" }],
  "flashcards": [{ "front": "term or question", "back": "definition or answer" }]
}
Arrays that don't apply to the requested format may be empty, but always include every key.`

  const userMsg = `Generate ${format} study material on: ${topic}${instructions ? `\n\nAdditional instructions: ${instructions}` : ''}`

  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  let parsed: GeneratedContent
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'The engine returned malformed content. Try again.' }, { status: 502 })
  }

  await logTokens({
    operation: 'study_generate',
    route: '/api/admin/study/generate',
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    user_id: userId,
  })

  const content: GeneratedContent = {
    summary: parsed.summary ?? '',
    key_points: parsed.key_points ?? [],
    concepts: parsed.concepts ?? [],
    quiz: parsed.quiz ?? [],
    flashcards: parsed.flashcards ?? [],
  }

  const { data: entry, error } = await supabase
    .from('study_entries')
    .insert({
      kb_id: kbId,
      title: (parsed.title ?? topic).slice(0, 200),
      topic: parsed.topic ?? topic,
      format,
      content,
      body_md: buildBodyMd(content),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      source_query: instructions ? `${topic} — ${instructions}` : topic,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Touch the KB so it sorts to the top of the list.
  await supabase.from('study_kbs').update({ updated_at: new Date().toISOString() }).eq('id', kbId)

  return NextResponse.json({ entry })
}
