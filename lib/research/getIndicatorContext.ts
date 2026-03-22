// ── Types ─────────────────────────────────────────────────────────────────────

import type { ParsedBar } from "./getTechnicalContext";

type TwelveBar = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
};

export type SwingStructure = {
  trend: "bullish" | "bearish" | "neutral";
  pattern: "HH_HL" | "LH_LL" | "mixed";
  last_swing_high: number | null;
  last_swing_low: number | null;
};

export type TimeframeIndicators = {
  // EMA
  ema20: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  ema_order: "bullish" | "bearish" | "mixed";
  price_vs_ema20: "above" | "below" | null;
  // ADX
  adx: number | null;
  adx_strength: "strong" | "moderate" | "weak" | null;
  // RSI
  rsi: number | null;
  rsi_zone: "overbought" | "oversold" | "neutral" | null;
  // MACD
  macd_histogram: number | null;
  macd_cross: "bullish_cross" | "bearish_cross" | "none";
  // Stochastic
  stoch_k: number | null;
  stoch_zone: "overbought" | "oversold" | "neutral" | null;
  // CCI
  cci: number | null;
  cci_zone: "overbought" | "oversold" | "neutral" | null;
  // ATR
  atr: number | null;
  // Bollinger Bands
  bb_upper: number | null;
  bb_lower: number | null;
  bb_position: "above_upper" | "near_upper" | "upper_half" | "lower_half" | "near_lower" | "below_lower" | null;
  bb_squeeze: boolean | null;
  // Swing structure
  swing: SwingStructure | null;
};

import { computeOrderFlow } from "./getOrderFlowContext";
import type { OrderFlowContext } from "./getOrderFlowContext";
import { detectMarketRegime } from "./getMarketRegime";
import type { MarketRegime } from "./getMarketRegime";

export type IndicatorContext = {
  d1: TimeframeIndicators;
  h4: TimeframeIndicators;
  h1: TimeframeIndicators;
  rsi_divergence_h4: "bullish" | "bearish" | null;
  rsi_divergence_d1: "bullish" | "bearish" | null;
  mtf_alignment: "all_bullish" | "all_bearish" | "mixed";
  market_regime: MarketRegime | null;
  order_flow: OrderFlowContext | null;
  summary: string;
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function getTimeSeries(symbol: string, interval: string, outputsize: number): Promise<ParsedBar[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return [];

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("format", "JSON");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json() as { values?: TwelveBar[] };
    return (data.values ?? [])
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
  } catch {
    return [];
  }
}

// ── Pure math helpers ─────────────────────────────────────────────────────────

/** Build full EMA array from a closes array. result[j] corresponds to closes[period-1+j]. */
function buildEMAArray(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcEMA(bars: ParsedBar[], period: number): number | null {
  const arr = buildEMAArray(bars.map((b) => b.close), period);
  return arr.length > 0 ? arr[arr.length - 1] : null;
}

function calcADX(bars: ParsedBar[], period = 14): number | null {
  if (bars.length < period * 2 + 1) return null;

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevHigh = bars[i - 1].high;
    const prevLow = bars[i - 1].low;
    const prevClose = bars[i - 1].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    trs.push(tr);
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (trs.length < period) return null;

  // Wilder's smoothing seed
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trs[i];
    smoothPlus = smoothPlus - smoothPlus / period + plusDMs[i];
    smoothMinus = smoothMinus - smoothMinus / period + minusDMs[i];

    if (smoothTR === 0) { dxValues.push(0); continue; }
    const plusDI = 100 * smoothPlus / smoothTR;
    const minusDI = 100 * smoothMinus / smoothTR;
    const diSum = plusDI + minusDI;
    dxValues.push(diSum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / diSum);
  }

  if (dxValues.length < period) return null;

  // ADX = Wilder's smooth of DX
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  return Number.isFinite(adx) ? adx : null;
}

/** Returns full RSI array (NaN for first `period` bars). */
function buildRSIArray(bars: ParsedBar[], period = 14): number[] {
  const closes = bars.map((b) => b.close);
  if (closes.length < period + 1) return [];

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss += Math.abs(d);
  }
  avgGain /= period;
  avgLoss /= period;

  const result: number[] = new Array(period).fill(NaN);
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function calcRSI(bars: ParsedBar[], period = 14): number | null {
  const arr = buildRSIArray(bars, period);
  const last = arr[arr.length - 1];
  return last != null && Number.isFinite(last) ? last : null;
}

function calcMACD(bars: ParsedBar[], fast = 12, slow = 26, signal = 9): {
  histogram: number | null;
  cross: "bullish_cross" | "bearish_cross" | "none";
} {
  const closes = bars.map((b) => b.close);
  if (closes.length < slow + signal + 2) return { histogram: null, cross: "none" };

  const emaFast = buildEMAArray(closes, fast);
  const emaSlow = buildEMAArray(closes, slow);

  // Align: emaFast[i + (slow-fast)] and emaSlow[i] both refer to the same close bar
  const diff = slow - fast;
  if (emaFast.length < diff + emaSlow.length) return { histogram: null, cross: "none" };

  const macdLine = emaSlow.map((s, i) => emaFast[i + diff] - s);
  if (macdLine.length < signal + 2) return { histogram: null, cross: "none" };

  const signalArr = buildEMAArray(macdLine, signal);
  if (signalArr.length < 2) return { histogram: null, cross: "none" };

  const curMACD = macdLine[macdLine.length - 1];
  const curSig = signalArr[signalArr.length - 1];
  const prevMACD = macdLine[macdLine.length - 2];
  const prevSig = signalArr[signalArr.length - 2];

  const hist = curMACD - curSig;
  const prevHist = prevMACD - prevSig;

  let cross: "bullish_cross" | "bearish_cross" | "none" = "none";
  if (prevHist <= 0 && hist > 0) cross = "bullish_cross";
  else if (prevHist >= 0 && hist < 0) cross = "bearish_cross";

  return { histogram: Number.isFinite(hist) ? hist : null, cross };
}

function calcStochastic(bars: ParsedBar[], kPeriod = 14, dPeriod = 3, smooth = 3): {
  k: number | null;
} {
  if (bars.length < kPeriod + dPeriod + smooth) return { k: null };

  const fastK: number[] = [];
  for (let i = kPeriod - 1; i < bars.length; i++) {
    const window = bars.slice(i - kPeriod + 1, i + 1);
    const lo = Math.min(...window.map((b) => b.low));
    const hi = Math.max(...window.map((b) => b.high));
    fastK.push(hi === lo ? 50 : ((bars[i].close - lo) / (hi - lo)) * 100);
  }

  // Slow %K = SMA(dPeriod) of fastK
  const slowK: number[] = [];
  for (let i = dPeriod - 1; i < fastK.length; i++) {
    slowK.push(fastK.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / dPeriod);
  }

  if (slowK.length < smooth) return { k: null };

  // Slow %D = SMA(smooth) of slowK — but we only need current Slow %K for signal
  return { k: slowK[slowK.length - 1] };
}

function calcCCI(bars: ParsedBar[], period = 20): number | null {
  if (bars.length < period) return null;
  const window = bars.slice(-period);
  const tps = window.map((b) => (b.high + b.low + b.close) / 3);
  const mean = tps.reduce((a, b) => a + b, 0) / period;
  const mad = tps.reduce((sum, tp) => sum + Math.abs(tp - mean), 0) / period;
  if (mad === 0) return 0;
  const currentTP = tps[tps.length - 1];
  const cci = (currentTP - mean) / (0.015 * mad);
  return Number.isFinite(cci) ? cci : null;
}

function calcATR(bars: ParsedBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const recent = bars.slice(-(period + 1));
  let trSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const { high, low } = recent[i];
    const prevClose = recent[i - 1].close;
    trSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  const atr = trSum / period;
  return Number.isFinite(atr) ? atr : null;
}

function calcBollingerBands(bars: ParsedBar[], period = 20, mult = 2): {
  upper: number | null;
  lower: number | null;
  position: TimeframeIndicators["bb_position"];
  squeeze: boolean | null;
} {
  if (bars.length < period * 2) return { upper: null, lower: null, position: null, squeeze: null };

  const closes = bars.slice(-period).map((b) => b.close);
  const middle = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((s, c) => s + (c - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + mult * stdDev;
  const lower = middle - mult * stdDev;
  const bw = (upper - lower) / middle;

  // Squeeze: compare bandwidth to previous period's bandwidth
  const prevCloses = bars.slice(-period * 2, -period).map((b) => b.close);
  const prevMiddle = prevCloses.reduce((a, b) => a + b, 0) / period;
  const prevVar = prevCloses.reduce((s, c) => s + (c - prevMiddle) ** 2, 0) / period;
  const prevBW = (2 * mult * Math.sqrt(prevVar)) / prevMiddle;
  const squeeze = bw < prevBW * 0.7;

  const price = bars[bars.length - 1].close;
  let position: TimeframeIndicators["bb_position"];
  if (price > upper) position = "above_upper";
  else if (price > upper - (upper - middle) * 0.05) position = "near_upper";
  else if (price > middle) position = "upper_half";
  else if (price > lower + (middle - lower) * 0.05) position = "lower_half";
  else if (price > lower) position = "near_lower";
  else position = "below_lower";

  return { upper, lower, position, squeeze };
}

function classifyEMAOrder(
  price: number | null,
  ema20: number | null,
  ema50: number | null,
  ema100: number | null,
  ema200: number | null
): { order: TimeframeIndicators["ema_order"]; price_vs_ema20: "above" | "below" | null } {
  const price_vs_ema20 =
    price != null && ema20 != null ? (price > ema20 ? "above" : "below") : null;

  // Full bullish stack: 20 > 50 > 100 (> 200 if available)
  const shortBullish = ema20 != null && ema50 != null && ema100 != null
    && ema20 > ema50 && ema50 > ema100;
  const shortBearish = ema20 != null && ema50 != null && ema100 != null
    && ema20 < ema50 && ema50 < ema100;

  const with200Bullish = ema200 != null ? shortBullish && ema100 > ema200 : shortBullish;
  const with200Bearish = ema200 != null ? shortBearish && ema100 < ema200 : shortBearish;

  const order: TimeframeIndicators["ema_order"] =
    with200Bullish ? "bullish" : with200Bearish ? "bearish" : "mixed";

  return { order, price_vs_ema20 };
}

/** Simple RSI divergence: compare two most recent pivot lows/highs in a lookback window. */
function detectRSIDivergence(
  bars: ParsedBar[],
  rsiArr: number[],
  lookback = 30
): "bullish" | "bearish" | null {
  if (bars.length < lookback || rsiArr.length < lookback) return null;
  const bSlice = bars.slice(-lookback);
  const rSlice = rsiArr.slice(-lookback);
  const strength = 3;

  // Bullish: price lower low, RSI higher low
  const lows: Array<{ price: number; rsi: number }> = [];
  for (let i = strength; i < bSlice.length - strength; i++) {
    const isLow = bSlice.slice(i - strength, i).every((b) => b.low >= bSlice[i].low)
      && bSlice.slice(i + 1, i + strength + 1).every((b) => b.low >= bSlice[i].low);
    if (isLow && Number.isFinite(rSlice[i])) {
      lows.push({ price: bSlice[i].low, rsi: rSlice[i] });
    }
  }
  if (lows.length >= 2) {
    const [l1, l2] = lows.slice(-2);
    if (l2.price < l1.price && l2.rsi > l1.rsi + 2) return "bullish";
  }

  // Bearish: price higher high, RSI lower high
  const highs: Array<{ price: number; rsi: number }> = [];
  for (let i = strength; i < bSlice.length - strength; i++) {
    const isHigh = bSlice.slice(i - strength, i).every((b) => b.high <= bSlice[i].high)
      && bSlice.slice(i + 1, i + strength + 1).every((b) => b.high <= bSlice[i].high);
    if (isHigh && Number.isFinite(rSlice[i])) {
      highs.push({ price: bSlice[i].high, rsi: rSlice[i] });
    }
  }
  if (highs.length >= 2) {
    const [h1, h2] = highs.slice(-2);
    if (h2.price > h1.price && h2.rsi < h1.rsi - 2) return "bearish";
  }

  return null;
}

/** Detects swing structure (HH/HL or LH/LL) from the most recent bars. */
function detectSwingStructure(bars: ParsedBar[], lookback = 3, recent = 60): SwingStructure | null {
  if (bars.length < lookback * 2 + 3) return null;
  const slice = bars.slice(-Math.min(recent + lookback * 2, bars.length));

  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];

  for (let i = lookback; i < slice.length - lookback; i++) {
    const high = slice[i].high;
    let isHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (slice[i - j].high >= high || slice[i + j].high >= high) { isHigh = false; break; }
    }
    if (isHigh) pivotHighs.push(high);

    const low = slice[i].low;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (slice[i - j].low <= low || slice[i + j].low <= low) { isLow = false; break; }
    }
    if (isLow) pivotLows.push(low);
  }

  const lastHigh  = pivotHighs.length > 0 ? pivotHighs[pivotHighs.length - 1] : null;
  const priorHigh = pivotHighs.length > 1 ? pivotHighs[pivotHighs.length - 2] : null;
  const lastLow   = pivotLows.length  > 0 ? pivotLows[pivotLows.length   - 1] : null;
  const priorLow  = pivotLows.length  > 1 ? pivotLows[pivotLows.length   - 2] : null;

  if (lastHigh == null || lastLow == null) return null;

  if (priorHigh != null && priorLow != null) {
    if (lastHigh > priorHigh && lastLow > priorLow)
      return { trend: "bullish", pattern: "HH_HL", last_swing_high: lastHigh, last_swing_low: lastLow };
    if (lastHigh < priorHigh && lastLow < priorLow)
      return { trend: "bearish", pattern: "LH_LL", last_swing_high: lastHigh, last_swing_low: lastLow };
  }

  return { trend: "neutral", pattern: "mixed", last_swing_high: lastHigh, last_swing_low: lastLow };
}

// ── Build indicators for a single timeframe ───────────────────────────────────

function buildTFIndicators(bars: ParsedBar[]): TimeframeIndicators {
  if (bars.length < 30) {
    return {
      ema20: null, ema50: null, ema100: null, ema200: null,
      ema_order: "mixed", price_vs_ema20: null,
      adx: null, adx_strength: null,
      rsi: null, rsi_zone: null,
      macd_histogram: null, macd_cross: "none",
      stoch_k: null, stoch_zone: null,
      cci: null, cci_zone: null,
      atr: null,
      bb_upper: null, bb_lower: null, bb_position: null, bb_squeeze: null,
      swing: null,
    };
  }

  const price = bars[bars.length - 1].close;
  const ema20 = calcEMA(bars, 20);
  const ema50 = calcEMA(bars, 50);
  const ema100 = calcEMA(bars, 100);
  const ema200 = calcEMA(bars, 200);
  const { order: ema_order, price_vs_ema20 } = classifyEMAOrder(price, ema20, ema50, ema100, ema200);

  const adx = calcADX(bars);
  const adx_strength: TimeframeIndicators["adx_strength"] =
    adx == null ? null : adx >= 40 ? "strong" : adx >= 20 ? "moderate" : "weak";

  const rsi = calcRSI(bars);
  const rsi_zone: TimeframeIndicators["rsi_zone"] =
    rsi == null ? null : rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";

  const { histogram: macd_histogram, cross: macd_cross } = calcMACD(bars);

  const { k: stoch_k } = calcStochastic(bars);
  const stoch_zone: TimeframeIndicators["stoch_zone"] =
    stoch_k == null ? null : stoch_k >= 80 ? "overbought" : stoch_k <= 20 ? "oversold" : "neutral";

  const cci = calcCCI(bars);
  const cci_zone: TimeframeIndicators["cci_zone"] =
    cci == null ? null : cci >= 100 ? "overbought" : cci <= -100 ? "oversold" : "neutral";

  const atr = calcATR(bars);

  const { upper: bb_upper, lower: bb_lower, position: bb_position, squeeze: bb_squeeze } =
    calcBollingerBands(bars);

  const swing = detectSwingStructure(bars);

  return {
    ema20, ema50, ema100, ema200,
    ema_order, price_vs_ema20,
    adx, adx_strength,
    rsi, rsi_zone,
    macd_histogram, macd_cross,
    stoch_k, stoch_zone,
    cci, cci_zone,
    atr,
    bb_upper, bb_lower, bb_position, bb_squeeze,
    swing,
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

function fmt(n: number | null, decimals = 0): string {
  return n != null ? n.toFixed(decimals) : "—";
}

function tfLine(label: string, tf: TimeframeIndicators): string {
  const parts: string[] = [];

  // EMA
  if (tf.ema_order !== "mixed") {
    parts.push(`EMA stack ${tf.ema_order}`);
  } else if (tf.price_vs_ema20) {
    parts.push(`price ${tf.price_vs_ema20} EMA20`);
  }

  // ADX
  if (tf.adx != null) parts.push(`ADX ${fmt(tf.adx)} (${tf.adx_strength})`);

  // RSI
  if (tf.rsi != null) parts.push(`RSI ${fmt(tf.rsi)} (${tf.rsi_zone})`);

  // MACD
  if (tf.macd_cross !== "none") {
    parts.push(`MACD ${tf.macd_cross.replace("_", " ")}`);
  } else if (tf.macd_histogram != null) {
    const sign = tf.macd_histogram >= 0 ? "+" : "";
    parts.push(`MACD hist ${sign}${fmt(tf.macd_histogram, 1)}`);
  }

  // Stochastic
  if (tf.stoch_k != null) {
    parts.push(`Stoch ${fmt(tf.stoch_k)} (${tf.stoch_zone})`);
  }

  // CCI
  if (tf.cci != null) {
    const sign = tf.cci >= 0 ? "+" : "";
    parts.push(`CCI ${sign}${fmt(tf.cci)} (${tf.cci_zone})`);
  }

  // ATR
  if (tf.atr != null) parts.push(`ATR ${fmt(tf.atr, 1)}`);

  // Bollinger Bands
  if (tf.bb_position) {
    parts.push(`BB ${tf.bb_position}${tf.bb_squeeze ? " [SQUEEZE]" : ""}`);
  }

  // Swing structure
  if (tf.swing) {
    const swingParts = [`Swing ${tf.swing.pattern}`];
    if (tf.swing.last_swing_high != null) swingParts.push(`SwH ${tf.swing.last_swing_high.toFixed(1)}`);
    if (tf.swing.last_swing_low  != null) swingParts.push(`SwL ${tf.swing.last_swing_low.toFixed(1)}`);
    parts.push(swingParts.join(" "));
  }

  return `${label}: ${parts.length > 0 ? parts.join(" | ") : "insufficient data"}`;
}

function computeMTFAlignment(
  d1: TimeframeIndicators,
  h4: TimeframeIndicators,
  h1: TimeframeIndicators
): IndicatorContext["mtf_alignment"] {
  const isBull = (tf: TimeframeIndicators) =>
    tf.swing?.trend === "bullish" || tf.ema_order === "bullish";
  const isBear = (tf: TimeframeIndicators) =>
    tf.swing?.trend === "bearish" || tf.ema_order === "bearish";

  if (isBull(d1) && isBull(h4) && isBull(h1)) return "all_bullish";
  if (isBear(d1) && isBear(h4) && isBear(h1)) return "all_bearish";
  return "mixed";
}

function buildSummary(
  d1: TimeframeIndicators,
  h4: TimeframeIndicators,
  h1: TimeframeIndicators,
  divH4: "bullish" | "bearish" | null,
  divD1: "bullish" | "bearish" | null,
  mtf: IndicatorContext["mtf_alignment"],
  regime: MarketRegime | null
): string {
  const lines = [
    tfLine("D1", d1),
    tfLine("H4", h4),
    tfLine("H1", h1),
    `MTF alignment: ${mtf}`,
  ];
  if (divH4) lines.push(`H4 RSI divergence: ${divH4} (price vs RSI pivots)`);
  if (divD1) lines.push(`D1 RSI divergence: ${divD1} (price vs RSI pivots)`);
  if (regime) lines.push(`Market regime: ${regime.summary}`);
  return lines.join("\n");
}

// ── Main exports ──────────────────────────────────────────────────────────────

export function buildIndicatorContextFromBars(
  d1Bars: ParsedBar[],
  h4Bars: ParsedBar[],
  h1Bars: ParsedBar[]
): IndicatorContext | null {
  if (!d1Bars.length && !h4Bars.length && !h1Bars.length) return null;

  const d1 = buildTFIndicators(d1Bars);
  const h4 = buildTFIndicators(h4Bars);
  const h1 = buildTFIndicators(h1Bars);

  const rsiD1 = buildRSIArray(d1Bars);
  const rsiH4 = buildRSIArray(h4Bars);
  const rsi_divergence_d1 = detectRSIDivergence(d1Bars, rsiD1);
  const rsi_divergence_h4 = detectRSIDivergence(h4Bars, rsiH4);

  const mtf_alignment = computeMTFAlignment(d1, h4, h1);
  const order_flow = computeOrderFlow(h4Bars, h1Bars);
  const market_regime = h1Bars.length >= 40 ? detectMarketRegime(h1Bars, h1) : null;
  const summary = buildSummary(d1, h4, h1, rsi_divergence_h4, rsi_divergence_d1, mtf_alignment, market_regime);

  return { d1, h4, h1, rsi_divergence_h4, rsi_divergence_d1, mtf_alignment, market_regime, order_flow, summary };
}

export async function getIndicatorContext(): Promise<IndicatorContext | null> {
  const symbol = process.env.XAUUSD_SYMBOL || "XAU/USD";

  try {
    const [d1Bars, h4Bars, h1Bars] = await Promise.all([
      getTimeSeries(symbol, "1day", 220),
      getTimeSeries(symbol, "4h", 250),
      getTimeSeries(symbol, "1h", 100),
    ]);

    if (!d1Bars.length && !h4Bars.length && !h1Bars.length) {
      console.error("getIndicatorContext: all timeframes returned empty — API likely rate-limited or key invalid");
      return null;
    }
    if (!d1Bars.length) console.warn("getIndicatorContext: D1 bars empty");
    if (!h4Bars.length) console.warn("getIndicatorContext: H4 bars empty");
    if (!h1Bars.length) console.warn("getIndicatorContext: H1 bars empty");

    return buildIndicatorContextFromBars(d1Bars, h4Bars, h1Bars);
  } catch (err) {
    console.error("getIndicatorContext error:", err);
    return null;
  }
}
