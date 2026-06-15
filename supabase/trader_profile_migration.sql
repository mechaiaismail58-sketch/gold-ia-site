-- ============================================================
-- Trader profile fields on public.users
-- Run in Supabase → SQL Editor. Idempotent & safe to re-run.
-- account_size and trading_style already exist (text). This
-- migration only adds the two missing columns.
-- ============================================================

alter table public.users add column if not exists prop_firm    text;
alter table public.users add column if not exists max_drawdown numeric;
