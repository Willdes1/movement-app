# Profile Improvements — Training Level & Activity Background

## Priority

**Ship before beta.** This data feeds directly into the AI plan generator — without it, the AI is producing programs without knowing the user's actual experience level or sport background.

## What to build

A new tab (or expanded section) within the user's profile/onboarding flow that collects:

### 1. Training Level
Single-select:
- Beginner
- Intermediate
- Expert
- Elite
- Pro

Definition guidance (shown as helper text below the selector):
- **Beginner** — Less than 1 year of consistent training
- **Intermediate** — 1–3 years, familiar with compound movements
- **Expert** — 3–5 years, programs their own training
- **Elite** — Competitive athlete, sport-specific periodization
- **Pro** — Professional or semi-professional athlete

### 2. Workout Background
Free-text field. Prompt: *"Describe your training history — programs you've followed, lifting style, sports background, anything the AI should know."*

Examples shown as placeholder:
> "5 years of powerlifting, followed 5/3/1 and nSuns. Competed in 3 meets. Currently transitioning to bodybuilding-style training."

### 3. Sport / Activity Performance Background
Repeatable list. Each entry has:
- **Activity name** (free-text or searchable from a predefined list: skateboarding, snowboarding, golf, tennis, basketball, MMA, etc.)
- **Skill level**: Beginner / Intermediate / Expert / Elite / Pro

Allow adding multiple activities. Allow removing entries.

## Schema

Two new columns on `profiles`:
- `training_level` — text, nullable, CHECK IN ('beginner','intermediate','expert','elite','pro')
- `workout_background` — text, nullable

One JSONB column on `profiles`:
- `activities` — jsonb, default `[]`, array of `{ name: string, level: string }` objects

Migration SQL is separate (already reviewed and approved before this build starts).

## Where it lives

- As a new **"Background"** tab within `/account` (profile page), alongside existing profile fields.
- Should also appear during **onboarding** (after the initial profile setup) so new users fill it in before their first plan is generated.
- Pre-populate in the plan generation prompt sent to the AI so it factors training level and sport background into exercise selection, volume, intensity, and language.

## AI integration

When generating a plan, include in the system prompt:
```
Training level: {training_level}
Workout background: {workout_background}
Sport/activity background: {activities.map(a => `${a.name} (${a.level})`).join(', ')}
```

The AI should:
- Adjust exercise complexity to the training level (beginners get form cues, pros get periodization language)
- Reference sport-specific movement patterns where relevant
- Scale volume and intensity to experience level

## What is NOT in this build

- Auto-detection of training level from logs (future)
- Importing training history from third-party apps (future)
- Coach-level override of a client's stated training level (Phase 2 of coach portal)

## Smoke test

1. Go to `/account` → Background tab → set training level to "Intermediate," fill in workout background, add "Golf – Beginner" and "Snowboarding – Intermediate."
2. Save. Reload. Confirm all fields persist.
3. Generate a new plan. Confirm the AI prompt sent includes the new fields (visible in token usage / plan generation log).
4. Review generated plan — language and exercise selection should reflect intermediate level, not generic beginner defaults.
