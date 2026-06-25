-- ─────────────────────────────────────────────────────────────────────────────
-- Allow 'replaced' as a coach_program_assignments status.
--
-- When a coach assigns a new program to a client who already has an active one,
-- the app retires the old assignment by setting status = 'replaced'. The original
-- CHECK constraint omitted that value, so the replace flow failed with:
--   new row ... violates check constraint "coach_program_assignments_status_check"
-- This widens the constraint to the full assignment lifecycle.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE coach_program_assignments
  DROP CONSTRAINT IF EXISTS coach_program_assignments_status_check;

ALTER TABLE coach_program_assignments
  ADD CONSTRAINT coach_program_assignments_status_check
  CHECK (status IN ('active', 'completed', 'paused', 'cancelled', 'replaced'));
