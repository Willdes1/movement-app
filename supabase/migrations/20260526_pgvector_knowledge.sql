-- MIE Phase 1: Domain Knowledge Store
-- Run this in Supabase SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge items table
CREATE TABLE IF NOT EXISTS knowledge_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category    text NOT NULL CHECK (category IN (
                'exercise', 'training_principle', 'sport_protocol',
                'rehab_protocol', 'nutrition_principle'
              )),
  title       text NOT NULL,
  content     text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now()
);

-- 3. Unique constraint on title for upsert support
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_title_unique UNIQUE (title);

-- 4. IVFFlat index for approximate nearest neighbor search
-- Run AFTER seeding with data (index needs at least 1 row)
-- CREATE INDEX ON knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Retrieval function
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count     int   DEFAULT 10
)
RETURNS TABLE (
  id         uuid,
  category   text,
  title      text,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.category,
    k.title,
    k.content,
    k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM knowledge_items k
  WHERE k.embedding IS NOT NULL
    AND 1 - (k.embedding <=> query_embedding) > match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. RLS — admin read/write, no public access
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage knowledge_items"
  ON knowledge_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- After seeding, run this to build the index:
-- CREATE INDEX ON knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
