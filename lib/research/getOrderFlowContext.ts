// ── Order Flow approximation from OHLCV bars ──────────────────────────────────
// Uses approximated volume delta — works with tick volume or range-proxy

export type OHLCVBar = {
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
};

export type DeltaSignal =
  | "strong_buying" | "buying" | "neutral" | "selling" | "strong_selling";

export type CVDSignal =
  | "bullish_divergence" | "bearish_divergence" | "confirming" | null;

export type VelocityState = "accelerating" | "normal" | "decelerating";

export type OrderFlowContext = {
  delta_h1_signal: DeltaSignal;
  delta_h4_signal: DeltaSignal;
  cvd_h4: CVDSignal;
  velocity_h1: VelocityState;
  velocity_note: string;
  institutional_synthesis: string | null;
  summary: string;
};

// ── Core delta computation ─────────────────────────────────────────────────────

/**
 * Approximated volume delta per bar.
 * - When tick volume is available: weights the close position in the range by volume.
 * - Fallback (volume=0): uses directional body size as proxy.
 * Result sign: positive = buying pressure, negative = selling pressure.
 */
function barDelta(bar: OHLCVBar): number {
  const range = bar.high - bar.low;
  if (range === 0) return 0;
  if (bar.volume > 0) {
    // (close − low) / (high − low) → fraction of range that is "bid"
    const buyFraction = (bar.close - bar.low) / range;
    return (2 * buyFraction - 1) * bar.volume; // −vol … +vol
  }
  // Fallback: directional body (sign + size)
  return bar.close - bar.open;
}

function classifyDelta(netDelta: number, totalAbsDelta: number): DeltaSignal {
  if (totalAbsDelta === 0) return "neutral";
  const r = netDelta / totalAbsDelta;
  if (r >  0.50) return "strong_buying";
  if (r >  0.15) return "buying";
  if (r < -0.50) return "strong_selling";
  if (r < -0.15) return "selling";
  return "neutral";
}

function netDelta(bars: OHLCVBar[], n: number): { signal: DeltaSignal } {
  if (bars.length < n) return { signal: "neutral" };
  const slice = bars.slice(-n);
  const deltas = slice.map(barDelta);
  const net = deltas.reduce((s, d) => s + d, 0);
  const totalAbs = deltas.reduce((s, d) => s + Math.abs(d), 0);
  return { signal: classifyDelta(net, totalAbs) };
}

// ── CVD divergence ─────────────────────────────────────────────────────────────

function computeCVDSignal(bars: OHLCVBar[], n = 50): CVDSignal {
  if (bars.length < n) return null;
  const slice = bars.slice(-n);

  // Build cumulative delta array
  const cvdArr: number[] = [];
  let c = 0;
  for (const bar of slice) { c += barDelta(bar); cvdArr.push(c); }

  // Compare averaged first vs last quintile to reduce noise
  const q = Math.max(5, Math.floor(n / 5));
  const avgArr = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const avgClose = (a: OHLCVBar[]) => a.reduce((s, b) => s + b.close, 0) / a.length;

  const priceEarly = avgClose(slice.slice(0, q));
  const priceLate  = avgClose(slice.slice(-q));
  const cvdEarly   = avgArr(cvdArr.slice(0, q));
  const cvdLate    = avgArr(cvdArr.slice(-q));

  // Require a meaningful CVD shift (> 12 % of full range) to avoid noise
  const cvdRange = Math.max(...cvdArr) - Math.min(...cvdArr);
  if (cvdRange === 0) return null;
  if (Math.abs(cvdLate - cvdEarly) / cvdRange < 0.12) return null;

  const priceUp = priceLate > priceEarly;
  const cvdUp   = cvdLate   > cvdEarly;

  if (priceUp && !cvdUp) return "bearish_divergence";  // price HH, CVD LH → weakness
  if (!priceUp && cvdUp) return "bullish_divergence";  // price LL, CVD HL → absorption
  if (priceUp && cvdUp)  return "confirming";
  return null;
}

// ── Movement velocity ──────────────────────────────────────────────────────────

function computeVelocity(bars: OHLCVBar[]): { state: VelocityState; note: string } {
  if (bars.length < 15) return { state: "normal", note: "Insufficient bars for velocity" };

  const recent = bars.slice(-20);
  const bodies = recent.map(b => Math.abs(b.close - b.open));
  // Baseline = mean of all but last 3
  const baseline = bodies.length > 3
    ? bodies.slice(0, -3).reduce((s, v) => s + v, 0) / (bodies.length - 3)
    : bodies.reduce((s, v) => s + v, 0) / bodies.length;

  if (baseline === 0) return { state: "normal", note: "No meaningful candle bodies detected" };

  const last3 = bodies.slice(-3);
  const lastBody = last3[last3.length - 1];
  const mult = lastBody / baseline;

  const expanding  = last3[2] > last3[1] && last3[1] > last3[0];
  const contracting = last3[2] < last3[1] && last3[1] < last3[0];

  if (mult > 2.5 || (expanding && mult > 1.5)) {
    const tag = mult > 3.0 ? "impulse — potential exhaustion or breakout" : "momentum expansion";
    return { state: "accelerating", note: `H1 velocity accelerating — last bar ${mult.toFixed(1)}× avg body size (${tag})` };
  }
  if (contracting || mult < 0.4) {
    return { state: "decelerating", note: `H1 velocity decelerating — shrinking candle bodies suggest absorption or momentum fade` };
  }
  return { state: "normal", note: `H1 velocity normal — ${mult.toFixed(1)}× avg body size` };
}

// ── Institutional synthesis (COT × Delta) ─────────────────────────────────────

export function buildInstitutionalSynthesis(
  deltaH4Signal: DeltaSignal,
  commercialSignal: string | null,
  largeSpecSignal: string | null
): string | null {
  if (!commercialSignal || !largeSpecSignal) return null;

  const bearDelta = deltaH4Signal === "selling" || deltaH4Signal === "strong_selling";
  const bullDelta = deltaH4Signal === "buying"  || deltaH4Signal === "strong_buying";
  const commShort = commercialSignal.includes("short");
  const commLong  = commercialSignal.includes("long");
  const specExtremeLong = largeSpecSignal === "extreme_long";

  if (commShort && bearDelta)
    return `Institutional conviction bearish: commercial hedging (${commercialSignal.replace(/_/g," ")}) aligns with H4 sell delta — institutional supply confirmed`;
  if (commLong && bullDelta)
    return `Institutional conviction bullish: commercial covering (${commercialSignal.replace(/_/g," ")}) aligns with H4 buy delta — institutional demand confirmed`;
  if (commLong && bearDelta)
    return `Institutional divergence: commercials covering (${commercialSignal.replace(/_/g," ")}) vs H4 sell delta — potential early accumulation against retail distribution`;
  if (commShort && bullDelta)
    return `Institutional divergence: commercial supply (${commercialSignal.replace(/_/g," ")}) vs H4 buy delta — overhead building against retail bids, caution`;
  if (specExtremeLong && commShort)
    return `COT extreme: large specs at extreme long + commercials short — crowded trade, elevated reversal risk regardless of delta`;
  return null;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function computeOrderFlow(
  h4Bars: OHLCVBar[],
  h1Bars: OHLCVBar[]
): OrderFlowContext {
  const { signal: delta_h1_signal } = netDelta(h1Bars, 10);
  const { signal: delta_h4_signal } = netDelta(h4Bars, 10);
  const cvd_h4 = computeCVDSignal(h4Bars, 50);
  const { state: velocity_h1, note: velocity_note } = computeVelocity(h1Bars);

  const parts: string[] = [
    `H1 delta (10 bars): ${delta_h1_signal.replace(/_/g, " ")}`,
    `H4 delta (10 bars): ${delta_h4_signal.replace(/_/g, " ")}`,
  ];
  if (cvd_h4) parts.push(`CVD H4: ${cvd_h4.replace(/_/g, " ")}`);
  parts.push(velocity_note);

  return {
    delta_h1_signal,
    delta_h4_signal,
    cvd_h4,
    velocity_h1,
    velocity_note,
    institutional_synthesis: null, // Set externally once COT is available
    summary: parts.join(" | "),
  };
}
