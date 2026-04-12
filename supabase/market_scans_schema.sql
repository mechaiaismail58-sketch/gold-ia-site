-- ── Market Scanner Tables ──────────────────────────────────────────────────────
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.market_scans (
  id                    uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  scanned_at            timestamptz   DEFAULT now(),
  price                 float         NOT NULL,
  session               text,         -- 'asia', 'london', 'ny', 'closed'
  session_phase         text,         -- 'early', 'prime', 'late'
  -- Structure snapshot
  h1_trend              text,         -- 'bullish_hh_hl', 'bearish_lh_ll', 'range'
  h4_trend              text,
  h1_swing_high         float,
  h1_swing_low          float,
  -- Key indicators snapshot
  rsi_h1                float,
  rsi_h4                float,
  macd_h4_hist          float,
  adx_h4                float,
  atr_h1                float,
  ema20_h1              float,
  bb_state              text,         -- 'squeeze', 'expansion', 'normal'
  -- Order flow snapshot
  delta_h1              text,         -- 'buying', 'selling', 'neutral'
  delta_h4              text,
  cvd_signal            text,         -- 'confirming', 'diverging'
  -- Macro snapshot
  dxy                   float,
  real_yield            float,
  vix                   float,
  -- Computed signals
  near_level            boolean       DEFAULT false,
  near_level_name       text,
  near_level_distance   float,
  breakout_detected     boolean       DEFAULT false,
  breakout_type         text,         -- 'bullish_bos', 'bearish_bos', 'range_break_up', 'range_break_down'
  breakout_level        float,
  squeeze_active        boolean       DEFAULT false,
  delta_flip            boolean       DEFAULT false,
  delta_flip_direction  text,         -- 'to_buying', 'to_selling'
  volume_spike          boolean       DEFAULT false,
  alert_triggered       boolean       DEFAULT false,
  alert_message         text
);

CREATE INDEX IF NOT EXISTS idx_scans_time ON public.market_scans (scanned_at DESC);

-- No RLS on market_scans — it's a global market snapshot, not user-specific.
-- Access is restricted to the cron route via ADMIN_SECRET.

-- ── Scan Alerts ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scan_alerts (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  alert_type   text        NOT NULL, -- 'level_touch', 'breakout', 'delta_flip', 'squeeze_break', 'volume_spike'
  price        float       NOT NULL,
  message      text        NOT NULL,
  severity     text        DEFAULT 'info', -- 'info', 'important', 'critical'
  acknowledged boolean     DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_alerts_time ON public.scan_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacked ON public.scan_alerts (acknowledged, created_at DESC);
