// ── Live News Context — RSS feeds for gold-relevant headlines ─────────────────
// Fetches 3 RSS feeds in parallel, parses XML with regex, categorizes headlines,
// and formats a compact summary for AI context injection.

const RSS_FEEDS = [
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US",
  "https://www.forexlive.com/feed/news",
  "https://www.fxstreet.com/rss/news",
];

const FEED_TIMEOUT_MS = 4_000;

type NewsItem = {
  title:     string;
  pubDate:   Date;
  link:      string;
  category:  "FED" | "TRUMP" | "GEO" | "DATA" | "GOLD" | "DOLLAR";
  ageMinutes: number;
};

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function parseItems(xml: string): Array<{ title: string; pubDate: string; link: string }> {
  const items: Array<{ title: string; pubDate: string; link: string }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title   = extractTag(block, "title");
    const pubDate = extractTag(block, "pubDate");
    const link    = extractTag(block, "link");
    if (title && pubDate) items.push({ title, pubDate, link });
  }
  return items.slice(0, 5);
}

function categorize(title: string): NewsItem["category"] | null {
  const t = title.toLowerCase();
  if (/\bfed\b|fomc|powell|warsh|hawkish|dovish|rate cut|rate hike|monetary|fed chair|fed president/.test(t)) return "FED";
  if (/trump|tariff|trade war|white house|executive order|maga/.test(t)) return "TRUMP";
  if (/\bwar\b|conflict|sanction|geopolit|middle east|russia|ukraine|iran|israel|gaza|nato|military|attack|ceasefire/.test(t)) return "GEO";
  if (/\bcpi\b|\bnfp\b|\bgdp\b|\bpce\b|\bppi\b|payroll|jobs report|unemployment|retail sales|\bism\b|\bpmi\b|inflation data/.test(t)) return "DATA";
  if (/gold|xauusd|bullion|precious metal|central bank buy/.test(t)) return "GOLD";
  if (/dollar|\bdxy\b|\busd\b|greenback/.test(t)) return "DOLLAR";
  return null;
}

async function fetchFeed(url: string): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 Bullion-Desk/1.0",
        "Accept":     "application/rss+xml, application/xml, text/xml",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const xml  = await res.text();
    const raw  = parseItems(xml);
    const now  = Date.now();
    const in6h = now - 6 * 60 * 60 * 1_000;
    const items: NewsItem[] = [];
    for (const r of raw) {
      const d = new Date(r.pubDate);
      if (isNaN(d.getTime())) continue;
      if (d.getTime() < in6h) continue;
      const cat = categorize(r.title);
      if (!cat) continue;
      items.push({ title: r.title, pubDate: d, link: r.link, category: cat, ageMinutes: Math.round((now - d.getTime()) / 60_000) });
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function deduplicateFuzzy(items: NewsItem[]): NewsItem[] {
  const result: NewsItem[] = [];
  for (const item of items) {
    const words = item.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const isDup = result.some((r) => {
      const rWords = r.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
      const shared = words.filter((w) => rWords.includes(w)).length;
      return shared >= Math.min(3, Math.floor(words.length * 0.5));
    });
    if (!isDup) result.push(item);
  }
  return result;
}

const CATEGORY_ORDER: NewsItem["category"][] = ["FED", "TRUMP", "GEO", "DATA", "GOLD", "DOLLAR"];

export async function getNewsContext(): Promise<string> {
  const results = await Promise.allSettled(RSS_FEEDS.map((url) => fetchFeed(url)));

  const all: NewsItem[] = [];
  let anySucceeded = false;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.length > 0) {
      anySucceeded = true;
      all.push(...r.value);
    }
  }

  if (!anySucceeded) return "LIVE NEWS: News feeds temporarily unavailable.";

  const deduped = deduplicateFuzzy(all);

  // Sort: FED/TRUMP/GEO first, then DATA/GOLD/DOLLAR, then by recency
  deduped.sort((a, b) => {
    const ao = CATEGORY_ORDER.indexOf(a.category);
    const bo = CATEGORY_ORDER.indexOf(b.category);
    if (ao !== bo) return ao - bo;
    return a.ageMinutes - b.ageMinutes;
  });

  if (deduped.length === 0) {
    return "LIVE NEWS: No significant gold-related headlines in the last 6 hours.";
  }

  const lines: string[] = [];
  const breaking: NewsItem[] = deduped.filter((i) => i.ageMinutes < 60 && ["FED", "TRUMP", "GEO"].includes(i.category));
  const regular: NewsItem[] = deduped.filter((i) => !breaking.includes(i)).slice(0, 8);

  function fmtAge(m: number): string {
    if (m < 60) return `${m}min ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  if (breaking.length > 0) {
    lines.push("BREAKING (< 1 hour):");
    for (const b of breaking) {
      lines.push(`[${b.category}] ${b.title} — ${fmtAge(b.ageMinutes)}`);
    }
  }

  if (regular.length > 0) {
    lines.push("LIVE NEWS (last 6 hours):");
    for (const n of regular) {
      lines.push(`[${n.category}] ${n.title} — ${fmtAge(n.ageMinutes)}`);
    }
  }

  return lines.join("\n");
}
