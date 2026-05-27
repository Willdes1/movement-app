import { getOpenAI } from './openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabaseAdmin
}

export type KnowledgeItem = {
  id: string
  category: string
  title: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map(t => t.slice(0, 8000)),
  })
  return response.data.map(d => d.embedding)
}

export async function retrieveKnowledge(
  query: string,
  matchCount = 12,
  matchThreshold = 0.45
): Promise<KnowledgeItem[]> {
  try {
    const embedding = await embedText(query)
    const { data, error } = await getSupabaseAdmin().rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })
    if (error) {
      console.error('match_knowledge RPC error:', error)
      return []
    }
    return (data as KnowledgeItem[]) ?? []
  } catch (err) {
    console.error('Knowledge retrieval error:', err)
    return []
  }
}

export function formatKnowledgeContext(items: KnowledgeItem[]): string {
  if (!items.length) return ''
  const grouped: Record<string, KnowledgeItem[]> = {}
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }
  const lines: string[] = ['RETRIEVED DOMAIN KNOWLEDGE (use this to inform your programming):']
  const labelMap: Record<string, string> = {
    training_principle: 'Training Principles',
    sport_protocol: 'Sport Protocols',
    rehab_protocol: 'Rehabilitation Protocols',
    exercise: 'Exercise Coaching Cues',
    nutrition_principle: 'Nutrition Principles',
  }
  for (const [cat, catItems] of Object.entries(grouped)) {
    lines.push(`\n[${labelMap[cat] ?? cat}]`)
    for (const item of catItems) {
      lines.push(`• ${item.title}: ${item.content}`)
    }
  }
  return lines.join('\n')
}
