import Anthropic from '@anthropic-ai/sdk'
import { verifyAdmin } from '@/lib/admin-auth'
import { logTokens } from '@/lib/log-tokens'
import { retrieveKnowledge, formatKnowledgeContext } from '@/lib/knowledge-retrieval'
import { CONTENT_CLUSTERS } from '@/lib/content-clusters'

export const runtime = 'nodejs'
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are the content writer for the Atlas Prime blog. Atlas Prime is an AI performance training platform: athletes get a personalized AI training program built around their sport, history, and body, with video demos, spoken coaching cues, and set tracking. Coaches get a full portal to build programs (with AI or by hand), manage clients, message them, track compliance, and deliver cues in their own voice.

Your job: write a genuinely useful, expert, human-sounding article that ranks in Google and earns trust. Not thin AI filler. Real substance an experienced coach would respect.

RULES:
- Sound like a sharp, experienced human coach. Warm, direct, specific. Not robotic, not hypey.
- NEVER use em dashes. Use periods, commas, or parentheses instead. This is a hard brand rule.
- Be honest. Give real value even to a reader who never signs up. Mention Atlas Prime naturally only where it genuinely fits, usually once or twice near the end. Do not oversell.
- Ground any factual claims in the retrieved domain knowledge when it is provided. Never invent studies, numbers, or fake statistics.
- Structure: a short compelling intro (no "In today's world" fluff), then 3 to 6 H2 sections with practical depth, then a brief closing. 900 to 1400 words.
- Use ## for section headings, ** for bold, and - for bullet lists. Keep paragraphs tight.
- Weave the target search terms in naturally where they fit. No keyword stuffing.

Return ONLY valid JSON, no code fence, no text before or after, this exact shape:
{
  "title": "Compelling and specific, under 65 characters, includes the main search term",
  "meta_description": "Under 155 characters. A clear, honest summary that makes someone click.",
  "excerpt": "One or two sentence teaser for the blog index card.",
  "tags": ["3 to 6 short lowercase tags"],
  "cover_emoji": "one single emoji that fits the topic",
  "body": "The full article in markdown. Do NOT use double-quote characters inside this field; use single quotes for any quoted text. Do NOT include the title as an H1 (it is rendered separately)."
}`

function parseDraft(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through to field extraction */ }

  const grab = (k: string): string => {
    const m = new RegExp(`"${k}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"[a-z_]+"\\s*:|}\\s*$)`).exec(cleaned)
    return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : ''
  }
  return {
    title: grab('title'),
    meta_description: grab('meta_description'),
    excerpt: grab('excerpt'),
    body: grab('body'),
    tags: [],
    cover_emoji: grab('cover_emoji') || '📝',
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req, 'marketing')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const topic = String(body.topic ?? '').trim()   // optional — blank = engine picks
    const angle = String(body.angle ?? '').trim()

    const cluster = CONTENT_CLUSTERS.find(c => c.id === body.cluster) ?? CONTENT_CLUSTERS[0]

    // Pull already-published titles in this cluster so the engine never repeats a topic.
    let existingTitles: string[] = []
    try {
      const { data } = await auth.supabase
        .from('content_posts')
        .select('title')
        .eq('category', cluster.id)
        .order('created_at', { ascending: false })
        .limit(40)
      existingTitles = (data ?? []).map((r: { title: string }) => r.title).filter(Boolean)
    } catch { /* best-effort; not fatal */ }

    // Ground the article in the domain knowledge store (best-effort).
    const retrievalQuery = topic ? `${topic}. ${cluster.terms}` : `${cluster.label}. ${cluster.terms}`
    const knowledge = await retrieveKnowledge(retrievalQuery, 10)
    const knowledgeCtx = formatKnowledgeContext(knowledge)

    const topicLine = topic
      ? `TOPIC: ${topic}`
      : `TOPIC: You choose it. Pick ONE specific, high-intent article a real person in this audience would search for. Prefer concrete, practical, evergreen angles over broad overviews. Make it genuinely useful.`

    const avoidLine = existingTitles.length
      ? `\n\nALREADY PUBLISHED (pick a clearly different topic, do not repeat or lightly reword these):\n${existingTitles.map(t => `- ${t}`).join('\n')}`
      : ''

    const userMsg = `Write a blog article.

${topicLine}
AUDIENCE: ${cluster.audience}
TARGET SEARCH TERMS (weave in naturally, no stuffing): ${cluster.terms}
EDITORIAL ANGLE: ${angle || cluster.angle}${avoidLine}

${knowledgeCtx ? knowledgeCtx + '\n\n' : ''}Return ONLY the JSON object described in your instructions.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const draft = parseDraft(raw)

    logTokens({
      operation: 'content_generate',
      route: '/api/admin/content/generate',
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      user_id: auth.userId,
    })

    return Response.json({
      draft: { ...draft, category: cluster.id },
      grounded: knowledge.length,
      usage: message.usage,
    })
  } catch (err) {
    console.error('content generate error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
