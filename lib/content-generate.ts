import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logTokens } from '@/lib/log-tokens'
import { retrieveKnowledge, formatKnowledgeContext } from '@/lib/knowledge-retrieval'
import { CONTENT_CLUSTERS } from '@/lib/content-clusters'

// Shared article generation. Used by the admin one-click route AND the content
// cron, so it takes a service-role Supabase client and does not touch auth.

let _client: Anthropic | null = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

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
  try { return JSON.parse(cleaned) } catch { /* fall through */ }

  const grab = (k: string): string => {
    const m = new RegExp(`"${k}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"[a-z_]+"\\s*:|}\\s*$)`).exec(cleaned)
    return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : ''
  }
  return {
    title: grab('title'), meta_description: grab('meta_description'), excerpt: grab('excerpt'),
    body: grab('body'), tags: [], cover_emoji: grab('cover_emoji') || '📝',
  }
}

export type GeneratedDraft = {
  title: string; meta_description: string; excerpt: string
  body: string; tags: string[]; cover_emoji: string; category: string
}

export async function generateArticleDraft(
  supabase: SupabaseClient,
  opts: { clusterId?: string; topic?: string; angle?: string; route?: string; userId?: string | null },
): Promise<{ draft: GeneratedDraft; grounded: number; usage: { input_tokens: number; output_tokens: number } }> {
  const cluster = CONTENT_CLUSTERS.find(c => c.id === opts.clusterId) ?? CONTENT_CLUSTERS[0]
  const topic = (opts.topic ?? '').trim()
  const angle = (opts.angle ?? '').trim()

  // Avoid repeating any already-published (or drafted) title in this cluster.
  let existingTitles: string[] = []
  try {
    const { data } = await supabase
      .from('content_posts').select('title').eq('category', cluster.id)
      .order('created_at', { ascending: false }).limit(40)
    existingTitles = (data ?? []).map((r: { title: string }) => r.title).filter(Boolean)
  } catch { /* best-effort */ }

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

  const message = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parseDraft(raw)

  logTokens({
    operation: 'content_generate',
    route: opts.route ?? '/lib/content-generate',
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    user_id: opts.userId ?? null,
  })

  const draft: GeneratedDraft = {
    title: String(parsed.title ?? ''),
    meta_description: String(parsed.meta_description ?? ''),
    excerpt: String(parsed.excerpt ?? ''),
    body: String(parsed.body ?? ''),
    tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : [],
    cover_emoji: String(parsed.cover_emoji ?? '📝'),
    category: cluster.id,
  }
  return { draft, grounded: knowledge.length, usage: message.usage }
}
