-- Tag video candidate queue entries with their origin
-- 'plan' = queued automatically when a user generated a training plan
-- 'program:<name>' = queued by admin seeding a specific coach program (e.g. 'program:Muscle Beach Method')
-- NULL = legacy entries created before this column existed (treat as 'plan')
ALTER TABLE exercise_video_candidates
  ADD COLUMN IF NOT EXISTS source_label text;

CREATE INDEX IF NOT EXISTS idx_evc_source_label
  ON exercise_video_candidates (source_label)
  WHERE source_label IS NOT NULL;
