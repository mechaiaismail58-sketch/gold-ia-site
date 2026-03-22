// Yahoo Finance — VIX, MOVE, Copper, Oil, DXY fallback — no API key required

export type YahooFinanceContext = {
  vix: number | null;
  move_index: number | null;
  copper_price: number | null;
  oil_wti: number | null;
  dxy_yahoo: number | null;
  copper_gold_ratio: number | null;
  risk_sentiment: "risk_off" | "neutral" | "risk_on" | null;
  summary: string;
};

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)",
  "Accept": "application/json",
};

type YFResponse = {
  chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
};

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  const encoded = encodeURIComponent(ticker);
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1d`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: YF_HEADERS,
        next: { revalidate: 900 }, // 15-minute cache
      });
      if (!res.ok) continue;
      const data = await res.json() as YFResponse;
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price != null && Number.isFinite(price)) return price;
    } catch {
      continue;
    }
  }
  return null;
}

function noteVIX(vix: number): string {
  if (vix > 30) return `VIX ${vix.toFixed(1)} — extreme fear, risk-off, gold safe-haven bid elevated`;
  if (vix > 20) return `VIX ${vix.toFixed(1)} — moderate fear, mild risk-off`;
  return `VIX ${vix.toFixed(1)} — low fear, risk-on environment`;
}

function noteMOVE(move: number): string {
  if (move > 120) return `MOVE ${move.toFixed(0)} — extreme bond vol, rates instability = gold support`;
  if (move > 90) return `MOVE ${move.toFixed(0)} — elevated bond vol, yields unsettled`;
  return `MOVE ${move.toFixed(0)} — bond market calm`;
}

export async function getYahooFinanceContext(
  goldPrice: number | null
): Promise<YahooFinanceContext | null> {
  const [vix, move, copper, oil, dxy] = await Promise.all([
    fetchYahooPrice("^VIX"),
    fetchYahooPrice("^MOVE"),
    fetchYahooPrice("HG=F"),
    fetchYahooPrice("CL=F"),
    fetchYahooPrice("DX-Y.NYB"),
  ]);

  if (vix == null && move == null && copper == null && oil == null && dxy == null) return null;

  // Copper/Gold ratio: copper in USD/lb, gold in USD/oz
  // Scale × 1000 to get a ratio in a readable range (~0.15–0.30)
  const copper_gold_ratio =
    copper != null && goldPrice != null && goldPrice > 0
      ? (copper / goldPrice) * 1000
      : null;

  // Risk sentiment composite (-1 = risk-off/gold bullish, +1 = risk-on/gold bearish)
  const signals: number[] = [];
  if (vix != null) signals.push(vix > 25 ? -1 : vix < 15 ? 1 : 0);
  if (copper_gold_ratio != null) signals.push(copper_gold_ratio > 0.25 ? 1 : copper_gold_ratio < 0.15 ? -1 : 0);

  let risk_sentiment: YahooFinanceContext["risk_sentiment"] = null;
  if (signals.length > 0) {
    const avg = signals.reduce((s, v) => s + v, 0) / signals.length;
    risk_sentiment = avg > 0.3 ? "risk_on" : avg < -0.3 ? "risk_off" : "neutral";
  }

  const parts: string[] = [];
  if (vix != null) parts.push(noteVIX(vix));
  if (move != null) parts.push(noteMOVE(move));
  if (copper_gold_ratio != null) {
    const note =
      copper_gold_ratio > 0.25
        ? "risk-on (growth pricing)"
        : copper_gold_ratio < 0.15
        ? "risk-off (recession fear)"
        : "neutral";
    parts.push(`Copper/Gold ${copper_gold_ratio.toFixed(3)} — ${note}`);
  }
  if (oil != null) {
    const note =
      oil > 80
        ? "elevated (inflation risk)"
        : oil < 65
        ? "weak (demand concern)"
        : "normal range";
    parts.push(`WTI $${oil.toFixed(1)} — ${note}`);
  }
  if (dxy != null) parts.push(`DXY (Yahoo): ${dxy.toFixed(2)}`);

  return {
    vix,
    move_index: move,
    copper_price: copper,
    oil_wti: oil,
    dxy_yahoo: dxy,
    copper_gold_ratio,
    risk_sentiment,
    summary: parts.join(" | "),
  };
}
