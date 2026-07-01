-- ─────────────────────────────────────────────────────────────────────────────
-- Chunk 5b — save / resume / restart.
-- When an athlete switches away from an active coach program, we stamp the week
-- they'd reached (resume_week) on that assignment. Re-activating it later can
-- then "resume where they left off" (date-shift to that week) instead of Day 1.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE coach_program_assignments ADD COLUMN IF NOT EXISTS resume_week integer;
