type TwelveQuote = {
  price?: string;
  close?: string;
};

async function getTwelvePrice(symbol: string): Promise<number | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    console.error("Missing TWELVE_DATA_API_KEY");
    return null;
  }

  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 15 },
  });

  if (!res.ok) {
    console.error(`TwelveData price failed for ${symbol}: ${res.status}`);
    return null;
  }

  const data = (await res.json()) as TwelveQuote & { status?: string; message?: string };

  const raw = data.price ?? data.close ?? null;
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function calcDivergencePct(a: number | null, b: number | null): number | null {
  if (a == null || b == null || a === 0) return null;
  return Math.abs((a - b) / a) * 100;
}

export async function getPriceContext() {
  const xauusdSymbol = process.env.XAUUSD_SYMBOL || "XAU/USD";
  const gldSymbol = process.env.GLD_SYMBOL || "GLD";
  const gcfSymbol = process.env.GCF_SYMBOL || "GC=F";
  const dxySymbol = process.env.DXY_SYMBOL || "DXY";

  const [xauusd, gc_f, gld, dxy] = await Promise.all([
    getTwelvePrice(xauusdSymbol),
    getTwelvePrice(gcfSymbol),
    getTwelvePrice(gldSymbol),
    getTwelvePrice(dxySymbol),
  ]);

  const divergence_pct = calcDivergencePct(xauusd, gc_f);

  return {
    xauusd,
    gc_f,
    gld,
    dxy,
    validated: divergence_pct != null ? divergence_pct <= 0.5 : false,
    divergence_pct,
    source_1: "Twelve Data",
    source_2: "Twelve Data",
  };
}