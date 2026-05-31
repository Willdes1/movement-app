# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## Commands

```bash
npm run dev        # start dev server (Turbopack)
npm run build      # production build (also runs scripts/git-stats.js via prebuild)
npm run start      # serve production build locally
```

There is no test runner configured. No linter script is defined in package.json.

---

## Architecture

### Stack
- **Next.js 16** — App Router, Turbopack, React 19, TypeScript
- **Supabase** — Postgres + Auth + Storage + Realtime (free tier; `main` branch = production)
- **Anthropic Claude API** (`claude-sonnet-4-6`) — plan generation, MIE agents, video curation
- **OpenAI API** — TTS (`tts-1`, voices: `onyx`/`nova`) + embeddings (`text-embedding-3-small`)
- **Stripe** — web subscriptions (iOS/Android requires RevenueCat instead)
- **Vercel Hobby** — 60s max serverless function duration (`export const maxDuration = 60`)

### Styling
**No Tailwind utility classes in components.** All styling is inline `style={{}}` objects using CSS custom properties (`var(--accent)`, `var(--surface)`, `var(--surface2)`, `var(--border)`, `var(--text)`, `var(--text-dim)`, `var(--text-mid)`). Theming lives in `ThemeContext`.

### Two Supabase clients — never mix them up

| Client | Where created | Use for |
|--------|--------------|---------|
| `import { supabase } from '@/lib/supabase'` | Anon key, client-side | All client components; JWT-verified API routes (caller auth) |
| `createClient(URL, SERVICE_ROLE_KEY)` | Service role, server-only | Fetching data inside API routes after JWT is verified; bypasses RLS |

**Standard API route auth pattern** (used in all coach/client routes):
```typescript
export const runtime = 'nodejs'
export const maxDuration = 60

// 1. Verify caller JWT
const anonClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
const { data: { user } } = await anonClient.auth.getUser()
// 2. Fetch data bypassing RLS
const supabase = createClient(URL, SERVICE_ROLE_KEY)
```

### Supabase join shape — critical
Joined relations **always return as arrays**, never single objects:
```typescript
// WRONG:
const name = (data.profiles as { name: string } | null)?.name
// RIGHT:
const name = (data.profiles as unknown as { name: string }[] | null)?.[0]?.name
```

### AuthContext (`contexts/AuthContext.tsx`)
Central auth provider. Key values consumed by most pages:
- `user` — real Supabase auth user (always the admin when impersonating)
- `effectiveUserId` — use this for all data reads/writes (swaps to impersonated user's ID during Zoom In sessions)
- `role` — `'admin' | 'coach' | 'beta' | 'ff' | 'free'`
- `isAdmin` — boolean, read from `profiles.is_admin`
- `loggedInsert` / `loggedDelete` — use instead of `supabase.from().insert/delete` when inside any admin impersonation flow; auto-logs the action

### Movement Intelligence Engine (MIE)
Multi-agent RAG pipeline in `app/api/generate-plan/route.ts`. Pipeline:
1. **RAG retrieval** — `lib/knowledge-retrieval.ts` queries pgvector (`match_knowledge` RPC, `text-embedding-3-small`) against 784-item Domain Knowledge Store
2. **S&C Agent** — drafts the 7-day JSON plan using retrieved knowledge
3. **PT/Rehab Agent** — safety review pass; replaces contraindicated exercises; has veto power
4. **Sports Specialist Agent** — rewrites `daily_session.warmup` and `coaching` fields to be sport-specific
5. **Mobility Agent** — owns morning/cooldown/evening blocks
6. **Mindset Agent** — adds Japanese warrior philosophy layer (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin)
7. **Recovery Agent** — rest day programming

All agents run sequentially; any agent failure is non-fatal (returns previous plan unchanged).

### Token logging
Every API route that calls Claude or OpenAI must call `logTokens()` from `lib/log-tokens.ts`. Costs tracked in `token_usage` table; visible in admin Health Monitor tab.

### Batch processing pattern (Vercel 60s limit)
```typescript
export const maxDuration = 60
const CONCURRENCY = 4
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const chunk = items.slice(i, i + CONCURRENCY)
  await Promise.all(chunk.map(item => processOne(item)))
}
```
Sequential loops over large arrays will 504. Always chunk.

### Admin portal
Single page at `app/admin/page.tsx` with hash-based tab routing (`/admin#tts`, `/admin#video`, `/admin#launchpad`, etc.). All tab components live in `components/admin/`. The Launchpad checklist (`components/admin/LaunchpadTab.tsx`) is hardcoded — no SQL. Update it in the same commit as any shipped feature: flip `done: false → true` in `READINESS_DATA` and add a line to the `BUILT` array.

### RLS safety
- Recursive RLS policies on `profiles` cause admin lockout. Always use `SECURITY DEFINER` functions for cross-role access.
- `protect_admin_role` trigger is live — blocks any UPDATE that changes a row's role away from `admin`.
- In API routes, use the service role key instead of complex RLS whenever possible.

### Key files
| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Anon client (client-side) |
| `lib/knowledge-retrieval.ts` | pgvector RAG — `retrieveKnowledge()` + `formatKnowledgeContext()` |
| `lib/log-tokens.ts` | `logTokens()` — call from every AI route |
| `lib/impersonation-logger.ts` | Zoom In audit trail |
| `contexts/AuthContext.tsx` | Auth + impersonation state; `effectiveUserId` is the correct ID to use |
| `components/admin/LaunchpadTab.tsx` | Hardcoded readiness checklist + BUILT list |
| `scripts/git-stats.js` | Regenerates `lib/git-stats.json`; runs automatically on `npm run build` |
| `TODO.md` | Active feature backlog — check before building |
| `AGENT_CONTEXT.md` | Full project briefing for new sessions |
