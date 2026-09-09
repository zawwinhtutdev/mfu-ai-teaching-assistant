-- Migration: Phase A – Chat feedback + Semester column

-- A2: Chat Feedback table
CREATE TABLE IF NOT EXISTS chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  conversation_id TEXT,
  course_id UUID,
  user_id UUID,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_feedback_course ON chat_feedback(course_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_user ON chat_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_rating ON chat_feedback(rating);

ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON chat_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON chat_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON chat_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON chat_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- A3: Add semester column to courses
DO $$ BEGIN
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester TEXT;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'courses table not found, skipping semester column';
END $$;
