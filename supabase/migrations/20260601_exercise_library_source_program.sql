-- Track which coach program an exercise was seeded from.
-- Stays on the row permanently — program lane visibility doesn't depend on candidate status.
ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS source_program text;

CREATE INDEX IF NOT EXISTS idx_exercise_library_source_program
  ON exercise_library (source_program)
  WHERE source_program IS NOT NULL;
