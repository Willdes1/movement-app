import Anthropic from '@anthropic-ai/sdk'
import { logTokens } from '@/lib/log-tokens'

let _supabaseAdmin: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const { createClient } = require('@supabase/supabase-js')
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabaseAdmin!
}

let _anthropic: Anthropic | null = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

const CURATOR_SYSTEM_PROMPT = `You are a sports science knowledge curator reviewing a fitness training knowledge base for accuracy and quality.

Your job: identify items that genuinely need updating. Be conservative — most items should NOT be flagged. Only flag an item if it:
1. Contains advice that conflicts with current sports science consensus
2. Is significantly incomplete in a way that could mislead training
3. Contains a factual inaccuracy

For each item you flag, provide:
- flag_reason: a specific 1-2 sentence explanation of the issue
- suggested_content: a corrected/improved version of the content

Return ONLY a raw JSON array (no markdown, no explanation). If no items need flagging, return [].
Format: [{"id": "uuid", "flag_reason": "...", "suggested_content": "..."}]`

type FlagResult = { id: string; flag_reason: string; suggested_content: string }
type KnowledgeRow = { id: string; category: string; title: string; content: string }

export async function POST() {
  try {
    const supabase = getSupabaseAdmin()

    // Fetch the 60 items least recently reviewed (never-reviewed items first)
    const { data: rawItems, error } = await supabase
      .from('knowledge_items')
      .select('id, category, title, content')
      .order('last_reviewed_at', { ascending: true, nullsFirst: true })
      .limit(60)
    const items = rawItems as KnowledgeRow[] | null

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!items || items.length === 0) return Response.json({ message: 'No items to review', flagged: 0 })

    const userPrompt = `Review the following knowledge items. Flag only those with genuine issues — be conservative.

ITEMS:
${JSON.stringify(items.map(i => ({ id: i.id, category: i.category, title: i.title, content: i.content })))}

Return JSON array of flagged items only (return [] if none need flagging):`

    const msg = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: CURATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    logTokens({
      operation: 'curate_knowledge',
      route: '/api/admin/curate-knowledge',
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      user_id: null,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let flags: FlagResult[] = []
    try { flags = JSON.parse(cleaned) } catch { flags = [] }
    if (!Array.isArray(flags)) flags = []

    const now = new Date().toISOString()

    // Mark flagged items
    if (flags.length > 0) {
      await Promise.all(
        flags.map(f =>
          supabase
            .from('knowledge_items')
            .update({
              flagged_for_review: true,
              flag_reason: f.flag_reason,
              suggested_content: f.suggested_content,
              flagged_at: now,
            })
            .eq('id', f.id)
        )
      )
    }

    // Stamp last_reviewed_at on all items in this batch (flagged or not)
    const batchIds = items.map(i => i.id)
    await supabase
      .from('knowledge_items')
      .update({ last_reviewed_at: now })
      .in('id', batchIds)

    return Response.json({
      message: `Reviewed ${items.length} items — ${flags.length} flagged for review`,
      flagged: flags.length,
      reviewed: items.length,
    })
  } catch (err) {
    console.error('Curator error:', err)
    return Response.json({ error: 'Curation failed' }, { status: 500 })
  }
}
