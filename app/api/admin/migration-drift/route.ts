import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import manifest from '@/lib/migrations-manifest.json'

export const runtime = 'nodejs'
export const maxDuration = 60

// Live migration-drift status for the Telemetry tab. Compares the build-time
// manifest (the .sql files in the repo) against the applied_migrations ledger.
// On Vercel the raw repo files aren't readable at runtime, so we diff the
// bundled manifest — not the filesystem.
export async function GET(req: Request) {
  const auth = await verifyAdmin(req, 'telemetry')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const files: string[] = (manifest as { files?: string[] }).files ?? []

  const { data, error } = await auth.supabase.from('applied_migrations').select('filename')
  if (error) {
    if (/does not exist|schema cache|Could not find the table/i.test(error.message)) {
      return NextResponse.json({ ledgerReady: false, total: files.length })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const applied = new Set((data ?? []).map(r => r.filename as string))
  const pending = files.filter(f => !applied.has(f))
  const orphan = [...applied].filter(f => !files.includes(f)).sort()

  return NextResponse.json({
    ledgerReady: true,
    total: files.length,
    appliedCount: applied.size,
    pending,
    orphan,
  })
}
