# Coached Mode v2 — "Program Modes" (athlete experience parity)

> Locked with Will 2026-06-30. Build in chunks; ship + verify each.

## North star
An athlete is always in exactly ONE active "mode" — **AI plan**, **Coach plan**, or
**Recovery** — and each is a self-contained, full-featured experience that takes over
while active (like the recovery playbook). The others **pause & save**, resuming
cleanly. The coached experience must FEEL identical to the AI experience so that when
an F&F user leaves a coach and switches to AI, nothing feels new. Phase-1 calendar
takeover (commit 15c9650) already started this.

## Locked decisions
1. **Activation = athlete-confirmed.** A coach assigning a program does NOT auto-take-over.
   The athlete gets a **notification** + prompt; they tap **Activate** (with a "save your
   current progress first?" option). (Today it auto-takes-over — change this.)
2. **One active program at a time** (AI / Coach / Recovery), others paused & saved. Not simultaneous.
3. **Coach instructions reuse:** coach can choose **reuse-across-all-programs** OR **per-program**.
   Give both options.
4. **Default instructions = free from our global `exercise_library` first**; AI-generate only
   the gaps. Then a **"Take over fully manually"** button reveals editing + custom header fields.
5. **Custom fields:** coach can set their own default field set once, but the **standard four
   (How to perform / Breathing / Core / Pro tip[=Common Mistakes]) are the defaults** and are
   "perfect" as the generic option. Standard-field AI gen now; custom-field AI gen = later upgrade.
6. **Restart to Day 1:** keep `exercise_set_logs`/`workout_logs` history (PRs stay); reset
   completions + dates only.

## Extra from Will
- **Piece 2 cues are curated by WILL in admin** — athletes never generate/curate; it's confusing
  for them. Pull **videos from the library** where available.
- F&F (incl. Will) get BOTH: AI plans, coach "My Coach" calendar, recovery — switchable via the
  one-active manager. Their real coaches (on Atlas Prime) can assign programs to them.
- Will's current Muscle Beach program has no instructions → backfill standard ones from the
  global library.

## Build chunks (order)
- **Chunk 1 (athlete display, free):** coached exercise view shows full standard instructions
  (How/Breathing/Core/Common-Mistakes) + video, sourced coach-override → global library. Fixes
  Muscle Beach instantly, zero coach effort. *(building now)*
- **Chunk 2 (coach editor):** schema for coach exercise instructions (standard + custom fields;
  reuse-across vs per-program). Coach portal editor: auto-filled free from global, "take over
  manually" → edit + custom fields. AI-generate standard.
- **Chunk 3 (admin curation):** Will curates/AI-generates cues + videos centrally for coach
  programs. Athletes never touch it.
- **Chunk 4 (custom fields in athlete UI):** ExerciseDetailModal renders coach custom sections.
- **Chunk 5 (Piece 3 — program switching):** activate-confirm + push/in-app notification on
  coach assign (no auto-takeover); save/resume (mark missed days, skip-or-continue, auto date
  shift); restart to Day 1 (keep logs); one-active manager across AI/coach/recovery/imported;
  F&F dual experience falls out of this.

## Reuse notes (don't rebuild)
- `ExerciseDetailModal` (how/breathing/core/tip + read-aloud + history + footer slot) — extend
  with optional custom sections for Chunk 4. AI calendar wires it with `<TrackWorkout/>` footer +
  `exercise_set_logs`.
- `coach_exercise_library` already stores coach `instructions`/`notes` per exercise; coached card
  already falls back to global `exercise_library`. Chunk 2 extends this to structured + custom.
- Win-back flow (ended assignment) + replace-program flow already exist → foundation for Chunk 5.
- Imported programs: `user_imported_programs`; AI: `training_programs`; one-active manager unifies.
