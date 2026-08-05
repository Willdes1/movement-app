# Standard starter library for every new coach

> Captured from Will 2026-08-05.

## What Will wants

Every coach who creates an account finds their exercise and workout library
already populated with well-known, old-school movements, instead of an empty
screen. New coaches immediately see how the library works without building
anything from scratch.

These are **editable examples**, not fixtures. A coach can modify them, delete
them, or use them as the starting point for their own programming.

Named as the opening set:

- Bench press
- Chest press
- Squats
- Deadlifts
- Romanian deadlifts
- Dips
- Shoulder press

To be expanded with other foundational exercises and standard workouts over time.

## Each exercise should carry

- Exercise instructions
- "Standard TSS information" (see the open question below)
- Coaching tips
- Appropriate headers and sections

## Editable, section by section

If a coach dislikes the instructions, tips or formatting, they edit it by hand.
They must be able to remove sections, rewrite instructions, adjust tips, and add
or change headers. The starter content is a floor, never a ceiling.

## The cost rule, which shapes the whole design

> "Whenever possible, this content should communicate with our internal library
> so that we do not repeatedly spend additional tokens generating the same
> information."

This is the important constraint and it is very achievable. `exercise_library`
already holds **2,050 rows** with `how`, `breathing`, `core`, `tip`, curated
video, trim windows and generated audio. Bench press, squats, deadlifts and the
rest of Will's list are already in there, already written, already paid for.

So the starter library should **reference or copy from the global library, and
generate nothing**. Seeding a coach costs zero tokens. Generation is only ever a
fallback for a movement the global library genuinely does not have, and that
result should be written back so it is paid for once, ever.

## What exists today

- `coach_exercise_library` already exists per coach, with instructions, YouTube
  clip trimming and video upload. See [[project_coach_library]].
- `CoachInstructionFields` is the shared structured editor (how / breathing /
  core / tip) with an import-from-library path already built.
- Coaches already have a **field template** (`20260630_coach_field_template.sql`)
  controlling which standard fields show and in what order, which is most of
  "add or change headers" already done.

So the work is mostly seeding and the editor surface, not new architecture.

## Open question for Will

**"Standard TSS information" is ambiguous and the two readings are different
features.** Either:

- **TTS**, the text-to-speech narration. Fits the context: the library already
  carries `tts_url_male` / `tts_url_female` per exercise, and reusing it costs
  nothing, which matches the token rule above.
- **TSS**, Training Stress Score, the endurance-training load metric. That would
  be a genuinely new thing: a per-exercise load value the app does not currently
  model anywhere.

Ask before building. Assumed TTS for now, because nothing in the app computes a
training stress score today.

## Related

Tooltips and first-use hints live in
`to-do/onboarding-help-knowledge-base.md`, not here.
