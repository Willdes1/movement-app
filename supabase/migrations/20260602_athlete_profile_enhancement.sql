-- Enhanced athlete profile fields for MIE input completeness
-- All use IF NOT EXISTS — safe to re-run if some columns were added in a prior session

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age              integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height           text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_lbs       numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_level   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_background text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activities       jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS improvement_notes text;
