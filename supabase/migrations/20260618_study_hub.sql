-- Admin-only Study Hub — subject-scoped knowledge bases for certification prep
-- (ISSA CFT-level self-study). Each KB is a persistent container with its own
-- scoped context/system prompt layered on the APIE engine. Content entries are
-- AI-generated original study material (concepts, summaries, key points, quizzes,
-- flashcards) with created_at/updated_at + a simple version flag.
--
-- ACCESS MODEL: admin-only. All reads/writes go through admin-gated API routes
-- using the service role key. RLS is enabled with NO anon/authenticated policies
-- (deny-by-default), so these tables are invisible to the anon Data API. The
-- service role bypasses RLS, so the API routes still work.

-- ── Knowledge Bases (subject containers) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_kbs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title        text NOT NULL,
  domain       text NOT NULL DEFAULT 'general',   -- taxonomy bucket (see StudyHubTab)
  description  text,
  scope_prompt text,                               -- per-KB scoped system-prompt layer
  cert_goal    text NOT NULL DEFAULT 'ISSA CFT',
  target_units integer NOT NULL DEFAULT 25,        -- progress denominator toward the goal
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_kbs_domain ON study_kbs (domain);
CREATE INDEX IF NOT EXISTS idx_study_kbs_created ON study_kbs (created_at DESC);

-- ── Content entries (generated study material) ────────────────────────────────
CREATE TABLE IF NOT EXISTS study_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id        uuid NOT NULL REFERENCES study_kbs(id) ON DELETE CASCADE,
  title        text NOT NULL,
  topic        text,
  format       text NOT NULL DEFAULT 'concept',    -- concept | summary | quiz | flashcards | mixed
  content      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- structured: key_points[], summary, concepts[], quiz[], flashcards[]
  body_md      text,                                -- flattened markdown for display + search
  tags         text[] NOT NULL DEFAULT '{}',
  source_query text,                                -- the topic/instructions that generated it
  status       text NOT NULL DEFAULT 'active',      -- active | mastered | archived
  version      integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_entries_kb     ON study_entries (kb_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_entries_status ON study_entries (kb_id, status);
CREATE INDEX IF NOT EXISTS idx_study_entries_tags   ON study_entries USING gin (tags);

-- ── RLS: deny-by-default (admin-only via service role in API routes) ──────────
ALTER TABLE study_kbs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_entries ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies for anon/authenticated. Service role bypasses RLS.

-- ── Grants (service role only — never expose to the anon Data API) ────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_kbs     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_entries TO service_role;
