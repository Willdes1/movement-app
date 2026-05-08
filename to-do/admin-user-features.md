# Admin User Features

## Goal
Give admin accounts proper first-class tooling — not just portal access, but the ability to manage their own workouts, notes, billing oversight, user management actions, and progress reporting.

**Priority: Build soon — admins are active daily users of the platform, not just operators.**

---

## What Admin Users Need

### 1. Save Their Own Workouts
Admins are athletes too. They should be able to:
- Generate and save their own 13-week plan like any user
- Log workouts from their plan
- Track their own PRs and session history

**Status:** Admins currently have full user functionality. Confirm this works end-to-end — generate plan, log reps, view calendar — and fix any gaps.

### 2. Notes System
Admin-specific notes (separate from user-facing coaching notes):

**Two note types:**
- **User notes** — attach a note to a specific user's profile (visible to admin, not the user unless toggled). Use cases: "Alex is rehabbing knee, don't push intensity", "Sarah wants to compete in October."
- **Platform notes** — internal operational notes, to-do reminders, build decisions. Think of it as a lightweight internal wiki.

Schema:
```sql
CREATE TABLE admin_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  user_id     uuid REFERENCES auth.users(id),  -- null = platform note
  title       text,
  body        text NOT NULL,
  is_visible_to_user boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### 3. Billing Management
Admin view of all billing activity:
- Current subscribers by tier (free / f_and_f / pro / coach)
- Monthly recurring revenue (MRR) — manual or pulled from Stripe when integrated
- Trial status by user — who's in trial, when it expires, conversion rate
- Payment history (once Stripe is integrated)
- Flag users with failed payments or churned subscriptions

### 4. User Management Actions
Expand admin's existing user management with direct action buttons:
- **Assign a plan** — push a specific program week to a user
- **Reset a user's plan** — wipe and allow regeneration
- **Change a user's role** — free → pro, add coach access, etc.
- **Send a direct notification** — one-off message to a specific user
- **Pause a user's account** — disable login without deleting
- **Export user data** — GDPR-compliant data export for a specific user

### 5. Assign Workouts to Users
Admin (or coach) can push a specific program to any user:
- Select user → select program (from coach_programs library or a template)
- Set start date
- Program appears in user's plan view on their next login

Ties into the coach portal assignment flow (coach_program_assignments table already exists).

### 6. Progress & Issue Reporting
An admin-facing dashboard showing:
- Users who haven't logged in for 7+ days (churn risk)
- Users who generated a plan but never logged a workout
- Users with open bug reports or feedback
- Users on expiring trials
- Error rate from AI generation (failed plan generates)

This becomes the operational heartbeat — a daily "what needs my attention" view.

---

## Build Phases
1. Audit: confirm admins can generate + log their own workouts (fix any gaps)
2. Admin notes — user notes + platform notes
3. Billing overview tab (manual MRR until Stripe integrated)
4. Expanded user management actions (assign plan, reset, push notification)
5. Progress / issue reporting dashboard
6. Workout assignment flow (ties into coach portal Step 5+)
