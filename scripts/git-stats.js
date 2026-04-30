// Runs before every build (npm run prebuild / Vercel prebuild).
// Reads git log, calculates coding sessions, writes lib/git-stats.json.
// Skips on Vercel — shallow clone produces wrong numbers; committed JSON is authoritative.
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.env.VERCEL) {
  console.log('ℹ git-stats.js: Vercel environment — using committed git-stats.json (shallow clone skipped).')
  process.exit(0)
}

const SESSION_GAP_MS = 2 * 60 * 60 * 1000   // 2h gap = new session
const BUFFER_MS      = 30 * 60 * 1000        // add 30 min to each session (pre-code thinking time)

try {
  const raw = execSync('git log --format="%ai" --reverse', { encoding: 'utf-8' }).trim()
  const timestamps = raw.split('\n').map(l => new Date(l.trim()))

  let totalMs = 0
  let sessions = 0
  let sessionStart = timestamps[0]
  let sessionLast  = timestamps[0]

  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1]
    if (gap > SESSION_GAP_MS) {
      totalMs += (sessionLast - sessionStart) + BUFFER_MS
      sessions++
      sessionStart = timestamps[i]
    }
    sessionLast = timestamps[i]
  }
  // Final session
  totalMs += (sessionLast - sessionStart) + BUFFER_MS
  sessions++

  const totalHours = Math.round(totalMs / (1000 * 60 * 60))
  const days = new Set(timestamps.map(t => t.toISOString().slice(0, 10)))

  const stats = {
    totalHours,
    sessions,
    activeDays: days.size,
    totalCommits: timestamps.length,
    firstCommit: timestamps[0].toISOString().slice(0, 10),
    lastUpdated: new Date().toISOString().slice(0, 10),
  }

  fs.writeFileSync(
    path.join(__dirname, '../lib/git-stats.json'),
    JSON.stringify(stats, null, 2)
  )
  console.log('✓ git-stats.json updated:', stats)
} catch (err) {
  console.warn('⚠ git-stats.js: could not read git log, skipping.', err.message)
}
