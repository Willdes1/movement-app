# Interactive Coach Portal onboarding preview

> Captured from Will 2026-08-05.
>
> **MAGIC PHRASE: "Let's see our onboarding process for the Coach Portal."**
> When Will says that, open and review the complete interactive experience.

## What Will wants

A working browser walkthrough of the coach onboarding exactly as a brand new
coach meets it. Not a description of it, not screenshots: the real questions and
screens, with buttons that move from one page to the next, so he can click all
the way through.

Two jobs:

1. Let Will review the whole experience himself and spot what needs changing.
2. Let him walk **Paul** through it as though Paul were signing up fresh
   (`to-do/paul-onboarding.md`, step 5).

Anything that looks wrong gets edited during or straight after the walkthrough.

## What exists today

`components/coach/OnboardingOverlay.tsx` is the real first-time coach setup
wizard. It fires once per coach, on first entry to the portal.

That is the thing to preview. **Read it first and preview the real component,**
do not rebuild a mock of it. A mock would drift from the real flow immediately,
and then the walkthrough would be reviewing something no coach ever sees.

## Design notes

- Needs a way to replay it on demand without wiping a real coach's state, since
  the overlay is normally once-only. A preview route or a query flag that mounts
  the real component in a sandboxed mode is the shape to aim for.
- Should be reachable by Will without creating a throwaway coach account.
- Forward and back through every step, so he can stop and study a screen.
- If it is genuinely easier to review outside the app, an Artifact version is
  acceptable, but the in-app preview of the real component is the goal, because
  only that stays honest as the wizard changes.

## Open question

Does Will want the preview to be admin-only, or a permanent "replay onboarding"
option that coaches themselves can use later? The second is more work and also
more useful, since coaches forget the tour.

---

## Manual builder usability (raised by Will 2026-08-05)

Will built a program by hand, added an exercise from the library, and found no
way to set sets, reps or rest. Investigated: **the feature exists, it just was
not where he looked, and one label actively misleads.**

**How it works today.** Sets and rest live on the exercise in the coach's own
**Library**, not in the builder. `coach_exercise_library` carries `sets_reps`
and `rest_between_sets`, and the Library edit form has both fields. When a coach
picks that exercise in the builder, `ManualProgramBuilder` appends the saved
scheme to the row text: "Bench Press 4x8". If the library row has no scheme, you
get a bare name, which is exactly what Will saw, because all of his imported
rows say "No sets/rest configured".

**Three real problems, in order of how much they cost:**

1. **The "Set rest" button does not set rest.** It converts the whole day into a
   REST DAY (`update({ type: 'rest' … })`). Sitting next to a duration dropdown,
   next to exercises that have no rest field, it reads as "configure rest times".
   This is almost certainly what made the builder feel confusing. Rename it.
2. **`rest_between_sets` never reaches the builder.** Only `sets_reps` is
   appended on pick. So a coach can set rest in their library and never see it
   again in a program.
3. **Sets and reps are free text appended to a name.** Fine for a fast typist,
   bad for progression: varying week 1 3x10 to week 4 5x5 means editing a string,
   and nothing downstream can read the scheme as data.

**Not yet decided:** whether to keep the scheme as text (simple, matches how the
AI plans store movements) or promote it to real per-day fields (better for
progression, analytics and the Task 9 vendor export, but a data change and a
migration). Ask Will before building.
