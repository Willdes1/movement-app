// Provision one partner: set their role and grant them specific admin sections.
//
// This exists because doing it by hand across two admin screens is error prone,
// and because the thing you must never get wrong here is scope. Access is
// granted PER USER, as a single row in admin_permissions keyed to one user id.
// Nothing in here grants anything to a role, to coaches in general, or to any
// group. If this script cannot resolve the email to exactly one account, it
// stops and changes nothing.
//
// Usage:
//   node scripts/provision-partner.js <email> --role coach --tabs trimming,media
//   node scripts/provision-partner.js <email> --dry-run      show the plan only
//   node scripts/provision-partner.js <email> --revoke       deactivate the grant
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (same key scripts/migration-drift.js
// wants). Never paste that key into chat; copy it from the Vercel env vars.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Sections this script is willing to grant. Deliberately a short allowlist, not
// the full catalog: anything touching user data, money or the permission system
// itself has to be a considered decision made in the Access Control UI, not a
// convenient default in a script. 'access' is the master key and is never here.
const ALLOWED_TABS = ['trimming', 'media', 'video', 'tts', 'seed', 'cleanup', 'launchpad', 'kb', 'study', 'architecture']
const VALID_ROLES = ['coach', 'beta', 'ff', 'free']

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
  } catch { /* no .env.local — rely on real env */ }
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback
}

function die(msg) {
  console.error(`\n  ✖ ${msg}\n`)
  process.exit(1)
}

async function main() {
  loadEnv()

  const email = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  const revoke = process.argv.includes('--revoke')
  const role = arg('role', 'coach')
  const tabs = (arg('tabs', 'trimming,media') || '').split(',').map(t => t.trim()).filter(Boolean)

  if (!email || email.startsWith('--')) die('Pass the person\'s email as the first argument.')
  if (!email.includes('@')) die(`"${email}" is not an email address. This script targets exactly one person.`)
  if (!VALID_ROLES.includes(role)) die(`--role must be one of: ${VALID_ROLES.join(', ')}. Refusing to set "${role}".`)

  const badTabs = tabs.filter(t => !ALLOWED_TABS.includes(t))
  if (badTabs.length) {
    die(`Refusing to grant: ${badTabs.join(', ')}\n    This script only grants: ${ALLOWED_TABS.join(', ')}\n    Anything sensitive (users, billing, spend, ceo, telemetry) or the\n    access master key must be granted deliberately in /admin#access.`)
  }

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!URL) die('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local.')
  if (!KEY) {
    die('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.\n\n'
      + '    Get it from Vercel: Project → Settings → Environment Variables →\n'
      + '    SUPABASE_SERVICE_ROLE_KEY → reveal → copy. Then add this line to\n'
      + '    c:\\Dev\\movement-app\\.env.local\n\n'
      + '      SUPABASE_SERVICE_ROLE_KEY=<paste it here>\n\n'
      + '    .env.local is gitignored, so it never reaches GitHub. Do not paste\n'
      + '    the key into a chat message.')
  }

  const supabase = createClient(URL, KEY)

  // ── 1. Resolve the email to exactly one auth account ──────────────────────
  const target = email.toLowerCase()
  let match = null
  let matchCount = 0
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) die(`Could not list users: ${error.message}`)
    const users = data?.users ?? []
    for (const u of users) {
      if ((u.email ?? '').toLowerCase() === target) { matchCount++; match = match ?? u }
    }
    if (users.length < 200) break
  }

  if (!match) die(`No account found for ${email}.\n    They have to sign up first. Check the address for typos.`)
  if (matchCount > 1) die(`${matchCount} accounts share ${email}. Refusing to guess which one.`)

  const userId = match.id
  const confirmed = !!match.email_confirmed_at

  // ── 2. Read the current state before changing anything ────────────────────
  const { data: profile } = await supabase
    .from('profiles').select('name, role, is_admin, is_owner').eq('id', userId).maybeSingle()
  const { data: existingPerm } = await supabase
    .from('admin_permissions').select('allowed_tabs, active, note').eq('user_id', userId).maybeSingle()

  console.log(`\n  ${email}`)
  console.log(`  user id            ${userId}`)
  console.log(`  email confirmed    ${confirmed ? 'yes' : 'NO — they must confirm before they can log in'}`)
  console.log(`  profiles row       ${profile ? 'exists' : 'MISSING — will be created'}`)
  console.log(`  name               ${profile?.name ?? '(not set)'}`)
  console.log(`  role now           ${profile?.role ?? '(none)'}`)
  console.log(`  admin sections now ${existingPerm ? `[${(existingPerm.allowed_tabs ?? []).join(', ')}]${existingPerm.active ? '' : ' (suspended)'}` : '(none)'}`)

  // Never touch an owner or full admin. The protect_admin_role trigger would
  // block the role change anyway, but failing loudly here is clearer.
  if (profile?.is_admin || profile?.is_owner) {
    die('That account is an owner or full admin. Refusing to modify it.')
  }

  if (revoke) {
    console.log(`\n  → revoke admin access (role left as "${profile?.role ?? 'none'}")`)
    if (dryRun) { console.log('\n  DRY RUN — nothing written.\n'); return }
    const { error } = await supabase.from('admin_permissions')
      .update({ active: false, allowed_tabs: [], updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) die(`Revoke failed: ${error.message}`)
    console.log('\n  ✔ Admin access revoked.\n')
    return
  }

  console.log(`\n  → set role to        "${role}"`)
  console.log(`  → grant sections     [${tabs.join(', ')}]`)
  console.log(`  → scope              this one user id only, nobody else`)

  if (dryRun) { console.log('\n  DRY RUN — nothing written.\n'); return }

  // ── 3. Role. Upsert so a missing profiles row is created rather than a
  //       silent zero-row update, which is how a role change appears to work
  //       and then does not. ─────────────────────────────────────────────────
  const { error: roleErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, role, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (roleErr) die(`Setting role failed: ${roleErr.message}`)

  // ── 4. The grant. One row, one user id. ───────────────────────────────────
  const { error: permErr } = await supabase
    .from('admin_permissions')
    .upsert({
      user_id: userId,
      allowed_tabs: tabs,
      active: true,
      note: arg('note', 'Video trimming partner'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (permErr) die(`Granting sections failed: ${permErr.message}`)

  // ── 5. Read back and prove it, rather than trusting the writes ────────────
  const { data: after } = await supabase
    .from('profiles').select('role, is_admin, is_owner').eq('id', userId).maybeSingle()
  const { data: permAfter } = await supabase
    .from('admin_permissions').select('allowed_tabs, active').eq('user_id', userId).maybeSingle()
  const { data: allPerms } = await supabase
    .from('admin_permissions').select('user_id, active, allowed_tabs')

  console.log('\n  ── verified by reading it back ──')
  console.log(`  role               ${after?.role}`)
  console.log(`  is_admin           ${after?.is_admin === true} (partners are never is_admin, by design)`)
  console.log(`  sections           [${(permAfter?.allowed_tabs ?? []).join(', ')}]`)
  console.log(`  active             ${permAfter?.active}`)

  const actives = (allPerms ?? []).filter(p => p.active)
  console.log(`\n  people with any admin access: ${actives.length}`)
  for (const p of actives) {
    console.log(`    ${p.user_id === userId ? '→' : ' '} ${p.user_id}  [${(p.allowed_tabs ?? []).join(', ')}]`)
  }

  console.log('\n  ✔ Done. They need to sign out and back in for it to take effect.\n')
}

main().catch(e => die(e.message))
