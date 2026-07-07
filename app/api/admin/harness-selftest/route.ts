export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { verifiedInsert, VerifyError } from '@/lib/verified-write'

// Admin-only harness self-test. Deliberately attempts a BROKEN verified write
// (a column that doesn't exist) to prove the read-after-write layer fails LOUD —
// [VERIFY_FAIL] in the server logs, plus a harness_events row once Stage 2 lands —
// instead of silently swallowing like the old logTokens bug did.
//
// Writes nothing: Postgres rejects the bad insert. Green result = safety net works.
export async function POST(req: Request) {
  const auth = await verifyAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth

  try {
    await verifiedInsert(
      supabase,
      'token_usage',
      { operation: 'harness_selftest', __bogus_column__: true },
      { context: 'selftest' },
    )
    // Reaching here means the broken write did NOT throw — the net is down.
    return NextResponse.json({
      ok: false,
      threwAsExpected: false,
      note: 'The deliberately broken write did NOT throw. Verification is not firing.',
    })
  } catch (err) {
    return NextResponse.json({
      ok: true,
      threwAsExpected: true,
      wasVerifyError: err instanceof VerifyError,
      message: err instanceof Error ? err.message : String(err),
      note: 'Broken write threw loudly. Look for [VERIFY_FAIL] in the server logs; after Stage 2 a harness_events row is written too.',
    })
  }
}
