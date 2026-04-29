// /api/dashboard — aggregated market data for the split-screen dashboard panel
// No auth required — data is public market information.
// Timeout: 10s per fetch, never throws.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getLatestFredValue, getFredLatestTwo } from "@/lib/research/getFredSeries";
import { buildFedWatchContext } from "@/lib/research/getFedWatchContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>(r => setTimeout(() => r(fallback), ms))]);
}

// ── Session detection ──────────────────────────────────────────────────────────

function detectSession(): { session: string; sessionStart: string; sessionEnd: string } {
  const h = new Date().getUTCHours();
  if (h >= 22 || h < 3)  return { session: "ASIA",       sessionStart: "22:00", sessionEnd: "03:00" };
  if (h >= 3  && h < 7)  return { session: "OVERNIGHT",  sessionStart: "03:00", sessionEnd: "07:00" };
  if (h >= 7  && h < 13) return { session: "LONDON",     sessionStart: "07:00", sessionEnd: "13:00" };
  if (h >= 13 && h < 16) return { session: "NY/LONDON",  sessionStart: "13:00", sessionEnd: "16:00" };
  return                        { session: "NEW YORK",   sessionStart: "16:00", sessionEnd: "21:00" };
}

// ── Gold price from Twelve Data ───────────────────────────────────────────────

async function fetchGoldPrice(): Promise<{ price: number | null; changePercent: number | null; changePct: string }> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return { price: null, changePercent: null, changePct: "—" };
  try {
    const [priceRes, prevRes] = await Promise.all([
      fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${key}`, { next: { revalidate: 30 } }),
      fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=2&apikey=${key}`, { next: { revalidate: 300 } }),
    ]);
    let price: number | null = null;
    let changePercent: number | null = null;

    if (priceRes.ok) {
      const d = await priceRes.json();
      price = parseFloat(d.price ?? "0") || null;
    }
    if (prevRes.ok) {
      const d = await prevRes.json();
      const vals = d?.values ?? [];
      if (vals.length >= 2 && price) {
        const prev = parseFloat(vals[1]?.close ?? "0");
        if (prev > 0) changePercent = parseFloat(((price - prev) / prev * 100).toFixed(2));
      }
    }
    const changePct = changePercent != null ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%` : "—";
    return { price, changePercent, changePct };
  } catch { return { price: null, changePercent: null, changePct: "—" }; }
}

// ── Latest scan bias + confluence ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchScanBias(db: any): Promise<{ bias: string; confluenceScore: number | null; marketState: string } | null> {
  try {
    const { data } = await db
      .from("market_scans")
      .select("bias, confluence_score, market_state")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!data) return null;
    return {
      bias: data.bias ?? "neutral",
      confluenceScore: data.confluence_score ?? null,
      marketState: data.market_state ?? "unknown",
    };
  } catch { return null; }
}

// ── Next high-impact event ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchNextEvent(db: any): Promise<{ title: string; eventTime: string; impact: string; hoursUntil: number } | null> {
  try {
    const { data } = await db
      .from("events")
      .select("title, event_time, impact")
      .gt("event_time", new Date().toISOString())
      .eq("impact", "HIGH")
      .order("event_time", { ascending: true })
      .limit(1)
      .single();
    if (!data) return null;
    const hoursUntil = parseFloat(((new Date(data.event_time).getTime() - Date.now()) / 3600000).toFixed(1));
    return { title: data.title, eventTime: data.event_time, impact: data.impact, hoursUntil };
  } catch { return null; }
}

// ── COT from latest scan ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCOT(db: any): Promise<{ managedMoney: number | null; swapDealers: number | null; smallSpecs: number | null } | null> {
  try {
    const { data } = await db
      .from("market_scans")
      .select("cot_data")
      .not("cot_data", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const cot = data?.cot_data;
    if (!cot) return null;
    return {
      managedMoney: cot.managed_money_net ?? null,
      swapDealers:  cot.swap_dealer_net   ?? null,
      smallSpecs:   cot.small_spec_net    ?? null,
    };
  } catch { return null; }
}

// ── Gold/Silver ratio ─────────────────────────────────────────────────────────

async function fetchGoldSilverRatio(goldPrice: number | null): Promise<{ ratio: number | null; zone: string } | null> {
  if (!goldPrice) return null;
  try {
    const silver = await getLatestFredValue("SLVPRUSD");
    if (!silver || silver === 0) return null;
    const ratio = parseFloat((goldPrice / silver).toFixed(1));
    const zone = ratio < 70 ? "cheap_gold" : ratio > 85 ? "expensive_gold" : "normal";
    return { ratio, zone };
  } catch { return null; }
}

// ── Yield curve ───────────────────────────────────────────────────────────────

async function fetchYieldCurve(): Promise<{ spread: number | null; status: string; trend: string } | null> {
  try {
    const [us10y, us2y] = await Promise.all([
      getLatestFredValue("DGS10"),
      getLatestFredValue("DGS2"),
    ]);
    if (us10y == null || us2y == null) return null;
    const spread = parseFloat((us10y - us2y).toFixed(3));
    const status = spread < 0 ? "inverted" : spread < 0.3 ? "flat" : "normal";
    const trend  = spread < 0 ? "inverting" : spread < 0.3 ? "flattening" : "widening";
    return { spread, status, trend };
  } catch { return null; }
}

// ── ETF flows ─────────────────────────────────────────────────────────────────

async function fetchETFFlows(): Promise<{ gld5d: number | null; iau5d: number | null; signal: string } | null> {
  const YF = { "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)", Accept: "application/json" };
  async function get5dChange(ticker: string): Promise<number | null> {
    for (const base of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
      try {
        const res = await fetch(`${base}/v8/finance/chart/${ticker}?range=5d&interval=1d`, { headers: YF, next: { revalidate: 3600 } });
        if (!res.ok) continue;
        const d = await res.json();
        const closes: number[] = (d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((v: unknown): v is number => typeof v === "number" && isFinite(v));
        if (closes.length < 2) continue;
        return parseFloat(((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2));
      } catch { continue; }
    }
    return null;
  }
  try {
    const [gld5d, iau5d] = await Promise.all([get5dChange("GLD"), get5dChange("IAU")]);
    const avg = [gld5d, iau5d].filter(v => v != null) as number[];
    const mean = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : 0;
    const signal = mean > 0.5 ? "accumulation" : mean < -0.5 ? "distribution" : "neutral";
    return { gld5d, iau5d, signal };
  } catch { return null; }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const db = createAdminClient();

  const [
    goldData,
    scanBias,
    realYieldTrend,
    us10yData,
    us2yData,
    targetUpper,
    effectiveRate,
    sofr,
    nextEvent,
    cotData,
    etfFlows,
  ] = await Promise.all([
    withTimeout(fetchGoldPrice(), 10000, { price: null, changePercent: null, changePct: "—" }),
    db ? withTimeout(fetchScanBias(db), 5000, null) : Promise.resolve(null),
    withTimeout(getFredLatestTwo("DFII10"), 5000, { current: null, previous: null, direction: "Data not found" as const }),
    withTimeout(getLatestFredValue("DGS10"), 5000, null),
    withTimeout(getLatestFredValue("DGS2"),  5000, null),
    withTimeout(getLatestFredValue("DFEDTARU"), 5000, null),
    withTimeout(getLatestFredValue("FEDFUNDS"),  5000, null),
    withTimeout(getLatestFredValue("SOFR"),      5000, null),
    db ? withTimeout(fetchNextEvent(db), 5000, null) : Promise.resolve(null),
    db ? withTimeout(fetchCOT(db), 5000, null) : Promise.resolve(null),
    withTimeout(fetchETFFlows(), 10000, null),
  ]);

  // Gold/silver ratio (needs gold price)
  const [goldSilver, yieldCurve] = await Promise.all([
    withTimeout(fetchGoldSilverRatio(goldData.price), 5000, null),
    withTimeout(fetchYieldCurve(), 5000, null),
  ]);

  // FedWatch (pure computation from FRED data)
  const fedWatchCtx = buildFedWatchContext({ targetUpper, sofr, effectiveRate, tgaBalance: null });
  const bias = fedWatchCtx.next_meeting_bias ?? "unknown";
  const fedWatch = {
    hold: bias === "hold" ? 60 : bias === "cut" ? 20 : 30,
    cut:  bias === "cut"  ? 65 : bias === "hold" ? 25 : 10,
    hike: bias === "hike" ? 55 : 5,
    bias,
    summary: fedWatchCtx.summary ?? null,
  };

  // Real yield
  const realYield = {
    value: realYieldTrend.current,
    trend: realYieldTrend.direction === "rising" ? "rising"
         : realYieldTrend.direction === "falling" ? "falling" : "flat",
  };

  // Yield curve spread (recompute from FRED data we already have)
  const spread = us10yData != null && us2yData != null
    ? parseFloat((us10yData - us2yData).toFixed(3))
    : null;
  const yieldCurveResult = yieldCurve ?? (spread != null ? {
    spread,
    status: spread < 0 ? "inverted" : spread < 0.3 ? "flat" : "normal",
    trend:  spread < 0 ? "inverting" : spread < 0.3 ? "flattening" : "widening",
  } : null);

  const session = detectSession();

  return NextResponse.json({
    price: {
      price:         goldData.price,
      changePercent: goldData.changePercent,
      changePct:     goldData.changePct,
    },
    bias: scanBias,
    realYield,
    session,
    nextEvent,
    cot: cotData,
    fedWatch,
    yieldCurve: yieldCurveResult,
    goldSilver,
    etfFlows,
    narrative: null, // populated by narrative intelligence module when available
    updatedAt: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
