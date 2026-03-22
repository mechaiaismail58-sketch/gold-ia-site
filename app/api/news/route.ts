type SentimentTag = "Bullish" | "Bearish" | "Neutral";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  tag: SentimentTag;
};

// ─── Relevance filter ────────────────────────────────────────────────────────
// Keeps only articles relevant to gold / macro / USD / yields

const RELEVANCE = [
  "gold", "xau", "xauusd", "bullion", "precious metal",
  "federal reserve", "fed ", " fed,", "fomc", "powell", "monetary policy",
  "treasury", "yield", "10-year", "10y", "bond",
  "dollar", "dxy", "usd index", "greenback",
  "inflation", "cpi", "pce", "deflation", "disinflation",
  "interest rate", "rate cut", "rate hike", "rate decision",
  "safe haven", "risk off", "geopolit", "iran", "war ", "conflict",
  "oil price", "silver", "copper",        // correlated commodities
  "recession", "gdp", "growth", "slowdown",
  "ecb", "boj", "bank of england", "central bank",
  "jobs report", "nfp", "unemployment", "payroll",
];

function isRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return RELEVANCE.some((kw) => lower.includes(kw));
}

// ─── Sentiment ────────────────────────────────────────────────────────────────

const BULLISH = [
  "rate cut","rate cuts","cuts rates","dovish","easing",
  "dollar falls","dollar drops","dollar weakens","dxy falls","dxy down",
  "gold rises","gold surges","gold rallies","gold jumps","gold gains","gold up",
  "gold hits record","gold near record","gold record",
  "safe haven","risk off","risk-off","flight to safety",
  "geopolitical","tension","crisis","conflict","war",
  "recession","slowdown","contraction",
  "inflation falls","inflation eases","disinflation",
  "weak jobs","unemployment rises","payrolls miss",
  "yields fall","yields drop","yields decline","10-year falls",
  "fed pause","no hike","fed hold","rate pause",
  "negative real yield","real yields fall","central bank buying",
];

const BEARISH = [
  "rate hike","rate hikes","hawkish","tightening","higher for longer",
  "dollar rises","dollar strengthens","dollar gains","dollar surges",
  "dxy up","dxy rises","usd rises","usd strengthens",
  "gold falls","gold drops","gold slides","gold declines","gold down","gold tumbles",
  "risk on","risk-on",
  "yields rise","yields surge","yields spike","10-year rises","treasury yields up",
  "strong jobs","hot inflation","inflation surges","inflation beats","cpi beats","pce beats",
  "real yields rise","more hikes","higher rates",
  "gold outflows","etf outflows",
];

function tagSentiment(title: string): SentimentTag {
  const lower = title.toLowerCase();
  const b = BULLISH.filter((kw) => lower.includes(kw)).length;
  const r = BEARISH.filter((kw) => lower.includes(kw)).length;
  if (b > r) return "Bullish";
  if (r > b) return "Bearish";
  return "Neutral";
}

// ─── RSS parser ───────────────────────────────────────────────────────────────

type RawItem = { title: string; url: string; pubDate: string };

function parseRSS(xml: string, defaultSource: string): Array<RawItem & { source: string }> {
  const items: Array<RawItem & { source: string }> = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null) {
    const b = m[1];

    const rawTitle =
      /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i.exec(b)?.[1] ??
      /<title>([\s\S]*?)<\/title>/i.exec(b)?.[1] ??
      "";

    const title = rawTitle
      .replace(/&amp;/g, "&")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#x2018;/g, "'").replace(/&#x2019;/g, "'")
      .replace(/&#x2014;/g, "—")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!title || title.length < 8) continue;

    const url = (/<link>([\s\S]*?)<\/link>/i.exec(b)?.[1] ?? "").trim();
    const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/i.exec(b)?.[1] ?? "").trim();

    items.push({ title, url, pubDate, source: defaultSource });
  }
  return items;
}

function toISO(raw: string): string {
  if (!raw) return new Date().toISOString();
  try {
    // Handle "2026-03-21 15:59:45" (Investing.com) and RFC-822
    const d = new Date(raw.replace(" ", "T"));
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── Sources ─────────────────────────────────────────────────────────────────

const SOURCES: Array<{ url: string; name: string }> = [
  // Reuters — business / commodities / macro (current, reliable)
  {
    url: "https://feeds.reuters.com/reuters/businessNews",
    name: "Reuters",
  },
  // Investing.com — economy & macro (confirmed: returns today's dates)
  {
    url: "https://www.investing.com/rss/news_14.rss",
    name: "Investing.com",
  },
  // Investing.com — forex / USD focus
  {
    url: "https://www.investing.com/rss/news_2.rss",
    name: "Investing.com",
  },
  // Investing.com — commodities (gold, oil, silver)
  {
    url: "https://www.investing.com/rss/news_4.rss",
    name: "Investing.com",
  },
  // FXStreet — forex / gold / Fed coverage
  {
    url: "https://www.fxstreet.com/rss/news",
    name: "FXStreet",
  },
];

const FETCH_OPTIONS = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  next: { revalidate: 180 }, // cache 3 min for fresher news
};

async function fetchSource(src: { url: string; name: string }): Promise<NewsItem[]> {
  const res = await fetch(src.url, FETCH_OPTIONS);
  if (!res.ok) throw new Error(`${src.name} ${res.status}`);
  const xml = await res.text();
  const raw = parseRSS(xml, src.name);

  return raw
    .filter((item) => isRelevant(item.title))
    .map((item, i) => ({
      id: `${src.name}-${i}-${item.pubDate}`,
      title:       item.title,
      source:      item.source,
      url:         item.url || "#",
      publishedAt: toISO(item.pubDate),
      tag:         tagSentiment(item.title),
    }));
}

// ─── NewsAPI (optional, if key is set) ────────────────────────────────────────

async function fetchNewsAPI(apiKey: string): Promise<NewsItem[]> {
  const q = encodeURIComponent(
    'gold OR "Federal Reserve" OR "treasury yields" OR "10-year" OR DXY OR XAUUSD OR "dollar index" OR inflation'
  );
  const res = await fetch(
    `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`,
    { next: { revalidate: 180 } }
  );
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok" || !Array.isArray(data.articles)) throw new Error(data.message);
  return data.articles
    .filter((a: any) => a.title && a.title !== "[Removed]")
    .map((a: any, i: number) => ({
      id:          `newsapi-${i}-${a.publishedAt}`,
      title:       a.title as string,
      source:      (a.source?.name as string) ?? "Unknown",
      url:         (a.url as string) ?? "#",
      publishedAt: a.publishedAt as string,
      tag:         tagSentiment(a.title as string),
    }));
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  // NewsAPI takes priority if key is configured
  const apiKey = process.env.NEWSAPI_KEY;
  if (apiKey) {
    try {
      const items = await fetchNewsAPI(apiKey);
      if (items.length > 0) return Response.json({ items, source: "newsapi" });
    } catch {
      // fall through
    }
  }

  // Fetch all RSS sources in parallel
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));

  const merged: NewsItem[] = [];
  const seen  = new Set<string>();

  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      const key = item.title.toLowerCase().slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
  }

  // Newest first
  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const items = merged.slice(0, 20);

  if (items.length === 0) {
    const errs = settled
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason))
      .join(" | ");
    return Response.json({ items: [], error: errs || "No relevant articles found" });
  }

  return Response.json({ items, source: "rss" });
}
