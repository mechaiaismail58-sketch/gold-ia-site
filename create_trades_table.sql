CREATE TABLE IF NOT EXISTS public.trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  mode text,
  bias text,
  entry numeric,
  stop_loss numeric,
  tp1 numeric,
  tp2 numeric,
  rr numeric,
  confluence integer,
  justification text,
  context_summary text,
  result text DEFAULT 'pending',
  result_pnl numeric,
  result_notes text,
  lesson_learned text,
  closed_at timestamp with time zone
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS trades_user_id_idx ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS trades_user_result_idx ON public.trades(user_id, result);
CREATE INDEX IF NOT EXISTS trades_user_created_idx ON public.trades(user_id, created_at DESC);

-- RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trades"
  ON public.trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON public.trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON public.trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE
  USING (auth.uid() = user_id);
