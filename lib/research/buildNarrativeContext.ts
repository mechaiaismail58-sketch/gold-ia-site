// ── Narrative Intelligence Module ────────────────────────────────────────────
// Fetches 5 data sources in parallel. Never throws — always returns fallback.

// ── Types ─────────────────────────────────────────────────────────────────────

export type FedDelta = {
  todayProb:    number;
  yesterdayProb: number;
  delta:        number;
  direction:    "more_cuts" | "fewer_cuts" | "unchanged";
};

export type Catalyst = {
  title:       string;
  source:      string;
  publishedAt: string;
  isHighImpact: boolean;
};

export type CrowdingSignal = {
  gldShortsChange: number | null;
  shortRatio:      number | null;
  cotPercentile:   number | null;
  crowdingLevel:   "extreme_long" | "high_long" | "neutral" | "high_short" | "extreme_short";
};

export type GeopoliticalPulse = {
  alertCount:   number;
  topHeadlines: string[];
  geoRiskLevel: "high" | "medium" | "low";
};

export type MechanicalFlags = {
  isEndOfMonth:   boolean;
  isEndOfQuarter: boolean;
  daysToMonthEnd: number;
  isOpExWeek:     boolean;
  nextGCExpiry:   string;
};

export type NarrativeContext = {
  fedDelta:        FedDelta | null;
  socialCatalysts: Catalyst[];
  crowding:        CrowdingSignal | null;
  geopolitical:    GeopoliticalPulse | null;
  mechanicalFlags: MechanicalFlags;
};

// ── Timeout wrapper ────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>(r => setTimeout(() => r(fallback), ms))]);
}

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)",
  "Accept":     "application/json",
};

const HIGH_IMPACT_TERMS = [
  "trump","powell","fed","fomc","iran","sanctions","tariff",
  "war","ceasefire","nuclear","opec","military","strike","attack",
  "russia","china","conflict","default","debt ceiling",
];

// ── Fetch 1 — Fed Expectations Delta ──────────────────────────────────────────
// todayProb and yesterdayProb are passed in from the parent context (buildFedWatchContext).
// Returns null when either value is unavailable — no external fetch needed.

function computeFedDelta(todayProb?: number | null, yesterdayProb?: number | null): FedDelta | null {
  if (todayProb == null || yesterdayProb == null) return null;
  const delta = todayProb - yesterdayProb;
  const direction: FedDelta["direction"] =
    delta > 1  ? "more_cuts" :
    delta < -1 ? "fewer_cuts" : "unchanged";
  return { todayProb, yesterdayProb, delta, direction };
}

// ── Fetch 2 — Social Catalysts ────────────────────────────────────────────────

async function fetchSocialCatalysts(): Promise<Catalyst[]> {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const results: Catalyst[] = [];

  // NewsAPI
  try {
    const key = process.env.NEWSAPI_KEY;
    if (key) {
      const url = `https://newsapi.org/v2/everything?q=(gold+OR+xauusd)+AND+(trump+OR+powell+OR+fed+OR+iran+OR+tariff+OR+china)&sortBy=publishedAt&pageSize=10&language=en&apiKey=${key}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        for (const art of (data.articles ?? []) as Array<{ title: string; publishedAt: string; source?: { name: string } }>) {
          if (!art.title || new Date(art.publishedAt).getTime() < cutoff) continue;
          const tl = art.title.toLowerCase();
          results.push({
            title:       art.title,
            source:      art.source?.name ?? "NewsAPI",
            publishedAt: art.publishedAt,
            isHighImpact: HIGH_IMPACT_TERMS.some(t => tl.includes(t)),
          });
        }
      }
    }
  } catch { /* skip */ }

  // RSS fallback — Reuters + ForexLive
  const rssFeeds = [
    { url: "https://feeds.reuters.com/reuters/businessNews", source: "Reuters" },
    { url: "https://www.forexlive.com/feed/news",           source: "ForexLive" },
  ];
  for (const feed of rssFeeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)" },
        next: { revalidate: 300 },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
      for (const item of items.slice(0, 20)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                   ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
        if (!title) continue;
        const pub = pubDate ? new Date(pubDate).getTime() : 0;
        if (pub < cutoff) continue;
        const tl = title.toLowerCase();
        const relevant = ["gold","xauusd","fed","powell","trump","iran","tariff","china","yield","dollar"].some(t => tl.includes(t));
        if (!relevant) continue;
        results.push({
          title,
          source:      feed.source,
          publishedAt: pubDate || new Date().toISOString(),
          isHighImpact: HIGH_IMPACT_TERMS.some(t => tl.includes(t)),
        });
      }
    } catch { /* skip */ }
  }

  // Deduplicate by first 60 chars of title
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.title.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}

// ── Fetch 3 — Crowding Signal ─────────────────────────────────────────────────

async function fetchCrowdingSignal(managedMoneyNet?: number | null): Promise<CrowdingSignal | null> {
  // COT percentile from historical range (min: -50k, max: +280k contracts)
  const COT_MIN = -50_000;
  const COT_MAX =  280_000;

  let cotPercentile: number | null = null;
  if (managedMoneyNet != null) {
    cotPercentile = Math.max(0, Math.min(100, ((managedMoneyNet - COT_MIN) / (COT_MAX - COT_MIN)) * 100));
  }

  let gldShortsChange: number | null = null;
  let shortRatio: number | null = null;

  // GLD short interest from Yahoo Finance
  try {
    type YFSummary = { quoteSummary?: { result?: Array<{ defaultKeyStatistics?: { sharesShort?: { raw?: number }; sharesShortPriorMonth?: { raw?: number }; shortRatio?: { raw?: number } } }> } };
    for (const base of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
      const res = await fetch(`${base}/v10/finance/quoteSummary/GLD?modules=defaultKeyStatistics`, { headers: YF_HEADERS, next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const data = await res.json() as YFSummary;
      const stats = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
      if (!stats) continue;
      const cur  = stats.sharesShort?.raw;
      const prev = stats.sharesShortPriorMonth?.raw;
      shortRatio = stats.shortRatio?.raw ?? null;
      if (cur != null && prev != null && prev > 0) {
        gldShortsChange = ((cur - prev) / prev) * 100;
      }
      break;
    }
  } catch { /* skip */ }

  if (cotPercentile == null && gldShortsChange == null) return null;

  const p = cotPercentile ?? 50;
  const crowdingLevel: CrowdingSignal["crowdingLevel"] =
    p > 80 ? "extreme_long" :
    p > 60 ? "high_long" :
    p > 40 ? "neutral" :
    p > 20 ? "high_short" : "extreme_short";

  return { gldShortsChange, shortRatio, cotPercentile, crowdingLevel };
}

// ── Fetch 4 — Geopolitical Pulse ──────────────────────────────────────────────

const GEO_TERMS = ["iran","russia","china","war","sanctions","nuclear","ceasefire","opec","conflict","military","attack","strike","embargo","invasion","escalat"];

async function fetchGeopoliticalPulse(): Promise<GeopoliticalPulse | null> {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const headlines: string[] = [];

  // GDELT
  try {
    const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=gold+iran+russia+china+war+sanctions&mode=artlist&maxrecords=10&format=json&timespan=6h";
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (res.ok) {
      const data = await res.json() as { articles?: Array<{ title?: string; seendate?: string }> };
      for (const a of data.articles ?? []) {
        if (a.title && GEO_TERMS.some(t => a.title!.toLowerCase().includes(t))) {
          headlines.push(a.title);
        }
      }
    }
  } catch { /* skip */ }

  // Al Jazeera RSS
  try {
    const res = await fetch("https://www.aljazeera.com/xml/rss/all.xml", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GoldDesk/1.0)" },
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const xml = await res.text();
      const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
      for (const item of items.slice(0, 30)) {
        const title   = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
        if (!title) continue;
        const pub = pubDate ? new Date(pubDate).getTime() : 0;
        if (pub < cutoff) continue;
        if (GEO_TERMS.some(t => title.toLowerCase().includes(t))) headlines.push(title);
      }
    }
  } catch { /* skip */ }

  const alertCount = headlines.length;
  const geoRiskLevel: GeopoliticalPulse["geoRiskLevel"] =
    alertCount >= 3 ? "high" :
    alertCount >= 1 ? "medium" : "low";

  return { alertCount, topHeadlines: headlines.slice(0, 5), geoRiskLevel };
}

// ── Fetch 5 — Mechanical Flow Flags (pure computation) ───────────────────────

function computeMechanicalFlags(): MechanicalFlags {
  const now     = new Date();
  const day     = now.getUTCDate();
  const month   = now.getUTCMonth() + 1; // 1-12
  const year    = now.getUTCFullYear();

  // Days to month end
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysToMonthEnd = lastDay - day;
  const isEndOfMonth   = day >= 25;
  const isEndOfQuarter = isEndOfMonth && [3, 6, 9, 12].includes(month);

  // Third Friday of current month (COMEX gold options expiry)
  function thirdFriday(y: number, m: number): Date {
    // m is 1-indexed
    const d = new Date(Date.UTC(y, m - 1, 1));
    let fridays = 0;
    while (fridays < 3) {
      if (d.getUTCDay() === 5) fridays++;
      if (fridays < 3) d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  }
  const thisExpiry = thirdFriday(year, month);
  const diffMs = thisExpiry.getTime() - now.getTime();
  const isOpExWeek = diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;

  // Next GC expiry (next month's third Friday)
  const nextM  = month === 12 ? 1 : month + 1;
  const nextY  = month === 12 ? year + 1 : year;
  const nextFri = thirdFriday(nextY, nextM);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const nextGCExpiry = `${monthNames[nextFri.getUTCMonth()]} ${nextFri.getUTCDate()}`;

  return { isEndOfMonth, isEndOfQuarter, daysToMonthEnd, isOpExWeek, nextGCExpiry };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildNarrativeContext(params?: {
  managedMoneyNet?:  number | null;
  todayCutProb?:     number | null;
  yesterdayCutProb?: number | null;
}): Promise<NarrativeContext> {
  // Fed delta is a pure computation — no async needed
  const fedDelta = computeFedDelta(params?.todayCutProb, params?.yesterdayCutProb);

  const [socialCatalysts, crowding, geopolitical] = await Promise.all([
    withTimeout(fetchSocialCatalysts(), 8000, []),
    withTimeout(fetchCrowdingSignal(params?.managedMoneyNet), 6000, null),
    withTimeout(fetchGeopoliticalPulse(), 8000, null),
  ]);

  const mechanicalFlags = computeMechanicalFlags();

  return { fedDelta, socialCatalysts, crowding, geopolitical, mechanicalFlags };
}

// ── Format for AI context injection ──────────────────────────────────────────

export function formatNarrativeContext(ctx: NarrativeContext): string {
  const lines: string[] = ["NARRATIVE INTELLIGENCE", "======================"];

  // Fed delta
  if (ctx.fedDelta) {
    const d = ctx.fedDelta;
    const sign = d.delta > 0 ? "+" : "";
    lines.push(`Fed Expectations Delta: ${sign}${d.delta.toFixed(1)}% (${d.direction.replace("_", " ")}) | Today: ${d.todayProb.toFixed(1)}% cut priced | Yesterday: ${d.yesterdayProb.toFixed(1)}%`);
  } else {
    lines.push("Fed Expectations Delta: unavailable");
  }

  // Crowding
  if (ctx.crowding) {
    const c = ctx.crowding;
    const pct = c.cotPercentile != null ? ` | Managed Money at ${c.cotPercentile.toFixed(0)}th percentile of historical range` : "";
    const shorts = c.gldShortsChange != null ? ` | GLD short interest: ${c.gldShortsChange > 0 ? "+" : ""}${c.gldShortsChange.toFixed(1)}% MoM` : "";
    const ratio  = c.shortRatio != null ? ` | short ratio ${c.shortRatio.toFixed(1)} days` : "";
    lines.push(`Crowding: ${c.crowdingLevel.replace("_", " ")}${pct}${shorts}${ratio}`);
  } else {
    lines.push("Crowding: unavailable");
  }

  // Geopolitical
  if (ctx.geopolitical) {
    const g = ctx.geopolitical;
    lines.push(`Geopolitical Risk: ${g.geoRiskLevel.toUpperCase()} — ${g.alertCount} alert${g.alertCount !== 1 ? "s" : ""} in last 6h`);
    if (g.topHeadlines.length > 0) {
      lines.push(`Top Headlines: ${g.topHeadlines.slice(0, 3).join(" / ")}`);
    }
  } else {
    lines.push("Geopolitical Risk: unavailable");
  }

  // Social catalysts
  const highImpact = ctx.socialCatalysts.filter(c => c.isHighImpact);
  if (highImpact.length > 0) {
    lines.push(`High-Impact Catalysts (last 6h): ${highImpact.slice(0, 3).map(c => c.title).join(" / ")}`);
  } else if (ctx.socialCatalysts.length > 0) {
    lines.push("High-Impact Catalysts: none detected");
  }

  // Mechanical flags
  const mf = ctx.mechanicalFlags;
  const flags: string[] = [];
  if (mf.isEndOfQuarter) flags.push(`END-OF-QUARTER (${mf.daysToMonthEnd} days to month end — institutional rebalancing likely)`);
  else if (mf.isEndOfMonth) flags.push(`END-OF-MONTH (${mf.daysToMonthEnd} days to month end — rebalancing window)`);
  if (mf.isOpExWeek) flags.push(`OPEX WEEK (COMEX options expiry, next GC: ${mf.nextGCExpiry})`);
  if (flags.length > 0) lines.push(`Mechanical Flows: ${flags.join(" | ")}`);
  else lines.push(`Mechanical Flows: no flags active (${mf.daysToMonthEnd} days to month end, next OpEx: ${mf.nextGCExpiry})`);

  return lines.join("\n");
}
