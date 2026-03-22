import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWELVE_KEY = process.env.TWELVE_DATA_API_KEY;
const FRED_KEY   = process.env.FRED_API_KEY;

export type TickerItem = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  decimals:      number;
  prefix?:       string;
  suffix?:       string;
};

/* ── Twelve Data — XAUUSD only ─────────────────────────────── */
async function getTwelveXAU(): Promise<any> {
  if (!TWELVE_KEY) return null;
  try {
    const url = `https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${TWELVE_KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ── Yahoo Finance v8 chart — free, no key ──────────────────── */
async function getYahooChart(
  symbol: string,
): Promise<{ price: number | null; change: number; changePercent: number }> {
  const empty = { price: null, change: 0, changePercent: 0 };
  try {
    const url =
      `https://query2.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return empty;
    const price = meta.regularMarketPrice as number;
    const prev  = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number;
    const change = price - prev;
    const changePercent = prev !== 0 ? (change / prev) * 100 : 0;
    return { price, change, changePercent };
  } catch {
    return empty;
  }
}

/* ── FRED US 10-Year Yield ──────────────────────────────────── */
async function getFredUS10Y(): Promise<{ value: number | null; prev: number | null }> {
  if (!FRED_KEY) return { value: null, prev: null };
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=DGS10&api_key=${FRED_KEY}&limit=3&sort_order=desc&file_type=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return { value: null, prev: null };
    const data = await res.json();
    const valid = (data?.observations ?? []).filter((o: any) => o.value !== ".");
    return {
      value: valid[0]?.value ? parseFloat(valid[0].value) : null,
      prev:  valid[1]?.value ? parseFloat(valid[1].value) : null,
    };
  } catch {
    return { value: null, prev: null };
  }
}

/* ── Parse a Twelve Data quote object ──────────────────────── */
function parseTwelveQuote(
  raw: any,
  name:     string,
  decimals: number,
  prefix?:  string,
  suffix?:  string,
): TickerItem | null {
  if (!raw || raw.code || raw.status === "error") return null;
  const price         = parseFloat(raw.price ?? raw.close ?? "0");
  const change        = parseFloat(raw.change ?? "0");
  const changePercent = parseFloat(raw.percent_change ?? "0");
  if (!isFinite(price) || price === 0) return null;
  return { symbol: name, name, price, change, changePercent, decimals, prefix, suffix };
}

/* ── Main handler ───────────────────────────────────────────── */
export async function GET() {
  const [xauRaw, dxyData, xagData, us10y] = await Promise.all([
    getTwelveXAU(),
    getYahooChart("DX-Y.NYB"),   // DXY — US Dollar Index
    getYahooChart("XAG=X"),      // Silver spot
    getFredUS10Y(),
  ]);

  const items: TickerItem[] = [];

  // 1. XAUUSD (Twelve Data)
  const xauItem = parseTwelveQuote(xauRaw, "XAUUSD", 2, "$");
  if (xauItem) items.push(xauItem);

  // 2. DXY (Yahoo Finance)
  if (dxyData.price !== null) {
    items.push({
      symbol:        "DXY",
      name:          "DXY",
      price:         dxyData.price,
      change:        parseFloat(dxyData.change.toFixed(3)),
      changePercent: parseFloat(dxyData.changePercent.toFixed(2)),
      decimals:      2,
    });
  }

  // 3. US 10Y (FRED — daily)
  if (us10y.value !== null) {
    const ch  = us10y.prev !== null ? us10y.value - us10y.prev : 0;
    const pct = us10y.prev && us10y.prev !== 0 ? (ch / us10y.prev) * 100 : 0;
    items.push({
      symbol:        "US10Y",
      name:          "US 10Y",
      price:         us10y.value,
      change:        parseFloat(ch.toFixed(3)),
      changePercent: parseFloat(pct.toFixed(2)),
      decimals:      2,
      suffix:        "%",
    });
  }

  // 4. XAGUSD (Yahoo Finance)
  if (xagData.price !== null) {
    items.push({
      symbol:        "XAGUSD",
      name:          "XAGUSD",
      price:         xagData.price,
      change:        parseFloat(xagData.change.toFixed(3)),
      changePercent: parseFloat(xagData.changePercent.toFixed(2)),
      decimals:      2,
      prefix:        "$",
    });
  }

  return NextResponse.json({ items, ts: Date.now() });
}
