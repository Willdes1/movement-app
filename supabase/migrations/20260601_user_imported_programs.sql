-- User-imported workout programs (PDF/DOCX uploads from regular users)

CREATE TABLE IF NOT EXISTS user_imported_programs (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  source_filename  text,
  weeks_total      integer     NOT NULL DEFAULT 1,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  raw_text         text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_imported_program_weeks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id   uuid        NOT NULL REFERENCES user_imported_programs(id) ON DELETE CASCADE,
  week_number  integer     NOT NULL,
  label        text        NOT NULL DEFAULT '',
  phase        text,
  days         jsonb       NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uip_user ON user_imported_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_uipw_program ON user_imported_program_weeks(program_id, week_number);

ALTER TABLE user_imported_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_imported_program_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_imported_programs"
  ON user_imported_programs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_own_imported_program_weeks"
  ON user_imported_program_weeks FOR ALL
  USING (
    program_id IN (
      SELECT id FROM user_imported_programs WHERE user_id = auth.uid()
    )
  );

-- Track which imported program is currently active on the profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_imported_program_id uuid
    REFERENCES user_imported_programs(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS imported_program_current_week integer DEFAULT 1;

-- Explicit grants (Supabase Data API policy)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_imported_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_imported_program_weeks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_imported_programs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_imported_program_weeks TO service_role;
