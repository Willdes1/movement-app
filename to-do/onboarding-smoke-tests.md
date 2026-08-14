# Smoke tests, run during real one-on-one onboarding

Will's call (2026-08-13): do NOT click through these alone. He is meeting friends
one-on-one to onboard and test, so the checks ride along with those sessions and
become real usage instead of synthetic clicking.

Two trigger points:
- **A new athlete member** signs up in front of him → run the ATHLETE list.
- **Paul** (or the next coach) runs coach onboarding → run the COACH list.

Everything below is outstanding verification of the 2026-08-12 auth sweep
(commits `c9bb52a`, `9f67df3`, `9209429`). Every mutating route now requires a
token. The gates are verified to reject anonymous callers; what is NOT yet
verified is that a **real signed-in user** still sails through. A failure looks
like an "Unauthorized" message or a silently dead button.

---

## ATHLETE session

| Flow | Where | Route being proved |
|---|---|---|
| Generate a plan | `/plan` → generate a week | `/api/generate-plan` |
| For You feed loads | `/for-you` | `/api/generate-feed` |
| Read aloud on an exercise | `/exercises` or `/today` → 🔈 | `/api/tts` |
| Exercise details fill in | any uncached exercise | `/api/generate-exercise-details` |
| Nutrition | `/nutrition` | `/api/generate-nutrition` |
| Recovery plan | `/recovery/return-to-sport` | `/api/generate-recovery-plan` |
| Streak increments after a workout | `/plan` complete a day | `/api/streaks/update` |
| Push notification opt-in | banner | `/api/notifications/subscribe` |
| Enter a coach code | `/account` | `/api/coach/redeem-invite` |

## COACH session

| Flow | Where | Route being proved |
|---|---|---|
| AI generates a program | `/coach/builder` | `/api/coach/generate-program` |
| Import a program file | `/coach/builder` | `/api/coach/import-program` |
| Starter library seeds on first open | `/coach/library` | `/api/coach/seed-library` |
| Invite a client | `/coach/clients` | invite code creation |
| Assign + activate a program | `/coach/programs` | `/api/coach/activate-assignment` |
| Message a client | `/coach/messages` | realtime + `coach_messages` |

## ADMIN, whenever convenient (Will alone, low risk)
- Video Curation: run a small batch → `/api/admin/curate-videos`
- Health Monitor: run a scan, all six API checks should read OK
- TTS: one Generate click, message should end with no waste line

## NOT testable until billing goes live
`/api/stripe/checkout` and `/api/stripe/portal` were rewritten to take identity
from the JWT instead of the request body. They cannot be exercised while
`BILLING_LIVE` is false and no profile has a `stripe_customer_id`. **Re-test both
during the billing build.** See `to-do/api-auth-audit.md`.
