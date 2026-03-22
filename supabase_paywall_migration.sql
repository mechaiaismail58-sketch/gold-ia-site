-- Bullion Desk — Paywall migration
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS free_analyses_used INTEGER DEFAULT 0;

-- Index for fast paywall checks
CREATE INDEX IF NOT EXISTS users_has_paid_idx ON public.users(id, has_paid, free_analyses_used);
