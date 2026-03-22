// ── Market Regime Detection ─────────────────────────────────────────────────────
// Classifies the current market regime from H1 OHLCV bars + precomputed indicators.
// Regimes: strong_trend | compressed_range | extreme_volatility | normal
//
// Uses: ADX, ATR ratio (current vs 20-period baseline), BB squeeze, EMA order

type ParsedBar = {
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
};

type H1Indicators = {
  adx: number | null;
  adx_strength: "strong" | "moderate" | "weak" | null;
  bb_squeeze: boolean | null;
  ema_order: "bullish" | "bearish" | "mixed";
  atr: number | null;
};

export type MarketRegime = {
  regime: "strong_trend" | "compressed_range" | "extreme_volatility" | "normal";
  direction: "bullish" | "bearish" | "neutral";
  atr_ratio: number | null; // current ATR relative to 20-bar baseline (>2 = extreme, <0.7 = compressed)
  approach: string;         // trade approach text — used by system prompt rule
  summary: string;
};

// ── ATR ratio ─────────────────────────────────────────────────────────────────
// current ATR = mean TR of last 14 bars
// baseline ATR = mean TR of bars[-35..-15] (20-bar period, shifted before current)

function computeATRRatio(bars: ParsedBar[]): number | null {
  if (bars.length < 40) return null;

  function meanTR(slice: ParsedBar[]): number {
    let sum = 0;
    for (let i = 1; i < slice.length; i++) {
      const tr = Math.max(
        slice[i].high - slice[i].low,
        Math.abs(slice[i].high - slice[i - 1].close),
        Math.abs(slice[i].low  - slice[i - 1].close)
      );
      sum += tr;
    }
    return sum / (slice.length - 1);
  }

  const currentATR  = meanTR(bars.slice(-15));          // last 14 TRs
  const baselineATR = meanTR(bars.slice(-36, -15));      // 20-bar window shifted back
  if (baselineATR <= 0) return null;
  return Number.isFinite(currentATR / baselineATR) ? currentATR / baselineATR : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function detectMarketRegime(
  h1Bars: ParsedBar[],
  h1: H1Indicators
): MarketRegime {
  const atr_ratio = computeATRRatio(h1Bars);
  const adx        = h1.adx;
  const bb_squeeze = h1.bb_squeeze ?? false;
  const ema_order  = h1.ema_order;

  let regime: MarketRegime["regime"] = "normal";

  // Priority 1: Extreme volatility — ATR spiking, often around macro event
  if (atr_ratio != null && atr_ratio > 2.0) {
    regime = "extreme_volatility";
  }
  // Priority 2: Strong trend — ADX strong, EMA aligned, ATR not collapsed
  else if (
    adx != null && adx > 35 &&
    ema_order !== "mixed" &&
    (atr_ratio == null || atr_ratio >= 0.85)
  ) {
    regime = "strong_trend";
  }
  // Priority 3: Compressed range — ADX weak, BB squeeze or ATR collapsed
  else if (
    (adx != null && adx < 20) &&
    (bb_squeeze || (atr_ratio != null && atr_ratio < 0.7))
  ) {
    regime = "compressed_range";
  }

  const direction: MarketRegime["direction"] =
    ema_order === "bullish" ? "bullish" :
    ema_order === "bearish" ? "bearish" : "neutral";

  const approachMap: Record<MarketRegime["regime"], string> = {
    strong_trend: "Follow trend direction only. Entries on pullback to EMA/structure. Extend TP targets. Allow SL to breathe (1.5–2.5× ATR). Avoid counter-trend entries.",
    compressed_range: "Fade extremes of the range only. Conservative TP (first opposing level). SL just outside range. Avoid breakout entries unless confirmed with volume and momentum.",
    extreme_volatility: "Maximum caution. SL +30% wider than standard. Higher conviction required. Prefer Stand Aside if structure is chaotic or event is unresolved.",
    normal: "Standard framework applies. No regime adjustment required.",
  };

  const parts: string[] = [];
  parts.push(`Regime: ${regime.replace(/_/g, " ").toUpperCase()}`);
  if (adx != null)         parts.push(`ADX ${adx.toFixed(0)} (${h1.adx_strength ?? "—"})`);
  if (atr_ratio != null)   parts.push(`ATR ratio ${atr_ratio.toFixed(2)}x baseline`);
  if (bb_squeeze)          parts.push("BB squeeze active");
  parts.push(`Direction: ${direction}`);

  return {
    regime,
    direction,
    atr_ratio,
    approach: approachMap[regime],
    summary: parts.join(" | "),
  };
}
