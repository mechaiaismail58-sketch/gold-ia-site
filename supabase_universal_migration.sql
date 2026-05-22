-- ============================================================
-- BullionDesk — Migration : Universal Trading Advisor
-- Ajoute les colonnes pour le profil multi-marchés et prop firm
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type TEXT
    CHECK (account_type IN ('prop_firm', 'personal', 'both')),
  ADD COLUMN IF NOT EXISTS prop_firm TEXT,
  ADD COLUMN IF NOT EXISTS prop_firm_phase TEXT
    CHECK (prop_firm_phase IN ('challenge_1', 'challenge_2', 'funded', 'personal')),
  ADD COLUMN IF NOT EXISTS primary_assets TEXT[],
  ADD COLUMN IF NOT EXISTS trading_style TEXT,
  ADD COLUMN IF NOT EXISTS risk_profile TEXT;
