-- Run this in the Supabase SQL Editor before enabling preference injection.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trading_style      text,
  ADD COLUMN IF NOT EXISTS experience_level   text,
  ADD COLUMN IF NOT EXISTS account_size       text,
  ADD COLUMN IF NOT EXISTS risk_profile       text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
