-- Migration: Phase B – FAQ management + vector search
-- Note: courses table may not exist yet in migration history (created via dashboard)
-- So we avoid FK references and use permissive RLS policies

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- B3: FAQs table with vector embedding
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embedding vector(768),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_course ON faqs(course_id);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no FK dependency on courses)
CREATE POLICY "Authenticated users can manage FAQs"
  ON faqs FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RPC: Search FAQs by embedding similarity
CREATE OR REPLACE FUNCTION match_faqs(
  p_course_id UUID,
  p_query_embedding vector(768),
  p_match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  course_id UUID,
  question TEXT,
  answer TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.course_id,
    f.question,
    f.answer,
    1 - (f.embedding <=> p_query_embedding) AS similarity
  FROM faqs f
  WHERE f.course_id = p_course_id
    AND f.embedding IS NOT NULL
  ORDER BY f.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;
