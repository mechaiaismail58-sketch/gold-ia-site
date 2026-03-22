import type { TechnicalContext, FVGZone } from "./types";

type TwelveBar = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
};

type TwelveTimeSeriesResponse = {
  values?: TwelveBar[];
  status?: string;
  message?: string;
};

export type ParsedBar = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getTimeSeries(symbol: string, interval: string, outputsize: number): Promise<ParsedBar[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    console.error("Missing TWELVE_DATA_API_KEY");
    return [];
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("format", "JSON");

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    console.error(`TwelveData time_series failed for ${symbol} ${interval}: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as TwelveTimeSeriesResponse;
  const values = data.values ?? [];

  return values
    .map((bar) => ({
      datetime: bar.datetime,
      open: toNumber(bar.open),
      high: toNumber(bar.high),
      low: toNumber(bar.low),
      close: toNumber(bar.close),
      volume: bar.volume ? (Number(bar.volume) || 0) : 0,
    }))
    .filter(
      (bar): bar is ParsedBar =>
        bar.open != null && bar.high != null && bar.low != null && bar.close != null
    )
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

function maxHigh(bars: ParsedBar[]): number | null {
  if (!bars.length) return null;
  return Math.max(...bars.map((b) => b.high));
}

function minLow(bars: ParsedBar[]): number | null {
  if (!bars.length) return null;
  return Math.min(...bars.map((b) => b.low));
}

function pctDistance(a: number | null, b: number | null): number | null {
  if (a == null || b == null || a === 0) return null;
  return Math.abs((b - a) / a) * 100;
}

function percentChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

function getRangePosition(price: number | null, low: number | null, high: number | null): number | null {
  if (price == null || low == null || high == null || high <= low) return null;
  return ((price - low) / (high - low)) * 100;
}

function averageBarRangePct(bars: ParsedBar[]): number | null {
  if (!bars.length) return null;
  const avg =
    bars.reduce((sum, b) => sum + ((b.high - b.low) / b.close) * 100, 0) / bars.length;
  return Number.isFinite(avg) ? avg : null;
}

// ── ATR (14-period, H1) ──────────────────────────────────────────────────────

function calculateATR(bars: ParsedBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const recent = bars.slice(-(period + 1));
  let trSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const { high, low } = recent[i];
    const prevClose = recent[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
  }
  const atr = trSum / period;
  return Number.isFinite(atr) ? atr : null;
}

// ── Previous day high/low ────────────────────────────────────────────────────

function getPrevDayHighLow(h1Bars: ParsedBar[]): { high: number | null; low: number | null } {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const prevDayBars = h1Bars.filter((b) => b.datetime.startsWith(yesterday));
  if (!prevDayBars.length) return { high: null, low: null };
  return { high: maxHigh(prevDayBars), low: minLow(prevDayBars) };
}

// ── Swing highs / lows (strength = 5 bars each side) ────────────────────────

function detectSwingHigh(bars: ParsedBar[], strength = 5): number | null {
  for (let i = bars.length - 1 - strength; i >= strength; i--) {
    const candidate = bars[i];
    let isSwing = true;
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (bars[j].high >= candidate.high) { isSwing = false; break; }
    }
    if (isSwing) return candidate.high;
  }
  return null;
}

function detectSwingLow(bars: ParsedBar[], strength = 5): number | null {
  for (let i = bars.length - 1 - strength; i >= strength; i--) {
    const candidate = bars[i];
    let isSwing = true;
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (bars[j].low <= candidate.low) { isSwing = false; break; }
    }
    if (isSwing) return candidate.low;
  }
  return null;
}

// ── Fair Value Gap detection ─────────────────────────────────────────────────
// Bullish FVG: bars[i].high < bars[i+2].low  → gap = {low: bars[i].high, high: bars[i+2].low}
// Bearish FVG: bars[i].low  > bars[i+2].high → gap = {low: bars[i+2].high, high: bars[i].low}
// Unmitigated: current price has NOT fully closed through the gap

function detectFVG(bars: ParsedBar[], direction: "bullish" | "bearish"): FVGZone | null {
  if (bars.length < 3) return null;
  const currentPrice = bars[bars.length - 1].close;
  const scanStart = Math.max(0, bars.length - 60);

  // Scan from most recent backwards to find the nearest unmitigated FVG
  for (let i = bars.length - 3; i >= scanStart; i--) {
    const a = bars[i];
    const c = bars[i + 2];

    if (direction === "bullish") {
      if (c.low > a.high) {
        const gapPct = (c.low - a.high) / a.high;
        if (gapPct >= 0.0003) {
          // Unmitigated: price hasn't dropped below the gap's lower boundary
          if (currentPrice >= a.high) {
            return { low: a.high, high: c.low };
          }
        }
      }
    } else {
      if (a.low > c.high) {
        const gapPct = (a.low - c.high) / c.high;
        if (gapPct >= 0.0003) {
          // Unmitigated: price hasn't risen above the gap's upper boundary
          if (currentPrice <= a.low) {
            return { low: c.high, high: a.low };
          }
        }
      }
    }
  }
  return null;
}

// ── Order Block detection ────────────────────────────────────────────────────
// Bullish OB (ICT): last bearish candle before bullish impulse that breaks above OB high
// Bearish OB (ICT): last bullish candle before bearish impulse that breaks below OB low
// Unmitigated: price hasn't fully retraced through the OB zone

function detectOrderBlock(bars: ParsedBar[], direction: "bullish" | "bearish"): FVGZone | null {
  if (bars.length < 8) return null;
  const currentPrice = bars[bars.length - 1].close;
  const scanStart = Math.max(1, bars.length - 40);

  for (let i = bars.length - 6; i >= scanStart; i--) {
    const ob = bars[i];

    if (direction === "bullish") {
      // Bullish OB: bearish candle before bullish impulse
      if (ob.close >= ob.open) continue;
      const nextBars = bars.slice(i + 1, Math.min(i + 7, bars.length));
      const impulseHigh = maxHigh(nextBars);
      if (impulseHigh == null || impulseHigh <= ob.high) continue;
      const impulseMove = (impulseHigh - ob.close) / ob.close;
      if (impulseMove < 0.003) continue;
      // Unmitigated: current price is above the OB's low (hasn't been fully absorbed)
      if (currentPrice > ob.low) {
        return { low: ob.low, high: ob.high };
      }
    } else {
      // Bearish OB: bullish candle before bearish impulse
      if (ob.close <= ob.open) continue;
      const nextBars = bars.slice(i + 1, Math.min(i + 7, bars.length));
      const impulseLow = minLow(nextBars);
      if (impulseLow == null || impulseLow >= ob.low) continue;
      const impulseMove = (ob.close - impulseLow) / ob.close;
      if (impulseMove < 0.003) continue;
      // Unmitigated: current price is below the OB's high
      if (currentPrice < ob.high) {
        return { low: ob.low, high: ob.high };
      }
    }
  }
  return null;
}

// ── Trend / structure classifiers ────────────────────────────────────────────

function classifyH1Trend(bars: ParsedBar[]): TechnicalContext["h1_trend"] {
  if (bars.length < 20) return "Data not found";

  const recent = bars.slice(-12);
  const earlier = bars.slice(-24, -12);

  const recentHigh = maxHigh(recent);
  const recentLow = minLow(recent);
  const earlierHigh = maxHigh(earlier);
  const earlierLow = minLow(earlier);

  if (recentHigh != null && recentLow != null && earlierHigh != null && earlierLow != null) {
    if (recentHigh > earlierHigh && recentLow > earlierLow) return "bullish";
    if (recentHigh < earlierHigh && recentLow < earlierLow) return "bearish";
    return "range";
  }

  return "Data not found";
}

function classifyM30Structure(
  bars: ParsedBar[],
  momentum5: number | null,
  avgRangePct: number | null
): TechnicalContext["m30_structure"] {
  if (bars.length < 20) return "Data not found";

  const recent = bars.slice(-20);
  const recentHigh = maxHigh(recent);
  const recentLow = minLow(recent);
  const pos = getRangePosition(recent[recent.length - 1]?.close ?? null, recentLow, recentHigh);

  if (avgRangePct != null && avgRangePct < 0.18) return "compression";
  if (momentum5 != null && Math.abs(momentum5) > 0.9) return "impulse";
  if (pos == null) return "Data not found";
  if (pos > 20 && pos < 80) return "range";
  return "trend";
}

function classifyVolatilityState(
  recentAvgRangePct: number | null,
  earlierAvgRangePct: number | null
): TechnicalContext["volatility_state"] {
  if (recentAvgRangePct == null || earlierAvgRangePct == null) return "Data not found";
  if (recentAvgRangePct > earlierAvgRangePct * 1.2) return "expanding";
  if (recentAvgRangePct < earlierAvgRangePct * 0.85) return "contracting";
  return "stable";
}

function classifyShortTermRegime(params: {
  h1Trend: TechnicalContext["h1_trend"];
  m30Structure: TechnicalContext["m30_structure"];
  rangePositionPct: number | null;
  momentum5: number | null;
}): TechnicalContext["short_term_regime"] {
  const { h1Trend, m30Structure, rangePositionPct, momentum5 } = params;

  if (h1Trend === "Data not found" || m30Structure === "Data not found") {
    return "Data not found";
  }

  if (m30Structure === "compression") return "Range Compression";
  if (m30Structure === "impulse") return "Breakout Transition";

  if (h1Trend === "bullish") {
    if (rangePositionPct != null && rangePositionPct < 45) return "Trending Pullback";
    return "Trending Expansion";
  }

  if (h1Trend === "bearish") {
    if (rangePositionPct != null && rangePositionPct > 55) return "Trending Pullback";
    return "Trending Expansion";
  }

  // h1Trend === "range" — remaining m30Structure values: "range" | "trend"
  if (m30Structure === "trend") return "Breakout Transition";
  if (momentum5 != null && Math.abs(momentum5) > 0.7) return "Breakout Transition";
  return "Range Compression";
}

// ── Main exports ──────────────────────────────────────────────────────────────

export function buildTechnicalContextFromBars(h1Bars: ParsedBar[], m30Bars: ParsedBar[]): TechnicalContext {
  const currentPrice = h1Bars[h1Bars.length - 1]?.close ?? m30Bars[m30Bars.length - 1]?.close ?? null;

  const recentWindowH1 = h1Bars.slice(-24);
  const intradayWindow = m30Bars.slice(-16);
  const weeklyWindow = h1Bars.slice(-120);

  const recentHigh = maxHigh(recentWindowH1);
  const recentLow = minLow(recentWindowH1);
  const intradayHigh = maxHigh(intradayWindow);
  const intradayLow = minLow(intradayWindow);
  const weeklyHigh = maxHigh(weeklyWindow);
  const weeklyLow = minLow(weeklyWindow);

  const prevDay = getPrevDayHighLow(h1Bars);

  const momentum5 = percentChange(
    m30Bars[m30Bars.length - 6]?.close ?? null,
    m30Bars[m30Bars.length - 1]?.close ?? null
  );

  const price24hAgo = h1Bars[h1Bars.length - 25]?.close ?? null;
  const price_change_24h_pct = percentChange(price24hAgo, currentPrice);

  const recentAvgRangePct = averageBarRangePct(m30Bars.slice(-10));
  const earlierAvgRangePct = averageBarRangePct(m30Bars.slice(-20, -10));
  const avgRangePctFull = averageBarRangePct(m30Bars.slice(-20));

  const h1Trend = classifyH1Trend(h1Bars);
  const m30Structure = classifyM30Structure(m30Bars, momentum5, avgRangePctFull);
  const rangePositionPct = getRangePosition(currentPrice, recentLow, recentHigh);

  return {
    current_price: currentPrice,
    timeframe_primary: "1h",
    timeframe_secondary: "30min",
    recent_high: recentHigh,
    recent_low: recentLow,
    intraday_high: intradayHigh,
    intraday_low: intradayLow,
    weekly_high: weeklyHigh,
    weekly_low: weeklyLow,
    prev_day_high: prevDay.high,
    prev_day_low: prevDay.low,
    range_position_pct: rangePositionPct,
    distance_to_recent_high_pct: pctDistance(currentPrice, recentHigh),
    distance_to_recent_low_pct: pctDistance(currentPrice, recentLow),
    h1_trend: h1Trend,
    m30_structure: m30Structure,
    short_term_regime: classifyShortTermRegime({
      h1Trend,
      m30Structure,
      rangePositionPct,
      momentum5,
    }),
    momentum_5_bars_pct: momentum5,
    average_bar_range_pct: avgRangePctFull,
    atr_h1: calculateATR(h1Bars),
    price_change_24h_pct,
    volatility_state: classifyVolatilityState(recentAvgRangePct, earlierAvgRangePct),
    liquidity_above: weeklyHigh,
    liquidity_below: weeklyLow,
    swing_high_h1: detectSwingHigh(h1Bars),
    swing_low_h1: detectSwingLow(h1Bars),
    fvg_bullish_h1: detectFVG(h1Bars, "bullish"),
    fvg_bearish_h1: detectFVG(h1Bars, "bearish"),
    fvg_bullish_m30: detectFVG(m30Bars, "bullish"),
    fvg_bearish_m30: detectFVG(m30Bars, "bearish"),
    orderblock_bullish_h1: detectOrderBlock(h1Bars, "bullish"),
    orderblock_bearish_h1: detectOrderBlock(h1Bars, "bearish"),
  };
}

export async function getTechnicalContext(): Promise<TechnicalContext> {
  const xauusdSymbol = process.env.XAUUSD_SYMBOL || "XAU/USD";
  const [h1Bars, m30Bars] = await Promise.all([
    getTimeSeries(xauusdSymbol, "1h", 140),
    getTimeSeries(xauusdSymbol, "30min", 80),
  ]);
  return buildTechnicalContextFromBars(h1Bars, m30Bars);
}
