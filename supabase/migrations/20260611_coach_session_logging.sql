-- Coach logs workouts on the client's behalf (in-person sessions)
-- logged_by / completed_by: null = the user did it themselves.

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS logged_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE coach_day_completions
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
