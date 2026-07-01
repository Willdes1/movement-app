-- ─────────────────────────────────────────────────────────────────────────────
-- Chunk 5a — athlete-confirmed activation.
-- A coach assigning a program now creates a 'pending' assignment; the athlete
-- gets a prompt and taps Activate → it becomes 'active' (and any current active
-- one is retired). Widen the status constraint to allow 'pending'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE coach_program_assignments
  DROP CONSTRAINT IF EXISTS coach_program_assignments_status_check;

ALTER TABLE coach_program_assignments
  ADD CONSTRAINT coach_program_assignments_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'paused', 'cancelled', 'replaced'));
