-- Plan conversion requests: users submit workout PDFs for manual coach conversion
CREATE TABLE IF NOT EXISTS plan_conversion_requests (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name       text        NOT NULL,
  storage_path    text        NOT NULL,
  description     text,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'in_review', 'completed', 'rejected')),
  admin_notes     text,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_conversion_user  ON plan_conversion_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_conversion_status ON plan_conversion_requests (status, created_at DESC);

ALTER TABLE plan_conversion_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "conversion_user_read" ON plan_conversion_requests
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "conversion_user_insert" ON plan_conversion_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Grant access to authenticated users
GRANT SELECT, INSERT ON plan_conversion_requests TO authenticated;
GRANT USAGE ON SEQUENCE plan_conversion_requests_id_seq TO authenticated;
