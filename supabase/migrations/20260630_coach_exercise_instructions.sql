-- ─────────────────────────────────────────────────────────────────────────────
-- Coached Mode v2 — Chunk 2: structured coach exercise instructions.
--
-- Coaches can now write the standard instruction fields (How to Perform /
-- Breathing / Core / Common Mistakes) per exercise in their library, plus their
-- own CUSTOM fields (e.g. "Heart Rate"). Standard fields are auto-fillable for
-- free from the global exercise_library, or AI-generated, then editable.
-- Reused across all the coach's programs (per-program override is a later add).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE coach_exercise_library ADD COLUMN IF NOT EXISTS how           text;
ALTER TABLE coach_exercise_library ADD COLUMN IF NOT EXISTS breathing     text;
ALTER TABLE coach_exercise_library ADD COLUMN IF NOT EXISTS core          text;
ALTER TABLE coach_exercise_library ADD COLUMN IF NOT EXISTS tip           text;  -- Common Mistakes
-- Custom fields: [{ "label": "Heart Rate", "text": "Keep RPE 7-8…" }, …]
ALTER TABLE coach_exercise_library ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
