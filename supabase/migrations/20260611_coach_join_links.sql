-- Coach vanity join links + pending clients
-- Join link: atlasprime.app/join/{coach_slug} — signup with coach connection pre-applied.
-- Pending clients: coach pre-creates a client record; it auto-claims on signup by email match.

-- Vanity slug on the coach's profile (lowercase letters, numbers, hyphens)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_coach_slug ON profiles (coach_slug) WHERE coach_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS coach_pending_clients (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email      text,                 -- lowercase; used to auto-claim on signup
  note       text,                 -- private coach note (goals, context)
  status     text        NOT NULL DEFAULT 'pending',  -- pending | claimed
  claimed_by uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_pending_clients_coach ON coach_pending_clients (coach_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_pending_clients_email ON coach_pending_clients (email) WHERE email IS NOT NULL;

ALTER TABLE coach_pending_clients ENABLE ROW LEVEL SECURITY;

-- Coaches manage their own pending clients (claiming happens server-side via service role)
CREATE POLICY "coach_own_pending" ON coach_pending_clients
  FOR ALL USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- Explicit grants (Supabase Data API policy change, enforcement Oct 2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_pending_clients TO authenticated;
