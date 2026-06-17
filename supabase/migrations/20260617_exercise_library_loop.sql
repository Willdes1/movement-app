-- GIF-style "movement preview" loop window, independent of the full clip range.
-- Stores ONLY metadata (loop boundaries in seconds) — original video is never altered.
-- loop_start_sec / loop_end_sec are re-trimmable anytime from the Video Curation tab.
-- real (not integer) so loops can be sub-second precise.
ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS loop_start_sec real,
  ADD COLUMN IF NOT EXISTS loop_end_sec   real;
