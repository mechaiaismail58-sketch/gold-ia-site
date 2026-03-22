-- Onboarding fields for user profiling
-- Run this in Supabase SQL editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS account_size TEXT CHECK (
    account_size IN ('under_5k', '5k_25k', '25k_100k', '100k_plus')
  ),
  ADD COLUMN IF NOT EXISTS experience_level TEXT CHECK (
    experience_level IN ('beginner', 'intermediate', 'advanced')
  );
