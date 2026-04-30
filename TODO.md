# To-Do Folder
> Claude reviews this before every next step

---

## 🔥 Active / Up Next
- [x] **Hyperextended elbow recovery plan** — 6-phase: RICE → Passive ROM → Active ROM → Isometric Loading → Progressive Resistance → Sport-Specific Return. Live at /recovery/elbow.
- [x] **Shoulder Impingement playbook** — 4-phase: Pain Relief & Posture → Mobility → Rotator Cuff Activation → Return to Function. Live at /recovery/shoulder.
- [x] **Knee Rehab playbook** — 4-phase: Protect → Stability → Strength → Return to Sport (includes hop test clearance). Live at /recovery/knee.
- [ ] Build out Browse & Learn page (exercise library + articles)

## 🏋️ Profile — Workout Environment
- [x] **Workout location** — Home / Gym / Both chips on profile
- [x] **Home equipment selector** — checklist + free-text, feeds AI prompt with hard equipment constraint
- [ ] **Travel adjustment button** — "Need modifications?" button on calendar days. User describes situation, AI regenerates that day only.

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
- [ ] **Missed session / schedule conflict button** — "I couldn't make it today" button on each day. AI restructures remaining week to maintain balance and progression without losing momentum
- [ ] **Progress persistence** — All phases (training, recovery, rest, transition) saved and tracked. Seamless handoffs between states; user can always resume exactly where they left off

## 🧪 Testing & Dev Safety (added 2026-04-23)
- [ ] **Test account isolation** — When testing new features, keep main account progress (SI joint recovery progress, 3-month workout plan) fully preserved. Ability to switch to a test account and jump back to main account without losing any data.

## 💰 Billing & Monetization (added 2026-04-23)
- [ ] **Billing structure brainstorm** — Free tier: basic workouts only. Paid tier: full plan customization and AI generation. Options: (1) per-plan token cost, (2) monthly subscription with a token allowance. Beta tester promo codes grant limited or full protocol access for a set period. Finalize model before public launch.

## 🔊 Audio & Accessibility (added 2026-04-23)
- [ ] **Read-aloud workout instructions** — Speaker button on each exercise reads instructions aloud using text-to-speech. Default: American male voice, with option to switch to female. Audio ducks (lowers) background music while reading, then restores — does not pause it. Designed for eyes-free use mid-workout on both iPhone and Android.

## 📊 Stats & Tracking (added 2026-04-23)
- [x] **Workout log system** — `workout_logs` table (user_id, exercise_normalized, sets, reps, weight, logged_at). Exercise modal shows "Last Session" card (weight, sets, reps, date) + "Log Set" form with 3 inputs. Logs persist across plans/weeks. Calendar modal shows last session read-only.
- [ ] **Auto-capture from workout flow** — Currently requires manual tap to log. Future: auto-prompt when marking a session complete.
- [ ] **Cross-plan stat persistence with timestamps** — Covered by current `workout_logs` design (exercise_normalized is the key). Just needs display in more places as needed.

## 🎬 Exercise Demos (added 2026-04-23)
- [ ] **Exercise demo solution** — Evaluate two options: (1) YouTube links that open in-app via embedded player — quick to implement, no hosting cost, but dependent on third-party links staying live. (2) Custom GIFs or muscle-highlight animations — higher quality, fully controlled, bigger production effort. Brainstorm what's realistic for beta vs. what to build for launch.

## 🧹 Content Management Rules (added 2026-04-23)
- [ ] **Deduplication enforcement** — When adding items to TODO or IDEAS, always check for existing related entries first. If overlap found: merge into the existing entry rather than creating a duplicate. If a task is done, mark it [x] immediately — never leave completed work in the active list.

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
*Last updated: 2026-04-29*
