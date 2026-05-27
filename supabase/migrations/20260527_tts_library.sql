-- MIE TTS: pre-generated audio URLs for exercise library
ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS tts_url_male   text,
  ADD COLUMN IF NOT EXISTS tts_url_female text;

-- Index for efficient "find exercises without TTS" queries
CREATE INDEX IF NOT EXISTS idx_exercise_no_tts_male
  ON exercise_library (id)
  WHERE tts_url_male IS NULL;
