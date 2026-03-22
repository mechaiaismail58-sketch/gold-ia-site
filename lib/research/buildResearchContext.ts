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
import { getAlphaVantageContext } from "./getAlphaVantageContext";
import { getYahooFinanceContext } from "./getYahooFinanceContext";
import { getETFFlowsContext } from "./getETFFlowsContext";
import { buildFedWatchContext } from "./getFedWatchContext";
import { getCentralBankContext } from "./getCentralBankContext";
import type { IndicatorContext } from "./getIndicatorContext";
import type { COTContext } from "./getCOTContext";
import type { UpcomingEventsContext } from "./getUpcomingEvents";
import type { PolygonOrderFlow } from "./getPolygonOrderFlow";
import type { SentimentContext } from "./getSentimentContext";
import type { AlphaVantageContext } from "./getAlphaVantageContext";
import type { YahooFinanceContext } from "./getYahooFinanceContext";
import type { ETFFlowsContext } from "./getETFFlowsContext";
import type { FedWatchContext } from "./getFedWatchContext";
import type { CentralBankContext } from "./getCentralBankContext";
import type { ResearchContext } from "./types";

// ── Shared OHLCV fetcher with 5-minute cache ──────────────────────────────────

async function fetchOHLCVBars(
  symbol: string,
  interval: string,
  outputsize: number
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
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
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
  let dominant_driver = "Donnée non trouvée";

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
  let condition = "Donnée non trouvée";

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
  av_context: AlphaVantageContext | null;
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
};

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
    avContext,
    etfFlows,
    centralBankContext,
    sofr,
    tgaRaw,
    targetUpper,
    effectiveRate,
  ] = await Promise.all([
    getPriceContext(),
    fetchOHLCVBars(symbol, "1h", 140),
    fetchOHLCVBars(symbol, "30min", 80),
    fetchOHLCVBars(symbol, "4h", 250),
    fetchOHLCVBars(symbol, "1day", 220),
    getFredLatestTwo("DGS10"),
    getFredLatestTwo("DFII10"),
    getLatestFredValue("DGS2"),
    getLatestFredValue("T10YIE"),
    getLatestFredValue("SLVPRUSD"),
    getFredLatestTwo("SP500"),
    getCOTContext(),
    getUpcomingEvents(),
    getPolygonOrderFlow(),
    getSentimentContext(),
    getAlphaVantageContext(),
    getETFFlowsContext(),
    getCentralBankContext(),
    getLatestFredValue("SOFR"),
    getLatestFredValue("WTREGEN"),
    getLatestFredValue("DFEDTARU"),
    getLatestFredValue("FEDFUNDS"),
  ]);

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

  const [yahooFinance] = await Promise.all([
    getYahooFinanceContext(goldPrice),
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

  // Append Polygon real flow to order flow summary if available
  if (indicatorContext?.order_flow && polygonOrderFlow) {
    indicatorContext.order_flow.summary += ` | ${polygonOrderFlow.summary}`;
  }

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
      note: "Use web search to identify the highest-importance macro events in the next 24 hours. If none are found, say 'Donnée non trouvée'.",
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
    av_context: avContext,
    yahoo_finance: yahooFinance,
    etf_flows: etfFlows,
    fed_watch: fedWatch.summary ? fedWatch : null,
    central_bank: centralBankContext,
    oi_signal,
    sofr,
    tga_balance_bn,
  };
}
