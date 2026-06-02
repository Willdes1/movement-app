# Agent Context — Movement App
> Full briefing for a new agent to continue this project without any prior conversation history.
> Last updated: 2026-06-02 | Current branch: master | 252 commits

---

## 1. Project Overview

**What it is:** A Next.js 16 fitness app called "Movement" (rename pending — user is choosing a final brand name). Currently deployed at Vercel, connected to Supabase. Hobby plan on both.

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Supabase (Postgres + Storage + Realtime + Auth), OpenAI API (TTS + AI features), Anthropic Claude API (MIE agents, program generation, video curation), Stripe (web subscriptions — iOS needs RevenueCat).

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
| `knowledge_items` | MIE vector knowledge store (pgvector) |
| `token_usage` | Claude API cost tracking |

### Key Files
| File | Purpose |
|------|---------|
| `app/admin/page.tsx` | Admin portal — all tabs inline (MediaLibraryTab, etc.) |
| `components/admin/LaunchpadTab.tsx` | **Launchpad** — tracks readiness percentages |
| `components/admin/VideoCurationTab.tsx` | Video curation UI |
| `components/admin/TTSCurationTab.tsx` | TTS audio library browser + generate |
| `components/admin/MIETab.tsx` | MIE AI agent UI |
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

## 4. What Was Built This Session (2026-06-02)

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
All new this session — run if not yet done:
1. `supabase/migrations/20260601_plan_conversion_requests.sql`
2. `supabase/migrations/20260601_coach_program_sharing.sql` (includes `source_coach_program_id` on `user_imported_programs`)
3. `supabase/migrations/20260601_curation_source_label.sql`
4. `supabase/migrations/20260601_exercise_library_source_program.sql`
5. `supabase/migrations/20260601_coach_exercise_library.sql`
6. `supabase/migrations/20260601_exercise_library_clip.sql`

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
- Replaced the single-line `@AGENTS.md` stub with a full architecture guide covering: dev commands, the two Supabase client pattern, API route auth pattern, Supabase join array gotcha, AuthContext/effectiveUserId, MIE pipeline, token logging, batch processing pattern, admin portal structure, RLS safety rules, and key file index.

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

## 5. PENDING: SQL Migrations to Run

**Run this in Supabase SQL Editor — user_imported_programs tables (2026-06-01):**
See `supabase/migrations/20260601_user_imported_programs.sql` — creates `user_imported_programs`, `user_imported_program_weeks`, adds `active_imported_program_id` + `imported_program_current_week` to profiles.

**Already run:**

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

## 10. MIE (Movement Intelligence Engine)

- **Phase 1+2 LIVE:** pgvector knowledge store (784 items) + S&C Agent + PT/Rehab Agent
- **Phase 3+4:** Full Agent Council — not yet built
- **Cost tracking:** `token_usage` table; admin UI in Health Monitor

---

## 11. What to Work on Next (Priority Order)

1. **LLC registration** — Everything App Store blocks on this; do it first
2. **App name decision** — Pick from shortlist (Hone, Caliber, Athlo, Kime, Vantage, Forge)
3. **Muscle Beach Method video curation** — Priority lane is now working; run 25 exercises/day until the program lane hits 0; then Approve All ≥ 0.85
4. **Stripe billing for coach tiers** — Last revenue-unlock for coach portal to hit 100%
5. **Coach affiliate / referral system** — Final coach portal item; depends on Stripe
6. **RevenueCat integration** — Critical App Store blocker; replaces Stripe for iOS/Android
7. **Capacitor wrapper** — Wrap PWA as native iOS + Android binary
8. **Connect Coach Exercise Library to program builder** — When building programs, coaches should be able to pull from their personal library; currently library is standalone
9. **TTS coverage** — Continue "Generate 25" daily in admin TTS tab
10. **Video curation backlog** — After Muscle Beach Method is done, chip through the 592-exercise backlog

---

## 12. Naming / Branding

- App is currently called "Movement" but rename is planned.
- Shortlist: Hone, Caliber, Athlo, Kime, Vantage, Forge
- Coach portal = "Playbook" (proposed name for that product)
- Strategy: one LLC + multiple product names
- **Do nothing** until user confirms final name

---

## 13. Infrastructure Notes

- **Vercel:** Hobby plan. `dentalseowill-5409` account.
- **Supabase:** Free tier. `main` branch = production.
- **GitHub:** `Willdes1/movement-app`, master branch.
- **Current production commit:** `e65ed5c`
- **Credentials:** GitHub PAT (Willdes1) in user's 1Will Gonzalez Google Drive.
- **Admin portal:** `/admin` — hash-based tab routing (e.g. `/admin#tts`, `/admin#video`, `/admin#launchpad`)
