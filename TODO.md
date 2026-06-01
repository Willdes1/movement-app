# To-Do Folder
> Claude reviews this before every next step

---

## 🔥 Active / Up Next
- [x] **Hyperextended elbow recovery plan** — 6-phase: RICE → Passive ROM → Active ROM → Isometric Loading → Progressive Resistance → Sport-Specific Return. Live at /recovery/elbow.
- [x] **Shoulder Impingement playbook** — 4-phase: Pain Relief & Posture → Mobility → Rotator Cuff Activation → Return to Function. Live at /recovery/shoulder.
- [x] **Knee Rehab playbook** — 4-phase: Protect → Stability → Strength → Return to Sport (includes hop test clearance). Live at /recovery/knee.
- [x] Build out Browse & Learn page (exercise library + articles)

## 🏋️ Profile — Workout Environment
- [x] **Workout location** — Home / Gym / Both chips on profile
- [x] **Home equipment selector** — checklist + free-text, feeds AI prompt with hard equipment constraint
- [x] **Travel adjustment button** — "Need modifications?" button on calendar days. User describes situation, AI regenerates that day only.

## 🧠 Plan Generation UX
- [x] **Pre-generation instructions box** — optional instructions textarea in Regenerate modal
- [x] **Confirm before auto-generating unvisited weeks** — modal with dumbbell+sparkle icon, Cancel stays on current week, Confirm navigates + generates. Silent pre-generation of adjacent weeks removed.

## 💪 Exercise Detail System — Global Library (added 2026-04-23)
- [x] **Exercise detail generation at plan time** — second AI pass after plan generation; how-to, breathing, core, tip for every exercise
- [x] **Global deduplication — generate once, reuse forever** — normalized name check against exercise_library before any AI call; tokens spent once per unique exercise across entire platform
- [x] **Zero tap cost** — exercise chips on Plan and Calendar are tappable; detail modal reads from library, no API call on tap
- [ ] **Periodic refinement** — Admin triggers refinement scan; AI reviews + updates stored cues. Manual, infrequent.

## 🤖 AI Agent System — Core Vision (added 2026-04-21)
> Full prompt saved for reference. Build in this order:

### Multi-Agent Program Generator (added 2026-04-29)
> Vision: Replace the single-model plan generator with a coordinated team of specialist agents — like a panel of doctors, therapists, and coaches working together. Each agent has a defined role and outputs feed into the next.

- [ ] **Primary Brain Agent** — Central coordinator. Deep knowledge of kinesiology, physical therapy, ligament/tendon biomechanics, and human performance science. Responsible for the overall program architecture and integrating all other agent outputs into a coherent plan.
- [ ] **Verification Agent** — Reviews the primary agent's output before it's returned to the user. Checks: exercise ordering logic, injury contraindication compliance, phase-appropriate intensity, rest time validity, and coaching cue accuracy. Rejects or corrects before delivery.
- [ ] **Sports Expert Agent** — Specialist in movement patterns across every sport. Has deep knowledge of sport-specific demands, injury risk profiles, and return-to-play progressions for: skateboarding, snowboarding, volleyball, pickleball, basketball, tennis, soccer, track, cycling, and emerging sports worldwide. Informs warmup design, sport-specific conditioning, and return-to-sport protocols.
- [ ] **Memory & Efficiency Agent** — Stores previously validated program outputs keyed by profile signature (sport + goal + week + phase). When a near-identical request comes in, reuses the stored program instead of re-generating from scratch. Tracks token savings. Also responsible for periodically refreshing stored programs when exercise science evolves or new cuing standards are adopted.
- [ ] **Additional specialist agents as needed** — e.g., Nutrition Agent (synced to training phase), Recovery Agent (injury-specific protocols), Mindset Agent (warrior philosophy + session intent).

### Existing Agent Items
- [ ] **Injury → Recovery handoff** — When user starts a recovery playbook, AI modifies remaining training plan to keep them active with safe, injury-appropriate workouts. No full stop.
- [ ] **Return-to-sport agent** (added 2026-04-27) — During active recovery, a second agent generates a full sport-specific return-to-sport plan. For skateboarding: Day 1 = riding around, pool riding, slappies → Day 2 = shiftys → Day 3 = 50-50s → 180s, etc. Progression is sport- and skill-level-specific. Each day after the recovery workout, a prompt asks how the sport session felt before unlocking the next step. Agent runs token-heavy generation once, saves the full plan (as a stored record), and only reads/updates it on daily check-ins — no re-generation per session. Activates automatically when user enters recovery mode.
- [ ] **Post-recovery re-entry plan** — After completing recovery, AI does NOT revert to old plan. It rebuilds around the healed area: targeted protective exercises + gradual intensity ramp for that body part over a set period
- [x] **Missed session / calendar rescheduling** — (expanded 2026-05-31) Skip flow live (mark missed day done and move on). Full reschedule options (move to tomorrow/weekend) coming later.
    - "I couldn't work out today" button on each calendar day
    - Follow-up: "Do you want to rearrange the rest of your week?" with smart options: move missed day to tomorrow, skip it and continue, miss the rest of the week and start fresh Monday, or move it to Saturday/Sunday
    - Ask "Are you available on the weekend?" — if yes, slot it there; if no, intelligently combine/redistribute remaining days so the week still has logical progression
    - Scope of changes: current week + following week only. Weeks 3+ stay fixed unless absolutely necessary
    - Token efficiency: use internal exercise library for rearrangement — do NOT regenerate from scratch. Only call AI if genuinely novel restructuring is needed; patch affected days only, not the whole program
- [ ] **Progress persistence** — All phases (training, recovery, rest, transition) saved and tracked. Seamless handoffs between states; user can always resume exactly where they left off

## 🧪 Testing & Dev Safety (added 2026-04-23)
- [ ] **Test account isolation** — When testing new features, keep main account progress (SI joint recovery progress, 3-month workout plan) fully preserved. Ability to switch to a test account and jump back to main account without losing any data.
- [ ] **⚠️ DELETE test QA accounts before production launch** — Three seeded accounts must be removed from Supabase before any real users are onboarded: `test-user@movement.local` (Alex Rivera, free), `test-coach@movement.local` (Morgan Lee, coach + affiliate), `test-client@movement.local` (Jamie Chen, ff/clinical). Delete from `auth.users` (cascades to profiles, workout_logs, coaches, coach_clients). Also delete any affiliate codes/ledger entries for Morgan Lee.

## 💰 Billing & Monetization (added 2026-04-23)
- [ ] **Billing structure brainstorm** — Free tier: basic workouts only. Paid tier: full plan customization and AI generation. Options: (1) per-plan token cost, (2) monthly subscription with a token allowance. Beta tester promo codes grant limited or full protocol access for a set period. Finalize model before public launch.

## 🔊 Audio & Accessibility (added 2026-04-23)
- [ ] **Read-aloud workout instructions** — Speaker button on each exercise reads instructions aloud using text-to-speech. Default: American male voice, with option to switch to female. Audio ducks (lowers) background music while reading, then restores — does not pause it. Designed for eyes-free use mid-workout on both iPhone and Android.

## 📊 Stats & Tracking (added 2026-04-23)
- [x] **Workout log system** — `workout_logs` table (user_id, exercise_normalized, sets, reps, weight, logged_at). Exercise modal shows "Last Session" card (weight, sets, reps, date) + "Log Set" form with 3 inputs. Logs persist across plans/weeks. Calendar modal shows last session read-only.
- [x] **Auto-capture from workout flow** — Green "Nice work!" prompt appears after completing a day, reminding user to tap any exercise to log sets.
- [ ] **Cross-plan stat persistence with timestamps** — Covered by current `workout_logs` design (exercise_normalized is the key). Just needs display in more places as needed.

## 🎬 Exercise Demos (added 2026-04-23)
- [ ] **Exercise demo solution** — Evaluate two options: (1) YouTube links that open in-app via embedded player — quick to implement, no hosting cost, but dependent on third-party links staying live. (2) Custom GIFs or muscle-highlight animations — higher quality, fully controlled, bigger production effort. Brainstorm what's realistic for beta vs. what to build for launch.

## 🧹 Content Management Rules (added 2026-04-23)
- [ ] **Deduplication enforcement** — When adding items to TODO or IDEAS, always check for existing related entries first. If overlap found: merge into the existing entry rather than creating a duplicate. If a task is done, mark it [x] immediately — never leave completed work in the active list.

## 🏋️ Coach & Trainer Portal (added 2026-05-05)
- [ ] **Layer 1–4 schema migration** — Run in Supabase SQL Editor: ALTER exercise_library (audience, source, notes, contraindications, modality, equipment_required, difficulty), CREATE 11 new tables (coaches, coach_clients, coach_program_templates, coach_programs, coach_program_weeks, coach_exercise_swaps, coach_check_ins, affiliate_referrals, affiliate_ledger, affiliate_payout_requests, coach_ai_generation_log), RLS enabled with stub policies on all new tables.
- [ ] **Route scaffolding** — Empty shells for /coach/dashboard, /coach/clients, /coach/clients/[id], /coach/builder. Auth role-split: coach role gets coach routes, admin gets all, user gets user routes.
- [x] **PDF export of programs** — Export PDF button on program detail page; opens printable HTML in new tab with print dialog; all weeks, days, movements, phases, coach notes.
- [x] **PDF/DOCX import flow** — Upload PDF or DOCX on Builder page; mammoth extracts DOCX text, pdf-parse extracts PDF text; Claude Haiku normalizes to coach_programs schema; preview before saving to coach_program_weeks.
- [x] **Build Manually** — Manual week/day builder: setup form (name, weeks, days/week, optional client), week accordion with label + phase, per-day exercise list with @dnd-kit drag-to-reorder, exercise autocomplete from exercise_library, client notes reminders surfaced inline per exercise, week copy-to-all, saves to coach_programs + coach_program_weeks.
- [ ] **Exercise swap modal** — Search exercise_library (filter by movement pattern / equipment), writes swap to coach_exercise_swaps, can write new exercises to library.
- [ ] **Two-agent coach generator** — Agent 1 (Planner): JSON skeleton for full program. Library lookup: no tokens (SQL). Agent 2 (Filler): only runs on unmatched slots. Coach-only pipeline, does not touch user generator.
- [ ] **Affiliate system + admin coach management** — Admin tab for coach accounts, tier assignment, payout review.

- [x] **Client notes & analysis — "Get to Know Your Client"** (added 2026-05-31) — Per-client notes system inside the coach portal:
    - Each client has a dedicated notes section the coach can add to during or after sessions
    - Input: type or speak (speech-to-text, similar to Wispr Flow) — coach should be able to quickly dictate observations
    - Example note: "Bob was dominating with his traps during dips today"
    - Over time the system learns each client's movement patterns, weaknesses, tendencies, and limitations
    - Smart reminders: "Last time Bob did dips, he overused his traps — watch for that again today"
    - Program cross-check: when a coach generates or assigns a plan, the system checks it against that client's notes and flags conflicts (e.g. "This client struggles with dips and the plan includes them twice this week — consider a variation")
    - Research needed: validate whether coaches actually use client notes this way before building full feature

- [ ] **Nutrition & meal planning in the coach portal** (added 2026-05-31) — Coaching portal version of the nutrition feature:
    - Coach can upload their own nutrition plans/ideas for a client
    - AI-assisted brainstorm and meal plan generation based on client goals
    - Manual meal plan builder
    - Generate plans based on client questionnaire answers
    - Customize based on client's specific goals (cut, bulk, performance, recovery)
    - Eventual full feature: strong enough to be a major selling point for the coach tier

### Exercise Library Backfill (added 2026-05-05)
- [ ] **58 missing SI joint exercises** — Only 24 of 82 SI joint playbook exercises are in exercise_library. Remaining 58 need individual review and manual addition with clinical-appropriate cues. Not blocking coach portal build, but must be done before coach clinical tool launch.
- [ ] **Audience-tagging default logic** — When imports write new rows: tag as `clinical` if coach specialty is rehab/PT/therapy, else `both`. When AI generates new rows: tag as `both` unless client has active injury/restriction flag. Document this in the import and generation pipelines when built.

## 📁 User Workout Program Library (added 2026-05-31)
> Users who have trained for years accumulate workout files, PDFs, and plans from trainers, apps, and programs they've purchased. Give them a home for all of it.

- [x] **Upload personal workout programs + PDF import + AI safety conversion** — Hamburger menu "Import a Program" entry at /import-program. Upload PDF/DOCX (text or scanned/image via Claude vision). PT/Rehab safety pass checks every exercise against user's injury restrictions and replaces contraindicated movements — shows a diff of changes before saving. Preview step with week accordion. "Activate Program" sets active_imported_program_id on profile; "Save for Later" stores as draft. ImportedProgramBanner shows active program with Leave Plan flow (save progress or exit) — same pattern as RecoveryBanner. DB: user_imported_programs + user_imported_program_weeks tables with RLS.

- [x] **Saved programs library** — /programs page lists all generated plans in reverse-chronological order with start date, date range, weeks built, and phase. Active badge + View Plan button on current program. Full program switching requires DB migration (coming later). Users can:
    - Browse all programs they've ever generated
    - Search previous programs
    - Select "Switch to this program"
    - Choose: "Start from the beginning" (resets to Day 1 intelligently) or "Continue where I left off"
    - Optionally save their current active calendar before switching so they can return to it later
    - This tab lives in the hamburger menu

- [ ] **Custom plan conversion — paid add-on** — Users (including F&F) can submit old workout plans and request a full conversion into a structured in-app program:
    1. User uploads the plan
    2. They request a quote
    3. Admin (Will) reviews and approves in the admin portal
    4. Converted program gets assigned to their account
    - Start as a manual/concierge service; automate later once patterns are established

## 🧘 Mobility, Stretching & Recovery AI (added 2026-05-31)

- [x] **"Ask AI" in Recovery tab** — Smart recovery assistant live at top of /recovery. User describes pain/soreness/tightness → 2-step AI pipeline → 5 targeted exercises with how-to + coaching tips. Refresh button for new set. Pulls from exercise library first, AI-generated cues as fallback.
    - Entry point: "Ask AI" button inside the Recovery tab
    - System asks targeted questions: Where does it hurt? When did it start? During workout/sport/normal movement? Pain on bending/twisting/coughing? Sharp, dull, tight, or burning?
    - Goal: NOT diagnosis — guide toward safe, helpful recovery movements
    - Output: up to 5 recovery stretches or mobility drills pulled from internal library (sets, reps, timers, video, instructions)
    - "Refresh" button to swap in 5 new recommendations
    - Built-in timer so users complete stretches inside the app without leaving
    - Also handles general soreness (e.g. "hips and mid-back tight after skateboarding yesterday" → returns a quick same-day recovery routine)
    - Token efficiency: pull from exercise library first; only call AI for the question/recommendation logic, not to generate exercise content

- [ ] **Dedicated mobility & stretching tab** — Hamburger menu tab strictly for mobility, stretching, and recovery movements:
    - Separate from the workout calendar — for users who just want extra movement work on top of their program
    - Search: "I did chest yesterday and I'm tight" → returns 5 targeted stretches/drills
    - Advanced lookup: "What are you looking to stretch?" → user types area/muscle/situation
    - Ties into anatomy section (future): user taps a body area → gets mobility drills, stretches, targeted exercises for that area
    - Simple version first; deep anatomy integration later

- [ ] **Targeted exercise library tied to anatomy** — Within the anatomy section, targeted exercises per muscle group (Chest, Back, Biceps, Triceps, Shoulders, Hips, Knees, Ankles, Core):
    - Entry point: "Targeted Exercises" menu option in anatomy area
    - Uses internal library with depth — 5 best mobility drills per target area based on research, usefulness, and safety
    - MIE guides video curation toward trusted channels: ATHLEAN-X, Knees Over Toes Guy, Vanja, and preferred recovery chiropractor
    - Manual batch URL upload: admin sits down, pastes a batch of links, library builds quickly
    - Quality gate: if a movement looks strange, creates compliance concerns, or doesn't make sense — exclude it
    - Token strategy: research and curate once, save internally; token cost paid once per exercise
    - Video roadmap: YouTube links now → replace with owned video or paid filming later

## 🗂️ Admin Tools (added 2026-04-23)
- [ ] **PDF workout plan upload (admin only)** — Admin can upload a PDF of any existing workout program (e.g. Athlean-X Dragon). AI reads and analyzes the plan, then offers to: (1) replace the user's current generated plan with it, or (2) blend it in. If replacing, AI intelligently reschedules any missed days and adjusts the remaining weeks to fit the user's timeline.

## 🥗 Nutrition Tab (added 2026-04-27)
> Replaces "Your Plan" tab slot. Placeholder screen first, full build later.
- [x] **Placeholder screen** — "We're building this in the background. Stay tuned." Shown immediately after nav merge.
- [ ] **Nutrition profile** — Separate from training profile. Collects: age, weight, height, wake time, first meal time, intermittent fasting preference, goals, known allergies, health conditions (gout, carpal tunnel, lactose intolerance, diabetes, etc.), doctor letters/dietary recommendations (file upload). If training profile or profile picture is incomplete, nudge user to fill those first.
- [ ] **AI nutrition agent** — Trained at certified-nutritionist level. Reads training plan phase, activity level tracked in app, biometric data (when integrated), and nutrition profile. Generates a 3-month meal plan synchronized to the current workout program: morning to night, what to eat, when to eat, meal timing, and scheduling recommendations.
- [ ] **Nutrition plan generation** — Paid feature (cost TBD during billing brainstorm). Token-heavy; runs once and stores the plan, not re-generated daily. Plan adapts as workout phase changes (Foundation → Build → Peak → Maintenance).
- [ ] **File upload support** — Users can upload doctor letters or dietary notes to inform the nutrition agent.

## 🎨 Branding (added 2026-04-27)
- [ ] **Logo design** — Generate a strong prompt for LLMs (Midjourney, DALL-E, etc.) to explore logo concepts. Claude Code to produce the prompt based on app identity: AI-personalized training, recovery, performance, warrior mindset, movement. Brainstorm: wordmark vs. icon vs. combination mark. Consider how it looks on dark backgrounds, app icon grid, and marketing materials.

## 📱 Native App — App Store & Google Play (added 2026-04-27)
- [ ] **Evaluate wrapper approach** — Option A: Capacitor (wraps existing Next.js PWA into a native shell — fastest path). Option B: React Native rewrite (more native feel, bigger lift). For beta testing phase, Capacitor is likely the right call.
- [ ] **iOS build** — Target App Store distribution via TestFlight for internal beta testing first. Requires Apple Developer account ($99/yr).
- [ ] **Android build** — Target Google Play via internal testing track. Requires Google Play Developer account ($25 one-time).
- [ ] **Goal** — Will downloads and tests on his own phone during active development. Full feature parity with web.

## 🗂️ Admin Dashboard — Full Company Portal (added 2026-04-27)
> Before building, Will wants to brainstorm and see a browser-link mockup. Design should feel analytical but match app vibe (focus, recovery, performance). Ask before starting.
- [ ] **Brainstorm + mockup review** — Show Will a design direction before any code is written.
- [ ] **Business analytics** — Click-to-purchase rate, click-out rate, ad spend ROI, conversion funnels.
- [ ] **Marketing control panel** — SEO recommendations, Facebook/Meta ads, LinkedIn ads, PPC, LLM visibility (how the app appears in AI-generated search results), Reddit content strategy, educational fitness/nutrition content calendar.
- [ ] **Partner management** — Physical therapists, nutritionists, personal trainers, fitness influencers, fitness enthusiasts with large followings. Track: audience size, performance, revenue contribution, referral clients, promotion activity. Revenue-sharing model: partners earn a cut when they bring in paying clients.
- [ ] **Partner portal (future)** — Partners get their own login: analytics, expected pay, revenue generated, CTR on their content, ad ideas, marketing suggestions.
- [ ] **Scout agent** — Actively searches the web for reviews mentioning the app and competing apps. Flags if someone says "X is better than Movement" or similar. Builds its own ideas/todo list of app improvement suggestions based on what people say online.
- [ ] **Bug monitoring agent** — Scans for bugs, estimates fix time, notifies affected users when issue is under investigation, updates them when resolved. Triggers app update or refresh prompts when needed.
- [ ] **Replaced existing item**: Supersedes "Admin analytics dashboard (user activity, completion rates)" from Infrastructure.

### Build Stats Tab (added 2026-04-29) — under Business Plan section in admin
- [ ] New tab in the Business Plan / Launchpad section showing real-time build activity:
  - Current builds in progress (open PRs or active sessions)
  - Successfully completed builds and pushes (git commit history with timestamps)
  - Total time and effort invested in the project (sum of dev session hours)
  - Visual timeline of build milestones from day 0 to present

### AI Competitor Scout Tab (added 2026-04-29) — dedicated admin tab
- [ ] Auto-refreshing AI agent that scans on a configurable interval (default: every 3 days):
  - Competitor feature updates across the fitness app industry (Nike TC, Whoop, Fitbod, Trainerize, etc.)
  - Reddit discussions: r/fitness, r/personaltraining, r/physicaltherapy, r/skateboarding — what users wish existed
  - Facebook groups for personal trainers and physical therapists — pain points and feature requests
  - App Store reviews for competitor apps — common complaints and requests
- [ ] Output: auto-populates a "AI Suggestions" folder in admin with entries showing: what was found, direct links to discussions, relevance to Move., and a proposed feature response
- [ ] Configurable refresh interval: 3 days → 5 days → weekly → biweekly → monthly. Setting lives in the tab header. Reduce frequency if output becomes redundant.
- [ ] Goal: stay ahead of competitors and build features the market is actively asking for but nobody has shipped

### Development Time Tracker (added 2026-04-29) — likely under Workflow tab
- [ ] Track total development time with a running clock: hours, weeks, months since first commit
- [ ] Manual session logging: each dev session can be tagged with what was built, so the history is searchable
- [ ] Milestones: auto-detected from git commits (e.g. "First commit", "First user signed up", "First plan generated", "First recovery plan")
- [ ] Purpose: internal tracking + future storytelling ("built from 0 to X users in N months")

### What's Built + AI Agents Roster (added 2026-04-29) — dedicated admin tab
- [ ] Visual overview of every feature that is live in the app
- [ ] AI Agents Roster section: list every agent powering the system, with:
  - Agent name and role
  - What it generates / what it reads
  - When it fires (on demand vs. scheduled vs. triggered)
  - Approximate token cost per run
  - Model used (claude-sonnet-4-6 or other)
- [ ] Update automatically as new agents are added

## 🧠 Admin Portal v2 — Modular Architecture + AI Search Layer (added 2026-05-07)
> Strategic reframe: treat the admin portal as a potential standalone SaaS product (Movement is the first app running on it). Architectural decisions now must not paint us into a corner. Does NOT mean over-engineering V1.

### ⛔ Trigger Gates — Do NOT start until ALL THREE are met
- [ ] Impersonation (Zoom In) smoke-tested and fully verified
- [ ] Coach portal at a stable checkpoint (at least dashboard + clients live)
- [ ] At least one beta tester actively using the platform

### Architectural Principles (non-negotiable)
- **Module pattern, not feature pattern** — each major area is a self-contained module with its own route, table(s), and UI. Shared shell: top nav, AI search bar, breadcrumbs, consistent design tokens.
- **org_id on every new table from day one** — default to a single hardcoded Movement org UUID. No org-switching UI yet. One column now prevents weeks of migration later.
- **AI search bar lives in the shell, not a tab** — searches across ALL modules. RAG only (retrieves real records, never invents). Pluggable source registry: new module = register table + columns, no search engine rewrite.

### Modules — existing (refactor into shell) + new (build fresh)
| Module | Status | Notes |
|---|---|---|
| Users | Existing | Refactor into module shell, don't rebuild |
| Coaches | In progress | Bring into shell when stable |
| Impersonation Log + Reversal | In progress | Bring into shell when stable |
| Media Library | Existing | Refactor into shell |
| Exercise Library + Curation | Planned/deferred | — |
| **Knowledge Base** | New | Highest-frequency; build first |
| **Launchpad** | New | Revenue projections, competitor diff, branding prompts, trademark/legal drafts, active Claude Code prompts |
| **Investor Materials** | New | Pitch deck uploads, investor summary angles, AI-draft generation |
| **Ideas + Decisions Log** | New | Structured replacement for ideas/ and to-do/ folders; import existing on first run, keep folders as git-backed offline mirror |

### Search Infrastructure
- Table: `search_index` (source_module, source_id, text_content, embedding vector, created_at)
- pgvector via Supabase native support
- Hybrid search: semantic (embeddings) + keyword (Postgres full-text) — semantic catches intent, keyword catches exact strings
- Result format: synthesized answer + source records pulled + clickable links to those records. Never "here's what I think" — always "here's what I found and where it came from."
- Bar placement V1: single global bar in admin shell header
- Bar placement V2 (gate on V1 usage): per-module contextual pre-filter

### Knowledge Base table: `admin_knowledge_entries`
Columns: id, org_id, title, body (markdown), tags (text[]), category, module_link (optional cross-link to another module), created_at, updated_at, created_by, updated_by, archived (bool)
Features: markdown editor + live preview, tag/category selectors, cross-link suggestions, list view with filters.
Seed entries to write on day one:
- F&F beta onboarding playbook
- How to create a test/beta user
- How to mark a user as F&F / extend free trial / set role to coach
- How to approve a coach
- How to run impersonation + reversal
- How to add an approved YouTube channel for curation
- Common troubleshooting: smoke test failures, RLS issues, missing migrations
- Trigger gates for every deferred feature in to-do/ (so they're searchable, not just buried in markdown)

### "Save to Admin Memory" — global capture pattern
Three flavors available across every module:
1. **Save to Knowledge Base** — opens markdown editor pre-filled
2. **Save to Decisions Log** — append-only "we decided X because Y on date Z"
3. **Save to Ideas** — append-only, lowest friction

All three feed the same search index. Different shapes, one search surface.

### What is deliberately NOT in V1
- Multi-user admin (org_id column is there for later, not the UI)
- External sharing of any module (no public links, no investor read-only views)
- Mobile admin (desktop only)
- Voice-to-admin-memory capture (separate workstream)
- Any client-facing features

### Build order (when trigger gates are met)
1. Read CLAUDE.md, to-do/, ideas/ — identify overlaps with existing modules before touching anything
2. Propose schema for new tables (admin_knowledge_entries, admin_decisions_log, admin_ideas, launchpad_entries, investor_materials, search_index) + org_id migration for existing tables — show before migrating
3. Admin shell refactor first — new top nav, module switcher, empty AI search bar in header. No content yet, just the clickable structure
4. Search infrastructure — search_index table, pgvector setup, source-registration pattern, hybrid query logic. Test on fake seeded data before wiring real modules
5. Knowledge Base module (highest frequency)
6. Launchpad → Ideas + Decisions Log → Investor Materials
7. Refactor existing modules (Users, Coaches, Media, Impersonation Log) into new shell last — don't break what's working

### Smoke test acceptance (definition of done)
- [ ] Type "how do I create a beta user" → synthesized answer from actual Knowledge Base entry + clickable link
- [ ] Type "kris" → finds Kris McKenna's coach record from Coaches module
- [ ] Type "competitor pricing" → finds the relevant Launchpad entry
- All three from the same bar, no module switching

---

## 🔒 DB Safety Rules — Profiles Table (added 2026-05-07)
> Incident: recursive RLS policy on profiles caused fetchUserStatus to return null, silently locking admin out. Root cause was an admin read-all policy with a self-referencing subquery. Fixed with SECURITY DEFINER function pattern.

- **Bulk operations on profiles are catastrophic-risk.** Any seeding, migration, or test script that touches `profiles` must guard admin rows. Pattern: `WHERE role != 'admin'` or `WHERE id != '<admin-uuid>'` on every UPDATE/UPSERT. No exceptions.
- **`role` column has no default** (removed 2026-05-07). Any INSERT that omits `role` will fail loudly. This is intentional — forces explicit role assignment on every new profile.
- **BEFORE UPDATE trigger `protect_admin_role_trigger`** on `profiles` — raises exception if any UPDATE attempts to change `role` away from `'admin'` or revoke `is_admin`. Database-level guarantee that no app code or migration can accidentally demote an admin.
- **RLS admin read-all must use `SECURITY DEFINER` function** — never a recursive subquery on the same table. Pattern: `CREATE FUNCTION is_admin_user() RETURNS boolean SECURITY DEFINER` → call it from the policy. Direct subquery `(SELECT is_admin FROM profiles WHERE id = auth.uid())` inside a profiles policy causes PostgREST to return null for all rows.
- **Admin modal override** — `today/page.tsx` welcome modal is gated by localStorage key `movement_welcomed_${userId}`. Added `if (isAdmin || role === 'admin') return` guard so even if localStorage is missing (new device/browser), admin never sees the onboarding modal.

## ⚠️ Launch Blockers — DO NOT ship to non-admin users until resolved

- [ ] **TOS / Privacy Policy disclosure (BLOCKS impersonation rollout)** — No TOS or Privacy Policy page exists. Required before any non-admin user can be subject to admin impersonation. Add this exact language to the Privacy Policy at signup: *"Authorized administrators of the Movement platform may access your account for purposes of customer support, technical debugging, and platform integrity. All such access is logged and subject to internal audit."* Do not enable Zoom In on real user accounts until this disclosure is live and agreed to at signup. Admin-only testing (Will's account) is fine to proceed without it.

## 🏗️ Infrastructure
- [ ] Stripe billing integration (freemium → paid tier)
- [ ] Push notifications (streaks, reminders, milestones)

## ✅ Completed
- [x] Nav restructure — "Your Plan" tab replaced by "Nutrition" (center tab). Nav: Home · For You · Nutrition · Calendar · Account. Plan page lives at /plan, accessible from Home quick nav.
- [x] Nutrition placeholder tab — "Building in the Background" screen with what's coming list.
- [x] Complete Day button — calendar day detail shows "✓ Complete Day" for past/today workout days; saves to `day_completions` table; shows "✓ Completed" on re-open.
- [x] AI Plan Generator v1 — 3-month (13-week) personalized program with phase progression (Foundation → Build → Peak → Maintenance), lazy week generation, 1-week pre-generation, week navigation
- [x] Pre-generation instructions box — optional instructions textarea in Regenerate modal
- [x] Calendar page — monthly grid, color-coded by type, tap-to-detail panel, week/phase label, month navigation, program range dimming
- [x] For You page — sport tips (accent) + Japanese warrior mindset cards (gold), stored in `for_you_feed`, zero tap cost after generation
- [x] Workout location + home equipment on profile — Home/Gym/Both chips + 8-item equipment checklist + free-text; feeds AI prompt with hard equipment constraint
- [x] Claude mobile dispatch system — add ideas/todos from phone via Claude Projects
- [x] Initial app build (Today, Plan, Recovery, Profile, Auth)
- [x] SI Joint 4-phase recovery playbook (82 exercises)
- [x] Supabase auth + profiles table
- [x] Ember UI + dynamic recovery theme system (phases 1–4)
- [x] Leave Plan modal (save/discard recovery progress)
- [x] 5-tab navigation (Home, For You, Your Plan, Calendar, Account)
- [x] Admin system + TODO/IDEAS folders + Admin Panel (/admin)
- [x] GitHub + Vercel deployment pipeline
- [x] Auth gates — app starts at login page for guests
- [x] Profile: multi-sport, multi-goal, bilateral injury sides, sport schedule
- [x] Account tab with sign out, edit profile, admin link

---
*Last updated: 2026-05-31*
