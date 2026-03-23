// GLD/IAU ETF flows — tonnes held + 5/20-day flow trend from Yahoo Finance volume

export type ETFFlowsContext = {
  gld_tonnes: number | null;
  iau_tonnes: number | null;
  combined_tonnes: number | null;
  institutional_signal: "accumulation" | "distribution" | "neutral" | null;
  // Flow trend analysis
  gld_5d_flow_signal: "strong_inflow" | "inflow" | "neutral" | "outflow" | "strong_outflow" | null;
  gld_20d_flow_signal: "strong_inflow" | "inflow" | "neutral" | "outflow" | "strong_outflow" | null;
  gld_5d_volume_ratio: number | null;  // recent vs avg: > 1.3 = unusual activity
  gld_price_5d_pct: number | null;
  gld_price_20d_pct: number | null;
  flow_trend_summary: string;
  summary: string;
};

// Each GLD share ≈ 0.0925 troy oz; each IAU share ≈ 0.01 troy oz
const GLD_OZ_PER_SHARE = 0.0925;
const IAU_OZ_PER_SHARE = 0.01;
const TROY_OZ_PER_TONNE = 32150.7;

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)",
  "Accept": "application/json",
};

type QuoteSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: { sharesOutstanding?: { raw?: number } };
    }>;
  };
};

type YFChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

async function fetchSharesOutstanding(ticker: string): Promise<number | null> {
  const urls = [
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics`,
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 86400 } });
      if (!res.ok) {
        console.error(`fetchSharesOutstanding(${ticker}): HTTP ${res.status} from ${url}`);
        continue;
      }
      const data = await res.json() as QuoteSummaryResponse;
      const shares = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics?.sharesOutstanding?.raw;
      if (shares != null && Number.isFinite(shares)) return shares;
      console.warn(`fetchSharesOutstanding(${ticker}): sharesOutstanding missing in response from ${url}`);
    } catch (err) {
      console.error(`fetchSharesOutstanding(${ticker}): fetch failed for ${url}:`, err);
      continue;
    }
  }
  return null;
}

async function fetchGLDHistory(): Promise<{ closes: number[]; volumes: number[] } | null> {
  const urls = [
    "https://query1.finance.yahoo.com/v8/finance/chart/GLD?range=1mo&interval=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/GLD?range=1mo&interval=1d",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } }); // 1h cache
      if (!res.ok) {
        console.error(`fetchGLDHistory: HTTP ${res.status} from ${url}`);
        continue;
      }
      const data = await res.json() as YFChartResponse;
      const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
      if (!quote) {
        console.warn(`fetchGLDHistory: no quote data in response from ${url}`);
        continue;
      }
      const closes  = (quote.close  ?? []).filter((v): v is number => v != null && Number.isFinite(v));
      const volumes = (quote.volume ?? []).filter((v): v is number => v != null && Number.isFinite(v));
      if (closes.length >= 10 && volumes.length >= 10) return { closes, volumes };
      console.warn(`fetchGLDHistory: insufficient data — ${closes.length} closes, ${volumes.length} volumes from ${url}`);
    } catch (err) {
      console.error(`fetchGLDHistory: fetch failed for ${url}:`, err);
      continue;
    }
  }
  return null;
}

type FlowSignal = "strong_inflow" | "inflow" | "neutral" | "outflow" | "strong_outflow";

function computeFlowSignal(volumeRatio: number, priceChangePct: number): FlowSignal {
  // High volume + price up → shares being created (institutional demand)
  // High volume + price down → shares being redeemed (institutional selling)
  if (volumeRatio > 2.0) {
    return priceChangePct > 0.5 ? "strong_inflow" : priceChangePct < -0.5 ? "strong_outflow" : "neutral";
  }
  if (volumeRatio > 1.4) {
    return priceChangePct > 0.3 ? "inflow" : priceChangePct < -0.3 ? "outflow" : "neutral";
  }
  // Low volume divergence from price: underperformance vs normal → outflows; outperformance → inflows
  if (volumeRatio < 0.5) {
    return priceChangePct < -1.0 ? "outflow" : "neutral";
  }
  return "neutral";
}

export async function getETFFlowsContext(): Promise<ETFFlowsContext | null> {
  const [gldShares, iauShares, history] = await Promise.all([
    fetchSharesOutstanding("GLD"),
    fetchSharesOutstanding("IAU"),
    fetchGLDHistory(),
  ]);

  if (gldShares == null && iauShares == null) return null;

  const gld_tonnes = gldShares != null ? (gldShares * GLD_OZ_PER_SHARE) / TROY_OZ_PER_TONNE : null;
  const iau_tonnes = iauShares != null ? (iauShares * IAU_OZ_PER_SHARE) / TROY_OZ_PER_TONNE : null;

  const combined_tonnes =
    gld_tonnes != null && iau_tonnes != null
      ? gld_tonnes + iau_tonnes
      : gld_tonnes ?? iau_tonnes;

  let institutional_signal: ETFFlowsContext["institutional_signal"] = "neutral";
  if (combined_tonnes != null) {
    if (combined_tonnes > 950) institutional_signal = "accumulation";
    else if (combined_tonnes < 700) institutional_signal = "distribution";
  }

  // ── Flow trend from 30-day GLD price/volume history ───────────────────────
  let gld_5d_flow_signal: FlowSignal | null = null;
  let gld_20d_flow_signal: FlowSignal | null = null;
  let gld_5d_volume_ratio: number | null = null;
  let gld_price_5d_pct: number | null = null;
  let gld_price_20d_pct: number | null = null;
  let flow_trend_summary = "";

  if (history && history.closes.length >= 10) {
    const { closes, volumes } = history;
    const n = closes.length;

    // 20-day avg volume baseline
    const vol20 = volumes.slice(-20);
    const avgVol20 = vol20.reduce((s, v) => s + v, 0) / vol20.length;

    // 5-day avg volume
    const vol5 = volumes.slice(-5);
    const avgVol5 = vol5.reduce((s, v) => s + v, 0) / vol5.length;

    gld_5d_volume_ratio = avgVol20 > 0 ? avgVol5 / avgVol20 : null;

    // 5-day price change
    if (n >= 5) {
      const close5dAgo = closes[n - 5];
      const closeNow = closes[n - 1];
      if (close5dAgo > 0) gld_price_5d_pct = ((closeNow - close5dAgo) / close5dAgo) * 100;
    }

    // 20-day price change
    if (n >= 20) {
      const close20dAgo = closes[n - 20];
      const closeNow = closes[n - 1];
      if (close20dAgo > 0) gld_price_20d_pct = ((closeNow - close20dAgo) / close20dAgo) * 100;
    }

    if (gld_5d_volume_ratio != null && gld_price_5d_pct != null) {
      gld_5d_flow_signal = computeFlowSignal(gld_5d_volume_ratio, gld_price_5d_pct);
    }

    // 20-day flow: compare volume of last 20d vs 10d-ago baseline
    if (n >= 20) {
      const vol20_recent = volumes.slice(-10);
      const vol20_prev   = volumes.slice(-20, -10);
      const avg20recent = vol20_recent.reduce((s, v) => s + v, 0) / vol20_recent.length;
      const avg20prev   = vol20_prev.reduce((s, v)   => s + v, 0) / vol20_prev.length;
      const vol20Ratio = avg20prev > 0 ? avg20recent / avg20prev : null;
      if (vol20Ratio != null && gld_price_20d_pct != null) {
        gld_20d_flow_signal = computeFlowSignal(vol20Ratio, gld_price_20d_pct);
      }
    }

    const signalLabel = (s: FlowSignal) => s.replace(/_/g, " ");
    const parts: string[] = [];
    if (gld_5d_flow_signal)  parts.push(`5d: ${signalLabel(gld_5d_flow_signal)}`);
    if (gld_20d_flow_signal) parts.push(`20d: ${signalLabel(gld_20d_flow_signal)}`);
    if (gld_5d_volume_ratio != null) parts.push(`Vol ratio 5d/20d: ${gld_5d_volume_ratio.toFixed(2)}×`);
    flow_trend_summary = parts.join(" | ");
  }

  const summaryParts: string[] = [];
  if (gld_tonnes != null) summaryParts.push(`GLD: ~${gld_tonnes.toFixed(0)}t`);
  if (iau_tonnes != null) summaryParts.push(`IAU: ~${iau_tonnes.toFixed(0)}t`);
  if (combined_tonnes != null) {
    const note =
      institutional_signal === "accumulation"
        ? "institutional accumulation (above historical norm)"
        : institutional_signal === "distribution"
        ? "institutional distribution (below historical norm)"
        : "normal holding level";
    summaryParts.push(`Combined: ~${combined_tonnes.toFixed(0)}t — ${note}`);
  }
  if (flow_trend_summary) summaryParts.push(`Flow: ${flow_trend_summary}`);

  return {
    gld_tonnes,
    iau_tonnes,
    combined_tonnes,
    institutional_signal,
    gld_5d_flow_signal,
    gld_20d_flow_signal,
    gld_5d_volume_ratio,
    gld_price_5d_pct,
    gld_price_20d_pct,
    flow_trend_summary,
    summary: summaryParts.join(" | "),
  };
}
