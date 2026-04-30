'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#3b82f6', accentDim: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.08)', greenBorder: 'rgba(34,197,94,0.22)',
  red: '#ef4444', redDim: 'rgba(239,68,68,0.08)', redBorder: 'rgba(239,68,68,0.28)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.08)', amberBorder: 'rgba(245,158,11,0.25)',
  text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}

type CheckStatus = 'pending' | 'running' | 'ok' | 'error'
type CheckCategory = 'page' | 'api' | 'database'

interface HealthCheck {
  id: string
  category: CheckCategory
  name: string
  path: string
  file: string
  status: CheckStatus
  statusCode?: number
  message?: string
  fixPrompt?: string
  durationMs?: number
}

// ─── CHECK DEFINITIONS ────────────────────────────────────────────────────────

const PAGE_CHECKS: Omit<HealthCheck, 'status'>[] = [
  { id: 'home',         category: 'page', name: 'Home',               path: '/',                          file: 'app/page.tsx' },
  { id: 'today',        category: 'page', name: 'Today',              path: '/today',                     file: 'app/today/page.tsx' },
  { id: 'plan',         category: 'page', name: 'Your Plan',          path: '/plan',                      file: 'app/plan/page.tsx' },
  { id: 'calendar',     category: 'page', name: 'Calendar',           path: '/calendar',                  file: 'app/calendar/page.tsx' },
  { id: 'for-you',      category: 'page', name: 'For You',            path: '/for-you',                   file: 'app/for-you/page.tsx' },
  { id: 'nutrition',    category: 'page', name: 'Nutrition',          path: '/nutrition',                 file: 'app/nutrition/page.tsx' },
  { id: 'profile',      category: 'page', name: 'Profile',            path: '/profile',                   file: 'app/profile/page.tsx' },
  { id: 'account',      category: 'page', name: 'Account',            path: '/account',                   file: 'app/account/page.tsx' },
  { id: 'browse',       category: 'page', name: 'Browse & Learn',     path: '/browse',                    file: 'app/browse/page.tsx' },
  { id: 'recovery',     category: 'page', name: 'Recovery Hub',       path: '/recovery',                  file: 'app/recovery/page.tsx' },
  { id: 'si-joint',     category: 'page', name: 'SI Joint Playbook',  path: '/recovery/si-joint',         file: 'app/recovery/si-joint/page.tsx' },
  { id: 'elbow',        category: 'page', name: 'Elbow Recovery',     path: '/recovery/elbow',            file: 'app/recovery/elbow/page.tsx' },
  { id: 'shoulder',     category: 'page', name: 'Shoulder Impingement', path: '/recovery/shoulder',       file: 'app/recovery/shoulder/page.tsx' },
  { id: 'knee',         category: 'page', name: 'Knee Rehab',         path: '/recovery/knee',             file: 'app/recovery/knee/page.tsx' },
  { id: 'anatomy',      category: 'page', name: 'Anatomy Explorer',   path: '/recovery/anatomy',          file: 'app/recovery/anatomy/page.tsx' },
  { id: 'rts',          category: 'page', name: 'Injury Recovery AI', path: '/recovery/return-to-sport',  file: 'app/recovery/return-to-sport/page.tsx' },
  { id: 'admin',        category: 'page', name: 'Admin Portal',       path: '/admin',                     file: 'app/admin/page.tsx' },
]

const API_CHECKS: Omit<HealthCheck, 'status'>[] = [
  { id: 'api-plan',      category: 'api', name: 'Generate Plan',            path: '/api/generate-plan',              file: 'app/api/generate-plan/route.ts' },
  { id: 'api-feed',      category: 'api', name: 'Generate Feed',            path: '/api/generate-feed',              file: 'app/api/generate-feed/route.ts' },
  { id: 'api-recovery',  category: 'api', name: 'Generate Recovery Plan',   path: '/api/generate-recovery-plan',     file: 'app/api/generate-recovery-plan/route.ts' },
  { id: 'api-rts',       category: 'api', name: 'Generate Return to Sport', path: '/api/generate-return-to-sport',   file: 'app/api/generate-return-to-sport/route.ts' },
  { id: 'api-exercise',  category: 'api', name: 'Generate Exercise Details', path: '/api/generate-exercise-details', file: 'app/api/generate-exercise-details/route.ts' },
  { id: 'api-launchpad', category: 'api', name: 'Launchpad Generate',       path: '/api/launchpad-generate',         file: 'app/api/launchpad-generate/route.ts' },
]

const DB_CHECKS: Omit<HealthCheck, 'status'>[] = [
  { id: 'db-profiles',    category: 'database', name: 'profiles',            path: 'profiles',            file: 'Supabase → Table Editor → profiles' },
  { id: 'db-programs',    category: 'database', name: 'training_programs',   path: 'training_programs',   file: 'Supabase → Table Editor → training_programs' },
  { id: 'db-plans',       category: 'database', name: 'weekly_plans',        path: 'weekly_plans',        file: 'Supabase → Table Editor → weekly_plans' },
  { id: 'db-completions', category: 'database', name: 'day_completions',     path: 'day_completions',     file: 'Supabase → Table Editor → day_completions' },
  { id: 'db-logs',        category: 'database', name: 'workout_logs',        path: 'workout_logs',        file: 'Supabase → Table Editor → workout_logs' },
  { id: 'db-library',     category: 'database', name: 'exercise_library',    path: 'exercise_library',    file: 'Supabase → Table Editor → exercise_library' },
  { id: 'db-feed',        category: 'database', name: 'for_you_feed',        path: 'for_you_feed',        file: 'Supabase → Table Editor → for_you_feed' },
  { id: 'db-recovery',    category: 'database', name: 'recovery_plans',      path: 'recovery_plans',      file: 'Supabase → Table Editor → recovery_plans' },
  { id: 'db-templates',   category: 'database', name: 'recovery_templates',  path: 'recovery_templates',  file: 'Supabase → Table Editor → recovery_templates' },
  { id: 'db-promos',      category: 'database', name: 'promo_codes',         path: 'promo_codes',         file: 'Supabase → Table Editor → promo_codes' },
  { id: 'db-redemptions', category: 'database', name: 'promo_redemptions',   path: 'promo_redemptions',   file: 'Supabase → Table Editor → promo_redemptions' },
]

// ─── FIX PROMPT GENERATORS ────────────────────────────────────────────────────

function makePagePrompt(check: HealthCheck, scannedAt: string): string {
  return `🚨 Bug Report — Movement App Health Monitor
Scanned: ${scannedAt}

Route: ${check.name} (${check.path})
Status: HTTP ${check.statusCode ?? 'unknown'}
File: ${check.file}

This page is returning a server error. Please investigate and fix.

Steps:
1. Open ${check.file} and look for:
   - Missing or renamed imports
   - Undefined variables used before null-check
   - TypeScript errors (run: npx tsc --noEmit)
   - Supabase queries that might be failing
2. Check if any components imported by this page have been recently changed
3. Check Vercel deployment logs for the exact error message
4. Run: npx next build — look for compilation errors

Fix the root cause. Do not change any existing working functionality.`
}

function makeApiPrompt(check: HealthCheck, scannedAt: string): string {
  return `🚨 Bug Report — Movement App Health Monitor
Scanned: ${scannedAt}

API Route: ${check.name} (${check.path})
Status: HTTP ${check.statusCode ?? 'unknown'}
File: ${check.file}

This API route is returning a 5xx server error even on an empty request.
A healthy route should return 400 (bad request) for an empty payload, not 500.

Steps:
1. Open ${check.file} and look for:
   - Top-level code that runs before the request body is parsed
   - Missing environment variables (ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, etc.)
   - Supabase client initialization errors
   - Import errors at the top of the file
2. Check Vercel → Functions logs for the exact stack trace
3. Run: npx tsc --noEmit to catch TypeScript errors

Fix the root cause. This API powers a user-facing feature and must be functional.`
}

function makeDbPrompt(check: HealthCheck, scannedAt: string): string {
  const table = check.path
  const featureMap: Record<string, string> = {
    profiles: 'user auth, profile page, plan generation',
    training_programs: 'Your Plan page, week generation',
    weekly_plans: 'Your Plan page, Calendar page',
    day_completions: 'Calendar completion tracking',
    workout_logs: 'Exercise logging, personal bests',
    exercise_library: 'Exercise detail modals, how-to cues',
    for_you_feed: 'For You page, AI tips and mindset cards',
    recovery_plans: 'Injury Recovery AI (/recovery/return-to-sport)',
    recovery_templates: 'Injury Recovery AI template cache',
    promo_codes: 'Promo code redemption (/account)',
    promo_redemptions: 'Promo code redemption tracking',
  }
  return `🚨 Bug Report — Movement App Health Monitor
Scanned: ${scannedAt}

Database Table: ${table}
Error: ${check.message ?? 'Query failed'}
Affects: ${featureMap[table] ?? 'unknown features'}

The '${table}' table is inaccessible. This will break: ${featureMap[table] ?? 'related features'}.

Steps:
1. Go to Supabase Dashboard → Table Editor
2. Verify the '${table}' table exists
3. If missing, check memory/pending_migrations.md for the CREATE TABLE SQL
4. Go to Supabase → Authentication → Policies
5. Verify RLS is enabled and there is a policy allowing authenticated users to SELECT from '${table}'
6. Run this query in Supabase SQL Editor:
   SELECT * FROM ${table} LIMIT 1;

Fix the root cause before deploying any features that depend on this table.`
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtTimestamp(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const CAT_LABEL: Record<CheckCategory, string> = { page: 'Page', api: 'API', database: 'Database' }
const CAT_COLOR: Record<CheckCategory, string> = { page: C.accent, api: '#a78bfa', database: C.amber }

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: show the text in a textarea
    }
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        padding: '6px 14px', borderRadius: 6, border: `1px solid ${copied ? C.greenBorder : C.redBorder}`,
        background: copied ? C.greenDim : C.redDim, color: copied ? C.green : C.red,
        fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.15s',
        fontFamily: 'monospace', flexShrink: 0,
      }}
    >
      {copied ? '✓ Copied' : '⧉ Copy Fix Prompt'}
    </button>
  )
}

function CheckRow({ check, scannedAt }: { check: HealthCheck; scannedAt: string }) {
  const [expanded, setExpanded] = useState(false)
  const isError = check.status === 'error'
  const isOk = check.status === 'ok'
  const isRunning = check.status === 'running'

  const statusDot = isOk ? C.green : isError ? C.red : isRunning ? C.amber : C.textDim
  const statusLabel = isOk ? 'OK' : isError ? `ERROR ${check.statusCode ?? ''}` : isRunning ? '…' : '—'

  const prompt = check.category === 'page' ? makePagePrompt(check, scannedAt)
    : check.category === 'api' ? makeApiPrompt(check, scannedAt)
    : makeDbPrompt(check, scannedAt)

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        onClick={() => isError && setExpanded(e => !e)}
        style={{
          display: 'grid', gridTemplateColumns: '10px 1fr 60px 70px 70px',
          alignItems: 'center', gap: 12, padding: '11px 20px',
          cursor: isError ? 'pointer' : 'default',
          background: isError && expanded ? 'rgba(239,68,68,0.04)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot, boxShadow: isError ? `0 0 6px ${C.red}` : isOk ? `0 0 4px ${C.green}44` : 'none', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{check.name}</span>
          <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8, fontFamily: 'monospace' }}>{check.path}</span>
        </div>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${CAT_COLOR[check.category]}18`, color: CAT_COLOR[check.category], fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', justifySelf: 'start' }}>
          {CAT_LABEL[check.category]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusDot, fontFamily: 'monospace', textAlign: 'right' }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', textAlign: 'right' }}>
          {check.durationMs != null ? fmtDuration(check.durationMs) : '—'}
        </span>
      </div>

      {isError && expanded && (
        <div style={{ margin: '0 20px 14px', padding: '14px 16px', background: C.redDim, border: `1px solid ${C.redBorder}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 10, lineHeight: 1.6 }}>
            <strong style={{ color: C.red }}>What failed:</strong> {check.message ?? `HTTP ${check.statusCode} response`}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', marginBottom: 12 }}>
            File: {check.file}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>
              Copy the prompt below and paste it directly into Claude Code in VS Code to auto-fix this issue.
            </p>
            <CopyButton text={prompt} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function HealthTab() {
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [scanning, setScanning] = useState(false)
  const [scannedAt, setScannedAt] = useState<Date | null>(null)
  const [showPassing, setShowPassing] = useState(false)

  const allChecks: Omit<HealthCheck, 'status'>[] = [...PAGE_CHECKS, ...API_CHECKS, ...DB_CHECKS]
  const total = allChecks.length

  const runScan = useCallback(async () => {
    setScanning(true)
    const now = new Date()
    setScannedAt(now)
    setShowPassing(false)

    const results: HealthCheck[] = allChecks.map(c => ({ ...c, status: 'pending' as const }))
    setChecks([...results])

    // ── Page checks ──────────────────────────────────────────────────────────
    for (let i = 0; i < PAGE_CHECKS.length; i++) {
      const def = PAGE_CHECKS[i]
      const idx = results.findIndex(r => r.id === def.id)
      results[idx] = { ...results[idx], status: 'running' }
      setChecks([...results])

      const t0 = Date.now()
      try {
        const res = await fetch(def.path, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000) })
        const dur = Date.now() - t0
        if (res.ok) {
          results[idx] = { ...results[idx], status: 'ok', statusCode: res.status, durationMs: dur }
        } else {
          results[idx] = {
            ...results[idx], status: 'error', statusCode: res.status, durationMs: dur,
            message: `Page returned HTTP ${res.status}. Expected 200.`,
          }
        }
      } catch (e: unknown) {
        const dur = Date.now() - t0
        const msg = e instanceof Error ? e.message : 'Network error or timeout'
        results[idx] = { ...results[idx], status: 'error', durationMs: dur, message: msg }
      }
      setChecks([...results])
    }

    // ── API checks ───────────────────────────────────────────────────────────
    for (let i = 0; i < API_CHECKS.length; i++) {
      const def = API_CHECKS[i]
      const idx = results.findIndex(r => r.id === def.id)
      results[idx] = { ...results[idx], status: 'running' }
      setChecks([...results])

      const t0 = Date.now()
      try {
        const res = await fetch(def.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ healthcheck: true }),
          signal: AbortSignal.timeout(12000),
        })
        const dur = Date.now() - t0
        // 4xx = route is up, correctly rejected bad input
        // 5xx = route crashed
        if (res.status < 500) {
          results[idx] = { ...results[idx], status: 'ok', statusCode: res.status, durationMs: dur }
        } else {
          results[idx] = {
            ...results[idx], status: 'error', statusCode: res.status, durationMs: dur,
            message: `API returned HTTP ${res.status}. This indicates a server-side crash, not just bad input.`,
          }
        }
      } catch (e: unknown) {
        const dur = Date.now() - t0
        const msg = e instanceof Error ? e.message : 'Network error or timeout'
        results[idx] = { ...results[idx], status: 'error', durationMs: dur, message: msg }
      }
      setChecks([...results])
    }

    // ── Database checks ──────────────────────────────────────────────────────
    for (let i = 0; i < DB_CHECKS.length; i++) {
      const def = DB_CHECKS[i]
      const idx = results.findIndex(r => r.id === def.id)
      results[idx] = { ...results[idx], status: 'running' }
      setChecks([...results])

      const t0 = Date.now()
      try {
        const { error } = await supabase.from(def.path as never).select('id').limit(1)
        const dur = Date.now() - t0
        if (error) {
          results[idx] = {
            ...results[idx], status: 'error', durationMs: dur,
            message: `${error.code}: ${error.message}`,
          }
        } else {
          results[idx] = { ...results[idx], status: 'ok', durationMs: dur }
        }
      } catch (e: unknown) {
        const dur = Date.now() - t0
        const msg = e instanceof Error ? e.message : 'Unexpected error'
        results[idx] = { ...results[idx], status: 'error', durationMs: dur, message: msg }
      }
      setChecks([...results])
    }

    setScanning(false)
  }, [])

  const errors = checks.filter(c => c.status === 'error')
  const passing = checks.filter(c => c.status === 'ok')
  const pending = checks.filter(c => c.status === 'pending' || c.status === 'running')
  const hasResults = checks.length > 0
  const scannedAtStr = scannedAt ? fmtTimestamp(scannedAt) : ''

  const pageErrors = errors.filter(c => c.category === 'page')
  const apiErrors = errors.filter(c => c.category === 'api')
  const dbErrors = errors.filter(c => c.category === 'database')

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Health Monitor</h2>
          <p style={{ fontSize: 12, color: C.textDim }}>
            {scannedAt
              ? `Last scan: ${scannedAtStr} · ${passing.length}/${total} checks passing`
              : `${total} checks across ${PAGE_CHECKS.length} pages, ${API_CHECKS.length} API routes, ${DB_CHECKS.length} tables`}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: '10px 22px', borderRadius: 8,
            border: `1px solid ${scanning ? C.border : C.accentBorder}`,
            background: scanning ? C.surface2 : C.accentDim,
            color: scanning ? C.textDim : C.accent,
            fontSize: 13, fontWeight: 700, cursor: scanning ? 'default' : 'pointer',
            letterSpacing: '0.03em', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {scanning ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }}>⟳</span>
              Scanning… ({pending.length} remaining)
            </>
          ) : (
            <>⟳ {hasResults ? 'Re-scan' : 'Run Scan'}</>
          )}
        </button>
      </div>

      {/* No scan yet */}
      {!hasResults && !scanning && (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>App Health Monitor</p>
          <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
            Run a scan to check all {PAGE_CHECKS.length} pages, {API_CHECKS.length} API routes, and {DB_CHECKS.length} database tables.
            Any failures show in red with a ready-to-paste Claude Code fix prompt.
          </p>
          <button
            onClick={runScan}
            style={{
              padding: '12px 28px', borderRadius: 8, border: `1px solid ${C.accentBorder}`,
              background: C.accentDim, color: C.accent, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⟳ Run Scan Now
          </button>
        </div>
      )}

      {/* Summary bar */}
      {hasResults && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Checks', val: total, color: C.accent },
            { label: errors.length === 0 ? 'All Passing' : 'Passing', val: passing.length, color: C.green },
            { label: 'Issues Found', val: errors.length, color: errors.length > 0 ? C.red : C.green },
            { label: scanning ? 'Remaining' : 'Scan Complete', val: scanning ? pending.length : '✓', color: scanning ? C.amber : C.green },
          ].map(k => (
            <div key={k.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', borderTop: `2px solid ${k.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: k.color, letterSpacing: '-0.02em' }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* All clear banner */}
      {hasResults && !scanning && errors.length === 0 && (
        <div style={{ padding: '20px 24px', background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <div>
            <p style={{ fontWeight: 800, color: C.green, fontSize: 15, marginBottom: 2 }}>All {total} checks passed</p>
            <p style={{ color: C.textDim, fontSize: 12 }}>Every page loads, every API route responds, every database table is accessible.</p>
          </div>
        </div>
      )}

      {/* Issues section */}
      {hasResults && errors.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.redBorder}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.redBorder}`, background: C.redDim, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.red, boxShadow: `0 0 8px ${C.red}` }} />
            <span style={{ fontWeight: 800, color: C.red, fontSize: 13 }}>{errors.length} Issue{errors.length !== 1 ? 's' : ''} Found</span>
            <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>
              {pageErrors.length > 0 && `${pageErrors.length} page${pageErrors.length !== 1 ? 's' : ''}`}
              {pageErrors.length > 0 && (apiErrors.length > 0 || dbErrors.length > 0) && ' · '}
              {apiErrors.length > 0 && `${apiErrors.length} API${apiErrors.length !== 1 ? 's' : ''}`}
              {apiErrors.length > 0 && dbErrors.length > 0 && ' · '}
              {dbErrors.length > 0 && `${dbErrors.length} table${dbErrors.length !== 1 ? 's' : ''}`}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textDim }}>Click a row to expand + copy fix prompt</span>
          </div>
          {errors.map(c => <CheckRow key={c.id} check={c} scannedAt={scannedAtStr} />)}
        </div>
      )}

      {/* Passing section */}
      {hasResults && passing.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => setShowPassing(p => !p)}
            style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.green }} />
            <span style={{ fontWeight: 700, color: C.textMid, fontSize: 13 }}>{passing.length} Passing</span>
            <svg width="14" height="14" fill="none" stroke={C.textDim} strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 'auto', transform: showPassing ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showPassing && (
            <>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '10px 1fr 60px 70px 70px', gap: 12, padding: '8px 20px', borderTop: `1px solid ${C.border}` }}>
                {['', 'Check', 'Type', 'Status', 'Time'].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {passing.map(c => <CheckRow key={c.id} check={c} scannedAt={scannedAtStr} />)}
            </>
          )}
        </div>
      )}

      {/* Scanning skeleton */}
      {scanning && pending.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
            <span style={{ fontWeight: 700, color: C.textMid, fontSize: 13 }}>Running checks…</span>
          </div>
          {pending.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '10px 1fr 60px 70px 70px', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'running' ? C.amber : C.border, animation: c.status === 'running' ? 'pulse 1s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize: 13, color: c.status === 'running' ? C.text : C.textDim }}>{c.name}</span>
              <span style={{ fontSize: 10, color: CAT_COLOR[c.category], fontFamily: 'monospace', fontWeight: 700 }}>{CAT_LABEL[c.category]}</span>
              <span style={{ fontSize: 11, color: c.status === 'running' ? C.amber : C.textDim, fontFamily: 'monospace', textAlign: 'right' }}>
                {c.status === 'running' ? '…' : 'queued'}
              </span>
              <span style={{ textAlign: 'right', color: C.textDim, fontSize: 11 }}>—</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
