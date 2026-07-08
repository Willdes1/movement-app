// Emits lib/migrations-manifest.json — the sorted list of every SQL file in
// supabase/migrations/. Runs on prebuild (like git-stats.js) so the deployed
// app has the file list bundled: on Vercel the raw repo files aren't readable
// at runtime, but this imported JSON is. The Telemetry tab's Migrations panel
// diffs this manifest against the applied_migrations ledger to surface drift.

const fs = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
const OUT = path.join(__dirname, '..', 'lib', 'migrations-manifest.json')

function main() {
  let files = []
  try {
    files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  } catch (e) {
    console.warn('[migrations-manifest] could not read migrations dir:', e.message)
  }
  const manifest = { generatedAt: new Date().toISOString(), count: files.length, files }
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`✓ migrations-manifest.json updated: ${files.length} files`)
}

main()
