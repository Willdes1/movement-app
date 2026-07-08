// Post-deploy smoke test (Stage 4 of Harness Engineering).
//
// POSTs to the deployed /api/admin/smoke-test route (server-side suite) using the
// cron secret, prints the per-check results, and exits non-zero on any failure —
// so it can gate a post-deploy step or be run by hand after shipping.
//
// Usage:
//   CRON_SECRET=xxx npm run smoke-test                       # against production
//   CRON_SECRET=xxx npm run smoke-test -- https://staging... # against a URL
//
// Prefer the "Run smoke tests" button in Admin → Telemetry if you don't have the
// cron secret handy (it uses your admin login instead).

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://atlasprime.app').replace(/\/$/, '')
const SECRET = process.env.CRON_SECRET

async function main() {
  if (!SECRET) {
    console.error('✗ CRON_SECRET not set. Set it (same value as in Vercel) to run from the CLI,')
    console.error('  or use the "Run smoke tests" button in Admin → Telemetry.')
    process.exit(1)
  }

  let res
  try {
    res = await fetch(`${BASE}/api/admin/smoke-test`, { method: 'POST', headers: { 'x-cron-secret': SECRET } })
  } catch (e) {
    console.error('✗ request failed:', e.message)
    process.exit(1)
  }

  if (res.status === 401 || res.status === 403) {
    console.error('✗ auth rejected — check CRON_SECRET matches Vercel.')
    process.exit(1)
  }

  const d = await res.json().catch(() => ({}))
  const checks = d.checks || []

  console.log(`\n  Smoke test — ${BASE}`)
  console.log(`  ${d.passed ?? 0}/${d.total ?? checks.length} passed · ${d.ok ? 'PASS ✓' : 'FAIL ✗'}\n`)
  for (const c of checks) {
    const mark = c.skipped ? '–' : c.ok ? '✓' : '✗'
    console.log(`  ${mark} ${c.name}${c.detail ? ' — ' + c.detail : ''}`)
  }
  console.log('')

  process.exit(d.ok ? 0 : 1)
}

main()
