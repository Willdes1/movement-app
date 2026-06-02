-- Store YouTube clip boundaries on exercise_library so trimmed videos
-- display correctly everywhere (curation tab, calendar modal, exercises page).
ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS youtube_start_sec integer,
  ADD COLUMN IF NOT EXISTS youtube_end_sec   integer;
