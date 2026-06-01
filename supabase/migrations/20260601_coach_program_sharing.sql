-- Allow admin to share coach programs with specific user roles (e.g. 'admin', 'ff')
ALTER TABLE coach_programs
  ADD COLUMN IF NOT EXISTS shared_with_roles text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_coach_programs_shared
  ON coach_programs USING GIN (shared_with_roles);

-- Track which coach program a user_imported_programs record was cloned from
ALTER TABLE user_imported_programs
  ADD COLUMN IF NOT EXISTS source_coach_program_id uuid REFERENCES coach_programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uip_coach_source
  ON user_imported_programs (source_coach_program_id)
  WHERE source_coach_program_id IS NOT NULL;

-- Authenticated users can read programs shared with their role
-- (service role used in API routes, so no RLS change needed for server-side reads)
