import { embedText } from '@/lib/knowledge-retrieval'

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

// PATCH /api/admin/review-knowledge
// body: { id: string, action: 'accept' | 'dismiss', custom_content?: string }
export async function PATCH(request: Request) {
  try {
    const { id, action, custom_content } = await request.json()
    if (!id || !action) return Response.json({ error: 'id and action required' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    if (action === 'dismiss') {
      // Clear flag, mark reviewed
      const { error } = await supabase
        .from('knowledge_items')
        .update({
          flagged_for_review: false,
          flag_reason: null,
          suggested_content: null,
          flagged_at: null,
          last_reviewed_at: now,
        })
        .eq('id', id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, action: 'dismissed' })
    }

    if (action === 'accept') {
      // Fetch current item to get suggested_content if no custom provided
      const { data: item, error: fetchErr } = await supabase
        .from('knowledge_items')
        .select('suggested_content, version')
        .eq('id', id)
        .single()
      if (fetchErr || !item) return Response.json({ error: 'Item not found' }, { status: 404 })

      const newContent = custom_content?.trim() || item.suggested_content
      if (!newContent) return Response.json({ error: 'No content to accept' }, { status: 400 })

      // Re-embed the new content
      const embedding = await embedText(newContent)

      const { error } = await supabase
        .from('knowledge_items')
        .update({
          content: newContent,
          embedding,
          version: (item.version ?? 1) + 1,
          flagged_for_review: false,
          flag_reason: null,
          suggested_content: null,
          flagged_at: null,
          last_reviewed_at: now,
        })
        .eq('id', id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, action: 'accepted', version: (item.version ?? 1) + 1 })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Review knowledge error:', err)
    return Response.json({ error: 'Review failed' }, { status: 500 })
  }
}
