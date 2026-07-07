export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

// Server-side receipt upload for the Spend Tracker. Runs with the SERVICE ROLE
// (bypasses storage RLS — the reason the old client-side upload silently failed)
// and surfaces any error to the caller instead of swallowing it. Returns a public
// URL stored on the expense row + included in the CSV export for tax records.
export async function POST(req: Request) {
  const auth = await verifyAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, userId } = auth

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const safeName = (file.name || 'receipt').replace(/[^\w.\-]+/g, '_').slice(-80)
  const path = `${userId}/${Date.now()}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (error) {
    // Most likely cause if this fires: the `receipts` bucket doesn't exist yet —
    // run supabase/migrations/20260707_receipts_bucket.sql.
    console.error('[RECEIPT_UPLOAD] failed:', error.message)
    return NextResponse.json({ error: `Receipt upload failed: ${error.message}` }, { status: 500 })
  }

  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, path })
}
