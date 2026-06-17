-- Granular per-set workout tracking (Reps / Weight / Notes, optional Left/Right).
-- Separate from workout_logs (which keeps one summary row per exercise for the
-- existing "Last Session" displays + coach analytics). Nothing here breaks that.
CREATE TABLE IF NOT EXISTS exercise_set_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_normalized text NOT NULL,
  exercise_display    text,
  set_number          integer NOT NULL DEFAULT 1,
  reps                integer,
  weight              numeric,
  weight_unit         text DEFAULT 'lbs',
  duration_sec        integer,
  side                text,          -- null | 'left' | 'right'
  notes               text,
  program_name        text,
  performed_at        timestamptz NOT NULL DEFAULT now(),
  logged_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_set_logs_user_ex   ON exercise_set_logs (user_id, exercise_normalized, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_set_logs_user_time ON exercise_set_logs (user_id, performed_at DESC);

ALTER TABLE exercise_set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "set_logs_select" ON exercise_set_logs FOR SELECT USING (user_id = auth.uid() OR logged_by = auth.uid());
CREATE POLICY "set_logs_insert" ON exercise_set_logs FOR INSERT WITH CHECK (user_id = auth.uid() OR logged_by = auth.uid());
CREATE POLICY "set_logs_update" ON exercise_set_logs FOR UPDATE USING (user_id = auth.uid() OR logged_by = auth.uid());
CREATE POLICY "set_logs_delete" ON exercise_set_logs FOR DELETE USING (user_id = auth.uid() OR logged_by = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_set_logs TO authenticated;
