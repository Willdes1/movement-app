// Migration-drift check (Stage 3 of Harness Engineering).
//
// Compares the .sql files in supabase/migrations/ against the applied_migrations
// ledger and reports:
//   • PENDING — a file that exists but was never recorded as applied (you forgot
//     to run it, or ran it without the self-register line).
//   • ORPHAN  — a ledger row with no matching file (a migration was deleted/renamed).
//
// Usage:
//   npm run migration-drift                 check production (from .env.local)
//   npm run migration-drift -- --staging    check staging (STAGING_* env vars)
//   npm run migration-drift -- --backfill   mark ALL current files as applied
//   npm run migration-drift -- --record F   mark one file F as applied
//   npm run migration-drift -- --json       machine-readable output
//
// Exit codes: 0 = in sync (or graceful skip), 2 = ledger table missing,
//             3 = drift detected. Logs a harness_events(migration_drift) row on drift.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const MIG_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
const args = process.argv.slice(2)
const useStaging = args.includes('--staging')
const asJson = args.includes('--json')

// Minimal .env.local loader (no dotenv dependency) — real env always wins.
function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        let v = m[2].trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        process.env[m[1]] = v
      }
    }
  } catch { /* no .env.local (e.g. CI) — rely on real env */ }
}

function log(...a) { if (!asJson) console.log(...a) }

async function main() {
  loadEnv()

  const url = useStaging ? process.env.STAGING_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = useStaging ? process.env.STAGING_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    if (useStaging) {
      // Graceful: staging isn't provisioned yet — that's expected, not a failure.
      log('ℹ Staging not configured (STAGING_SUPABASE_URL / STAGING_SERVICE_ROLE_KEY missing). Skipping.')
      if (asJson) console.log(JSON.stringify({ skipped: true, reason: 'staging-not-configured' }))
      process.exit(0)
    }
    console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const target = useStaging ? 'staging' : 'production'

  const files = fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort()

  // --record F : mark one file applied.
  const recIdx = args.indexOf('--record')
  if (recIdx !== -1) {
    const f = args[recIdx + 1]
    if (!f) { console.error('✗ --record needs a filename.'); process.exit(1) }
    const { error } = await supabase.from('applied_migrations').upsert({ filename: f }, { onConflict: 'filename', ignoreDuplicates: true })
    if (error) { console.error('✗', error.message); process.exit(1) }
    log(`✓ Recorded ${f} as applied on ${target}.`)
    process.exit(0)
  }

  // --backfill : mark every current file applied (assumes all are live — use with care).
  if (args.includes('--backfill')) {
    const { error } = await supabase.from('applied_migrations').upsert(files.map(filename => ({ filename })), { onConflict: 'filename', ignoreDuplicates: true })
    if (error) { console.error('✗', error.message); process.exit(1) }
    log(`✓ Backfilled ${files.length} files into the ${target} ledger. (Assumed all applied — remove any you haven't run.)`)
    process.exit(0)
  }

  const { data, error } = await supabase.from('applied_migrations').select('filename')
  if (error) {
    if (/does not exist|schema cache|Could not find the table/i.test(error.message)) {
      log('⚠ Ledger table applied_migrations does not exist yet.')
      log('  Run supabase/migrations/20260708_applied_migrations.sql first.')
      if (asJson) console.log(JSON.stringify({ ledgerReady: false }))
      process.exit(2)
    }
    console.error('✗', error.message)
    process.exit(1)
  }

  const applied = new Set((data || []).map(r => r.filename))
  const pending = files.filter(f => !applied.has(f))
  const orphan = [...applied].filter(f => !files.includes(f)).sort()
  const drift = pending.length > 0 || orphan.length > 0

  if (asJson) {
    console.log(JSON.stringify({ target, total: files.length, applied: applied.size, pending, orphan, drift }))
  } else {
    log(`\n  Migration drift — ${target}`)
    log(`  ${files.length} files · ${applied.size} recorded applied\n`)
    if (!drift) {
      log('  ✓ In sync — every migration file has been applied.\n')
    } else {
      if (pending.length) {
        log(`  ⚠ ${pending.length} PENDING (file exists, not applied):`)
        pending.forEach(f => log(`      • ${f}`))
      }
      if (orphan.length) {
        log(`  ⚠ ${orphan.length} ORPHAN (applied, no file):`)
        orphan.forEach(f => log(`      • ${f}`))
      }
      log('')
    }
  }

  // Record drift to harness_events so it surfaces in the Telemetry tab.
  if (drift) {
    await supabase.from('harness_events').insert({
      event_type: 'migration_drift',
      severity: pending.length ? 'warn' : 'info',
      context: target,
      message: `${pending.length} pending, ${orphan.length} orphan migration(s)`,
      metadata: { pending, orphan },
    }).then(({ error: e }) => { if (e && !/does not exist/i.test(e.message)) log('  (could not log to harness_events:', e.message + ')') })
  }

  process.exit(drift ? 3 : 0)
}

main().catch(e => { console.error('✗ drift check failed:', e.message); process.exit(1) })
