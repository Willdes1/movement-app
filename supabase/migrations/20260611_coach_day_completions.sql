-- Coach program day completions — mirrors day_completions but for coach-assigned programs.
-- Keyed by assignment so restarting/reassigning a program starts a fresh completion set.

CREATE TABLE IF NOT EXISTS coach_day_completions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id uuid        NOT NULL REFERENCES coach_program_assignments(id) ON DELETE CASCADE,
  week_number   int         NOT NULL,
  day_name      text        NOT NULL,   -- 'Mon'..'Sun', matches coach_program_weeks.days[].day
  skipped       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, assignment_id, week_number, day_name)
);

CREATE INDEX IF NOT EXISTS idx_coach_day_completions_lookup
  ON coach_day_completions (user_id, assignment_id);

ALTER TABLE coach_day_completions ENABLE ROW LEVEL SECURITY;

-- Clients manage their own completions
CREATE POLICY "own_completions" ON coach_day_completions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Coaches can read completions on their own assignments (compliance view)
CREATE POLICY "coach_read_completions" ON coach_day_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_program_assignments a
      WHERE a.id = coach_day_completions.assignment_id AND a.coach_id = auth.uid()
    )
  );

-- Explicit grants (Supabase Data API policy change, enforcement Oct 2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_day_completions TO authenticated;
GRANT SELECT ON coach_day_completions TO anon;
