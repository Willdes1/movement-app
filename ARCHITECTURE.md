# Atlas Prime — System Architecture

> How the platform is wired end to end: from a tap in the app, through the API layer and
> database, out to the AI services, and back. One codebase serves three surfaces — the
> **Athlete app**, the **Coach Portal**, and the **Admin Portal**.
>
> _Mapped 2026-07-03. A companion visual version lives at `docs/architecture.html`._
> _For a per-session change log see `AGENT_CONTEXT.md`; for the working conventions see `CLAUDE.md`._

---

## 1. Overview

Atlas Prime is a single **Next.js 16** application. The same codebase renders the user-facing
pages **and** hosts the backend as serverless **API routes** (`app/api/**/route.ts`) — there is no
separate backend server. Everything persistent lives in one **Supabase** project (Postgres + Auth
+ Storage + Realtime). The heavy generation — training plans, coaching cues, voices — is delegated
to external AI providers and billed per use.

Mental model:

- **Browser** holds a login token (JWT).
- **API routes** are the gatekeepers.
- **Postgres** is the single source of truth.
- **AI providers** are contractors the routes hire job-by-job.

| Metric | Value |
|---|---|
| API routes | 52 (`app/api/**/route.ts`) |
| Database | 1 Postgres (Supabase), ~40 tables |
| SQL migrations | 29 (`supabase/migrations/`) |
| External AI / pay providers | Anthropic, OpenAI, ElevenLabs, Stripe/RevenueCat |
| App surfaces | Athlete, Coach, Admin |
| Roles | admin, coach, beta, ff, free |

---

## 2. The stack

Four layers; a request falls straight down and the response climbs back up.

| Layer | Tech | Notes |
|---|---|---|
| **Client** | React 19, Next.js App Router | Inline-styled components (no Tailwind), installable PWA, Web Push |
| **Edge / API** | Vercel serverless (Node runtime) | `export const maxDuration = 60` — 60s hard cap; bulk work is chunked |
| **Data** | Supabase | Postgres + RLS, Auth (email/Google/Apple), Storage, Realtime, pgvector |
| **Providers** | Anthropic, OpenAI, ElevenLabs, Stripe, YouTube | Metered per use; keys in Vercel env only |

**Hard constraint:** Vercel Hobby kills any function at **60 seconds**. Every bulk job (TTS voicing,
library fill, video curation) is chunked into small parallel batches and looped from the client —
never one long server call. See the batch pattern in `CLAUDE.md`.

---

## 3. Request lifecycle — the two Supabase clients

The single most important backend pattern. There are **two** database connections for two jobs:

```
Browser (anon client + JWT)
   → API route
      → ① verify caller   : anon client + auth.getUser()   (proves identity, RLS-bound)
      → ② service role    : SUPABASE_SERVICE_ROLE_KEY       (server-only, bypasses RLS)
         → Postgres        : trusted reads / writes
```

- **Anon client** (`lib/supabase.ts`) — runs in the browser, bound by Row-Level Security; can only
  touch rows the logged-in user owns. Also used inside routes to _verify_ the caller's JWT.
- **Service-role client** — created only inside API routes, after identity is proven. Holds a secret
  key that bypasses RLS for trusted work (read another user's program, write cost logs, run admin jobs).

**Rule: verify with the anon key, then act with the service key.** The canonical route shape:

```ts
export const runtime = 'nodejs'
export const maxDuration = 60

// 1. Verify caller JWT
const anonClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
const { data: { user } } = await anonClient.auth.getUser()
// 2. Fetch/write bypassing RLS
const supabase = createClient(URL, SERVICE_ROLE_KEY)
```

> **Cautionary tale:** `logTokens()` silently failed for months because it wrote with the _anon_ key
> to an RLS-locked table — every insert was rejected and swallowed by `.catch()`. Fix was the
> service-role key. Same pattern, correctly applied. (`lib/log-tokens.ts`)

**Supabase gotcha:** joined relations always come back as **arrays**, never single objects. Cast as
`Type[]` and index `[0]`:

```ts
// WRONG: (data.profiles as { name: string } | null)?.name
// RIGHT: (data.profiles as unknown as { name: string }[] | null)?.[0]?.name
```

---

## 4. Identity & roles

Every account is a row in `profiles`; the `role` column decides which surface a person sees.

| Role | Gets | Set by |
|---|---|---|
| `admin` | Everything + Admin Portal (`/admin`) | Manual / owner (`is_admin`, `is_owner`) |
| `coach` | Coach Portal (`/coach/*`) + athlete app | `/coaches` signup link, or a coach promo code |
| `beta` | Full athlete app (early access) | Promo code |
| `ff` | Athlete app (friends & family) | Promo code |
| `free` | Athlete app (default) | Signup default |

**Signup paths** (`app/auth/page.tsx`, `app/auth/callback/page.tsx`):
- Athlete → `atlasprime.app` → default role.
- Coach → `atlasprime.app/coaches` (redirects to `/auth?as=coach`) → stamps `role = coach`, routes to
  `/coach/dashboard`. Works for email + Google/Apple via a `pendingCoach` flag.
- Promo codes (`promo_codes` table) can grant any role; entered at signup, applied post-auth.

**`AuthContext` (`contexts/AuthContext.tsx`)** exposes:
- `user` — the real logged-in account (always the admin when impersonating).
- `effectiveUserId` — **whose data to read/write.** Swaps to the impersonated user during admin
  "Zoom In" sessions. **All data reads use `effectiveUserId`, never `user.id`.**
- `role`, `isAdmin`, `isOwner`, `hasAdminAccess`, `adminTabs`.
- `loggedInsert` / `loggedDelete` — audited variants used inside impersonation flows.

---

## 5. Three surfaces, one codebase

| Surface | Routes | Access gate |
|---|---|---|
| **Athlete app** | `/today`, `/calendar`, `/log`, `/recovery`, `/for-you`, `/my-coach` | Any logged-in user |
| **Coach Portal** | `/coach/dashboard`, `/coach/builder`, `/coach/clients`, `/coach/programs`, `/coach/messages`, `/coach/analytics`, `/coach/library` | `role === 'coach'` or admin (else redirect to `/today`) |
| **Admin Portal** | `/admin#seed`, `#video`, `#tts`, `#spend`, `#health`, `#access`, … | `is_admin` (owner) or granted partner permission |

The Admin Portal is a single page (`app/admin/page.tsx`) with hash-based tab routing; tab components
live in `components/admin/`. It stays private at App Store / Play submission.

---

## 6. The AI Plan Engine (APIE)

`app/api/generate-plan/route.ts` runs a multi-agent RAG pipeline. Retrieve knowledge, then pass a
draft through specialist **Claude** agents, each rewriting its own slice. Any agent failure is
**non-fatal** — the plan still returns.

```
RAG retrieval (OpenAI embeddings → pgvector match_knowledge, 784-item store)
  → S&C Agent          drafts the 7-day plan
  → PT / Rehab Agent   safety pass; swaps contraindicated moves; has veto
  → Sports Specialist  rewrites warmup + coaching to the sport
  → Mobility Agent     owns morning / cooldown / evening blocks
  → Mindset Agent      warrior-philosophy layer
  → Recovery Agent     rest-day programming
  → training_programs  (Postgres)
```

Supporting library: `lib/knowledge-retrieval.ts` (`retrieveKnowledge()` + `formatKnowledgeContext()`,
`text-embedding-3-small`, `match_knowledge` RPC). Every agent call is metered (§9).

---

## 7. Coached Mode

When a coach takes on an athlete, the coach's program **takes over** the athlete's app (the AI plan
pauses). The handoff is explicit and reversible.

```
Coach builds (manual or AI)  → coach_programs + coach_program_weeks
  → Assign                    → coach_program_assignments (status: pending) + push prompt
  → Athlete activates         → status: active
  → CoachedContext            → serves the program app-wide (calendar takeover)
  → Athlete logs              → workout_logs + coach_day_completions
```

Layered on top: real-time **messaging** (Supabase Realtime, `coach_messages`), per-client **notes**
(`coach_client_notes`), compliance **analytics** (`/api/coach/analytics`), coach-side **in-person
session logging**, and optional **voice cloning** (ElevenLabs → `coach_voices`, cached per exercise in
`coach_exercise_audio`). Pausing coaching resurfaces the athlete's AI plan; nothing is lost. Key files:
`contexts/CoachedContext.tsx`, `components/CoachedSessionCard.tsx`, `app/api/coach/my-program/route.ts`.

---

## 8. The content engine

Preloads the exercise library so any athlete worldwide gets a zero-lag plan. One admin tool feeds two
downstream pipelines — text by **Claude**, then voice by **OpenAI** and video by curation.

```
Library Builder (Claude)  → exercise_library (name, how, breathing, core, tip; dedup by name_normalized)
                             ├→ Video Curation (Claude scores YouTube clips from approved_yt_channels)
                             └→ TTS voicing (OpenAI onyx + nova) → Supabase Storage (exercise-tts) → CDN
```

Files: `app/api/admin/seed-library/route.ts`, `components/admin/LibrarySeedTab.tsx`,
`app/api/admin/generate-tts/route.ts`, `components/admin/VideoCurationTab.tsx`.

Cost guards:
- **Saturation memory** — Library Builder remembers categories that yield 0 new exercises and skips
  them on re-runs with zero token cost (localStorage, per count).
- **Hands-free voicing loop** — "Voice All Missing Audio" loops the TTS route (batches of 20, 8-wide)
  until the backlog is empty; resumes wherever it left off.
- **Staleness-based upgrade** — the "Upgrade seeded" pass finds not-yet-upgraded rows by `updated_at`
  and retries skipped ones, so it converges to done and never re-charges finished rows.

---

## 9. Cost tracking

Every route that spends on an AI provider logs the exact dollar cost. Providers bill differently, so
each route computes its own cost; the Spend Tracker sums the stored dollar figures.

```
Any AI route  → lib/ai-costs.ts (per-provider pricing → exact $)  → logTokens() (service-role insert)
              → token_usage (operation, api_route, input/output, estimated_cost_usd, metadata.provider)
              → Spend Tracker (components/admin/SpendTab.tsx) sums estimated_cost_usd, badges by provider
```

| Service | Provider | Billed by | Rate |
|---|---|---|---|
| Plan gen · curation · Library Builder | Claude | input + output tokens | $3 / $15 per 1M |
| Read-aloud voices (TTS) | OpenAI | characters | $15 / 1M chars |
| Knowledge search (embeddings) | OpenAI | tokens | $0.02 / 1M |
| Voice-note transcription (Whisper) | OpenAI | audio minutes | $0.006 / min |
| Coach voice cloning | ElevenLabs | characters | gated |

**Rule:** every AI route must call `logTokens()` from `lib/log-tokens.ts`. Pricing lives in one place
(`lib/ai-costs.ts`) — update a rate there when a provider changes pricing.

---

## 10. The database, by domain

One Postgres database, ~40 tables, all with RLS. Schema changes ship as timestamped SQL migrations in
`supabase/migrations/` (applied by hand in the Supabase SQL editor).

| Domain | Tables |
|---|---|
| **Identity & access** | `profiles`, `promo_codes`, `admin_permissions`, impersonation log |
| **Plans & programs** | `training_programs`, `user_imported_programs`, `user_imported_program_weeks`, `plan_conversion_requests` |
| **Exercises & media** | `exercise_library`, `exercise_media`, `exercise_video_candidates`, `approved_yt_channels`, `exercise_set_logs` |
| **Coaching** | `coach_programs`, `coach_program_weeks`, `coach_program_assignments`, `coach_clients`, `coach_invite_codes`, `coach_messages`, `coach_client_notes`, `coach_exercise_library`, `coach_day_completions`, `coach_pending_clients`, `coach_voices`, `coach_exercise_audio` |
| **Knowledge & study** | `knowledge_items` (pgvector), `study_kbs`, `study_entries` |
| **Tracking** | `workout_logs`, `day_completions`, `streaks`, recovery |
| **Money & ops** | `token_usage`, `project_expenses`, `bug_reports`, `account_deletion_feedback` |

---

## 11. External services

| Provider | Used for | Notes |
|---|---|---|
| **Anthropic (Claude)** | Plan agents, coaching cues, video scoring, study material | Models: Haiku 4.5 / Sonnet 4.6 (app default) / Opus 4.8 |
| **OpenAI** | Read-aloud voices, knowledge embeddings, voice-note transcription | `tts-1`, `text-embedding-3-small`, `whisper-1` |
| **ElevenLabs** | Coach voice cloning (premium) | Flag-gated (`COACH_VOICE_CLONING`) + `ELEVENLABS_API_KEY` |
| **Stripe + RevenueCat** | Subscriptions — web via Stripe, iOS via RevenueCat | **Not live** (`BILLING_LIVE = false`); iOS requires RevenueCat |
| **YouTube Data API** | Sourcing demo clips for curation | Quota-limited |
| **Web Push (VAPID)** | Notifications (assignments, coach nudges) | `/api/notifications/*` |

**Billing status:** wired but off. `BILLING_LIVE` in `lib/flags.ts` is the single go-live switch;
flipping it turns on every billing-gated feature at once.

---

## 12. Security model

| Guardrail | What it does |
|---|---|
| **Row-Level Security** | Postgres enforces per-row ownership on every table; the browser anon key can't read another user's data. |
| **Service-role split** | Trusted writes happen only inside API routes after JWT verification; the secret key never reaches the browser. |
| **`protect_admin_role` trigger** | Blocks any update that would change an admin's role away from admin — even the coach-signup flow can't demote an admin. |
| **`SECURITY DEFINER` functions** | Cross-role reads go through controlled functions instead of recursive RLS policies (which once caused an admin lockout). |
| **`admin_permissions`** | Partner admins get scoped, per-section grants; they are not `is_admin` and can't see owner-only data. |
| **Impersonation audit** | Every admin Zoom-In action is written to an audit trail; the real actor is always recorded (`lib/impersonation-logger.ts`). |
| **Verified writes** | Money / critical-state writes read the row back and assert it persisted. A rejected or mismatched write logs a loud `[VERIFY_FAIL]` + a `harness_events` row and throws — instead of failing silently (`lib/verified-write.ts`). This exists because a cost-logging write silently failed for months. |
| **Telemetry (`harness_events`)** | The app's own safety checks (`verify_fail`, `route_error`, `migration_drift`, `smoke_fail`/`smoke_run`) are recorded and surfaced in Admin → Telemetry with severity badges. Thrown route errors are additionally forwarded to Sentry when a `SENTRY_DSN` is configured (`lib/observability.ts`, `withHarness()`); it no-ops cleanly without one. |

---

## 13. Deploy & ops

```
git push (master)  →  Vercel build (auto, type-checked, Turbopack)  →  atlasprime.app
```

- **`master` is production** — no staging environment yet. A staging setup is documented in
  `docs/harness-staging.md` and deliberately deferred until post-launch (its real value is protecting
  real user data from a bad migration); the harness tooling degrades gracefully without it.
- **Database changes are manual but tracked.** SQL migrations are run by hand in the Supabase SQL
  editor — and each migration self-registers in the `applied_migrations` ledger when it runs. The
  Admin → Telemetry **Migrations panel** (and `npm run migration-drift`) flags any file you forgot to
  run, so a missed migration can't hide. Safe dry-run order is in `docs/harness-migrations.md`.
- **Secrets** (API keys, service-role key) live only in Vercel environment variables, never in the repo.
- **Verify deploys** via `gh api repos/Willdes1/movement-app/commits/<sha>/status` — the Vercel webhook
  occasionally drops; an empty commit re-fires it.
- **Smoke-test critical paths** after a deploy: `npm run smoke-test` (or the ▶ button in Admin →
  Telemetry) exercises db/auth/ledger + a real `token_usage` verified write→read-back→cleanup and the
  auth gates, asserting DB side effects. Failures log a `smoke_fail` event. See `docs/harness-smoke.md`.
- **Monitoring** is watched from the Admin Portal: **Telemetry** (`#telemetry` — harness events,
  migration drift, last smoke run) plus **Health** (`#health`) and **Spend** (`#spend`).

### The harness (verification → monitoring → tracking → testing)
A four-layer safety net added because a silent write bug hid for months:
1. **Verify** — `lib/verified-write.ts` reads every money/state write back and throws loudly on mismatch.
2. **Monitor** — `harness_events` + the Telemetry tab + optional Sentry (`lib/observability.ts`).
3. **Track** — the `applied_migrations` ledger + drift check catch a forgotten migration.
4. **Test** — `/api/admin/smoke-test` exercises the critical paths and asserts real DB effects.

---

_This is a living map. When the backend changes, update this file and `docs/architecture.html` with it._
