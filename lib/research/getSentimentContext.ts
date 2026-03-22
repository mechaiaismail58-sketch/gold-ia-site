// Fear & Greed (CNN) + GNews headlines + GDELT geopolitical signal

export type SentimentContext = {
  fear_greed_score: number | null;
  fear_greed_label: string | null;
  fear_greed_gold_bias: "bullish" | "bearish" | "neutral" | null;
  news_headlines: string[];
  news_sentiment_score: number | null; // -1 (bearish gold) to +1 (bullish gold)
  geopolitical_articles: number | null;
  gold_bias: "bullish" | "bearish" | "neutral" | null;
  summary: string;
};

const BULLISH_KEYWORDS = [
  "war", "conflict", "crisis", "inflation", "rate cut", "fed cut", "rate pause",
  "dovish", "safe haven", "recession", "uncertainty", "geopolit", "tariff",
  "trade war", "sanctions", "default", "debt ceiling", "weak dollar",
  "gold rally", "gold surge", "gold high", "gold record", "lower rates",
  "risk off", "haven demand", "stagflation", "fallout", "fear",
];
const BEARISH_KEYWORDS = [
  "rate hike", "strong dollar", "risk-on", "gold fall", "gold drop", "gold decline",
  "hawkish", "higher rates", "strong economy", "jobs beat", "nonfarm",
  "gold sell", "gold pressure", "recovery surge",
];

function scoreHeadline(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of BULLISH_KEYWORDS) if (lower.includes(kw)) score++;
  for (const kw of BEARISH_KEYWORDS) if (lower.includes(kw)) score--;
  return Math.max(-2, Math.min(2, score));
}

function classifyFG(score: number): { label: string; bias: "bullish" | "bearish" | "neutral" } {
  if (score <= 25) return { label: "Extreme Fear", bias: "bullish" };
  if (score <= 45) return { label: "Fear", bias: "bullish" };
  if (score <= 55) return { label: "Neutral", bias: "neutral" };
  if (score <= 75) return { label: "Greed", bias: "bearish" };
  return { label: "Extreme Greed", bias: "bearish" };
}

async function fetchFearGreed(): Promise<{ score: number | null; label: string | null }> {
  try {
    const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { score: null, label: null };
    const data = await res.json() as { fear_and_greed?: { score: number; rating: string } };
    const fg = data.fear_and_greed;
    if (fg?.score == null) return { score: null, label: null };
    return { score: Math.round(fg.score), label: fg.rating ?? null };
  } catch {
    return { score: null, label: null };
  }
}

async function fetchGNewsHeadlines(): Promise<string[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `https://gnews.io/api/v4/search?q=gold+OR+XAUUSD+OR+%22federal+reserve%22+OR+inflation&lang=en&max=6&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json() as { articles?: Array<{ title: string }> };
    return (data.articles ?? []).map((a) => a.title).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchGDELTCount(): Promise<number | null> {
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=gold+safe+haven+geopolitical&mode=ArtList&maxrecords=10&format=JSON&TIMESPAN=240`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { articles?: unknown[] };
    return Array.isArray(data.articles) ? data.articles.length : null;
  } catch {
    return null;
  }
}

export async function getSentimentContext(): Promise<SentimentContext | null> {
  const [fg, headlines, geoCount] = await Promise.all([
    fetchFearGreed(),
    fetchGNewsHeadlines(),
    fetchGDELTCount(),
  ]);

  if (fg.score == null && headlines.length === 0 && geoCount == null) return null;

  const fgMeta = fg.score != null ? classifyFG(fg.score) : null;

  let newsSentimentScore: number | null = null;
  if (headlines.length > 0) {
    const total = headlines.reduce((s, h) => s + scoreHeadline(h), 0);
    newsSentimentScore = total / headlines.length;
  }

  // Aggregate gold bias from all signals
  const signals: number[] = [];
  if (fgMeta) signals.push(fgMeta.bias === "bullish" ? 1 : fgMeta.bias === "bearish" ? -1 : 0);
  if (newsSentimentScore != null) signals.push(newsSentimentScore > 0.3 ? 1 : newsSentimentScore < -0.3 ? -1 : 0);
  if (geoCount != null) signals.push(geoCount >= 5 ? 1 : 0);

  let gold_bias: SentimentContext["gold_bias"] = null;
  if (signals.length > 0) {
    const avg = signals.reduce((s, v) => s + v, 0) / signals.length;
    gold_bias = avg > 0.2 ? "bullish" : avg < -0.2 ? "bearish" : "neutral";
  }

  const parts: string[] = [];
  if (fg.score != null && fgMeta) {
    parts.push(`Fear & Greed: ${fg.score}/100 (${fgMeta.label}) → gold ${fgMeta.bias}`);
  }
  if (newsSentimentScore != null && headlines.length > 0) {
    const label = newsSentimentScore > 0.3 ? "bullish gold" : newsSentimentScore < -0.3 ? "bearish gold" : "neutral";
    parts.push(`News sentiment: ${label} (${headlines.length} headlines)`);
  }
  if (geoCount != null) {
    parts.push(`Geo signal: ${geoCount} safe-haven articles/4h${geoCount >= 5 ? " — elevated tension" : ""}`);
  }

  return {
    fear_greed_score: fg.score,
    fear_greed_label: fg.label,
    fear_greed_gold_bias: fgMeta?.bias ?? null,
    news_headlines: headlines,
    news_sentiment_score: newsSentimentScore,
    geopolitical_articles: geoCount,
    gold_bias,
    summary: parts.join(" | ") || "Sentiment data unavailable",
  };
}
