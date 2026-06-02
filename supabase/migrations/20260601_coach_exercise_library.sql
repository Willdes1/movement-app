-- Coach personal exercise library: coaches can store exercises with their own
-- video references (YouTube with optional trim, or uploaded video file),
-- instructions, rest times, and notes.
CREATE TABLE IF NOT EXISTS coach_exercise_library (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Exercise identity
  name              text        NOT NULL,
  name_normalized   text        NOT NULL,

  -- Coaching content
  instructions      text,
  sets_reps         text,           -- e.g. "3×10", "4×8-12"
  rest_between_sets text,           -- e.g. "90 sec", "2 min"
  notes             text,

  -- Video
  video_type        text        CHECK (video_type IN ('youtube', 'shorts', 'upload')),
  youtube_url       text,
  youtube_start_sec integer,        -- clip start in seconds (0 = beginning)
  youtube_end_sec   integer,        -- clip end in seconds (NULL = play to end)
  storage_path      text,           -- Supabase storage path for uploaded videos
  video_url         text,           -- public URL for uploaded videos

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (coach_id, name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_cel_coach_id ON coach_exercise_library (coach_id, name);

ALTER TABLE coach_exercise_library ENABLE ROW LEVEL SECURITY;

-- Coaches can fully manage their own library
CREATE POLICY "cel_coach_all" ON coach_exercise_library
  FOR ALL USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON coach_exercise_library TO authenticated;
