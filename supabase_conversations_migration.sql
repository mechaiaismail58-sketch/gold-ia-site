-- Conversation history table
-- Each row = one full exchange (user message + AI response) in a session

CREATE TABLE IF NOT EXISTS public.conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL,
  mode           TEXT NOT NULL DEFAULT 'deep',
  message_user   TEXT NOT NULL,
  message_ia     TEXT NOT NULL,
  image_attached BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_session
  ON public.conversations(user_id, session_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_created
  ON public.conversations(user_id, created_at DESC);

-- RLS: users can only see and insert their own conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_own"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "conversations_insert_own"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
