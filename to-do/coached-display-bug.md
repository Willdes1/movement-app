# BUG: active coach assignment not surfacing on client side

## Status: OPEN — found 2026-06-24, blocks live testing of Coach Voice Cloning

## Symptom
A self-assigned coach program does not appear on the athlete side:
- `/today` shows the AI plan, not the coached card; no "My Coach" nav item.
- `/my-coach` (direct URL, fresh fetch, no impersonation override) shows
  **"No Coach Program Yet."**
- True even after a hard refresh AND after the my-program embed-shape fix
  (commit cb323b0) was confirmed deployed.

## What the DB actually contains (verified via SQL 2026-06-24)
`coach_program_assignments` has an **active** row:
- status = `active`, program = Muscle Beach Method
- client_id = coach_id = `93813a02-785b-45b6-b966-c88779661ebc` (Wheel = Will's account)
- start_date = **2026-06-25** (future — set in the assign modal default)
- (A second active row exists for client Alex Rivera, a test account.)

So the assignment is genuinely persisted + active + attached to the viewing account.

## The contradiction (why it's not solved yet)
- The Coach Portal replace-warning query (anon/RLS, `client_id` + `coach_id` + status=active)
  FINDS the row (the amber "Already on a program" warning showed).
- `/api/coach/my-program` (service role, `client_id = targetId` + status=active, `.single()`)
  returns assignment:null for the SAME account → "No Coach Program Yet".
- These should match. So my-program is either resolving a different `targetId`, or the
  query is erroring. Cannot see it from code alone — needs runtime visibility.

## Next debugging steps (do with server logs / a temp debug field)
1. Add temporary debug to my-program: log `targetId`, the raw assignment query result,
   and any PostgREST error. Hit `/my-coach`, read Vercel function logs.
2. Check whether `start_date` in the FUTURE matters anywhere (it shouldn't — no date filter
   in my-program — but verify the display layer).
3. Check whether self-assignment (client_id === coach_id) trips anything.
4. CRITICAL before relying on a test account: verify a REAL client account (separate user,
   joined via roster) actually sees its coached program. If the bug is NOT self-assign-specific,
   a test client will hit the same "No Coach Program Yet" wall — and that breaks the whole
   coached-client experience, not just voice testing.

## Plan decided with Will (2026-06-24)
- Pause LIVE testing of Coach Voice Cloning (code is built + deployed; only the end-to-end
  test is blocked). See [[coach-voice-cloning]].
- Will will create a dedicated test client account (after some profile/onboarding work),
  which is the more realistic coach→client test anyway. Fix THIS bug before/while that
  account is set up so the test works first try.
