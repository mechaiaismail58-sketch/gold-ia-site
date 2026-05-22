-- ============================================================
-- BullionDesk — Migration : Account Snapshot Table
-- Suivi temps réel du compte prop firm / personnel
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  account_balance     NUMERIC(14,2) DEFAULT 0,
  daily_dd            NUMERIC(14,2) DEFAULT 0,
  total_dd            NUMERIC(14,2) DEFAULT 0,
  daily_profit        NUMERIC(14,2) DEFAULT 0,
  total_profit        NUMERIC(14,2) DEFAULT 0,
  trade_count_today   INTEGER       DEFAULT 0,
  trade_count_month   INTEGER       DEFAULT 0,
  trading_days        INTEGER       DEFAULT 0,
  best_day_profit     NUMERIC(14,2) DEFAULT 0,
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),
  CONSTRAINT account_snapshots_user_date_key UNIQUE (user_id, snapshot_date)
);

ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_snapshots_select_own" ON public.account_snapshots;
DROP POLICY IF EXISTS "account_snapshots_insert_own" ON public.account_snapshots;
DROP POLICY IF EXISTS "account_snapshots_update_own" ON public.account_snapshots;

CREATE POLICY "account_snapshots_select_own" ON public.account_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "account_snapshots_insert_own" ON public.account_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "account_snapshots_update_own" ON public.account_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS account_snapshots_user_date_idx
  ON public.account_snapshots (user_id, snapshot_date DESC);
