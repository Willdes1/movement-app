-- Coach invite codes: persistent codes coaches share with clients
CREATE TABLE IF NOT EXISTS coach_invite_codes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  uses        integer DEFAULT 0 NOT NULL,
  max_uses    integer DEFAULT 500 NOT NULL,
  active      boolean DEFAULT true NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_invite_codes_coach ON coach_invite_codes (coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_invite_codes_code  ON coach_invite_codes (code) WHERE active = true;

ALTER TABLE coach_invite_codes ENABLE ROW LEVEL SECURITY;

-- Coaches manage their own codes
CREATE POLICY "coaches_manage_own_invite_codes"
  ON coach_invite_codes
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Any authenticated user can look up an active code (to validate before redeeming)
CREATE POLICY "authenticated_read_active_codes"
  ON coach_invite_codes
  FOR SELECT
  TO authenticated
  USING (active = true);
