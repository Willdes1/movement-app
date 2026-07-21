# Agent Context — Atlas Prime
> Full briefing for a new agent to continue this project without any prior conversation history.
> Last updated: 2026-07-15 | Current branch: master | 395 commits

---

## 1. Project Overview

**What it is:** A Next.js 16 fitness app called **Atlas Prime** (brand: Atlas Prime Performance; parent: Atlas Prime Labs LLC). Currently deployed at Vercel, connected to Supabase. Hobby plan on both.

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Supabase (Postgres + Storage + Realtime + Auth), OpenAI API (TTS + AI features), Anthropic Claude API (APIE agents, program generation, video curation), Stripe (web subscriptions — iOS needs RevenueCat).

**Working directory:** `C:\Dev\movement-app`
**GitHub repo:** `https://github.com/Willdes1/movement-app`
**Vercel auto-deploys:** Every `git push` to master triggers a Vercel production build.

**User:** Will (email: dentalseowill@gmail.com). Non-technical but moves fast. Needs things explained simply. Loves dopamine from progress — always update the Launchpad when features are marked done.

---

## 2. Critical Rules (Never Break These)

- **After every code change: commit and push.** Vercel deploys on push. User cannot see changes until pushed.
- **API keys NEVER in chat.** Go directly to Vercel env vars.
- **GitHub PAT (Willdes1)** is in user's 1Will Gonzalez Google Drive.
- **Password questions:** Tell user it's in their Google Drive — don't give instructions for creating a new one.
- **Every feature must serve the Apple/Google App Store launch goal.** Deprioritize anything that doesn't move the launch needle.
- **Update git-stats at session close:** Run `node scripts/git-stats.js` then commit `lib/git-stats.json`.
- **Launchpad:** Always mark items done in `components/admin/LaunchpadTab.tsx` and commit when a feature ships.
- **Supabase joined relations always return as arrays.** Cast as `Type[]` and use `[0]` index. Use `unknown` as intermediate cast: `(data.field as unknown as Type[] | null)?.[0]`.
- **Vercel Hobby timeout:** Serverless functions max 60s (`export const maxDuration = 60`). For batch work, process in parallel chunks (4 at a time) to stay within limits.

---

## 3. App Architecture

### User Roles
- `admin` — full access, admin portal at `/admin`
- `coach` — coach portal at `/coach/*`
- `beta` / `ff` / `free` — regular app users

### Key Routes
| Path | What it is |
|------|-----------|
| `/today` | Daily workout calendar (main user home) |
| `/for-you` | AI mindset feed |
| `/exercises` | Exercise library |
| `/log` | Workout history |
| `/recovery` | Recovery tracking |
| `/my-coach` | Client-facing coach portal (program + messages) |
| `/account` | User account + coach code entry |
| `/coach/dashboard` | Coach home |
| `/coach/programs` | Program management |
| `/coach/clients` | Client roster |
| `/coach/builder` | AI program builder |
| `/coach/analytics` | Per-client workout compliance |
| `/coach/messages` | Coach ↔ client messaging |
| `/admin` | Admin portal (hash-based tabs) |

### Key Tables (Supabase)
| Table | Purpose |
|-------|---------|
| `profiles` | User profile (name, role, training_level, sports, is_admin) |
| `exercise_library` | 752 exercises with coaching cues, TTS URLs, video URLs |
| `exercise_media` | Manual media overrides (youtube_url, image_url, notes) |
| `exercise_video_candidates` | AI-proposed YouTube videos awaiting review |
| `approved_yt_channels` | Whitelisted YouTube channels for video curation |
| `coach_programs` | Programs created by coaches |
| `coach_program_weeks` | Week structure (days JSON) per program |
| `coach_program_assignments` | Which client is on which program (coach_id, client_id, status) |
| `coach_clients` | Coach ↔ client roster (coach_id, client_id, status) |
| `coach_invite_codes` | Invite codes coaches generate; clients enter in Account |
| `coach_messages` | Real-time messages between coach and client |
| `workout_logs` | User workout completion logs (user_id, logged_at) |
| `knowledge_items` | APIE vector knowledge store (pgvector) |
| `token_usage` | Claude API cost tracking |

### Key Files
| File | Purpose |
|------|---------|
| `app/admin/page.tsx` | Admin portal — all tabs inline (MediaLibraryTab, etc.) |
| `components/admin/LaunchpadTab.tsx` | **Launchpad** — tracks readiness percentages |
| `components/admin/VideoCurationTab.tsx` | Video curation UI |
| `components/admin/TTSCurationTab.tsx` | TTS audio library browser + generate |
| `components/admin/APIETab.tsx` | APIE AI agent UI |
| `components/coach/OnboardingOverlay.tsx` | First-time coach setup wizard |
| `components/ui/MobileMenu.tsx` | Mobile nav drawer (clients) |
| `app/coach/layout.tsx` | Coach portal sidebar + mobile nav |
| `app/coach/messages/page.tsx` | Coach messaging page |
| `app/my-coach/page.tsx` | Client-facing program + messages |
| `app/api/coach/analytics/route.ts` | Per-client workout stats API |
| `app/api/coach/my-program/route.ts` | Client's assigned program API |
| `app/api/coach/redeem-invite/route.ts` | Redeem coach invite code |
| `app/api/admin/curate-videos/route.ts` | AI video curation pipeline |
| `app/api/admin/generate-tts/route.ts` | Batch TTS generation |
| `app/api/tts/route.ts` | Real-time TTS + auto-save |
| `lib/git-stats.json` | Git activity stats (updated at session close) |
| `scripts/git-stats.js` | Generates git-stats.json |

---

## 4. What Was Built This Session (2026-07-20 → 07-21)

**SEO launch + a full self-running Content Engine (Phase 1 of the Marketing Hub).
Everything deployed green. Two migrations RUN by Will (content_posts +
content_scheduling); CRON_SECRET added to Vercel + redeployed so the auto-pilot cron
is armed.**

### 🔍 SEO launch — the marketing site is now findable
- Homepage metadata (keyword-worked title/description/canonical/keywords/OG/Twitter in
  `app/layout.tsx`, since `/` is a client component). Code-generated 1200x630 branded
  share card `app/opengraph-image.tsx` (+ `twitter-image.tsx` re-export) — confirmed
  rendering in the FB debugger. `app/sitemap.ts` + `app/robots.ts`. FAQ section + FAQPage
  JSON-LD on the landing page. **Google Search Console** auto-verified via the Workspace
  domain + sitemap submitted; **Bing** imported. Verified with will@atlasprime.app.
- Reality check with Will: "Atlas Prime" the search term is owned by the Warframe game.
  We do NOT fight for the brand term; we win non-branded intent (AI workout plan, coaching
  software) via content. That reframed the whole content strategy.

### ✍️ Content Engine — public blog at /blog (Phase 1 of TODO #6)
- Admin **Marketing** tab (`components/admin/MarketingTab.tsx`) replaces the old
  placeholder. **One-click generation:** pick a category (coach-software / recovery-rehab /
  ai-training / sport-specific), hit generate; the engine picks a fresh, unpublished topic
  (dupe-guarded), writes an expert, human-voiced, no-em-dash article grounded in the APIE
  knowledge store, and hands back a draft. Optional topic/angle steering tucked away.
- Public `/blog` (index) + `/blog/[slug]` with generateMetadata + Article JSON-LD;
  `components/blog/BlogShell.tsx` (landing palette). Zero-dep markdown renderer
  (`lib/markdown.ts`). Server reads env-guarded (`lib/content.ts`). App chrome hidden on
  /blog; posts auto-added to the sitemap. SQL: `20260720_content_posts` (RLS: public reads
  published only).

### 🚀 Content Auto-pilot — scheduled drip + auto-draft
- Lifecycle: draft → **ready** (approved, in drip queue) → published. Daily cron
  `app/api/cron/content` (CRON_SECRET-guarded; in `vercel.json` at `0 9 * * *`): publishes
  due `scheduled_for` pins, drips the oldest ready post on configured publish days (default
  **Tue+Fri**), and auto-generates ≤1 draft/run to keep the buffer at `queue_target`.
  `lib/content-generate.ts` = shared generation (admin route + cron). `content_settings`
  table + `/api/admin/content/settings`. MarketingTab has Approve-to-queue, a drip-queue
  view, and an Auto-pilot settings panel (toggle, publish days, buffer size). SQL:
  `20260721_content_scheduling`. Decisions with Will: drip queue + keep the human approval
  gate + 2/week (Tue+Fri). Rationale: "no one really reads blogs, this is for SEO" → minimize
  his effort, one button, approve if he likes it.

### 🧾 Also
- Added Will's 8-item batch to TODO.md (Added 2026-07-20): admin education KB, massage-gun
  tab, Claude-as-sales-coach, slide-by-slide onboarding, anytime AI profile optimizer, the
  Marketing/Lead hub (#6), per-subsection audio controls, wearable integration.
- `to-do/marketing-hub.md` = phased spec for the rest of #6 (lead investigation, AI outreach,
  ads). Memory: [[project_content_engine]], [[reference_business_email]] (use
  will@atlasprime.app for all business accounts).

### ▶️ NEXT for the Content Engine / launch
- Watch the first auto-pilot cron run (fires ~9am UTC daily); approve the first drafts into
  the queue. Optional Phase-1 follow-ups in `to-do/marketing-hub.md`: per-article OG images,
  programmatic SEO from the 750+ exercise library, internal linking.
- Then either **Coach Billing Stage B** (run coach_usage migration → Stripe products → flip
  BILLING_LIVE → enforcement gates) or **Marketing Hub Phase 2** (Lead Investigation).

---

## Previous Session (2026-07-15)

**Big product + growth night: Product Telemetry, a Video Curation fix, Coach billing
foundation, self-serve coach signup, and a full public MARKETING LANDING PAGE now live
at atlasprime.app. All deployed green. Copy rule adopted: NO EM DASHES anywhere in site
copy or in replies to Will.**

### 🏠 Marketing landing page — LIVE at atlasprime.app (the headline win)
- `atlasprime.app` (`/`) now shows a real marketing homepage to LOGGED-OUT visitors;
  logged-in users still go straight to `/today`. Went through 3 rounds: Titan/Heavens
  (too classical) → merged two-path version → **final "KINETIC"** direction, which Will
  loved ("super fire", design friends approved). `components/landing/LandingPage.tsx`
  (namespaced under `.aplp`, injected via dangerouslySetInnerHTML, canvas EKG pulse +
  pricing toggle + reveal wired in useEffect). Built from the REAL app palette (near-black
  `#0c0c0f` + orange-red `#FF5C35` + emerald `#2ECC8F`, blue `#4E9FFF` trust cue for the
  coach side) so site and app feel like one product. Split For Athletes / For Coaches,
  product mockups, Option-A toggle pricing, SEO hooks (JSON-LD + hidden summary), login →
  `/auth`. **Grounded in real color research** (subagent, cited): dark+one-accent formula,
  single-stat hero, high-contrast CTA, no heavy video, black=premium (Wang 2022),
  blue=trust (Su 2019). Debunked myths ("90% color", "80% recognition", HubSpot red+21%).
  **Reversible:** `LANDING_LIVE` in `lib/flags.ts` (false = revert to sign-in-first).
  **Logo swappable:** search `LOGO SWAP` in LandingPage.tsx (nav + footer marks). Mobile
  hardened to ~320px. `app/page.tsx` + AppMain/Sidebar/MobileMenu/BottomNav hide chrome on `/`.

### 💳 Coach billing — STAGE A (foundation, not yet live)
- `lib/coach-plans.ts` (Free/Starter $19/Growth $49/Pro $99 — credits + message caps,
  editable), `lib/coach-usage.ts` + `coach_usage` migration (monthly counters), `/coach/billing`
  page (plan + live usage meters + tier cards → existing Stripe checkout/portal), nav added.
  `lib/platform.ts` `isNativeApp()` seam (web=Stripe now, iOS=IAP later). Gated on
  `BILLING_LIVE` (still false). Model chosen with Will: credits + overages, hard-cap +
  upgrade prompt (overage auto-billing = Phase 2). **PENDING (Will's to-do):** run
  `coach_usage` migration, create 3 Stripe products → price IDs in Vercel, then flip
  BILLING_LIVE + build STAGE B (enforcement gates on generate-program/voice/messaging).
- **Athlete pricing DRAFTED (Will: "sweet spot, keep it"):** Free (3 AI programs) +
  Prime $12.99/mo or $89/yr. Idea captured: Founder annual $69 for first 100. Free trials
  for both apps = brainstorm later with Stripe.

### 📊 Product Telemetry + conversion funnel
- `product_events` table + `lib/track.ts` + `<ProductTracker>` (auto page_view) + `/api/track`
  ingest + `/api/admin/product-events`. Telemetry tab gained a **System | Product** toggle
  (`components/admin/ProductTelemetry.tsx`: KPIs, top pages, conversion events, 7-day bars,
  recent stream). Wired explicit `trackEvent()` on the funnel: signup/coach_signup,
  generate_plan_click, plan_generated, coach_ai_program_generated, coach_program_created,
  coach_client_invited, program_activated, workout_complete. Billing events deferred to Stripe.

### 🎬 Video Curation — lane partition fix
- Full Library Backlog counted ALL un-proposed exercises incl. Library-Builder-seeded ones →
  double-counted + a Library Builder run "deducted from backlog". Now backlog EXCLUDES
  program-lane exercises (client count + server `lane:'backlog'`); program-lane badges show
  needs-curation-now (drops when you Run). Clean partition, consistent counts.

### 🔑 Self-serve coach signup
- Added an **"I'm an athlete / I'm a coach" toggle** to the `/auth` signup (flips the existing
  `asCoach` state → role=coach for email + Google/Apple). No `/coaches` URL needed. Part 2
  (coach also gets athlete app: Back-to-Training, self-assign, AI generate) already existed.

### 🧾 Also
- Spend Tracker: AI-ops table now sorts freshest-first + paginated scroll (was sorted by cost).
- Confirmed Fable 5 NOT free (promo ended ~Jun 22) + costs 2× Opus 4.8 → stay on Opus 4.8.
- **NEXT for landing: SEO** once copy locked — see `to-do/seo-launch.md`.

---

## Previous Session (2026-07-08)

**Harness Engineering — ALL 4 STAGES COMPLETE + each verified green — plus a Spend
Tracker sort fix. ~7 commits, all deployed green. Migrations `20260707_harness_events`
+ `20260708_applied_migrations` RUN by Will; the two long-pending 07-07 migrations
(`receipts_bucket` + `token_usage_grants`) ALSO RUN → ledger shows 33/33. Only the
"After all stages" wrap-up remains: update `ARCHITECTURE.md` (Deploy/Ops + Security)
+ a one-paragraph coverage summary.**

### 🔧 Harness Stage 2 — Production error + event monitoring (verified)
- `harness_events` table (`20260707_harness_events.sql`, RUN). `lib/observability.ts` —
  DSN-gated **Sentry forwarder** (no-ops without `SENTRY_DSN`) + `withHarness()` route
  wrapper → Sentry + `logHarnessEvent('route_error')`. New **Telemetry admin tab**
  (`/admin#telemetry`, Dev Tools): severity badges, Sentry-status chip, 🔥 Fire-test-error
  button. Verified: fired test error → `route_error` row appeared. Sentry chip reads
  "not configured" until Will adds a DSN; full `@sentry/nextjs` client+edge deferred until
  then. `withHarness` proven on the test route only — NOT yet retrofitted across all routes.

### 🔧 Harness Stage 3 — Migration ledger + drift check (verified)
- `applied_migrations` ledger (`20260708_applied_migrations.sql`, RUN → 33/33). Every
  migration self-registers on run (guarded `DO $$…undefined_table…$$` block).
  `scripts/migration-drift.js` (fs vs ledger; `--staging/--backfill/--record/--json`; needs
  `SUPABASE_SERVICE_ROLE_KEY`, which is NOT in `.env.local`). Build-time
  `lib/migrations-manifest.json` (prebuild) powers a live **Migrations panel** in the
  Telemetry tab + `/api/admin/migration-drift`. Backfill intentionally excluded the 2
  then-pending files → panel correctly showed "2 pending"; Will ran both → 33/33. Docs:
  `docs/harness-staging.md` + `docs/harness-migrations.md`. **STAGING DEFERRED** (Will's
  call): revisit post-launch, or if smoke tests want a non-prod target. Proactively
  recommend it when it's genuinely needed.

### 🔧 Harness Stage 4 — Smoke tests (verified)
- Server-side `/api/admin/smoke-test` runs 7 checks reusing the REAL helpers: db
  connectivity, auth identity, `harness_events` present, `migration_ledger` drift,
  **`token_usage` verifiedInsert write→read-back→cleanup** (the money path — self-cleaning,
  no cost), + 2 auth-gate 401 checks. Logs `smoke_run` (pass) / `smoke_fail` (fail) →
  persistent last-run in the tab. `scripts/smoke-test.js` CLI (post-deploy via `CRON_SECRET`).
  Smoke panel + last-run in Telemetry. Docs `docs/harness-smoke.md`. **Bug caught + fixed
  same session:** gate checks first fetched `VERCEL_URL` (behind Vercel Deployment Protection
  → a 200 interstitial masked the real 401 = false failure). Confirmed via `curl` both routes
  401 correctly; fixed to hit the canonical domain (`SMOKE_BASE_URL` override for staging).
  `generate-plan` E2E intentionally NOT run against prod (token spend + real `training_programs`
  writes) — deferred to staging; suite verifies its dependencies instead.

### 💰 Spend Tracker — freshest-first sort + paginated scroll (f572226)
- The AI Token Costs "By Operation" table sorted by cost, so date ranges looked scrambled.
  Now sorts by most-recent activity (maxDate desc; null dates sink; ties break by cost then
  name). Rows live in a 520px scroll window that loads 50 more as you near the bottom.

### 📎 Non-code
- Confirmed **Fable 5 is NOT free** in Claude Code (promo ended ~June 22) and costs **2× Opus
  4.8** — so stay on Opus 4.8 (already the session model). The **full 4-stage Harness spec was
  saved VERBATIM to memory** so it's never lost again.

---

## Previous Session (2026-07-03 → 07-07)

**Big content-ops + reliability + monetization night — ~20 commits, all deployed
green. Two NEW SQL migrations created (see ⚠️ PENDING below — NOT yet run by Will).**

### 🔊 Library Builder / TTS content engine hardening
- **Auto-generate audio** (79cb6c6): toggle on the Library Builder — every newly-seeded
  exercise is handed straight to the TTS route (OpenAI onyx+nova) as it's added, chunked
  under the 60s wall. One "Fill Every Category" run now preloads text + video-queue + voice.
- **"Voice the backlog"** (2a31c9c): hands-free loop button that voices ALL rows missing
  audio (auto-audio only covers new rows). Resilient loop w/ retry.
- **Fill saturation guard** (fc1a0be): remembers categories that yield 0 new (localStorage,
  per count) and skips them on re-runs with ZERO token cost. "Reset & re-check all" link.
- **Upgrade rebuilt** (c9514ff → 5e0da2d): real N/total progress + resume + a ✓ done state;
  selects the STALEST not-yet-upgraded rows by `updated_at` (stamps updated_at on write, no
  trigger on the table) and retries skips → always converges to 1,064, never re-charges done
  rows. "Re-run from scratch" hidden once complete (2e6e55d) to prevent accidental re-charge.
- **TTS 504 fix** (8f92338): the round is now TIME-BUDGETED (process 6-wide, stop launching
  chunks past 38s) instead of a fixed batch — can't 504 no matter how slow calls get. OpenAI
  call + previously-unbounded Supabase upload both timeout-bounded. Backlog loop retries
  transient failures instead of stranding.

### 💰 Cost tracking (Spend Tracker) — big fixes
- **logTokens fixed** (18de56b): was writing with the anon key to an RLS-locked table + a
  non-existent `route` column → every server-side AI cost silently 400'd for months. Now
  service-role key + real column `api_route`.
- **OpenAI spend tracking** (196d504): `lib/ai-costs.ts` — per-provider pricing (TTS per-char,
  embeddings per-token, Whisper per-minute); SpendTab sums stored `estimated_cost_usd` +
  provider badges (Claude purple / OpenAI green).
- **Spend Tracker resilience** (a70f3c2): Stage-1 verified `.insert().select()` broke on
  token_usage (service_role has INSERT but not SELECT → RETURNING fails). `verifiedInsert`
  now FALLS BACK to a plain insert (cause-agnostic, can't double-write). ⚠️ optional migration
  `20260707_token_usage_grants.sql` restores full read-back.
- **Receipts + tax features** (6e127d9, 3d15a41): receipt upload was the ONLY client-side
  upload (failed on storage RLS, swallowed) + there was no `receipts` bucket. Now server-side
  `/api/admin/upload-receipt` (service role) + ⚠️ migration `20260707_receipts_bucket.sql`.
  Added: **Edit** button on expenses (fix date / attach receipt without re-logging), **📦 Tax
  Package** zip (JSZip: CSV + all receipt files, cross-referenced), AI-cost **date ranges**
  (fetch created_at resiliently), **fmtDate timezone fix** (date-only was a day early),
  **↻ Refresh** button. NOTE: receipts logged before this were never stored — re-upload needed.

### 📋 Coach acquisition — /coaches QR signup (cf9e2e0)
- `atlasprime.app/coaches` → coach-branded signup, auto `role=coach`, lands in Coach Portal.
  The **coach business-card QR** target (athlete QR = root domain). Admin Promos dropdown gains
  a "Coach" option. Decided pricing (memory `coach-pricing-tiers`): 5 free AI programs, then
  monthly tiers with included AI credits + overage charges. Signup differentiates profile type.

### 🗺️ System Architecture docs (2a3d08b, 402f765)
- `ARCHITECTURE.md` (dev) + `docs/architecture.html` (visual) + **Admin → Dev Tools → 🗺️
  Architecture** tab (native React port). Full data-flow map. "Living map" — keep the three in sync.

### 🔧 Harness Engineering — STAGE 1 DONE (2810f28) — user-driven staged spec
- Read-after-write verification on money/state writes. `lib/verified-write.ts`
  (verifiedInsert/Update/Upsert — write, read back, assert; loud [VERIFY_FAIL] + harness_events
  + throw on failure) + `lib/harness-events.ts` (logHarnessEvent, safe before the Stage-2 table
  exists). Retrofitted: logTokens (loud-but-contained), activate/pause-assignment, log-session.
  `/api/admin/harness-selftest` + a "Run harness self-test" button on the Architecture tab.
- **Stages 2–4 NOT started** (paused for confirmation per the spec). Stage 2 = `harness_events`
  migration + Sentry + a **Telemetry tab**; Stage 3 = staging DB + migration drift; Stage 4 =
  smoke tests. Full spec was pasted by Will — re-request it before starting Stage 2.

### ⚠️ PENDING SQL MIGRATIONS (Will runs by hand — surface immediately next session)
1. `supabase/migrations/20260707_receipts_bucket.sql` — **REQUIRED** before receipts upload
   (creates/ensures a public `receipts` storage bucket).
2. `supabase/migrations/20260707_token_usage_grants.sql` — **OPTIONAL** (GRANT SELECT on
   token_usage to service_role) — restores full read-back verification; Spend Tracker already
   works via the fallback without it.

---

## Previous Session (2026-07-02)

**Polish + content-engine night — desktop layout overhaul, a from-scratch Library
Builder content engine, name-emoji personalization, and YouTube quota reply prep.
~11 commits, all deployed green. No new SQL migrations.**

### 🖥️ Desktop "fill the screen" pass (b2876c7 → 61c0ffc)
- Athlete tabs were capped narrow + centered (For You at 480px) — floating in the
  middle on desktop; coach portal jammed left. Fixed app-wide: `.page-content`
  860→1200; For You → 2-column feed grid; coach pages centered at 1280; My Coach /
  Nutrition / Account / Profile widened to 1200. **Mobile untouched (all changes ≥768px).**
- **Coached Calendar rebuilt** (`components/CoachedCalendar.tsx`) — was an abstract
  week/day picker (480px, floated, overflowed mobile). Now a real month grid mapping
  the coach program onto actual dates, using the SAME visual language as the AI-plan
  calendar so switching off a coach → AI plan is seamless. Mobile cutoff fixed.
- Memory: [[feedback_desktop_fill_screen]].

### 😀 Profile-name emoji everywhere (4c50315)
- Greetings used `name.split(' ')[0]`, dropping any emoji ("Wheel 💪" → "Wheel"). New
  `lib/name.ts` (`displayName` keeps first name + emoji, `avatarInitials` strips emoji)
  wired into account greeting, Home greeting, sidebar, mobile menu. Added a preloaded
  emoji picker to the profile name field (tap to add/remove flair).

### 🏗️ Library Builder — content pre-load engine (2bb6f6b → 1028d59)
- New admin tab **Content → 🏗️ Library Builder** (`#seed`). Generates real exercises
  WITH instructions for any sport/category via Claude, dedups against exercise_library,
  inserts new rows → they flow into the Video Curator (video_url null) + TTS (how set).
  Preloads the library so any athlete worldwide gets a zero-lag plan + keeps the YouTube
  curator fed during the quota review. **No migration.**
- Files: `app/api/admin/seed-library/route.ts`, `components/admin/LibrarySeedTab.tsx`.
- Modes: single Generate · **🌍 Fill Every Category** (loops ~70 sports+focuses,
  dedup-aware, progress+stop) · **⬆️ Upgrade seeded instructions** (regenerates cues on
  existing seeds with a better model, nulls stale TTS to re-sync audio, cursor-paginated;
  leaves video_url untouched). Models: Haiku/Sonnet(default)/Opus; VOICE section = human
  coach tone. Collapsed ~50 `seed:*` curation lanes into ONE "Library Builder" lane.
  Fixed missing NAV_GROUPS sidebar entry + derived hash-routing valid list from NAV_GROUPS
  so `#seed` (and any future tab) persists on refresh. Memory: [[project-library-builder]],
  [[feedback_human_voice_content]].

### 📺 YouTube API quota reply (non-code, prepped)
- Reviewer asked for a screencast of our YouTube API use case (7 BUSINESS days from Jun 24
  → ~Jul 3; not too late). Full Loom script + email draft saved to memory
  [[youtube-quota-reply-prep]] — surfaces on the magic words "give me those instructions
  for the reply." Current pace fits the free 10k/day quota; finishing preserves the queue position.

---

## Previous Session (2026-06-30 → 07-01)

**Marathon session — shipped the Coach Voice Cloning feature, fixed a launch-level
coached-display bug, and completed the entire Coached Mode v2 epic (instructions +
program switching). ~20 commits.**

### 🎙 Coach Voice Cloning (Phase 1) — SQL `20260623_coach_voice_cloning.sql`
- ElevenLabs Instant Voice Cloning. Coach records consent + sample on Dashboard
  (`VoiceCloneCard`) → `voice_id` on `coach_voices`. Coached client's 🔈 synthesizes
  cues in the coach's voice, cached per (coach, exercise) in public `coach-voice-audio`
  bucket + `coach_exercise_audio`. Fallback to default TTS. Gated by `COACH_VOICE_CLONING`
  flag + `ELEVENLABS_API_KEY`. Files: `lib/elevenlabs.ts`, `app/api/coach/voice` + `/voice/speak`.
- ⏳ **Live test still blocked on:** ElevenLabs key in Vercel + a working coached client
  (now unblocked by the display fix below).

### 🐛 Launch-level bug fix — coached programs weren't displaying (commit b2a24da)
- `my-program` selected `coach_programs.description`, a column that DOESN'T EXIST → the
  embed errored → assignment nulled → **`coached` was false for EVERY client**, not just
  self-assign. Removed the bad column. Found via temp debug instrumentation. This had been
  silently breaking the whole coached experience.
- Also fixed `coach_program_assignments_status_check` to allow `replaced` (SQL 20260624).

### 🏗️ Coached Mode v2 — the full epic (spec: `to-do/coached-mode-vision.md`)
- **Calendar takeover:** when coached, `/calendar` shows the coach program (`CoachedCalendar`,
  week/day picker driving the day-agnostic `CoachedSessionCard`); AI plan paused. My Coach in
  desktop nav; AI-plan surfaces hidden while coached.
- **Chunk 1** — standard instructions (how/breathing/core/tip) on coach exercises, free from the
  global library.
- **Chunk 2** — coach instruction editor: structured + custom fields (`CoachInstructionFields`
  shared component), Autofill-free + AI-generate, **import-to-library** + **in-place ✎ Cues**
  editor on the program page. SQL `20260630_coach_exercise_instructions.sql`.
- **Q1 Field Template** — coach chooses which standard fields show + order. SQL
  `20260630_coach_field_template.sql`.
- **Chunk 3** — one-click **self-hiding** bulk instruction curation across all programs
  (`InstructionCuratePanel` atop Video Curation tab; `/api/admin/curate-all-instructions`).
  Also per-program `Generate Instructions` button.
- **Chunk 5a** — athlete-confirmed activation: coach assign → `pending` + push/in-app prompt
  (`CoachAssignmentPrompt`) → athlete taps Activate. SQL `20260630_assignment_pending.sql`.
- **Chunk 5b** — save/resume/restart: `resume_week` stamp, resume (date-shift) vs fresh (Day 1,
  clears completions, keeps logs); "My Coach Programs" switcher on /my-coach. SQL
  `20260630_assignment_resume_week.sql`.
- **Chunk 5c** — pause coaching → AI plan resurfaces; one-active manager (paused programs
  resumable from /my-coach even when on own plan). `/api/coach/pause-assignment`.

### Idea captured (priority)
- `to-do/onboarding-help-knowledge-base.md` — one help-content source → first-use hover hints
  + internal KB + AI "ask the app" chat. Do with onboarding.

---

## Previous Session (2026-06-23)

**Big multi-feature night — 10 commits. Admin tooling + App Store compliance + a full coach feature arc + a security fix. Three SQL migrations created (see ⚠️ in §11).**

### Admin: Study Hub (`c8431e1`) — SQL `20260618_study_hub.sql` (RUN ✅ by Will)
- New admin-only tab (Strategy → 🎓 **Study Hub**) for ISSA CFT cert prep. Multi-KB: each Knowledge Base is a subject container with its own scope prompt layered on APIE; generates original structured study material (concepts/summaries/quizzes/flashcards) grounded in pgvector via `retrieveKnowledge()`; tag/search, mastered status, progress tracking. Server-only, copyright guardrail in the prompt. Tables `study_kbs` / `study_entries`. **New `lib/admin-auth.ts`** — `verifyAdmin(req, tab?)` + `verifyOwner(req)`.

### Admin: Partner permissions (`577b840`, `609d9d3`) — SQL `20260618_admin_permissions.sql` (⚠️ VERIFY RUN — adds `profiles.is_owner`)
- Owner vs partner admins. **Owner** = `profiles.is_owner` (migration sets all existing is_admin → owner). **Partners** are NOT `is_admin`; access driven by `admin_permissions` table (`allowed_tabs`, `active`). AuthContext now exposes `isOwner` / `hasAdminAccess` / `adminTabs`; `/admin` gates on `hasAdminAccess`, owner-gates the all-user `loadAll`, filters NAV by `adminTabs`. Owner-only **Access Control** tab (`#access`) grants/revokes by user + section. Every section is grantable; sensitive ones are flagged ⚠️ (not locked); only `access` stays owner-only. Single source `lib/admin-tabs.ts`. Admin portal stays private at store submission. See memory `project_admin_access`.

### App Store compliance (`2fdb3ad`, `8b98138`) — SQL `20260618_account_deletion.sql` (⚠️ VERIFY RUN)
- Privacy audit: disclosed **OpenAI** as a processor + stamped last-updated.
- **In-app account deletion** (Apple Guideline 5.1.1 — was missing, and the legal docs falsely claimed it existed): "Delete My Account" funnel on `/account` (intent take-a-break vs delete → reason capture → tailored save offer [pause / contact-support / discount placeholder gated by `BILLING_LIVE`] → type-DELETE confirm). `/api/account/delete` is self-only (JWT-derived id), logs an anonymous reason to `account_deletion_feedback`, best-effort wipes data, then `auth.admin.deleteUser`. **Contact Support** form → existing `bug_reports` pipeline (no email exposed). Components in `components/account/`.

### Security (`9bd7e67`)
- Locked down **`/api/notifications/send`** (was unauthenticated — anyone could blast push to all users). Now `verifyAdmin(req, 'push')` + optional `x-cron-secret`. PushTab sends the admin JWT.

### Billing safeguard (`70ccd30`)
- Centralized **`BILLING_LIVE`** into `lib/flags.ts` (one flip at go-live). Full go-live checklist in memory `project_billing_golive` + TODO under the Stripe item.

### Coach feature arc — Library ↔ Builder ↔ Client (`d9a76c5`, `4180e9a`, `bd12a91`) — NO migration
- **Builder:** manual program builder autocomplete now pulls the coach's OWN `coach_exercise_library` first (★ LIBRARY tag, 🎥, sets×reps autofill); per-day **"📚 From Library"** picker (`LibraryPickerModal`, multi-add).
- **Client:** `/api/coach/my-program` resolves the coach's library server-side (RLS-safe) → `coachLibrary` map → `CoachedContext` → **`CoachedSessionCard` prefers the coach's clip + cues per exercise** (★ Coach's demo badge; YouTube→LoopPreview, upload→`<video>`; TTS reads coach cues).
- **Polish:** `/my-coach` full-program view shows a ★ Coach badge on coach-demo'd exercises.

### Non-code (launch paperwork — all unblocked now)
- **D-U-N-S requested AND received** (the 9-digit "Resolution DUNS" is the number). **Mercury virtual card created.** Next paperwork: Google Play **org** account ($25, needs D-U-N-S) + Apple Developer enrollment ($99/yr, needs D-U-N-S + Mercury card + business email). Tip: enroll with the **existing personal Apple ID** (creating a new one hit a phone-verify block). `support@atlasprime.app` = free Workspace alias when wanted.

### New idea captured → **next session's build**
- `to-do/coach-voice-cloning.md` — clone the coach's voice (ElevenLabs) so exercise narration plays in the coach's own voice ("your coach in your ear, every rep"). Premium coach upsell. Will explicitly chose this as the next build.

---

## Previous Session (2026-06-12)

**Launch infrastructure day — domain migration complete. No feature code; one Launchpad commit.**

### Custom Domain Live — atlasprime.app → Vercel
- **Vercel:** `atlasprime.app` added to movement-app project as primary (apex, connected to Production). `www.atlasprime.app`, `atlasprime.fit`, `atlasprime.health` (+ www variants) all added as **308 Permanent Redirects** → atlasprime.app. Old `movement-app-three.vercel.app` also 308-redirects now.
- **DNS values (Vercel's NEW IP range — not the old 76.76.21.21):** A record `@` → `216.198.79.1`; CNAME `www` → per-project value shown in Vercel domains tab.
- **Namecheap:** all three domains configured in Advanced DNS; deleted default parking URL Redirect Records on `@` (they conflict with the A record).
- **Vercel dialog gotchas learned:** "Include apex and www variants" checkbox must be UNCHECKED when adding www as a redirect-to-apex (else "domain cannot redirect to itself"); checkbox stays CHECKED for .fit/.health so both variants are covered.
- **Supabase auth:** Site URL → `https://atlasprime.app`; redirect URLs added for apex + www with `/**`; old vercel.app entries kept as transition backup. Google OAuth unaffected (flows through Supabase's own callback domain).
- **Stripe webhook:** endpoint URL **edited in place** to `https://atlasprime.app/api/stripe/webhook` — same signing secret preserved. (Never create a new endpoint for a URL change; that rotates the secret and breaks `STRIPE_WEBHOOK_SECRET` in Vercel env.)
- **Verified end-to-end:** incognito Google login at atlasprime.app stays on the new domain; .fit redirect works; all domains green in Vercel.
- **Code check:** no hardcoded site URLs anywhere — join links + auth redirects all use `window.location.origin`, so no code changes were needed.
- **Launchpad:** domain item ✅, LLC item ✅ (was stale-unchecked), BUILT entry added (commit `30d766a`).

### YouTube API Quota Follow-Up
- Original quota request submitted May 18, acknowledged May 20, silent since. Follow-up sent 2026-06-12 **in the same Gmail thread** (Google tracks the application there), referencing the new production domain + Google Cloud project ID `movement-app-495418`.
- **Decision:** Google Cloud project display name stays "movement-app" until the review completes (don't touch anything mid-review; project ID is permanent and invisible to users anyway — same logic as repo/folder names).

### Cleanup
- Deleted untracked scratch files: `app/admin/mockup-b/` (style exploration, style already chosen) and `youtube-api-proof.html` (saved externally by Will).

### User-stated next session focus
Google Workspace email on @atlasprime.app, then Stripe + Apple payment method setup (Mercury debit card as preferred payment method).

---

## Previous Session (2026-06-11)

Massive session — 11 features shipped, all deployed green. The full coach-client product arc.

### Mobile Nav Unification (Athlete App + Coach Portal)
- **Coach Portal mobile:** fixed dark header bar with boxed ☰ hamburger top-left + Coach OS logo beside it; slide-out drawer (Programs, Builder, Library + quiet "Back to My Training"); bottom nav rebuilt as 4 SVG-icon tabs (Dashboard/Clients/Messages/Analytics) matching athlete BottomNav style. `components/coach/CoachMobileMenu.tsx`
- **Critical CSS lesson:** `backdrop-filter` on a fixed header traps `position:fixed` descendants — drawers must `createPortal(document.body)`. Both drawers do this now.
- **Athlete App mobile:** same fixed header treatment (hamburger + ATLAS PRIME logo, left-aligned); `.app-mobile-header` class; sticky video players get `.video-sticky` so they pin below the header; safe-area insets.
- **Coach Portal menu item** in athlete drawer ("Coaching" section) for coach/admin roles, hidden during impersonation.
- **Terminology (user-adopted):** Athlete App / Coach Portal / Admin Portal; tabs (bottom bar), menu items + drawer (hamburger).

### Coach Self-Assignment + Replace Confirmation
- "💪 Assign to myself" quick-pick in program assign modal; skips coach_clients roster (coach never appears in own client list). Program surfaces via My Coach.
- Replace-program confirmation: assigning to anyone already on an active program shows amber warning naming current program; confirming retires old assignments (`status: replaced`) — exactly one active assignment per client guaranteed.

### Coached Mode (Phases 1–3 of the coach-client vision)
- **Phase 1 — coach program becomes the main program:** `contexts/CoachedContext.tsx` (app-wide coached state from /api/coach/my-program, follows effectiveUserId so Zoom In sees client experience). Today page shows coach workout as main card (`components/CoachedSessionCard.tsx`): "Programmed by Coach X" badge, per-exercise set logging → workout_logs (with last-session display), TTS read-aloud, Complete Day → new `coach_day_completions` table. Hidden while coached: AI Generate CTAs, Import a Program, Convert My Plan (both navs), Featured Programs.
- **Phase 2 — win-back + modifications:** `components/CoachWinBackModal.tsx` — once per ended assignment, "Are you still working with a coach?" → Atlas Prime AI pitch → Generate CTA (localStorage-dismissed, skips coach role). "✈️ Need changes? Message coach" on coached Today card deep-links to /my-coach?tab=messages&draft=… (my-coach page wrapped in Suspense for useSearchParams).
- **Phase 3 — vanity join links + pending clients:** `atlasprime.app/join/{slug}` — coach sets brand slug on Dashboard ("Your Join Link" card, auto-suggested from name, unique). Public branded landing page (`app/join/[slug]/page.tsx`); slug survives signup via localStorage + `components/JoinLinkRedeemer.tsx` (works with OAuth) → auto-connects roster + confirmation modal. "+ Add Client" on Clients page creates pending clients (name/email/private note) that auto-claim by email match on signup.

### In-Person Session Logging (priority feature, built same day it was requested)
- Coach logs the workout on the client's behalf: "📝 Log Session" section on client detail page — week/day/date pickers, per-exercise sets/reps/weight prefilled from programmed scheme, client's own logs preload with "edit or leave as is" badge, per-exercise + session notes → coach_client_notes, "Mark day complete" toggle.
- API `/api/coach/log-session`: roster + assignment verification, workout_logs insert/update with `logged_by=coach`, completion upsert with `completed_by=coach`, web-push notification to client on completion.
- Client side: push ("Good job! Looks like you crushed today's session with Coach X"), one-time 🎉 celebration banner on Today, button reads "✓ Completed with Coach X".

### Layout Bug Fix — Coach Desktop Double Offset
- Coach pages sat 460px from the left edge: athlete root layout's `.app-main` reserved 230px for the athlete sidebar even on coach routes (its sidebar hides; reservation stayed) + coach layout's own 230px. Fix: `components/AppMain.tsx` — applies `.app-main` only on athlete routes; coach/admin/auth/legal/join get bare `<main>`. Also fixed doubled 56px mobile header padding + /auth and /join desktop centering.

### Ops Notes
- **Vercel webhook dropped twice today** (push received by GitHub, no Vercel status ever posted). Fix: `git commit --allow-empty` + push re-fires it. Verify deploys via `gh api repos/Willdes1/movement-app/commits/<sha>/status`.
- ~~**`/api/notifications/send` has NO auth check**~~ — FIXED 2026-06-19: now gated by `verifyAdmin(req, 'push')` (admin/owner or push-permitted partner), with an optional `x-cron-secret` header for trusted server callers. PushTab sends the admin JWT.

### SQL Migrations — ALL CONFIRMED RUN (2026-06-11)
1. `20260611_coach_day_completions.sql` ✅
2. `20260611_coach_join_links.sql` (profiles.coach_slug + coach_pending_clients) ✅
3. `20260611_coach_session_logging.sql` (workout_logs.logged_by + coach_day_completions.completed_by) ✅

### TODO additions (see TODO.md "Added 2026-06-11")
Occupation-based plans ("No sport? Tell us what you do for work"), program-style preference + PDF style transfer (ATHLEAN-X/KOT/Bamberger influences), Founder's Program (Will tests own plan through Kallen's wedding ~mid-July 2026), coach calculators toolkit (research TrueCoach/TrainHeroic, stay unique). In-person logging item already built + marked done.

---

## Previous Session (2026-06-10)

### Coach Portal — Full Mobile Responsiveness Pass
Complete mobile overhaul of the coach portal across all 10 pages. Two commit batch.

**Layout (app/coach/layout.tsx + app/globals.css):**
- Added fixed mobile header bar (`.coach-mobile-header`) showing Atlas Prime Coach OS logo; hidden on desktop
- Bottom nav: labels completely removed on mobile (icons only); 9 items fit cleanly at ~43px each
- Added `padding-top: calc(56px + env(safe-area-inset-top))` to `.coach-main` so content clears the header bar
- Added `overflow-x: hidden` to `.coach-main` to prevent any child from creating a horizontal scrollbar
- Safe area insets applied to both header bar (`padding-top: env(safe-area-inset-top)`) and coach-main

**New CSS classes (app/globals.css):**
- `.coach-page` — responsive padding: 16px horizontal on mobile, 40px on desktop. Applied to all 10 coach pages.
- `.coach-page-header` — stacks title+button vertically on mobile (<600px), horizontal space-between on desktop
- `.coach-grid-2` / `.coach-grid-3` — responsive 1-col → 2/3-col grids (breakpoint: 600px)
- `.coach-messages-layout` — full-height layout that subtracts mobile header from `100vh`

**Per-page changes (10 files):**
- All pages: replaced `padding: '40px 40px 80px'` inline style with `className="coach-page"`
- All pages: "Coach Portal" eyebrow text → "Atlas Prime"
- `dashboard/page.tsx`: invite code + quick actions 2-col grid → `.coach-grid-2`
- `builder/page.tsx`: Sport/Goal, Duration/Days/Session, Restrictions/Notes form grids → `.coach-grid-2` / `.coach-grid-3`
- `messages/page.tsx`: outer height container changed from `height: 100vh` inline → `.coach-messages-layout` class
- `programs/page.tsx`, `analytics/page.tsx`, `library/page.tsx`, `builder/page.tsx` (preview), `programs/[id]/page.tsx`: header rows changed to `.coach-page-header`

### Business Formation — Mercury Approved
- Mercury business bank account approved (2026-06-10). Ready to fund with first transfer.

---

## Previous Session (2026-06-09)

### Business Formation — EIN + Mercury (non-code)
- **EIN obtained (2026-06-09):** Applied via IRS online EIN tool; Atlas Prime Labs LLC is now a legally recognized federal tax entity. EIN confirmation letter saved to Google Drive.
- **Mercury business bank account:** Application submitted 2026-06-09; in review (~1 day approval). Connected to Atlas Prime Labs LLC + EIN. Account type: Fitness / LLC / single member.
- **SQL migration:** `supabase/migrations/20260601_user_imported_programs.sql` confirmed — tables already existed; migration was previously run.

---

## Previous Session (2026-06-06)

### Coach Note Voice Dictation — Cross-Browser Fix
- Replaced Web Speech API (Chrome/Edge desktop only) with `MediaRecorder` + OpenAI Whisper
- Works on all browsers: Chrome, Firefox, Safari 14.1+, iOS Safari, Android Chrome
- New API route: `app/api/coach/transcribe/route.ts` — JWT-verified, accepts audio blob, calls `whisper-1`, returns transcript
- Frontend: mic button records audio via `MediaRecorder`, auto-detects MIME type (webm/mp4), sends to transcribe route, appends transcript to draft
- Voice dictation earmarked as a **paid coach upgrade** (pricing TBD); gate behind tier check when Stripe billing is built
- **Files:** `app/api/coach/transcribe/route.ts`, `components/coach/ClientNotesSection.tsx`

### Coach Notes — Edit + Delete
- Every note now has ✏️ edit and ✕ delete — including the single-note "Last Session Reminder" card (previously had no actions)
- Edit: inline form pre-filled with note text + session date; saves via Supabase UPDATE; no page refresh
- Delete: clicking ✕ shows inline "Delete? Yes / No" confirmation before firing; No dismisses back to normal
- `NoteEditForm` extracted as shared sub-component used by both the reminder card and the All Notes list
- **File:** `components/coach/ClientNotesSection.tsx`

### Business Formation (non-code)
- **Domains purchased (Namecheap, 2026-06-06):** `atlasprime.app` ($12.98), `atlasprime.fit` ($2.98), `atlasprime.health` ($12.98) — all with free domain privacy; $29.54 total logged in Spend Tracker
- **`atlasprime.com`** is parked by a domain investor since 2017 (NameBright); estimated $1,500-5,000+ to acquire; deferred until post-launch
- **Atlas Prime Labs LLC** filed with California Secretary of State (Articles of Organization, standard processing, certified copy); $75 total logged in Spend Tracker; receipt saved to Google Drive

---

## Previous Session (2026-06-04)

### TTS Batch 504 Fix
- **Root cause:** `BATCH=20` × 2 voices = 40 OpenAI TTS calls per run, chunked 4 at a time across 5 sequential chunks — enough to hit Vercel's 60s wall on slow calls
- **Fix:** `BATCH` reduced 20→10 (20 TTS calls, 3 chunks max); added `withTimeout()` helper wrapping each OpenAI call at 10s so a single slow call fails fast instead of blocking the chunk
- **File:** `app/api/admin/generate-tts/route.ts`

### TTS Library — Per-Row Generate Button
- Missing exercises in the Library tab now show a yellow **🎙 Generate** button instead of a grey "Missing" label
- Clicking generates both male (onyx) + female (nova) voices for that one exercise by calling the batch route with `{ targets: [name_normalized] }`
- Row shows "Generating…" on both voice cells, then flips to green Play buttons when done — no page refresh
- Batch route updated to accept optional `targets: string[]` body; normal batch operation unchanged when no body
- **Files:** `app/api/admin/generate-tts/route.ts`, `components/admin/TTSCurationTab.tsx`

### Onboarding Modal — Two Bug Fixes
- **Admin guard timing bug:** `isAdmin` loads asynchronously; the modal was firing once before that data arrived (saw `isAdmin=false`), then `isAdmin` updated to true but nothing called `setShow(false)`. Fixed: guard now calls `setShow(false)` explicitly.
- **Cross-device persistence:** Added DB fallback check — if profile already has `name` or `sport` set, stamp localStorage and skip the modal. Prevents re-showing on new browser/device for users who already onboarded.
- **Sex field updated:** Step 1 "Gender" → "Sex assigned at birth"; options reduced to Male/Female; Oura-style "Why we ask" collapsible added (matches profile edit screen)
- **File:** `components/OnboardingModal.tsx`

### Full Atlas Prime Rebrand (Phases 1–3)
Complete brand rename from "Movement" / "Move." / "MIE" to "Atlas Prime" / "APIE".

**Phase 1 (audit only):** Categorized every reference across the codebase into brand vs. fitness-term vs. code-level identifier. No changes.

**Phase 2 — User-facing renames (22 files):**
- UI copy: welcome messages, sidebar taglines, portal labels
- Page metadata (`app/layout.tsx`), PWA manifest, push notification default
- Admin portal: "Movement OS" → "Atlas Prime OS" in all surfaces
- Legal pages: all brand "Movement" → "Atlas Prime"
- AI prompt context strings: dropped all "(working brand name: Move.)" parentheticals; "Movement Intelligence Engine (MIE)" → "Atlas Prime Intelligence Engine (APIE)" in all admin tabs + API prompts
- Fitness-term "movement" left untouched throughout

**Internal docs commit (separate):** `AGENT_CONTEXT.md`, `CLAUDE.md`, `IDEAS.md`, `to-do/intelligence-engine.md`

**Placeholder Logo component:**
- `components/ui/Logo.tsx` — single source of truth; stacked ATLAS/PRIME wordmark, CSS-only, no image assets
- `variant` prop: `'app'` (ATLAS/PRIME) | `'admin'` (+ OS label) | `'coach'` (+ Coach OS label)
- Wired into all 5 brand surfaces: `Sidebar.tsx`, `MobileMenu.tsx`, `coach/layout.tsx`, `admin/page.tsx`, `admin/mockup-a/page.tsx`
- Mobile fix: `MobileMenu.tsx` had the old "Move." gradient hardcoded in the drawer — missed in initial pass, fixed in separate commit

**Phase 3 partial:**
- `MIETab.tsx` → `APIETab.tsx` via `git mv` (history preserved); function renamed; single importer `app/admin/page.tsx` updated
- `package.json` `"name"` field: `"movement-app"` → `"atlas-prime"` (cosmetic only)
- **NOT renamed:** folder `C:\Dev\movement-app`, GitHub repo `Willdes1/movement-app`, localStorage keys `movement_welcomed_*` / `movement_impersonation` — all intentionally preserved

---

## Previous Session (2026-06-03)

---

## Previous Session (2026-06-02 — continued)

### APIE Questionnaire Audit + Profile Enhancement
Full audit of what the APIE prompt expects vs. what the profile form actually collected. Added 7 new questions to close every gap:
- **Sex assigned at birth** — relabeled from "Gender" with Oura-style "Why we ask" collapsible
- **Age** — number input; wired to APIE `profile.age`
- **Height & Weight** — side-by-side inputs; stored as `height text` + `weight_lbs numeric` on profiles
- **Training experience level** — 5-chip selector (Beginner / Intermediate / Expert / Elite / Pro)
- **Training history** — textarea for `workout_background`
- **"What do you want to improve?"** — `improvement_notes` textarea; injected into S&C Agent + Phase 3
- **Per-sport skill level** — chips inside each sport's schedule row; builds `activities[]` array
- **SQL:** `supabase/migrations/20260602_athlete_profile_enhancement.sql`
- **Files:** `app/profile/page.tsx`, `lib/types.ts`, `app/api/generate-plan/route.ts`

### Launchpad Fix
- Coach Portal checklist updated: added Manual program builder, PDF/DOCX import, and Coach Exercise Library as done items — bumped from 13/15 (87%) → 16/18 (89%)

---

## Previous Session (2026-06-02)

### 7 Quick-Build Features
- **Travel adjustment** — ✈️ "Need modifications?" button on any calendar workout day; user describes situation; Claude Haiku patches warmup/workout/abs blocks; saves to DB
- **Ask AI Recovery** — 🤖 collapsible card at top of `/recovery`; describes pain/soreness → 2-step AI pipeline → 5 targeted exercises with how-to + tip; library-first, AI fallback
- **Missed session / Skip** — "Couldn't make it?" on past uncompleted days; expands to skip option; writes `day_completions` with `skipped:true`
- **Auto-capture prompt** — after ✓ Complete Day, green "Nice work! Tap any exercise to log sets" prompt appears (dismissible)
- **Saved Programs Library** — `/programs` page listing all `training_programs` records; date range, phase, Active badge, View Plan button; in both navs
- **Browse & Learn** — `/browse` rebuilt with live `exercise_library` data; searchable 750+ exercises; expandable coaching cards; load-more pagination
- **API:** `/api/user/travel-adjust` and `/api/user/ask-recovery` created

### 5 Medium-Build Features
- **Mobility tab** — `/mobility` with 12 body-area chips (Hip Flexors, Hamstrings, T-Spine, Shoulders, etc.) + text search; keyword filters `exercise_library`; in both navs
- **Read-aloud workout instructions** — `useTTS` wired into Today page; 🔈 speaker button on every exercise in workout blocks; pre-loads library after plan loads; reads name + how-to + tip
- **Targeted anatomy exercises** — anatomy page restructured from full-screen iframe to 55vh iframe + "Targeted Exercises" section below with 12 muscle group chips
- **Nutrition profile enhancements** — added wake time, first meal time, IF preference (5 options: None/16:8/14:10/18:6/OMAD), health conditions multi-select (10 conditions) to existing nutrition form
- **Custom plan conversion** — `/convert-plan` concierge page (PDF/DOCX upload, description, status tracker, admin notes visible to user) + admin "🔄 Conversions" tab; SQL: `plan_conversion_requests` table

### Platform Program Sharing (Muscle Beach Method)
- **`coach_programs.shared_with_roles text[]`** — admin toggle in coach portal program detail; shares with `admin` / `ff` roles
- **`/api/user/activate-shared-program`** — copies `coach_program_weeks` → `user_imported_programs` for user; sets `active_imported_program_id` on profile
- **Programs page** — shows "Featured Programs" section for role-shared programs; Activate / Restart from Week 1 buttons
- **Seed exercises API** — `/api/admin/seed-program-exercises` extracts exercises → upserts to `exercise_library`; stamps `source_program` on library rows for stable program lane tracking
- **SQL:** `coach_programs.shared_with_roles`, `user_imported_programs.source_coach_program_id`, `exercise_library.source_program`

### Video Curation — Priority Lanes + Bug Fixes
- **Priority Lanes UI** — replaced blind batch controls with 3 lanes: 🔴 User Plans Queue / 🔵 Program lanes (one per seeded program) / ⬜ Full Library Backlog; each shows pending count + Run 10/25 buttons
- **Manual URL bug fix** — `pasteCustom` now supersedes all proposed/queued candidates when manual URL is saved; `Approve All ≥ 0.85` skips exercises that already have `video_url`
- **`source_label` on `exercise_video_candidates`** — seeds tag queue entries with `program:Name`; tab reads this to build program lanes
- **`exercise_library.source_program`** — stable permanent tag used for program lane counting (doesn't depend on transient candidate status)
- **curate-videos API** — accepts `exerciseIds[]` (targeted run) + `lane` param (`plans`/`backlog`/`all`)

### Coach Exercise Library (`/coach/library`)
- New page with 🎬 Library tab in coach sidebar + mobile nav
- Add/Edit modal: name, sets×reps, rest between sets, instructions, coach notes
- Video type tabs: **No Video** / **▶ YouTube / Short** / **🎥 Upload My Video**
  - YouTube: URL + ✂️ clip trimming (start/end M:SS) + live preview; Shorts auto-detected
  - Upload: file picker (MP4/MOV/WebM, 200MB) with format guidelines; Supabase storage
- List view: video badge, clip range badge, Preview toggle, Edit, Delete
- Expanded row: side-by-side video player + instructions
- SQL: `coach_exercise_library` table (RLS-protected)

### YouTube Clip Trimming in Video Curation
- Paste URL section expanded with ✂️ Clip Trimming panel (auto-appears when valid URL detected)
- Start/End time inputs in M:SS format + inline usage guide + live preview
- `pasteCustom` saves `youtube_start_sec` / `youtube_end_sec` to `exercise_library`
- `VideoPlayer` in calendar + exercises pages updated to apply `?start=N&end=N` embed params
- SQL: `exercise_library.youtube_start_sec`, `exercise_library.youtube_end_sec`

### Pending SQL Migrations (run in Supabase SQL Editor)
**NEW — run this migration from the 2026-06-02 continued session:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age              integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height           text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_lbs       numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_level   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_background text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activities       jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS improvement_notes text;
```
File: `supabase/migrations/20260602_athlete_profile_enhancement.sql`

**Already confirmed run (previous session):**
1. `supabase/migrations/20260601_plan_conversion_requests.sql` ✅
2. `supabase/migrations/20260601_coach_program_sharing.sql` ✅
3. `supabase/migrations/20260601_curation_source_label.sql` ✅
4. `supabase/migrations/20260601_exercise_library_source_program.sql` ✅
5. `supabase/migrations/20260601_coach_exercise_library.sql` ✅
6. `supabase/migrations/20260601_exercise_library_clip.sql` ✅
7. `supabase/migrations/20260601_user_imported_programs.sql` ✅

---

## Previous Session (2026-06-01)

### PDF Export — Coach Program Detail
- "Export PDF" button on `/coach/programs/[id]` header row (next to Assign to Client)
- Generates a complete printable HTML document in memory (all weeks, days, movements, phases, coach notes, branded footer) and opens it in a new tab with `window.onload = () => window.print()` — zero new dependencies
- File: `app/coach/programs/[id]/page.tsx` — `exportPDF()` function

### Vision Fallback for Image-Based PDF Imports (Coach)
- `app/api/coach/import-program/route.ts` — if `pdf-parse` returns < 80 chars, falls back to sending raw PDF bytes to Claude Sonnet as a native `document` type (base64). Claude reads pages visually.
- Text-based PDFs still use Haiku (fast + cheap). Image PDFs use Sonnet vision. Tokens logged separately as `coach_import_program_vision`.
- Loading message updated to reflect longer wait for image PDFs.

### Manual Program Builder (Coach Portal)
- **Component:** `components/coach/ManualProgramBuilder.tsx`
- Setup form: program name, weeks (1–13), days/week (2–7), optional client selection
- Week accordion: label + phase dropdown, expand/collapse, "Copy to all weeks" button on Week 1
- Day editor: toggle training/rest, session name, focus, duration selector
- Exercise list: `@dnd-kit/core` + `@dnd-kit/sortable` drag-to-reorder, Enter to add row, Backspace on empty to remove
- Autocomplete: searches `exercise_library` as coach types, shows coaching tip under each suggestion
- **Client notes reminders:** if a client is selected at setup, every exercise input keyword-matches that client's `coach_client_notes` and surfaces relevant notes in amber inline below the input — zero AI cost, pure text matching
- Saves to `coach_programs` (source: 'manual') + `coach_program_weeks` — same schema as AI/import paths
- "Build Manually" card on Builder page now active (was disabled)
- Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### TypeScript Fixes (Unblocked Vercel Builds)
- `app/api/admin/generate-tts/route.ts` — typed `exercises` as `ExRow[]` to fix implicit `any` on `chunk.map`; also fixed `string | null` vs `string | undefined` mismatch on `buildSpeechText` and `generateAndUpload` signatures
- `app/api/coach/import-program/route.ts` — cast vision content array as `any` (Anthropic SDK document type mismatch)
- `components/coach/ManualProgramBuilder.tsx` — updated `inputRef` prop to `RefObject<HTMLInputElement | null>` (React 19 useRef change)
- `npx tsc --noEmit` now passes with zero errors

### PreCompact Hook
- `.claude/settings.json` — `PreCompact` hook (matcher: "auto") runs `node scripts/git-stats.js && git add lib/git-stats.json && git commit && git push` asynchronously when Claude auto-compacts context

### Supabase Data API Grants Migration
- `supabase/migrations/20260601_add_grants.sql` — explicit `GRANT` statements for `coach_client_notes` and new tables per Supabase May 30 policy change (enforcement October 30, 2026)

### User PDF Program Import — Full Feature
- **DB migration:** `supabase/migrations/20260601_user_imported_programs.sql`
  - Tables: `user_imported_programs`, `user_imported_program_weeks` (RLS + grants)
  - Profiles columns: `active_imported_program_id`, `imported_program_current_week`
- **API:** `app/api/user/import-program/route.ts` — JWT-auth, fetches user profile, parses PDF/DOCX (text or vision fallback), runs PT/Rehab safety pass if user has restrictions, returns `{ program, changes, hasChanges, usedVision }`
- **Page:** `app/import-program/page.tsx` — upload (drag-drop or tap), processing spinner, preview with week accordion. Amber banner shows count of exercises adjusted with full diff (original ~~struck through~~ → replacement + reason). "Activate Program" sets `active_imported_program_id` on profile; "Save for Later" stores as draft.
- **Banner:** `components/ui/ImportedProgramBanner.tsx` — mirrors `RecoveryBanner` pattern. Shows active program name + "Week X of Y" + progress bar + "Leave Plan" button. Leave modal: "Save progress & leave" (pauses program, clears active_id) or "Leave without saving". Added to `app/layout.tsx` between RecoveryBanner and GenerationBanner.
- **Nav:** Added "Import a Program" (📄) to BOTH `components/ui/MobileMenu.tsx` AND `components/ui/Sidebar.tsx`

### Git Remote PAT Fix
- Root cause of all push failures: remote URL was `https://Willdes1@github.com/...` (username only, no token). Fixed by user running `git remote set-url origin https://Willdes1:TOKEN@github.com/Willdes1/movement-app.git`

---

## Previous Session (2026-05-31)

### TTS 504 Timeout Fix
- **File:** `app/api/admin/generate-tts/route.ts`
- Root cause: no `maxDuration` set (Vercel default = 10s) + sequential `for` loop over 25 exercises (~100s total).
- Fix: added `export const maxDuration = 60` + `export const runtime = 'nodejs'`, reduced batch to 20, chunked 4 exercises at a time in parallel. Now completes in ~20s.

### "Get to Know Your Client" — Coach Client Notes
- **SQL migration:** `supabase/migrations/20260531_coach_client_notes.sql`
  - Table: `coach_client_notes` (id, coach_id, client_id, note, session_date, created_at)
  - RLS: coaches read/write/delete their own notes only; clients cannot see them
- **Component:** `components/coach/ClientNotesSection.tsx` — added to `/coach/clients/[id]` page
  - **Last Session Reminder** card at top — shows most recent note with date immediately when coach opens client page
  - **Add Note** form with session date picker (defaults to today) + 2000-char textarea
  - **Voice dictation** via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — free, built into Chrome/Edge, no external service. Mic button with pulsing red indicator while active. Falls back gracefully on unsupported browsers.
  - Notes history (newest first), show 5 then "show more", per-note delete
- **Launchpad:** item added and marked done; added to BUILT list

### CLAUDE.md Rewrite
- Replaced the single-line `@AGENTS.md` stub with a full architecture guide covering: dev commands, the two Supabase client pattern, API route auth pattern, Supabase join array gotcha, AuthContext/effectiveUserId, APIE pipeline, token logging, batch processing pattern, admin portal structure, RLS safety rules, and key file index.

### TODO.md — 10 New Feature Items Added
1. Missed workout / calendar rescheduling (expanded existing item)
2. Upload personal workout programs
3. Custom plan conversion (paid add-on)
4. Ask AI recovery feature (pain/soreness/mobility)
5. Saved programs library per user account
6. PDF program upload + AI conversion for regular users
7. Dedicated mobility & stretching tab
8. Targeted exercise library tied to anatomy
9. "Get to Know Your Client" coach notes ✅ built same session
10. Nutrition & meal planning in coach portal

---

## Previous Session (2026-05-29)

### Coach Analytics Dashboard
- **API:** `GET /api/coach/analytics` — JWT-verified, service key. Fetches roster, profiles, active assignments, workout_logs (30d). Groups logs by user counting distinct calendar dates for 7d/30d counts. Returns per-client stats + summary.
- **Page:** `/coach/analytics` — 4 summary cards, activity color coding (green ≥3/7d, blue ≥1/7d, amber daysSince≤10, red inactive), sort controls, inactive alert banner, per-client rows. Click row → `/coach/clients/[id]`.
- **Nav:** Added `Analytics` to coach sidebar.

### TTS Audio Library Browser
- **TTSCurationTab rewrite:** Added sub-tabs — `Generate` (existing) and `Library` (new).
- **Library tab:** Stats strip (total/male/female/missing), search + filter (All/Generated/Missing), rows with `▶ Play` buttons for male (onyx) and female (nova). Uses `new Audio(url)` for inline playback. Playing state shows `⏸ Playing`.
- **Error display fix:** Generate tab now shows red for errors, green for success (previously always green).

### Media Library TTS Columns
- Updated `MediaLibraryTab` in `app/admin/page.tsx`:
  - Added `tts_url_male` and `tts_url_female` to load query from `exercise_library`.
  - Added compact `▶ ♂` (blue) and `▶ ♀` (purple) play buttons in TTS column.
  - Added "Missing TTS" filter.
  - Header stat line shows TTS count.
  - Added `useRef` for audio playback.

### Coach Onboarding Flow
- **File:** `components/coach/OnboardingOverlay.tsx`
- Appears on first visit to `/coach/dashboard` (localStorage key: `coach_onboarded_${userId}`).
- 3 steps: Welcome → Generate Invite Code → Build First Program.
- Dismissible at any step. Detects existing code and skips generation if already done.
- Integrated into `app/coach/dashboard/page.tsx`.

### Video Curation Timeout Fix
- **Problem:** Sequential `for` loop over 50 exercises exceeded 60s Vercel limit.
- **Fix:** Split `processExercises` into `processOne` (single exercise) + chunked parallel runner (4 concurrent via `Promise.all`). 50 exercises now takes ~25s instead of 100s+.

### YouTube Shorts Support
- **Files:** `app/exercises/page.tsx`, `app/calendar/page.tsx`, `components/admin/VideoCurationTab.tsx`
- `extractYouTubeId` regex updated to match `/shorts/VIDEO_ID` URLs in addition to `watch?v=` and `youtu.be/`.
- `VideoPlayer` detects Shorts via `url.includes('/shorts/')` → renders 9:16 vertical player (`paddingBottom: '177.78%'`).
- Shorts auto-play muted + loop on open (`autoplay=1&loop=1&playlist=VIDEO_ID&mute=1`). No tap needed.
- `🔇 Muted Loop` / `🔊 Audio On` toggle button — reloads iframe via `key` prop on toggle.
- Player container is `position: sticky; top: 0` so it stays visible while scrolling through coaching cues.
- Admin paste input accepts Shorts URLs and preserves `/shorts/` format when saving to DB (so detection works later).
- Regular YouTube videos are unchanged (no autoplay, 16:9).

### Coach ↔ Client Messaging
- **SQL migration:** `supabase/migrations/20260529_coach_messages.sql`
  - Table: `coach_messages` (id, coach_id, client_id, sender_id, content, created_at, read_at)
  - RLS: Coaches read/insert own threads. Clients read/insert only for rostered coaches. Both can UPDATE for marking read.
- **Coach page:** `app/coach/messages/page.tsx` — Two-panel layout (client list + thread). Unread badges on client list. Real-time via Supabase channel `coach_msgs_{userId}`. Date dividers, auto-scroll, Enter to send. Mobile: show list OR thread.
- **Client page:** Added Messages tab to `/my-coach` alongside Program tab. Unread badge on tab. Real-time subscription marks read on open.
- **API update:** `app/api/coach/my-program/route.ts` now returns `coachId` in response.
- **Coach nav:** Added `Messages 💬` to coach sidebar.

---

## 5. SQL Migrations Status

**No pending migrations as of 2026-06-11.** All three 2026-06-11 migrations confirmed run (coach_day_completions, coach_join_links, coach_session_logging). `20260601_user_imported_programs.sql` confirmed run 2026-06-09. `20260602_athlete_profile_enhancement.sql` uses IF NOT EXISTS — re-run anytime if profile columns ever look missing.

**Reference — already run:**

### coach_client_notes (Get to Know Your Client)
```sql
CREATE TABLE IF NOT EXISTS coach_client_notes (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note         text        NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  session_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_client_notes_lookup ON coach_client_notes (coach_id, client_id, created_at DESC);
ALTER TABLE coach_client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_notes_all" ON coach_client_notes FOR ALL USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
```

### coach_messages (Coach ↔ Client Messaging)
**The messaging feature will NOT work until this SQL is run in Supabase SQL Editor:**

```sql
CREATE TABLE IF NOT EXISTS coach_messages (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now() NOT NULL,
  read_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_coach_messages_thread ON coach_messages (coach_id, client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_messages_client ON coach_messages (client_id);
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_read"    ON coach_messages FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY "coach_insert"  ON coach_messages FOR INSERT WITH CHECK (coach_id = auth.uid() AND sender_id = auth.uid());
CREATE POLICY "client_read"   ON coach_messages FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "client_insert" ON coach_messages FOR INSERT WITH CHECK (
  client_id = auth.uid() AND sender_id = auth.uid() AND
  EXISTS (SELECT 1 FROM coach_clients WHERE coach_clients.coach_id = coach_messages.coach_id AND coach_clients.client_id = auth.uid() AND coach_clients.status = 'active')
);
CREATE POLICY "mark_read" ON coach_messages FOR UPDATE
  USING (coach_id = auth.uid() OR client_id = auth.uid())
  WITH CHECK (coach_id = auth.uid() OR client_id = auth.uid());
```

---

## 6. Current Launchpad Status

### F&F Beta Readiness — ~94% (18/19 done)
- Only missing: Exercise videos curated (80%+ of library) — in progress via admin

### Coach Portal Beta Readiness — 87% (13/15 done)
| Item | Status |
|------|--------|
| Programs library | ✅ |
| Program detail (inline editing + status) | ✅ |
| Assign-to-client (search + date picker) | ✅ |
| Exercise swap modal (sets/reps preserved) | ✅ |
| AI generate (periodized plans) | ✅ |
| Template library (zero-cost reuse) | ✅ |
| Client roster + assignment history | ✅ |
| Client portal (clients see assigned plans) | ✅ |
| Coach onboarding flow | ✅ |
| Coach analytics dashboard | ✅ |
| In-app coach ↔ client messaging | ✅ |
| Get to Know Your Client (client notes) | ✅ |
| PDF export of programs | ✅ |
| Manual program builder | ✅ |
| PDF/DOCX import (text + image) | ✅ |
| Stripe billing for coach tiers | ❌ |
| Coach affiliate / referral system | ❌ |

### App Store Launch — ~12% (3/27 done)
Critical blockers (in priority order):
1. **LLC registration** — Required before Apple Developer Program; also needed before naming is final
2. **App name finalized** — shortlist: Hone, Caliber, Athlo, Kime, Vantage, Forge
3. **RevenueCat** — Stripe alone = App Store rejection for subscriptions
4. **Capacitor wrapper** — PWA → native iOS + Android (nothing submittable without this)

---

## 7. Patterns & Lessons Learned

### TypeScript / Supabase Patterns
```typescript
// Supabase joins ALWAYS return arrays — never single objects
// WRONG:
const name = (data.profiles as { name: string } | null)?.name
// RIGHT:
const name = (data.profiles as unknown as { name: string }[] | null)?.[0]?.name
```

### JWT-Authenticated API Routes Pattern
All coach/client API routes use this pattern:
```typescript
export const runtime = 'nodejs'
// 1. Verify caller via anon client with their JWT
const anonClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
const { data: { user } } = await anonClient.auth.getUser()
// 2. Fetch data via service role key (bypasses RLS)
const supabase = createClient(URL, SERVICE_ROLE_KEY)
```

### Vercel Timeout Pattern
```typescript
export const maxDuration = 60  // max for Hobby plan

// For batch work — process in parallel chunks, not sequentially:
const CONCURRENCY = 4
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const chunk = items.slice(i, i + CONCURRENCY)
  const results = await Promise.all(chunk.map(item => processOne(item)))
}
```

### RLS Safety (Learned the Hard Way)
- Recursive RLS policies caused admin lockout (2026-05-07). Always use `SECURITY DEFINER` functions for cross-role access.
- `protect_admin_role` trigger is live — protects admin role from being changed.
- When in doubt, use service role key in API routes instead of complex RLS.

### Audio Playback Pattern (No DOM element needed)
```typescript
const audioRef = useRef<HTMLAudioElement | null>(null)
function play(url: string, id: string) {
  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  if (playingId === id) { setPlayingId(null); return }
  const audio = new Audio(url)
  audioRef.current = audio
  setPlayingId(id)
  audio.play()
  audio.onended = () => setPlayingId(null)
}
```

### Supabase Realtime Pattern
```typescript
const channel = supabase
  .channel(`unique_channel_name_${userId}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'coach_messages',
    filter: `coach_id=eq.${userId}`,
  }, (payload) => { /* handle */ })
  .subscribe()
return () => { supabase.removeChannel(channel) }
```

---

## 8. TTS Audio System

- **Storage:** Supabase bucket `exercise-tts` → folders `onyx/` (male) and `nova/` (female)
- **File naming:** `{name_normalized}.mp3`
- **DB columns:** `exercise_library.tts_url_male` and `exercise_library.tts_url_female`
- **Coverage:** ~26/752 exercises generated (3%). Run "Generate 25" daily in admin → TTS Audio tab.
- **Cost:** ~$7 total for all 752 exercises. One-time cost, then served free from CDN.
- **Auto-backfill:** When a user triggers TTS for an ungenerates exercise, it generates + saves automatically.
- **Timeout issue:** Batch generation (25 exercises = 50 TTS calls) can hit Vercel 60s limit. Existing `maxDuration = 60` on the route.

---

## 9. Video Curation System

- **Pipeline:** AI searches approved YouTube channels → scores videos via Claude → proposes top 3 per exercise → admin approves
- **Batch size:** Up to 50 exercises per run (now parallel — 4 at a time)
- **Regenerate:** Uses `buildAlternativeQueries` (strips directional terms, core name, "how to" prefix) + all channels + strict scoring (0.35 threshold)
- **Common error:** `"An error o"... is not valid JSON` = Vercel timeout. Reduce batch or fixed by parallelization.

---

## 10. APIE (Atlas Prime Intelligence Engine)

- **Phase 1+2 LIVE:** pgvector knowledge store (784 items) + S&C Agent + PT/Rehab Agent
- **Phase 3+4:** Full Agent Council — not yet built
- **Cost tracking:** `token_usage` table; admin UI in Health Monitor

---

## 11. What to Work on Next (Priority Order)

**IMMEDIATE (start of next session): pick from the open threads below — nothing is forced.**
The Kinetic marketing landing is LIVE at atlasprime.app. Harness (all 4 stages + wrap-up) DONE.
Product Telemetry DONE. Coach billing Stage A BUILT (not live). Athlete pricing locked as a draft.

0. **⚠️ Pending SQL migration (coach billing only):** `20260708_coach_usage.sql` — run when Will
   does the coach-billing Stripe setup (item 2). Not urgent; usage tracking degrades gracefully
   without it. Everything else is tracked in the `applied_migrations` ledger (drift panel at
   `/admin#telemetry`). `20260708_product_events.sql` already run (Product view works).
1. **🔎 SEO for the landing** — copy is effectively locked, so this is READY. See
   `to-do/seo-launch.md`: per-page title + description via Next metadata, Open Graph + Twitter
   share card (needs a 1200×630 branded image), sitemap.xml + robots.txt, register Google Search
   Console + submit sitemap, expand JSON-LD (add FAQ), weave target keywords into copy. Mostly
   one focused session. Will asked to have this waiting for a fresh session.
2. **💳 Coach Stripe billing — go live + Stage B (Will's tedious to-do, deferred by choice).**
   Stage A built. Will's steps: run `coach_usage` migration, create 3 Stripe products
   (Starter/Growth/Pro) → price IDs in Vercel (`STRIPE_PRO/PLUS/SUPREME_PRICE_ID`), confirm the
   webhook, then flip `BILLING_LIVE` + build STAGE B (enforcement gates: generate-program
   credits, voice paid-gating, message caps). Model: credits + overages, hard-cap + upgrade
   prompt now, auto-overage = Phase 2. Also brainstorm **free trials for both apps** + the
   Founder athlete deal ($69/yr first 100). Athlete price locked: Free (3 AI) + Prime $12.99/mo, $89/yr.
3. **🏁 Harness — DONE this session** (verified writes → Telemetry → migration ledger → smoke
   tests, all 3 architecture surfaces updated). Optional follow-ups if wanted: retrofit
   `withHarness()` across routes; add `SENTRY_DSN`; provision staging (deferred).
4. **🎙 Coach voice cloning — go live + test.** Phase 1 is BUILT. Needs: `ELEVENLABS_API_KEY` in
   Vercel (free tier OK for testing; upgrade to $5 Starter before a PAYING customer hears a
   cloned voice) + run `20260623_coach_voice_cloning.sql`. Then test with a coached client.
1. **🎙 Coach voice cloning — go live + test.** Phase 1 is BUILT. Needs: `ELEVENLABS_API_KEY` in
   Vercel (free tier OK for testing; upgrade to $5 Starter before a PAYING customer hears a
   cloned voice) + run `20260623_coach_voice_cloning.sql`. Then test with a coached client
   (now possible — coached display bug fixed). Full plan `to-do/coach-voice-cloning.md`. Phases
   2-4 (pre-generate on assign, athlete voice choice, hype lines) after.
2. **Launch paperwork (Will, non-code):** Google Play **org** account ($25, has D-U-N-S now) + **Apple Developer enrollment** ($99/yr — has D-U-N-S + Mercury card + business email; enroll with existing personal Apple ID). Then RevenueCat + Capacitor → TestFlight. Mercury → Stripe payout wiring is prep (no revenue yet).
3. **(Optional) DKIM** for the new email — Google Admin → Apps → Gmail → Authenticate email → paste the generated TXT into Namecheap (alongside the existing MX/SPF/verification records).
3. **Apple launch compliance — full review** — Apple Developer Program enrollment (LLC ✅, domain ✅, needs business email + $99/yr + D-U-N-S for org account), App Store Review Guidelines compliance audit (health/fitness app rules, account deletion requirement, privacy nutrition labels, subscription rules → RevenueCat not Stripe on iOS), privacy policy/TOS review.
4. **TestFlight path** — requires Dev Program enrollment + Capacitor-wrapped binary, but NOT App Store approval (internal testers ~immediately, external = lightweight beta review). Path: enrollment → Capacitor wrapper → TestFlight internal → external beta → submission.
5. **YouTube API quota** — follow-up sent 2026-06-12 in-thread (project `movement-app-495418`); watch for Google's response. After approval: optionally rename Cloud project display name to atlas-prime.
6. **F&F self-test account** — brand-new account through the full new-user flow on atlasprime.app.
7. **TTS backfill** — `/admin#tts` daily (~700 exercises remaining).
8. **Muscle Beach Method video curation** — `/admin#video`.
9. **Stripe billing for coach tiers** (web) + **RevenueCat** (iOS/Android) + **Capacitor wrapper**.
10. ~~**Lock down `/api/notifications/send`**~~ — DONE 2026-06-19 (admin/owner or push-permitted partner via `verifyAdmin`, plus optional cron secret).
11. **Real logo** — swap `components/ui/Logo.tsx` when the final asset is ready.
12. **Someday:** redirect cleanup — flip www.atlasprime.app redirect from 307 → 308 in Vercel (cosmetic; works fine as-is).

---

## 12. Naming / Branding

**Brand architecture (final — decided 2026-06-04):**
- **Parent / legal entity:** Atlas Prime Labs LLC
- **Consumer app:** Atlas Prime
- **App Store name:** Atlas Prime Performance
- **Admin portal:** Atlas Prime OS
- **Coach portal:** Atlas Prime Coach OS

**Code-level note:** Folder (`C:\Dev\movement-app`), GitHub repo (`Willdes1/movement-app`), and localStorage keys (`movement_welcomed_*`, `movement_impersonation`) intentionally kept as-is — renaming them would break paths/sessions with zero user-visible benefit.

**Placeholder logo:** `components/ui/Logo.tsx` — stacked ATLAS/PRIME CSS wordmark. Replace this single file with the final asset when ready.

---

## 13. Infrastructure Notes

- **Vercel:** Hobby plan. `dentalseowill-5409` account.
- **Supabase:** Free tier. `main` branch = production.
- **GitHub:** `Willdes1/movement-app`, master branch.
- **Current production commit:** `30d766a` (2026-06-12)
- **Production domain:** `https://atlasprime.app` (live 2026-06-12). www + .fit + .health + old movement-app-three.vercel.app all 308-redirect to it.
- **Credentials:** GitHub PAT (Willdes1) in user's 1Will Gonzalez Google Drive.
- **Admin portal:** `/admin` — hash-based tab routing (e.g. `/admin#tts`, `/admin#video`, `/admin#launchpad`)
