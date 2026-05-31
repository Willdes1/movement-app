CREATE TABLE IF NOT EXISTS coach_client_notes (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note         text        NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  session_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_client_notes_lookup
  ON coach_client_notes (coach_id, client_id, created_at DESC);

ALTER TABLE coach_client_notes ENABLE ROW LEVEL SECURITY;

-- Coaches can read, insert, and delete their own notes. Clients cannot see these.
CREATE POLICY "coach_notes_all" ON coach_client_notes
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
