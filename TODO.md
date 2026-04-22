# To-Do Folder
> Claude reviews this before every next step

---

## 🔥 Active / Up Next
- [ ] Build personalized plan generator (reads profile → generates weekly plan)
- [ ] Add more recovery playbooks (Shoulder Impingement, Knee Rehab)
- [ ] Build out For You page (personalized feed)
- [ ] Build out Calendar page (monthly training view)
- [ ] Build out Browse & Learn page (exercise library + articles)

## 🤖 AI Agent System — Core Vision (added 2026-04-21)
> Full prompt saved for reference. Build in this order:

- [ ] **AI Plan Generator v1** — AI agent trained on ISSA CFT, PT textbooks, kinesiology materials generates a fully customized daily workout plan from profile data (sport schedule, goals, restrictions, session length, workout time)
- [ ] **Injury → Recovery handoff** — When user starts a recovery playbook, AI modifies remaining training plan to keep them active with safe, injury-appropriate workouts. No full stop.
- [ ] **Post-recovery re-entry plan** — After completing recovery, AI does NOT revert to old plan. It rebuilds around the healed area: targeted protective exercises + gradual intensity ramp for that body part over a set period
- [ ] **Missed session / schedule conflict button** — "I couldn't make it today" button on each day. AI restructures remaining week to maintain balance and progression without losing momentum
- [ ] **Progress persistence** — All phases (training, recovery, rest, transition) saved and tracked. Seamless handoffs between states; user can always resume exactly where they left off
- [ ] **Multi-platform delivery** — Ensure full feature parity on iPhone, Android (PWA), and desktop browser

## 🏗️ Infrastructure
- [ ] Stripe billing integration (freemium → paid tier)
- [ ] Promo code system (beta friends get free access)
- [ ] Push notifications (streaks, reminders, milestones)
- [ ] Admin analytics dashboard (user activity, completion rates)

## ✅ Completed
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
*Last updated: 2026-04-21*
