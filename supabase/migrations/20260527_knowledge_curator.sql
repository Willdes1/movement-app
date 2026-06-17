-- APIE Phase 4: Knowledge Curator Agent
-- Run this in Supabase SQL Editor

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS version            integer     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason        text,
  ADD COLUMN IF NOT EXISTS suggested_content  text,
  ADD COLUMN IF NOT EXISTS flagged_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_at   timestamptz;

-- Partial index — only indexes flagged rows, keeps it tiny
CREATE INDEX IF NOT EXISTS idx_knowledge_flagged
  ON knowledge_items (flagged_at DESC)
  WHERE flagged_for_review = true;

-- Index for rotating curation batches (least-recently-reviewed first)
CREATE INDEX IF NOT EXISTS idx_knowledge_reviewed
  ON knowledge_items (last_reviewed_at ASC NULLS FIRST);
