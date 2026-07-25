import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
//  Single wrapper for every YouTube Data API call. Nothing should hit the API
//  directly. Provides: usage logging (youtube_api_usage), 429 exponential
//  backoff, 403 quotaExceeded circuit-breaker (stop, do not loop), ETag support,
//  and a batched videos.list helper reused by curation AND the Task 2 dead-video
//  health check.
// ─────────────────────────────────────────────────────────────────────────────

export type YtEndpoint = 'search' | 'videos' | 'playlistItems' | 'channels'

// Documented quota costs. search.list is the expensive one at 100 units; the
// others are 1 unit and accept up to 50 IDs per call.
export const UNIT_COSTS: Record<YtEndpoint, number> = {
  search: 100, videos: 1, playlistItems: 1, channels: 1,
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const YT_KEY = process.env.YOUTUBE_API_KEY ?? ''

// ── usage logging (best-effort; the table may not exist until the migration is
//    run, so a failure here must never break curation) ────────────────────────
let _db: SupabaseClient | null = null
function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!_db) _db = createClient(url, key)
  return _db
}

type LogRow = {
  endpoint: YtEndpoint; unit_cost: number; http_status: number | null
  success: boolean; not_modified: boolean; quota_exceeded: boolean
  is_fallback: boolean; video_id: string | null; curation_batch_id: string | null; error: string | null
}
async function logUsage(row: LogRow) {
  try {
    const client = db()
    if (!client) return
    await client.from('youtube_api_usage').insert(row)
  } catch { /* logging must never throw into the caller */ }
}

// ── process-level quota circuit breaker ──────────────────────────────────────
// Once YouTube returns 403 quotaExceeded, stop hitting the API for the rest of
// this batch (return a synthetic quotaExceeded) instead of looping and burning
// nothing but time. beginYtBatch() clears it and hands back a batch id.
let _quotaTripped = false
export function beginYtBatch(): string { _quotaTripped = false; return randomUUID() }
export function isQuotaTripped(): boolean { return _quotaTripped }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type YtResult = { data: any; status: number; notModified: boolean; etag: string | null; quotaExceeded: boolean; error: string | null }

export async function ytFetch(
  endpoint: YtEndpoint,
  params: Record<string, string | number>,
  opts: { batchId?: string | null; videoId?: string | null; etag?: string | null; isFallback?: boolean } = {},
): Promise<YtResult> {
  const base = {
    endpoint, unit_cost: UNIT_COSTS[endpoint], is_fallback: !!opts.isFallback,
    video_id: opts.videoId ?? null, curation_batch_id: opts.batchId ?? null,
  }

  // Breaker: quota already exhausted this batch — do not call the API.
  if (_quotaTripped) {
    await logUsage({ ...base, http_status: null, success: false, not_modified: false, quota_exceeded: true, error: 'skipped: quota exhausted this batch' })
    return { data: { error: { errors: [{ reason: 'quotaExceeded' }] } }, status: 403, notModified: false, etag: null, quotaExceeded: true, error: 'quotaExceeded' }
  }

  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
  qs.set('key', YT_KEY)
  const url = `${YT_BASE}/${endpoint}?${qs.toString()}`
  const headers: Record<string, string> = {}
  if (opts.etag) headers['If-None-Match'] = opts.etag

  let attempt = 0
  const maxRetries = 3
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response
    try {
      res = await fetch(url, { headers })
    } catch (e) {
      await logUsage({ ...base, http_status: null, success: false, not_modified: false, quota_exceeded: false, error: e instanceof Error ? e.message : 'network error' })
      return { data: null, status: 0, notModified: false, etag: null, quotaExceeded: false, error: 'network error' }
    }

    // 304: ETag match. No body, and (to be verified) no quota consumed.
    if (res.status === 304) {
      await logUsage({ ...base, http_status: 304, success: true, not_modified: true, quota_exceeded: false, error: null })
      return { data: null, status: 304, notModified: true, etag: opts.etag ?? null, quotaExceeded: false, error: null }
    }

    // 429: rate limited (not a quota exhaustion). Exponential backoff and retry.
    if (res.status === 429 && attempt < maxRetries) {
      await sleep(500 * Math.pow(2, attempt)); attempt++; continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null
    try { data = await res.json() } catch { /* non-json body */ }

    const apiReason: string | undefined = data?.error?.errors?.[0]?.reason
    const quotaExceeded = res.status === 403 && (apiReason === 'quotaExceeded' || apiReason === 'dailyLimitExceeded')
    if (quotaExceeded) _quotaTripped = true

    const etag: string | null = res.headers.get('etag') ?? data?.etag ?? null
    const ok = res.ok && !data?.error

    await logUsage({
      ...base, http_status: res.status, success: ok, not_modified: false,
      quota_exceeded: quotaExceeded, error: ok ? null : (apiReason ?? data?.error?.message ?? `http ${res.status}`),
    })

    return { data, status: res.status, notModified: false, etag, quotaExceeded, error: ok ? null : (apiReason ?? `http ${res.status}`) }
  }
}

// Batched videos.list — up to 50 IDs per call, all requested parts in a single
// call (extra parts do not raise the cost). Reused by curation AND Task 2.
export async function getVideosBatched(
  videoIds: string[],
  parts: string[],
  opts: { batchId?: string | null; isFallback?: boolean } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    const { data } = await ytFetch('videos', { part: parts.join(','), id: chunk.join(','), maxResults: 50 }, { batchId: opts.batchId, isFallback: opts.isFallback })
    if (data?.items) items.push(...data.items)
  }
  return items
}
