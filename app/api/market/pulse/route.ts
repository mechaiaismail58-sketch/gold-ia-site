import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple 30-second in-memory cache
let cachedAt = 0;
let cachedData: { price: number; change_24h_pct: number; session: string } | null = null;

function getActiveSession(): string {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
  if (utcDay === 0 || utcDay === 6) return "Closed";
  const utcHour = now.getUTCHours();
  if (utcHour >= 7 && utcHour < 12) return "London";
  if (utcHour >= 12 && utcHour < 21) return "New York";
  return "Asia";
}

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cachedAt < 30_000) {
    return NextResponse.json(cachedData, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY not configured" }, { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const [priceRes, prevRes] = await Promise.allSettled([
      fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${apiKey}`, { signal: controller.signal }),
      fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=2&apikey=${apiKey}`, { signal: controller.signal }),
    ]);
    clearTimeout(timer);

    let price = 0;
    let change_24h_pct = 0;

    if (priceRes.status === "fulfilled" && priceRes.value.ok) {
      const data = await priceRes.value.json();
      price = parseFloat(data.price ?? "0");
    }

    if (prevRes.status === "fulfilled" && prevRes.value.ok) {
      const data = await prevRes.value.json();
      const values = data?.values ?? [];
      if (values.length >= 2) {
        const today = parseFloat(values[0]?.close ?? "0");
        const yesterday = parseFloat(values[1]?.close ?? "0");
        if (price === 0) price = today;
        if (yesterday > 0) {
          change_24h_pct = parseFloat((((price - yesterday) / yesterday) * 100).toFixed(2));
        }
      }
    }

    const result = { price, change_24h_pct, session: getActiveSession() };
    cachedData = result;
    cachedAt = now;

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  } catch (err) {
    console.error("[market/pulse] error:", err);
    // Return stale if available
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
  }
}
