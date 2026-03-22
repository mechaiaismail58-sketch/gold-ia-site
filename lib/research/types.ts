export type PriceContext = {
  xauusd: number | null;
  gc_f: number | null;
  gld: number | null;
  dxy: number | null;
  validated: boolean;
  divergence_pct: number | null;
  source_1: string;
  source_2: string;
};

export type MacroContext = {
  us10y: number | null;
  us2y: number | null;
  real_yield_10y: number | null;
  breakeven_10y: number | null;
  yield_curve_spread: number | null; // 10Y - 2Y
  us10y_direction: "rising" | "falling" | "stable" | "Data not found";
  real_yield_direction: "rising" | "falling" | "stable" | "Data not found";
  correlation_state: "Confirmed" | "Weak" | "Inverted" | "Decoupled" | "Data not found";
};

export type FVGZone = { high: number; low: number };

export type TechnicalContext = {
  current_price: number | null;
  timeframe_primary: string;
  timeframe_secondary: string;
  recent_high: number | null;
  recent_low: number | null;
  intraday_high: number | null;
  intraday_low: number | null;
  weekly_high: number | null;
  weekly_low: number | null;
  prev_day_high: number | null;
  prev_day_low: number | null;
  range_position_pct: number | null;
  distance_to_recent_high_pct: number | null;
  distance_to_recent_low_pct: number | null;
  h1_trend: "bullish" | "bearish" | "range" | "Data not found";
  m30_structure: "trend" | "range" | "compression" | "impulse" | "Data not found";
  short_term_regime:
    | "Trending Expansion"
    | "Trending Pullback"
    | "Range Compression"
    | "Breakout Transition"
    | "Data not found";
  momentum_5_bars_pct: number | null;
  average_bar_range_pct: number | null;
  atr_h1: number | null;
  price_change_24h_pct: number | null;
  volatility_state: "contracting" | "stable" | "expanding" | "Data not found";
  liquidity_above: number | null;
  liquidity_below: number | null;
  swing_high_h1: number | null;
  swing_low_h1: number | null;
  fvg_bullish_h1: FVGZone | null;
  fvg_bearish_h1: FVGZone | null;
  fvg_bullish_m30: FVGZone | null;
  fvg_bearish_m30: FVGZone | null;
  orderblock_bullish_h1: FVGZone | null;
  orderblock_bearish_h1: FVGZone | null;
};

export type MarketContext = {
  market_type: "XAUUSD / Gold";
  market_status: "OPEN" | "CLOSED";
  session_state: "WEEKDAY_ACTIVE" | "DAILY_BREAK" | "WEEKEND_CLOSED";
  active_session: "London" | "London/NY Overlap" | "New York" | "Asia" | "Overnight" | "Closed";
  session_liquidity: "High" | "Medium" | "Low";
  session_characteristics: string;
  is_weekend: boolean;
  now_utc: string;
  next_open_utc: string | null;
  next_open_note: string;
};

export type EventContext = {
  note: string;
};

export type NewsContext = {
  note: string;
};

export type ValidationContext = {
  completeness: "High" | "Medium" | "Low";
  source_consistency: "Valid" | "Inconsistent" | "Partial";
  timestamp_utc: string;
};

export type ResearchContext = {
  price_context: PriceContext;
  macro_context: MacroContext;
  technical_context: TechnicalContext;
  market_context: MarketContext;
  event_context: EventContext;
  news_context: NewsContext;
  validation_context: ValidationContext;
};

export type OHLCVBar = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
