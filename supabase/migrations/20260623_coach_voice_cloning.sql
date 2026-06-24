-- ─────────────────────────────────────────────────────────────────────────────
-- Coach Voice Cloning (Phase 1)
-- "Your coach, in your ear, every rep." — ElevenLabs Instant Voice Cloning.
--
-- A coach records a short consent + sample → we create an ElevenLabs voice and
-- store its voice_id. When a coached client taps 🔈 on an exercise, we synthesize
-- the cue in the COACH's cloned voice and cache it once per (coach, exercise) so
-- repeat taps cost nothing — mirrors the exercise_library tts_url_* cache pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. The coach's cloned voice (one per coach)
CREATE TABLE IF NOT EXISTS coach_voices (
  coach_id     uuid        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  voice_id     text,                                  -- ElevenLabs voice_id once cloned
  status       text        NOT NULL DEFAULT 'pending' -- pending | ready | failed
                 CHECK (status IN ('pending', 'ready', 'failed')),
  consent_at   timestamptz,                           -- when the coach explicitly consented to cloning
  sample_secs  numeric,                               -- length of the recording they submitted
  error        text,                                  -- last failure reason, if any
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_voices ENABLE ROW LEVEL SECURITY;

-- Coaches manage only their own voice. Clients never read this table directly —
-- the server resolves voice status via the service role inside /api/coach/my-program.
DROP POLICY IF EXISTS "coach_voice_owner" ON coach_voices;
CREATE POLICY "coach_voice_owner" ON coach_voices
  FOR ALL USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON coach_voices TO authenticated;


-- 2. Cached generated audio, keyed by (coach, exercise). Written by the service
--    role only; the public bucket serves the mp3 so playback needs no RLS.
CREATE TABLE IF NOT EXISTS coach_exercise_audio (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name_normalized text        NOT NULL,
  audio_url       text        NOT NULL,
  char_count      integer,                            -- chars billed by ElevenLabs (for future spend tracking)
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_coach_exercise_audio_lookup
  ON coach_exercise_audio (coach_id, name_normalized);

ALTER TABLE coach_exercise_audio ENABLE ROW LEVEL SECURITY;

-- Coaches can read their own cached clips (e.g. to preview/manage). All writes go
-- through the service role, which bypasses RLS.
DROP POLICY IF EXISTS "coach_audio_owner_read" ON coach_exercise_audio;
CREATE POLICY "coach_audio_owner_read" ON coach_exercise_audio
  FOR SELECT USING (coach_id = auth.uid());

GRANT SELECT ON coach_exercise_audio TO authenticated;


-- 3. Public storage bucket for the generated mp3s (mirrors the exercise-tts bucket).
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-voice-audio', 'coach-voice-audio', true)
ON CONFLICT (id) DO NOTHING;
