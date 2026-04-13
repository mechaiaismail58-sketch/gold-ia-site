import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 30s server-side cache
let cachedAt = 0;
let cachedMarket: { price: number; change_pct: number; session: string; dxy: number | null; real_yield: number | null; vix: number | null } | null = null;

function getActiveSession(): string {
  const now = new Date();
  const d = now.getUTCDay();
  if (d === 0 || d === 6) return "Closed";
  const h = now.getUTCHours();
  if (h >= 7 && h < 12) return "London";
  if (h >= 12 && h < 21) return "New York";
  return "Asia";
}

async function fetchMarketData() {
  const now = Date.now();
  if (cachedMarket && now - cachedAt < 30_000) return cachedMarket;

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  let price = 0, change_pct = 0, dxy: number | null = null;

  if (apiKey) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const [priceRes, prevRes, dxyRes] = await Promise.allSettled([
        fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${apiKey}`, { signal: ctrl.signal }),
        fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=2&apikey=${apiKey}`, { signal: ctrl.signal }),
        fetch(`https://api.twelvedata.com/price?symbol=DXY&apikey=${apiKey}`, { signal: ctrl.signal }),
      ]);
      clearTimeout(t);
      if (priceRes.status === "fulfilled" && priceRes.value.ok) {
        const d = await priceRes.value.json() as { price?: string };
        price = parseFloat(d.price ?? "0") || 0;
      }
      if (prevRes.status === "fulfilled" && prevRes.value.ok) {
        const d = await prevRes.value.json() as { values?: Array<{ close: string }> };
        const vals = d.values ?? [];
        if (vals.length >= 2 && price > 0) {
          const prev = parseFloat(vals[1].close);
          if (prev > 0) change_pct = ((price - prev) / prev) * 100;
        }
      }
      if (dxyRes.status === "fulfilled" && dxyRes.value.ok) {
        const d = await dxyRes.value.json() as { price?: string };
        dxy = parseFloat(d.price ?? "0") || null;
      }
    } catch { /* silent */ }
  }

  // VIX + real yield from Yahoo Finance (best-effort, no auth needed)
  let real_yield: number | null = null;
  let vix: number | null = null;
  try {
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 3000);
    const YF_HEADERS = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };
    const [vixRes, ryRes] = await Promise.allSettled([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1d&interval=1d", { headers: YF_HEADERS, signal: ctrl2.signal }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?range=1d&interval=1d", { headers: YF_HEADERS, signal: ctrl2.signal }),
    ]);
    clearTimeout(t2);
    type YFMeta = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
    if (vixRes.status === "fulfilled" && vixRes.value.ok) {
      const d = await vixRes.value.json() as YFMeta;
      vix = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
    if (ryRes.status === "fulfilled" && ryRes.value.ok) {
      const d = await ryRes.value.json() as YFMeta;
      real_yield = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
  } catch { /* silent */ }

  cachedMarket = { price, change_pct, session: getActiveSession(), dxy, real_yield, vix };
  cachedAt = Date.now();
  return cachedMarket;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const db = (admin ?? supabase) as typeof supabase;

  const [market, alertsRes, tradesRes, scanRes] = await Promise.allSettled([
    fetchMarketData(),
    db.from("scan_alerts")
      .select("alert_type, message, severity, created_at")
      .eq("acknowledged", false)
      .gte("created_at", new Date(Date.now() - 4 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(3),
    db.from("trades")
      .select("bias, result, entry, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("market_scans")
      .select("rsi_h4, adx_h4, alert_message")
      .order("scanned_at", { ascending: false })
      .limit(1),
  ]);

  const mkt = market.status === "fulfilled" ? market.value : { price: 0, change_pct: 0, session: "Closed", dxy: null, real_yield: null, vix: null };
  const alerts = alertsRes.status === "fulfilled" ? (alertsRes.value.data ?? []) : [];
  const trades = tradesRes.status === "fulfilled" ? (tradesRes.value.data ?? []) : [];
  const scan = scanRes.status === "fulfilled" ? (scanRes.value.data?.[0] ?? null) : null;

  const wins = trades.filter(t => t.result === "tp1_hit" || t.result === "tp2_hit").length;
  const closed = trades.filter(t => t.result && t.result !== "pending" && t.result !== "still_open").length;
  const winrate = closed > 0 ? Math.round((wins / closed) * 100) : null;
  const lastTrade = trades[0] ?? null;

  return NextResponse.json({
    price: mkt.price,
    change_pct: mkt.change_pct,
    session: mkt.session,
    dxy: mkt.dxy,
    real_yield: mkt.real_yield,
    vix: mkt.vix,
    last_confluence: scan?.adx_h4 ?? null,
    alerts,
    last_trade: lastTrade,
    winrate,
    total_trades: closed,
  }, { headers: { "Cache-Control": "private, s-maxage=30" } });
}
