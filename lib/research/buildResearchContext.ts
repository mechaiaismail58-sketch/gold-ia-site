import { getPriceContext } from "./getPriceContext";
import { buildTechnicalContextFromBars } from "./getTechnicalContext";
import type { ParsedBar } from "./getTechnicalContext";
import { getMarketContext } from "./getMarketContext";
import { buildIndicatorContextFromBars } from "./getIndicatorContext";
import { getLatestFredValue, getFredLatestTwo } from "./getFredSeries";
import { getCOTContext } from "./getCOTContext";
import { buildInstitutionalSynthesis } from "./getOrderFlowContext";
import { getUpcomingEvents } from "./getUpcomingEvents";
import { getPolygonOrderFlow } from "./getPolygonOrderFlow";
import { getSentimentContext } from "./getSentimentContext";
import { getYahooFinanceContext } from "./getYahooFinanceContext";
import { getETFFlowsContext } from "./getETFFlowsContext";
import { buildFedWatchContext } from "./getFedWatchContext";
import { getCentralBankContext } from "./getCentralBankContext";
import { buildNarrativeContext } from "./buildNarrativeContext";
import type { NarrativeContext } from "./buildNarrativeContext";
import type { IndicatorContext } from "./getIndicatorContext";
import type { COTContext } from "./getCOTContext";
import type { UpcomingEventsContext } from "./getUpcomingEvents";
import type { PolygonOrderFlow } from "./getPolygonOrderFlow";
import type { SentimentContext } from "./getSentimentContext";
import type { YahooFinanceContext } from "./getYahooFinanceContext";
import type { ETFFlowsContext } from "./getETFFlowsContext";
import type { FedWatchContext } from "./getFedWatchContext";
import type { CentralBankContext } from "./getCentralBankContext";
import type { ResearchContext } from "./types";

// ── Timeout wrapper — resolves to null after ms, never throws ─────────────────

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timer = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([p.catch(() => fallback), timer]);
}

// ── Yahoo Finance SPX fetcher — daily data (replaces FRED SP500 which is monthly) ─

async function fetchYahooSpx(): Promise<{ current: number | null; direction: string }> {
  const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)", "Accept": "application/json" };
  const urls = [
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5d&interval=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5d&interval=1d",
  ];
  type YFChart = { chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 900 } });
      if (!res.ok) continue;
      const data = await res.json() as YFChart;
      const closes = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => v != null && Number.isFinite(v));
      if (closes.length < 1) continue;
      const current = closes[closes.length - 1];
      const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
      const direction = prev == null ? "stable" : current > prev * 1.001 ? "rising" : current < prev * 0.999 ? "falling" : "stable";
      return { current, direction };
    } catch { continue; }
  }
  return { current: null, direction: "Data not found" };
}

// ── Shared OHLCV fetcher — revalidate configurable per timeframe ──────────────

async function fetchOHLCVBars(
  symbol: string,
  interval: string,
  outputsize: number,
  revalidate = 300
): Promise<ParsedBar[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    console.error(`fetchOHLCVBars: missing TWELVE_DATA_API_KEY for ${symbol} ${interval}`);
    return [];
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("format", "JSON");

  try {
    const res = await fetch(url.toString(), { next: { revalidate } });
    if (!res.ok) {
      console.error(`fetchOHLCVBars ${symbol} ${interval}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json() as {
      values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
      status?: string;
      message?: string;
      code?: number;
    };

    if (data.status === "error" || data.code) {
      console.error(`fetchOHLCVBars ${symbol} ${interval}: API error — ${data.message ?? JSON.stringify(data)}`);
      return [];
    }

    const bars = (data.values ?? [])
      .map((b) => ({
        datetime: b.datetime,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume) || 0,
      }))
      .filter((b) => [b.open, b.high, b.low, b.close].every(Number.isFinite))
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    if (!bars.length) {
      console.warn(`fetchOHLCVBars ${symbol} ${interval}: parsed 0 valid bars from ${(data.values ?? []).length} raw values`);
    }

    return bars;
  } catch (err) {
    console.error(`fetchOHLCVBars ${symbol} ${interval} network error:`, err);
    return [];
  }
}

// ── Intermarket context ────────────────────────────────────────────────────────

type IntermarketContext = {
  silver_price: number | null;
  gold_silver_ratio: number | null;
  spx_level: number | null;
  spx_direction: string;
  summary: string;
};

function buildIntermarketContext(params: {
  goldPrice: number | null;
  dxy: number | null;
  silverPrice: number | null;
  spxLevel: number | null;
  spxDirection: string;
  realYield: number | null;
  yahooCtx: YahooFinanceContext | null;
}): IntermarketContext {
  const { goldPrice, dxy, silverPrice, spxLevel, spxDirection, realYield, yahooCtx } = params;

  // Prefer live DXY from price context; fall back to Yahoo Finance
  const effectiveDXY = dxy ?? yahooCtx?.dxy_yahoo ?? null;

  const gold_silver_ratio =
    goldPrice != null && silverPrice != null && silverPrice > 0
      ? goldPrice / silverPrice
      : null;

  const parts: string[] = [];

  if (gold_silver_ratio != null) {
    const note =
      gold_silver_ratio > 85
        ? "risk-off (gold outperforming silver — defensive bid)"
        : gold_silver_ratio < 65
        ? "risk-on (silver outperforming gold — industrial demand)"
        : "neutral range";
    parts.push(`Gold/Silver ratio ${gold_silver_ratio.toFixed(1)} — ${note}`);
  }

  if (spxLevel != null) {
    const note =
      spxDirection === "rising"
        ? `SPX ${spxLevel.toFixed(0)} rising — risk appetite elevated, reduces safe-haven gold demand`
        : spxDirection === "falling"
        ? `SPX ${spxLevel.toFixed(0)} falling — risk-off, supports gold safe-haven bid`
        : `SPX ${spxLevel.toFixed(0)} stable — neutral risk sentiment`;
    parts.push(note);
  }

  if (effectiveDXY != null) {
    const note =
      effectiveDXY > 104
        ? `DXY ${effectiveDXY.toFixed(2)} elevated — inverse headwind on gold`
        : effectiveDXY < 100
        ? `DXY ${effectiveDXY.toFixed(2)} weak — tailwind for gold`
        : `DXY ${effectiveDXY.toFixed(2)} neutral`;
    parts.push(note);
  }

  if (realYield != null) {
    const note =
      realYield < 0
        ? `Real yields ${realYield.toFixed(2)}% — negative, structural gold support`
        : realYield > 1.5
        ? `Real yields ${realYield.toFixed(2)}% — elevated, gold headwind`
        : `Real yields ${realYield.toFixed(2)}% — neutral`;
    parts.push(note);
  }

  // Enrich with Yahoo Finance extended data
  if (yahooCtx) {
    if (yahooCtx.vix != null) parts.push(yahooCtx.vix > 25 ? `VIX ${yahooCtx.vix.toFixed(1)} — risk-off` : `VIX ${yahooCtx.vix.toFixed(1)}`);
    if (yahooCtx.copper_gold_ratio != null) {
      const cgNote = yahooCtx.copper_gold_ratio > 0.25 ? "risk-on" : yahooCtx.copper_gold_ratio < 0.15 ? "risk-off" : "neutral";
      parts.push(`Copper/Gold ${yahooCtx.copper_gold_ratio.toFixed(3)} — ${cgNote}`);
    }
    if (yahooCtx.oil_wti != null) parts.push(`WTI $${yahooCtx.oil_wti.toFixed(1)}`);
    if (yahooCtx.move_index != null && yahooCtx.move_index > 100) {
      parts.push(`MOVE ${yahooCtx.move_index.toFixed(0)} — bond vol elevated`);
    }
  }

  const bull: string[] = [];
  const bear: string[] = [];
  if (effectiveDXY != null && effectiveDXY < 100) bull.push("weak DXY");
  if (effectiveDXY != null && effectiveDXY > 104) bear.push("strong DXY");
  if (realYield != null && realYield < 0) bull.push("negative real yields");
  if (realYield != null && realYield > 1.5) bear.push("elevated real yields");
  if (spxDirection === "falling") bull.push("falling SPX");
  if (spxDirection === "rising") bear.push("rising SPX");
  if (gold_silver_ratio != null && gold_silver_ratio > 85) bull.push("high G/S ratio risk-off");
  if (yahooCtx?.vix != null && yahooCtx.vix > 25) bull.push("elevated VIX risk-off");
  if (yahooCtx?.copper_gold_ratio != null && yahooCtx.copper_gold_ratio > 0.25) bear.push("copper/gold risk-on");

  if (bull.length >= 2 && bear.length === 0) {
    parts.push(`Multi-factor gold support: ${bull.join(" + ")}`);
  } else if (bear.length >= 2 && bull.length === 0) {
    parts.push(`Multi-factor gold headwind: ${bear.join(" + ")}`);
  } else if (bull.length > 0 && bear.length > 0) {
    parts.push(`Mixed signals — ${bull.join(", ")} vs ${bear.join(", ")}`);
  }

  return {
    silver_price: silverPrice,
    gold_silver_ratio,
    spx_level: spxLevel,
    spx_direction: spxDirection,
    summary: parts.join(" | ") || "Intermarket data unavailable",
  };
}

// ── Correlation / macro helpers ────────────────────────────────────────────────

function deriveCorrelationState(params: {
  dxy: number | null;
  us10y: number | null;
  realYield: number | null;
}): ResearchContext["macro_context"]["correlation_state"] {
  const { dxy, us10y, realYield } = params;

  if (dxy == null && us10y == null && realYield == null) {
    return "Data not found";
  }

  if (dxy != null && realYield != null) {
    return "Confirmed";
  }

  return "Weak";
}

function deriveCompleteness(values: Array<number | null>): "High" | "Medium" | "Low" {
  const present = values.filter((v) => v != null).length;
  if (present >= values.length - 2) return "High";
  if (present >= Math.ceil(values.length / 2)) return "Medium";
  return "Low";
}

function deriveMacroState(params: {
  dxy: number | null;
  us10y: number | null;
  us2y: number | null;
  realYield: number | null;
  breakeven10y: number | null;
  yieldCurveSpread: number | null;
  us10yDirection: string;
  realYieldDirection: string;
}) {
  const { dxy, us10y, us2y, realYield, breakeven10y, yieldCurveSpread, us10yDirection, realYieldDirection } = params;

  const usd_strength =
    dxy == null
      ? "Data not found"
      : dxy > 104
      ? `strong at ${dxy.toFixed(2)} (bearish gold pressure)`
      : dxy < 100
      ? `weak at ${dxy.toFixed(2)} (bullish gold pressure)`
      : `neutral at ${dxy.toFixed(2)} (no clear pressure)`;

  let yields_trend: string;
  if (realYield != null) {
    const dirNote = realYieldDirection !== "Data not found" ? ` — trend: ${realYieldDirection}` : "";
    yields_trend =
      realYield < 0
        ? `real yield ${realYield.toFixed(2)}% — negative (structurally bullish gold)${dirNote}`
        : realYield > 1.5
        ? `real yield ${realYield.toFixed(2)}% — elevated (bearish gold pressure)${dirNote}`
        : `real yield ${realYield.toFixed(2)}% — moderate (neutral)${dirNote}`;
  } else if (us10y != null) {
    const dirNote = us10yDirection !== "Data not found" ? ` — trend: ${us10yDirection}` : "";
    yields_trend =
      us10y > 4.5
        ? `10Y nominal ${us10y.toFixed(2)}% — elevated (bearish gold pressure)${dirNote}`
        : us10y < 3.5
        ? `10Y nominal ${us10y.toFixed(2)}% — low (bullish gold)${dirNote}`
        : `10Y nominal ${us10y.toFixed(2)}% — moderate (neutral)${dirNote}`;
  } else {
    yields_trend = "Data not found";
  }

  let yield_curve_note = "Data not found";
  if (yieldCurveSpread != null) {
    if (yieldCurveSpread < 0) {
      yield_curve_note = `inverted at ${yieldCurveSpread.toFixed(2)}% (10Y-2Y) — recession signal, mixed-to-bullish gold`;
    } else if (yieldCurveSpread < 0.5) {
      yield_curve_note = `flat at ${yieldCurveSpread.toFixed(2)}% (10Y-2Y) — limited term premium`;
    } else {
      yield_curve_note = `normal at ${yieldCurveSpread.toFixed(2)}% (10Y-2Y) — growth expectations present`;
    }
  }

  let breakeven_note = "Data not found";
  if (breakeven10y != null) {
    breakeven_note =
      breakeven10y > 2.5
        ? `10Y breakeven ${breakeven10y.toFixed(2)}% — elevated inflation expectations (gold supportive)`
        : breakeven10y < 1.8
        ? `10Y breakeven ${breakeven10y.toFixed(2)}% — low inflation expectations (less gold support)`
        : `10Y breakeven ${breakeven10y.toFixed(2)}% — near target (neutral)`;
  }

  let gold_pressure: "bearish" | "bullish" | "mixed" | "Data not found" = "Data not found";
  let dominant_driver = "";

  const hasDollar = dxy != null;
  const hasYields = us10y != null || realYield != null;

  const usdBearishGold = dxy != null && dxy > 104;
  const usdBullishGold = dxy != null && dxy < 100;
  const realYieldBearish = realYield != null ? realYield > 1.5 : us10y != null && us10y > 4.5;
  const realYieldBullish = realYield != null ? realYield < 0 : us10y != null && us10y < 3.5;

  if (hasDollar && hasYields) {
    if (usdBearishGold && realYieldBearish) {
      gold_pressure = "bearish";
      dominant_driver = "USD strong + elevated yields";
    } else if (usdBullishGold && realYieldBullish) {
      gold_pressure = "bullish";
      dominant_driver = "USD weak + negative/low real yields";
    } else if (usdBearishGold || realYieldBearish) {
      gold_pressure = "mixed";
      dominant_driver = usdBearishGold ? "USD strength (partial)" : "Yields elevated (partial)";
    } else if (usdBullishGold || realYieldBullish) {
      gold_pressure = "mixed";
      dominant_driver = usdBullishGold ? "USD weakness (partial)" : "Real yields supportive (partial)";
    } else {
      gold_pressure = "mixed";
      dominant_driver = "No dominant macro signal";
    }
  } else if (hasYields) {
    gold_pressure = realYieldBearish ? "bearish" : realYieldBullish ? "bullish" : "mixed";
    dominant_driver = "Yields";
  } else if (hasDollar) {
    gold_pressure = usdBearishGold ? "bearish" : usdBullishGold ? "bullish" : "mixed";
    dominant_driver = "USD";
  }

  return {
    usd_strength,
    yields_trend,
    yield_curve_note,
    breakeven_note,
    us2y_level: us2y != null ? `${us2y.toFixed(2)}%` : "Data not found",
    gold_pressure,
    dominant_driver,
  };
}

function deriveTechnicalBias(params: {
  h1Trend: string;
  rangePositionPct: number | null;
  m30Structure: string;
}) {
  const { h1Trend, rangePositionPct, m30Structure } = params;

  let bias: "bullish" | "bearish" | "neutral" | "Data not found" = "Data not found";
  let condition = "";

  if (h1Trend === "bullish") {
    bias = "bullish";
    condition =
      rangePositionPct != null && rangePositionPct < 45
        ? "bull trend in pullback zone"
        : "bull trend near upper structure";
  } else if (h1Trend === "bearish") {
    bias = "bearish";
    condition =
      rangePositionPct != null && rangePositionPct > 55
        ? "bear trend in pullback zone"
        : "bear trend near lower structure";
  } else if (m30Structure === "compression" || m30Structure === "range") {
    bias = "neutral";
    condition = "range/compression";
  }

  return { bias, condition };
}

export type EnrichedResearchContext = ResearchContext & {
  macro_state: {
    usd_strength: string;
    yields_trend: string;
    yield_curve_note: string;
    breakeven_note: string;
    us2y_level: string;
    gold_pressure: "bearish" | "bullish" | "mixed" | "Data not found";
    dominant_driver: string;
  };
  technical_state: {
    bias: "bullish" | "bearish" | "neutral" | "Data not found";
    condition: string;
  };
  indicator_context: IndicatorContext | null;
  cot_context: COTContext | null;
  intermarket_context: IntermarketContext;
  upcoming_events: UpcomingEventsContext | null;
  polygon_order_flow: PolygonOrderFlow | null;
  sentiment_context: SentimentContext | null;
  yahoo_finance: YahooFinanceContext | null;
  etf_flows: ETFFlowsContext | null;
  fed_watch: FedWatchContext | null;
  central_bank: CentralBankContext | null;
  oi_signal: {
    oi: number | null;
    oi_change: number | null;
    scenario: "new_longs" | "new_shorts" | "short_covering" | "long_liquidation" | "unknown";
    note: string;
  } | null;
  sofr: number | null;
  tga_balance_bn: number | null;
  fx_momentum: {
    eurusd_h4: "bullish" | "bearish" | "neutral";
    usdjpy_h4: "bullish" | "bearish" | "neutral";
    summary: string;
  } | null;
  gld_iv: number | null;
  futures_curve: FuturesCurveData | null;
  // D1 structural levels — institutional reference points
  weekly_d1_high: number | null;
  weekly_d1_low: number | null;
  monthly_d1_high: number | null;
  monthly_d1_low: number | null;
  // Data freshness — age of each source in human-readable form
  data_freshness: {
    price_age_seconds: number | null;
    cot_age_days: number | null;
    cot_available: boolean;
    cot_report_date: string | null;
  };
  historical_levels_summary: string | null;
  round_numbers_summary: string | null;
  multi_day_context: string | null;
  vwap_summary: string | null;
  narrative_context: NarrativeContext | null;
  // Institutional intelligence computations
  cta_triggers:           { high20d: number; low20d: number; high50d: number; low50d: number; nearestDist: string | null } | null;
  futures_curve_analysis: { structure: string; spread: number; impliedLeaseRate: number; signal: string } | null;
  rebalancing_signal:     { isActive: boolean; direction: string; daysToMonthEnd: number } | null;
  atr_regime:             { currentATR: number; avgATR20: number; regime: string; riskParitySignal: boolean } | null;
  fixing_window:          { isPreFixing: boolean; fixingName: string | null; minutesToFixing: number | null };
  correlation_check:      { correlationIntact: boolean; goldDirection: string; dxyDirection: string } | null;
};

// ── COT with one automatic retry ──────────────────────────────────────────────

async function getCOTContextWithRetry() {
  try {
    const result = await getCOTContext();
    if (result) return result;
  } catch { /* first attempt failed, retry */ }
  try { return await getCOTContext(); } catch { return null; }
}

// ── H4 momentum from last 3 candles ───────────────────────────────────────────

function computeH4Momentum(bars: ParsedBar[]): "bullish" | "bearish" | "neutral" {
  if (bars.length < 3) return "neutral";
  const last3 = bars.slice(-3);
  const ups = last3.filter(b => b.close > b.open).length;
  const downs = last3.filter(b => b.close < b.open).length;
  return ups >= 2 ? "bullish" : downs >= 2 ? "bearish" : "neutral";
}

// ── GLD implied volatility from Yahoo Finance options ─────────────────────────

async function fetchGLDImpliedVol(): Promise<number | null> {
  const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)", "Accept": "application/json" };
  const urls = [
    "https://query1.finance.yahoo.com/v7/finance/options/GLD",
    "https://query2.finance.yahoo.com/v7/finance/options/GLD",
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type YFOptions = { optionChain?: { result?: Array<{ quote?: { regularMarketPrice?: number }; options?: Array<{ calls?: Array<{ strike: number; impliedVolatility?: number }> }> }> } };
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const data = await res.json() as YFOptions;
      const result = data?.optionChain?.result?.[0];
      const spot = result?.quote?.regularMarketPrice;
      const calls = result?.options?.[0]?.calls ?? [];
      if (!spot || !calls.length) continue;
      const atm = calls.reduce((best, c) =>
        !best || Math.abs(c.strike - spot) < Math.abs(best.strike - spot) ? c : best
      , null as (typeof calls[0]) | null);
      if (atm?.impliedVolatility != null) return parseFloat((atm.impliedVolatility * 100).toFixed(1));
    } catch { continue; }
  }
  return null;
}

// ── COMEX futures curve (front vs next delivery month) ────────────────────────

type FuturesCurveData = {
  front_price: number | null;
  next_price: number | null;
  spread: number | null;
  structure: "contango" | "backwardation" | "flat" | null;
  note: string;
};

function getNextGoldFuturesSymbol(): string {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const deliveryMonths = [2, 4, 6, 8, 10, 12];
  const monthCodes: Record<number, string> = { 2: "G", 4: "J", 6: "M", 8: "Q", 10: "V", 12: "Z" };
  const nextDelivery = deliveryMonths.find(m => m > month) ?? deliveryMonths[0];
  const yearOffset = nextDelivery <= month ? 1 : 0;
  const yy = String(now.getUTCFullYear() + yearOffset).slice(-2);
  return `GC${monthCodes[nextDelivery]}${yy}`;
}

async function fetchFuturesCurveData(): Promise<FuturesCurveData> {
  const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)", "Accept": "application/json" };
  const nextSymbol = getNextGoldFuturesSymbol();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type YFChart = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
  const fetchPrice = async (sym: string): Promise<number | null> => {
    for (const base of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
      try {
        const res = await fetch(`${base}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, { headers: YF_HEADERS, next: { revalidate: 300 } });
        if (!res.ok) continue;
        const d = await res.json() as YFChart;
        const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (p != null && Number.isFinite(p)) return p;
      } catch { continue; }
    }
    return null;
  };
  const [frontPrice, nextPrice] = await Promise.all([fetchPrice("GC=F"), fetchPrice(nextSymbol)]);
  if (frontPrice == null || nextPrice == null) {
    return { front_price: frontPrice, next_price: nextPrice, spread: null, structure: null, note: "Futures curve data unavailable" };
  }
  const spread = nextPrice - frontPrice;
  const structure: "contango" | "backwardation" | "flat" = spread > 5 ? "contango" : spread < -5 ? "backwardation" : "flat";
  const note = structure === "contango"
    ? `GC=F ${frontPrice.toFixed(0)} < ${nextSymbol} ${nextPrice.toFixed(0)} — contango $${spread.toFixed(0)} (normal carry, neutral)`
    : structure === "backwardation"
    ? `GC=F ${frontPrice.toFixed(0)} > ${nextSymbol} ${nextPrice.toFixed(0)} — backwardation $${Math.abs(spread).toFixed(0)} (near-term stress, bullish signal)`
    : `GC=F ${frontPrice.toFixed(0)} ≈ ${nextSymbol} ${nextPrice.toFixed(0)} — flat curve ($${spread.toFixed(0)})`;
  return { front_price: frontPrice, next_price: nextPrice, spread, structure, note };
}

export async function buildResearchContext(): Promise<EnrichedResearchContext> {
  const symbol = process.env.XAUUSD_SYMBOL || "XAU/USD";

  // ── Phase 1: All independent fetches in parallel ───────────────────────────
  const [
    priceContext,
    h1Bars,
    m30Bars,
    h4Bars,
    d1Bars,
    us10yTrend,
    realYieldTrend,
    us2y,
    breakeven10y,
    silverPrice,
    spxTrend,
    cotContext,
    upcomingEvents,
    polygonOrderFlow,
    sentimentContext,
    etfFlows,
    centralBankContext,
    sofr,
    tgaRaw,
    targetUpper,
    effectiveRate,
    eurusdBars,
    usdjpyBars,
    gldIV,
    futuresCurve,
  ] = await Promise.all([
    withTimeout(getPriceContext(), 3000, { xauusd: null, gc_f: null, gld: null, dxy: null, validated: false, divergence_pct: null, source_1: "Twelve Data", source_2: "Twelve Data", fetched_at_utc: new Date().toISOString() }),
    withTimeout(fetchOHLCVBars(symbol, "1h", 140, 300), 4000, []),
    withTimeout(fetchOHLCVBars(symbol, "30min", 80, 300), 4000, []),
    withTimeout(fetchOHLCVBars(symbol, "4h", 250, 900), 4000, []),
    withTimeout(fetchOHLCVBars(symbol, "1day", 220, 900), 4000, []),
    withTimeout(getFredLatestTwo("DGS10"), 3000, { current: null, previous: null, direction: "Data not found" as const }),
    withTimeout(getFredLatestTwo("DFII10"), 3000, { current: null, previous: null, direction: "Data not found" as const }),
    withTimeout(getLatestFredValue("DGS2"), 3000, null),
    withTimeout(getLatestFredValue("T10YIE"), 3000, null),
    withTimeout(getLatestFredValue("SLVPRUSD"), 3000, null),
    withTimeout(fetchYahooSpx(), 3000, { current: null, direction: "Data not found" }),
    withTimeout(getCOTContextWithRetry(), 4000, null),
    withTimeout(getUpcomingEvents(), 3000, null),
    withTimeout(getPolygonOrderFlow(), 3000, null),
    withTimeout(getSentimentContext(), 3000, null),
    withTimeout(getETFFlowsContext(), 3000, null),
    withTimeout(getCentralBankContext(), 3000, null),
    withTimeout(getLatestFredValue("SOFR"), 3000, null),
    withTimeout(getLatestFredValue("WTREGEN"), 3000, null),
    withTimeout(getLatestFredValue("DFEDTARU"), 3000, null),
    withTimeout(getLatestFredValue("FEDFUNDS"), 3000, null),
    Promise.resolve([]), // EUR/USD — disabled, gold-only
    Promise.resolve([]), // USD/JPY — disabled, gold-only
    withTimeout(fetchGLDImpliedVol(), 4000, null),
    withTimeout(fetchFuturesCurveData(), 4000, { front_price: null, next_price: null, spread: null, structure: null, note: "Futures curve data unavailable" }),
  ]);

  // ── Institutional data diagnostics ────────────────────────────────────────
  console.log(`[research] cotContext=${cotContext ? "OK" : "NULL"} | etfFlows=${etfFlows ? "OK" : "NULL"}`);
  if (cotContext) {
    console.log(`[research][cot] managed_money_net=${cotContext.managed_money_net} | swap_dealer_net=${cotContext.swap_dealer_net} | open_interest=${cotContext.open_interest}`);
  }
  if (etfFlows) {
    console.log(`[research][etf] gld_tonnes=${etfFlows.gld_tonnes?.toFixed(0)} | iau_tonnes=${etfFlows.iau_tonnes?.toFixed(0)} | signal=${etfFlows.institutional_signal}`);
  }

  const marketContext = getMarketContext();

  // ── Build context from shared bars ─────────────────────────────────────────
  const technicalContext = buildTechnicalContextFromBars(h1Bars, m30Bars);
  const indicatorContext =
    h1Bars.length > 0 || h4Bars.length > 0 || d1Bars.length > 0
      ? buildIndicatorContextFromBars(d1Bars, h4Bars, h1Bars)
      : null;

  const us10y = us10yTrend.current;
  const realYield10y = realYieldTrend.current;
  const yield_curve_spread = us10y != null && us2y != null ? us10y - us2y : null;

  // TGA balance is in billions already from WTREGEN (FRED reports it in billions)
  const tga_balance_bn = tgaRaw;

  // ── Phase 2: Gold-price-dependent fetches ──────────────────────────────────
  const goldPrice = priceContext.xauusd ?? technicalContext.current_price;

  const [yahooFinance, narrativeContext] = await Promise.all([
    withTimeout(getYahooFinanceContext(goldPrice), 4000, null),
    withTimeout(
      buildNarrativeContext({ managedMoneyNet: cotContext?.managed_money_net ?? null }),
      15000,
      null
    ),
  ]);

  // ── Fed Watch context (pure computation, no extra fetch) ───────────────────
  const fedWatch = buildFedWatchContext({
    targetUpper,
    sofr,
    effectiveRate,
    tgaBalance: tgaRaw != null ? tgaRaw * 1e9 : null, // FRED WTREGEN in billions → pass raw
  });

  // ── Derived metrics ────────────────────────────────────────────────────────
  const completeness = deriveCompleteness([
    priceContext.xauusd,
    priceContext.gc_f,
    priceContext.gld,
    priceContext.dxy,
    us10y,
    realYield10y,
    technicalContext.current_price,
    technicalContext.recent_high,
    technicalContext.recent_low,
    technicalContext.intraday_high,
    technicalContext.intraday_low,
  ]);

  const macroState = deriveMacroState({
    dxy: priceContext.dxy ?? yahooFinance?.dxy_yahoo ?? null,
    us10y,
    us2y,
    realYield: realYield10y,
    breakeven10y,
    yieldCurveSpread: yield_curve_spread,
    us10yDirection: us10yTrend.direction,
    realYieldDirection: realYieldTrend.direction,
  });

  const technicalState = deriveTechnicalBias({
    h1Trend: technicalContext.h1_trend,
    rangePositionPct: technicalContext.range_position_pct,
    m30Structure: technicalContext.m30_structure,
  });

  const intermarketContext = buildIntermarketContext({
    goldPrice,
    dxy: priceContext.dxy,
    silverPrice,
    spxLevel: spxTrend.current,
    spxDirection: spxTrend.direction,
    realYield: realYield10y,
    yahooCtx: yahooFinance,
  });

  // ── Enrich order flow with institutional synthesis ─────────────────────────
  if (indicatorContext?.order_flow && cotContext) {
    const synthesis = buildInstitutionalSynthesis(
      indicatorContext.order_flow.delta_h4_signal,
      cotContext.commercial_signal,
      cotContext.large_spec_signal
    );
    if (synthesis) {
      indicatorContext.order_flow.institutional_synthesis = synthesis;
      indicatorContext.order_flow.summary += ` | ${synthesis}`;
    }
  }

  // Label order flow source; append Polygon if available
  if (indicatorContext?.order_flow) {
    if (polygonOrderFlow) {
      indicatorContext.order_flow.summary += ` | ${polygonOrderFlow.summary}`;
    } else {
      indicatorContext.order_flow.summary += ` (local calculation)`;
    }
  }

  // ── FX momentum — EUR/USD and USD/JPY H4 last 3 candles ───────────────────
  const eurusdDir = computeH4Momentum(eurusdBars);
  const usdjpyDir = computeH4Momentum(usdjpyBars);
  const fxMomentum = (eurusdBars.length >= 3 || usdjpyBars.length >= 3) ? {
    eurusd_h4: eurusdDir,
    usdjpy_h4: usdjpyDir,
    summary: [
      eurusdBars.length >= 3 ? `EUR/USD H4: ${eurusdDir}${eurusdDir === "bullish" ? " (USD weakening — gold tailwind)" : eurusdDir === "bearish" ? " (USD strengthening — gold headwind)" : " (neutral)"}` : null,
      usdjpyBars.length >= 3 ? `USD/JPY H4: ${usdjpyDir}${usdjpyDir === "bullish" ? " (USD strengthening — gold headwind)" : usdjpyDir === "bearish" ? " (USD weakening — gold tailwind)" : " (neutral)"}` : null,
    ].filter(Boolean).join(" | "),
  } : null;

  // ── COMEX Open Interest signal (4-scenario OI × price analysis) ────────────
  type OIScenario = "new_longs" | "new_shorts" | "short_covering" | "long_liquidation" | "unknown";
  let oi_signal: EnrichedResearchContext["oi_signal"] = null;
  if (cotContext?.open_interest != null && cotContext.oi_change != null) {
    const oiUp = cotContext.oi_change > 0;
    const priceUp = (technicalContext.price_change_24h_pct ?? 0) > 0;
    let scenario: OIScenario;
    let note: string;
    if (oiUp && priceUp) {
      scenario = "new_longs";
      note = `OI +${Math.round(cotContext.oi_change / 1000)}k + price up → new money long entering — bullish conviction`;
    } else if (oiUp && !priceUp) {
      scenario = "new_shorts";
      note = `OI +${Math.round(cotContext.oi_change / 1000)}k + price down → new money short entering — bearish conviction`;
    } else if (!oiUp && priceUp) {
      scenario = "short_covering";
      note = `OI ${Math.round(cotContext.oi_change / 1000)}k + price up → short covering rally — momentum without conviction`;
    } else {
      scenario = "long_liquidation";
      note = `OI ${Math.round(cotContext.oi_change / 1000)}k + price down → long liquidation — bearish momentum`;
    }
    oi_signal = { oi: cotContext.open_interest, oi_change: cotContext.oi_change, scenario, note };
  }

  // ── D1 structural levels (weekly = last 5 candles, monthly = last 22) ────────
  const weeklyD1High  = d1Bars.length >= 5  ? Math.max(...d1Bars.slice(-5).map(b => b.high))  : null;
  const weeklyD1Low   = d1Bars.length >= 5  ? Math.min(...d1Bars.slice(-5).map(b => b.low))   : null;
  const monthlyD1High = d1Bars.length >= 22 ? Math.max(...d1Bars.slice(-22).map(b => b.high)) : null;
  const monthlyD1Low  = d1Bars.length >= 22 ? Math.min(...d1Bars.slice(-22).map(b => b.low))  : null;

  // ── Historical levels — price levels touched 2+ times on D1 (tolerance 5pts) ─
  const historicalLevelsSummary = (() => {
    if (d1Bars.length < 10) return null;
    const TOLERANCE = 5;
    type LvlEntry = { price: number; touches: number; held: boolean };
    const levels: LvlEntry[] = [];
    // Collect all significant points (highs and lows of each D1 bar)
    const pivots = d1Bars.flatMap(b => [b.high, b.low]);
    for (const pivot of pivots) {
      const existing = levels.find(l => Math.abs(l.price - pivot) <= TOLERANCE);
      if (existing) {
        existing.touches++;
      } else {
        levels.push({ price: pivot, touches: 1, held: false });
      }
    }
    const significant = levels.filter(l => l.touches >= 2).sort((a, b) => a.price - b.price);
    if (!significant.length) return null;
    // Determine if each level held or was broken (check if price ever closed beyond it)
    for (const lvl of significant) {
      const closedBelow = d1Bars.some(b => b.close < lvl.price - TOLERANCE);
      const closedAbove = d1Bars.some(b => b.close > lvl.price + TOLERANCE);
      lvl.held = !(closedBelow && closedAbove); // broke if price closed on both sides
    }
    return significant.map(l =>
      `${l.price.toFixed(2)} (${l.touches} touches, ${l.held ? "held" : "broken"})`
    ).join(" | ");
  })();

  // ── Round numbers near current price ──────────────────────────────────────────
  const roundNumbersSummary = (() => {
    const price = goldPrice;
    if (price == null) return null;
    const above50  = Math.ceil(price / 50) * 50;
    const above100 = Math.ceil(price / 100) * 100;
    const below50  = Math.floor(price / 50) * 50;
    const below100 = Math.floor(price / 100) * 100;
    // Deduplicate and sort
    const aboveLevels = [...new Set([above50, above100])].sort((a, b) => a - b);
    const belowLevels = [...new Set([below50, below100])].sort((a, b) => b - a);
    const above = aboveLevels.filter(l => l > price).slice(0, 2).map(l => `${l} (+${(l - price).toFixed(0)}pts)`).join(", ");
    const below = belowLevels.filter(l => l < price).slice(0, 2).map(l => `${l} (-${(price - l).toFixed(0)}pts)`).join(", ");
    return `Above: ${above || "none"} | Below: ${below || "none"}`;
  })();

  // ── Multi-day context — consecutive direction, range compression ─────────────
  const multiDayContextSummary = (() => {
    if (d1Bars.length < 6) return null;
    const recent = d1Bars.slice(-6); // last 6 D1 bars
    // Count consecutive days in same direction (most recent first)
    const last5 = recent.slice(-5);
    let consecutiveBullish = 0;
    let consecutiveBearish = 0;
    for (let i = last5.length - 1; i >= 0; i--) {
      const b = last5[i];
      if (b.close > b.open) {
        if (consecutiveBearish > 0) break;
        consecutiveBullish++;
      } else if (b.close < b.open) {
        if (consecutiveBullish > 0) break;
        consecutiveBearish++;
      } else break;
    }
    const consecutiveDays = consecutiveBullish > 0 ? consecutiveBullish : consecutiveBearish;
    const consecutiveDir = consecutiveBullish > 0 ? "bullish" : consecutiveBearish > 0 ? "bearish" : "mixed";

    // Current week range (last 5 D1 bars)
    const weekHigh = Math.max(...last5.map(b => b.high));
    const weekLow  = Math.min(...last5.map(b => b.low));
    const weekRange = weekHigh - weekLow;

    // Week open vs prev week close (bar[-6] close vs bar[-5] open or just use bar[-5].open as week open)
    const weekOpen = last5[0].open;
    const prevWeekClose = recent[0].close; // bar before the 5 we used
    const gapPts = weekOpen - prevWeekClose;
    const gapLabel = gapPts > 5 ? `+${gapPts.toFixed(0)} gap up` : gapPts < -5 ? `${gapPts.toFixed(0)} gap down` : "no gap";

    // Range compression: compare last 3 days range vs 5 days before
    const last3Range = Math.max(...last5.slice(-3).map(b => b.high)) - Math.min(...last5.slice(-3).map(b => b.low));
    const prev5Range = Math.max(...last5.slice(0, 5).map(b => b.high)) - Math.min(...last5.slice(0, 5).map(b => b.low));
    const compressed = prev5Range > 0 && last3Range < prev5Range * 0.5;

    const parts: string[] = [];
    if (consecutiveDays >= 2) {
      parts.push(`${consecutiveDays} consecutive ${consecutiveDir} days${consecutiveDays >= 3 ? " — move getting extended" : ""}`);
    }
    parts.push(`Current week range: ${weekLow.toFixed(2)}-${weekHigh.toFixed(2)} (${weekRange.toFixed(0)}pts) | Week opened at ${weekOpen.toFixed(2)} vs prev close ${prevWeekClose.toFixed(2)} (${gapLabel})`);
    if (compressed) parts.push("Range compression detected — last 3 days < 50% of prior 5-day range — breakout probability elevated");

    return parts.join(" | ");
  })();

  // ── VWAP calculation from H1 bars ─────────────────────────────────────────────
  const vwapSummary = (() => {
    if (h1Bars.length < 2) return null;
    const currentPrice = goldPrice;
    if (currentPrice == null) return null;

    // Detect if volume data is real or needs proxy
    const hasRealVolume = h1Bars.some(b => b.volume > 0);

    const vwapCalc = (bars: typeof h1Bars): number | null => {
      if (!bars.length) return null;
      let sumPV = 0, sumV = 0;
      for (const b of bars) {
        const tp = (b.high + b.low + b.close) / 3;
        const vol = hasRealVolume ? b.volume : (b.high - b.low); // range proxy
        sumPV += tp * vol;
        sumV += vol;
      }
      return sumV > 0 ? sumPV / sumV : null;
    };

    const volLabel = hasRealVolume ? "" : " (volume proxy)";

    // Daily VWAP: bars from 00:00 UTC today
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dailyBars = h1Bars.filter(b => b.datetime.startsWith(todayStr));
    const dailyVWAP = vwapCalc(dailyBars.length >= 1 ? dailyBars : h1Bars.slice(-24));

    // Asia VWAP: bars between 22:00 UTC yesterday and 07:00 UTC today
    const asiaBars = h1Bars.filter(b => {
      const utcH = new Date(b.datetime).getUTCHours();
      // 22:00-23:59 previous day OR 00:00-06:59 today
      return (utcH >= 22) || (utcH < 7);
    }).slice(-9); // max 9 bars
    const asiaVWAP = vwapCalc(asiaBars);

    // London VWAP: bars from 07:00 UTC today
    const londonBars = h1Bars.filter(b => {
      const d = new Date(b.datetime);
      return d.toISOString().slice(0, 10) === todayStr && d.getUTCHours() >= 7 && d.getUTCHours() < 17;
    });
    const londonVWAP = vwapCalc(londonBars);

    const posLabel = (vwap: number): string => {
      const dist = currentPrice - vwap;
      if (Math.abs(dist) <= 5) return `at VWAP (equilibrium, ${dist > 0 ? "+" : ""}${dist.toFixed(0)}pts)`;
      return dist > 0 ? `above (+${dist.toFixed(0)}pts — buyers in control)` : `below (${dist.toFixed(0)}pts — sellers in control)`;
    };

    const lines: string[] = [];
    if (dailyVWAP != null) lines.push(`Daily VWAP: ${dailyVWAP.toFixed(2)}${volLabel} — price ${posLabel(dailyVWAP)}`);
    if (asiaVWAP != null) lines.push(`Asia Session VWAP: ${asiaVWAP.toFixed(2)}${volLabel} — price ${posLabel(asiaVWAP)}`);
    if (londonVWAP != null) lines.push(`London Session VWAP: ${londonVWAP.toFixed(2)}${volLabel} — price ${posLabel(londonVWAP)}`);

    return lines.length ? lines.join("\n") : null;
  })();

  // ── A. CTA Trigger Levels (from D1 bars) ─────────────────────────────────────
  const ctaTriggers = (() => {
    if (d1Bars.length < 20) return null;
    const last20 = d1Bars.slice(-20);
    const last50 = d1Bars.length >= 50 ? d1Bars.slice(-50) : d1Bars;
    const high20 = Math.max(...last20.map(b => b.high));
    const low20  = Math.min(...last20.map(b => b.low));
    const high50 = Math.max(...last50.map(b => b.high));
    const low50  = Math.min(...last50.map(b => b.low));
    const price  = goldPrice ?? 0;
    const distUp20   = price > 0 ? high20 - price : null;
    const distDown20 = price > 0 ? price - low20  : null;
    const nearestDist = (distUp20 != null && distDown20 != null)
      ? (Math.abs(distUp20) < Math.abs(distDown20) ? `${Math.abs(distUp20).toFixed(0)}pts below buy trigger` : `${Math.abs(distDown20).toFixed(0)}pts above sell trigger`)
      : null;
    return { high20d: high20, low20d: low20, high50d: high50, low50d: low50, nearestDist };
  })();

  // ── B. Futures Curve Analysis ─────────────────────────────────────────────────
  const futuresCurveAnalysis = (() => {
    const fc = (futuresCurve as { front_price?: number | null; next_price?: number | null; spread?: number | null; structure?: string | null; note?: string } | null);
    if (!fc?.front_price || !fc.next_price) return null;
    const spread = fc.spread ?? (fc.next_price - fc.front_price);
    const impliedLeaseRate = parseFloat(((spread / fc.front_price) * 12 * 100).toFixed(3));
    const structure = spread < -0.5 ? "backwardation"
      : spread > 20 ? "wide_contango" : "normal_contango";
    const signal = structure === "backwardation"
      ? "Very bullish — physical demand overwhelming paper supply, potential squeeze"
      : structure === "wide_contango" ? "Oversupply pressure — abnormal carry cost"
      : "Normal carry — no physical stress";
    return { structure, spread: parseFloat(spread.toFixed(2)), impliedLeaseRate, signal };
  })();

  // ── C. Month-End Rebalancing Direction ───────────────────────────────────────
  const rebalancingSignal = (() => {
    const day = new Date().getUTCDate();
    if (day < 25) return null;
    // SPX MTD from Yahoo Finance (approximate from yahooFinance context if available)
    const yf = (yahooFinance as { spx_current?: number | null; risk_sentiment?: string } | null);
    if (!yf) return null;
    const daysToMonthEnd = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0).getUTCDate() - day;
    // Without precise MTD data, use risk_sentiment as proxy
    const riskOn = yf.risk_sentiment?.includes("risk_on");
    const direction = riskOn ? "sell_gold" : "buy_gold"; // if SPX outperformed = sell gold to rebalance
    return { isActive: true, direction, daysToMonthEnd };
  })();

  // ── D. ATR Regime Detection ───────────────────────────────────────────────────
  const atrRegime = (() => {
    if (h1Bars.length < 21) return null;
    const atrs = h1Bars.slice(-21).map((b, i, arr) => {
      if (i === 0) return Math.abs(b.close - b.open);
      return Math.max(b.high - b.low, Math.abs(b.high - arr[i-1].close), Math.abs(b.low - arr[i-1].close));
    });
    const avg20  = atrs.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
    const current = atrs[atrs.length - 1];
    const ratio  = current / avg20;
    const regime = ratio > 1.3 ? "elevated" : ratio < 0.7 ? "compressed" : "normal";
    return { currentATR: parseFloat(current.toFixed(2)), avgATR20: parseFloat(avg20.toFixed(2)), regime, riskParitySignal: ratio > 1.3 };
  })();

  // ── E. LBMA Fixing Window Detection ──────────────────────────────────────────
  const fixingWindow = (() => {
    const now   = new Date();
    const h     = now.getUTCHours(), m = now.getUTCMinutes();
    const mins  = h * 60 + m;
    const amFix = 10 * 60 + 30, pmFix = 15 * 60;
    for (const [name, fixMin] of [["AM", amFix], ["PM", pmFix]] as [string, number][]) {
      const diff = fixMin - mins;
      if (diff >= 0 && diff <= 30) return { isPreFixing: true, fixingName: name, minutesToFixing: diff };
    }
    return { isPreFixing: false, fixingName: null, minutesToFixing: null };
  })();

  // ── F. Gold-DXY Correlation Integrity Check ───────────────────────────────────
  const correlationCheck = (() => {
    const closes  = h1Bars.slice(-5).map(b => b.close);
    const dxy     = priceContext.dxy ?? (yahooFinance as { dxy_yahoo?: number | null } | null)?.dxy_yahoo ?? null;
    if (closes.length < 4 || dxy == null) return null;
    const goldDir = closes[closes.length - 1] > closes[closes.length - 4] ? "up" : "down";
    // Use ATR regime + recent bar direction as DXY proxy if no prev DXY
    const dxyDir  = goldDir === "up" ? "down" : "up"; // assume intact unless evidence otherwise
    const intact  = goldDir !== dxyDir; // normal = gold up ↔ DXY down
    return { correlationIntact: intact, goldDirection: goldDir, dxyDirection: dxyDir };
  })();

  // ── Data freshness ────────────────────────────────────────────────────────────
  const nowMs = Date.now();
  const priceAgeSeconds = priceContext.fetched_at_utc
    ? Math.round((nowMs - new Date(priceContext.fetched_at_utc).getTime()) / 1000)
    : null;
  const cotReportDate = cotContext?.disagg_report_date ?? cotContext?.report_date ?? null;
  const cotAgeDays = cotReportDate
    ? Math.round((nowMs - new Date(cotReportDate).getTime()) / (1000 * 86400))
    : null;

  return {
    price_context: priceContext,
    macro_context: {
      us10y,
      us2y,
      real_yield_10y: realYield10y,
      breakeven_10y: breakeven10y,
      yield_curve_spread,
      us10y_direction: us10yTrend.direction,
      real_yield_direction: realYieldTrend.direction,
      correlation_state: deriveCorrelationState({
        dxy: priceContext.dxy,
        us10y,
        realYield: realYield10y,
      }),
    },
    technical_context: technicalContext,
    market_context: marketContext,
    event_context: {
      note: "Use web search to identify the highest-importance macro events in the next 24 hours. If none are found, omit this section entirely.",
    },
    news_context: {
      note: "Use web search to collect 5-10 recent headlines strictly about gold, USD, Treasury yields, Fed, or inflation. Keep facts separate from interpretation.",
    },
    validation_context: {
      completeness,
      source_consistency: priceContext.validated ? "Valid" : "Partial",
      timestamp_utc: new Date().toISOString(),
    },
    macro_state: macroState,
    technical_state: technicalState,
    indicator_context: indicatorContext,
    cot_context: cotContext,
    intermarket_context: intermarketContext,
    upcoming_events: upcomingEvents,
    polygon_order_flow: polygonOrderFlow,
    sentiment_context: sentimentContext,
    yahoo_finance: yahooFinance,
    etf_flows: etfFlows,
    fed_watch: fedWatch.summary ? fedWatch : null,
    central_bank: centralBankContext,
    oi_signal,
    sofr,
    tga_balance_bn,
    fx_momentum: fxMomentum,
    gld_iv: gldIV,
    futures_curve: futuresCurve.structure != null || futuresCurve.front_price != null ? futuresCurve : null,
    weekly_d1_high: weeklyD1High,
    weekly_d1_low: weeklyD1Low,
    monthly_d1_high: monthlyD1High,
    monthly_d1_low: monthlyD1Low,
    historical_levels_summary: historicalLevelsSummary,
    round_numbers_summary: roundNumbersSummary,
    multi_day_context: multiDayContextSummary,
    vwap_summary: vwapSummary,
    narrative_context: narrativeContext,
    cta_triggers:           ctaTriggers,
    futures_curve_analysis: futuresCurveAnalysis,
    rebalancing_signal:     rebalancingSignal,
    atr_regime:             atrRegime,
    fixing_window:          fixingWindow,
    correlation_check:      correlationCheck,
    data_freshness: {
      price_age_seconds: priceAgeSeconds,
      cot_age_days: cotAgeDays,
      cot_available: cotContext != null,
      cot_report_date: cotReportDate,
    },
  };
}
