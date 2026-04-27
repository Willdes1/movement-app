# To-Do Folder
> Claude reviews this before every next step

---

## 🔥 Active / Up Next
- [ ] Add more recovery playbooks (Shoulder Impingement, Knee Rehab)
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

- [ ] **Injury → Recovery handoff** — When user starts a recovery playbook, AI modifies remaining training plan to keep them active with safe, injury-appropriate workouts. No full stop.
- [ ] **Post-recovery re-entry plan** — After completing recovery, AI does NOT revert to old plan. It rebuilds around the healed area: targeted protective exercises + gradual intensity ramp for that body part over a set period
- [ ] **Missed session / schedule conflict button** — "I couldn't make it today" button on each day. AI restructures remaining week to maintain balance and progression without losing momentum
- [ ] **Progress persistence** — All phases (training, recovery, rest, transition) saved and tracked. Seamless handoffs between states; user can always resume exactly where they left off
- [ ] **Multi-platform delivery** — Ensure full feature parity on iPhone, Android (PWA), and desktop browser

## 🧪 Testing & Dev Safety (added 2026-04-23)
- [ ] **Test account isolation** — When testing new features, keep main account progress (SI joint recovery progress, 3-month workout plan) fully preserved. Ability to switch to a test account and jump back to main account without losing any data.

## 💰 Billing & Monetization (added 2026-04-23)
- [ ] **Billing structure brainstorm** — Free tier: basic workouts only. Paid tier: full plan customization and AI generation. Options: (1) per-plan token cost, (2) monthly subscription with a token allowance. Beta tester promo codes grant limited or full protocol access for a set period. Finalize model before public launch.

## 🔊 Audio & Accessibility (added 2026-04-23)
- [ ] **Read-aloud workout instructions** — Speaker button on each exercise reads instructions aloud using text-to-speech. Default: American male voice, with option to switch to female. Audio ducks (lowers) background music while reading, then restores — does not pause it. Designed for eyes-free use mid-workout on both iPhone and Android.

## 📊 Stats & Tracking (added 2026-04-23)
- [ ] **Auto-save stats on every workout** — In the background, log sets/reps/weight per exercise per session. On the exercise screen, show "Last time: 25 lb × 3×10" so the user always knows where they left off. No manual input required — auto-captures from the workout flow.
- [ ] **Cross-plan stat persistence with timestamps** — If a user lifts 45 lb on hang cleans in one plan, that stat appears when the same exercise shows up in any future plan, with date context ("Last done: Apr 10"). Persists across program restarts, plan switches, and recovery periods.

## 🎬 Exercise Demos (added 2026-04-23)
- [ ] **Exercise demo solution** — Evaluate two options: (1) YouTube links that open in-app via embedded player — quick to implement, no hosting cost, but dependent on third-party links staying live. (2) Custom GIFs or muscle-highlight animations — higher quality, fully controlled, bigger production effort. Brainstorm what's realistic for beta vs. what to build for launch.

## 🧹 Content Management Rules (added 2026-04-23)
- [ ] **Deduplication enforcement** — When adding items to TODO or IDEAS, always check for existing related entries first. If overlap found: merge into the existing entry rather than creating a duplicate. If a task is done, mark it [x] immediately — never leave completed work in the active list.

## 🗂️ Admin Tools (added 2026-04-23)
- [ ] **PDF workout plan upload (admin only)** — Admin can upload a PDF of any existing workout program (e.g. Athlean-X Dragon). AI reads and analyzes the plan, then offers to: (1) replace the user's current generated plan with it, or (2) blend it in. If replacing, AI intelligently reschedules any missed days and adjusts the remaining weeks to fit the user's timeline.

## 🏗️ Infrastructure
- [ ] Stripe billing integration (freemium → paid tier)
- [ ] Promo code system (beta friends get free access)
- [ ] Push notifications (streaks, reminders, milestones)
- [ ] Admin analytics dashboard (user activity, completion rates)

## ✅ Completed
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
*Last updated: 2026-04-23*
