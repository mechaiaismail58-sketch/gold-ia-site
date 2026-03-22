// Real order flow from Polygon.io — genuine volume delta on C:XAUUSD 1-minute bars

export type PolygonOrderFlow = {
  bars_count: number;
  delta_pct: number;
  signal: "strong_buying" | "buying" | "neutral" | "selling" | "strong_selling";
  last_price: number | null;
  summary: string;
};

export async function getPolygonOrderFlow(): Promise<PolygonOrderFlow | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  const now = Date.now();
  const from = now - 30 * 60 * 1000; // last 30 minutes
  const url = `https://api.polygon.io/v2/aggs/ticker/C:XAUUSD/range/1/minute/${from}/${now}?adjusted=true&sort=asc&limit=50&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`Polygon order flow HTTP ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      status?: string;
      results?: Array<{ o: number; h: number; l: number; c: number; v: number; t: number }>;
    };

    if (data.status === "ERROR" || !data.results?.length) {
      console.warn("Polygon order flow: no results");
      return null;
    }

    const bars = data.results;
    let buyVolume = 0;
    let sellVolume = 0;

    for (const bar of bars) {
      const range = bar.h - bar.l;
      if (range === 0 || !bar.v) continue;
      const buyFraction = (bar.c - bar.l) / range;
      buyVolume += buyFraction * bar.v;
      sellVolume += (1 - buyFraction) * bar.v;
    }

    const totalVolume = buyVolume + sellVolume;
    if (totalVolume === 0) return null;

    const netDelta = buyVolume - sellVolume;
    const deltaRatio = netDelta / totalVolume;

    let signal: PolygonOrderFlow["signal"] = "neutral";
    if (deltaRatio > 0.35) signal = "strong_buying";
    else if (deltaRatio > 0.10) signal = "buying";
    else if (deltaRatio < -0.35) signal = "strong_selling";
    else if (deltaRatio < -0.10) signal = "selling";

    const lastBar = bars[bars.length - 1];

    return {
      bars_count: bars.length,
      delta_pct: deltaRatio * 100,
      signal,
      last_price: lastBar?.c ?? null,
      summary: `Real flow (Polygon, ${bars.length}× 1m): ${signal.replace(/_/g, " ")} — net delta ${(deltaRatio * 100).toFixed(1)}% of volume`,
    };
  } catch (err) {
    console.error("Polygon order flow error:", err);
    return null;
  }
}
