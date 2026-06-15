import { NextResponse } from "next/server";

export const runtime = "nodejs";

type FFEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  country: string;
  date: string; // ISO 8601
  impact: "high" | "medium" | "low";
  forecast: string | null;
  previous: string | null;
};

// ── Checked FIRST — these override HIGH keywords ───────────────────────────────
// Fed speakers, FOMC minutes, Beige Book, press conferences = MEDIUM, not HIGH
const FED_SPEAKER_PATTERNS = [
  "speaks", "speech", "testimony", "remarks",
  "fomc minutes", "meeting minutes",
  "beige book",
  "press conference",
];

// ── HIGH impact — most significant USD events for gold ─────────────────────────
const HIGH_IMPACT_KEYWORDS = [
  "cpi", "consumer price index", "core cpi",
  "non-farm", "nonfarm", "nfp", "payroll",
  "fomc", "federal open market", "federal funds rate", "rate decision",
  "gdp", "gross domestic",
  "pce", "personal consumption expenditure",
  "ppi", "producer price",
  "retail sales",
  "unemployment rate",
  "ism manufacturing", "ism services", "ism non-manufacturing",
  "purchasing managers", "pmi",
];

// ── MEDIUM impact ─────────────────────────────────────────────────────────────
const MEDIUM_IMPACT_KEYWORDS = [
  "jobless claims", "initial jobless", "initial claims", "continuing claims",
  "unemployment claims",
  "jolts",
  "durable goods",
  "industrial production",
  "consumer sentiment",
  "consumer confidence",
  "michigan",
];

// ── LOW impact ────────────────────────────────────────────────────────────────
const LOW_IMPACT_KEYWORDS = [
  "capacity utilization",
  "trade balance",
  "housing", "building permits", "existing home", "new home",
  "crude oil inventories",
  "treasury",
];

function classifyImpact(title: string): "high" | "medium" | "low" | null {
  const t = title.toLowerCase();

  // Fed speakers and FOMC minutes are MEDIUM regardless of other keywords
  if (FED_SPEAKER_PATTERNS.some((k) => t.includes(k))) return "medium";

  if (HIGH_IMPACT_KEYWORDS.some((k) => t.includes(k))) return "high";
  if (MEDIUM_IMPACT_KEYWORDS.some((k) => t.includes(k))) return "medium";
  if (LOW_IMPACT_KEYWORDS.some((k) => t.includes(k))) return "low";
  return null;
}

// ── Fallback ──────────────────────────────────────────────────────────────────
// Realistic gold-relevant US events spread across the current week, used only
// when the live source is unreachable or returns nothing — so the calendar is
// never stale or empty. Dates are derived from "this week".
function buildFallbackEvents(): CalendarEvent[] {
  const now = new Date();
  const monday = new Date(now);
  // Rewind to Monday 00:00 UTC of the current week (treat Sunday as day 7).
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);

  const at = (offsetDays: number, h: number, m: number): string => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + offsetDays);
    d.setUTCHours(h, m, 0, 0);
    return d.toISOString();
  };

  const defs: Array<{ off: number; h: number; m: number; title: string; impact: CalendarEvent["impact"]; forecast: string; previous: string }> = [
    { off: 1, h: 12, m: 30, title: "Core CPI m/m",                        impact: "high",   forecast: "0.3%",  previous: "0.2%" },
    { off: 2, h: 12, m: 30, title: "PPI m/m",                             impact: "high",   forecast: "0.2%",  previous: "0.1%" },
    { off: 2, h: 18, m: 0,  title: "FOMC Statement & Federal Funds Rate", impact: "high",   forecast: "4.50%", previous: "4.50%" },
    { off: 3, h: 12, m: 30, title: "Advance GDP q/q",                     impact: "high",   forecast: "2.1%",  previous: "1.8%" },
    { off: 3, h: 12, m: 30, title: "Unemployment Claims",                 impact: "medium", forecast: "232K",  previous: "229K" },
    { off: 4, h: 12, m: 30, title: "Non-Farm Payrolls",                   impact: "high",   forecast: "185K",  previous: "177K" },
    { off: 4, h: 12, m: 30, title: "Core PCE Price Index m/m",            impact: "high",   forecast: "0.3%",  previous: "0.3%" },
  ];

  return defs.map((e, i) => ({
    id:       `fallback-${i}`,
    title:    e.title,
    country:  "USD",
    date:     at(e.off, e.h, e.m),
    impact:   e.impact,
    forecast: e.forecast,
    previous: e.previous,
  }));
}

export async function GET() {
  try {
    const res = await fetch(
      "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
      {
        headers: { "User-Agent": "Mozilla/5.0 Bullion-Desk/1.0", "Accept": "application/json" },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ ok: true, events: buildFallbackEvents(), source: "fallback" });
    }

    const raw: FFEvent[] = await res.json();

    const events: CalendarEvent[] = raw
      .filter((e) => {
        if (e.country !== "USD") return false;
        return classifyImpact(e.title) !== null;
      })
      .map((e, i) => ({
        id:       `${e.date}-${i}`,
        title:    e.title,
        country:  e.country,
        date:     e.date,
        impact:   classifyImpact(e.title)!,
        forecast: e.forecast?.trim() || null,
        previous: e.previous?.trim() || null,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (events.length === 0) {
      return NextResponse.json({ ok: true, events: buildFallbackEvents(), source: "fallback" });
    }

    return NextResponse.json({ ok: true, events, source: "forex-factory" });
  } catch (err) {
    console.error("Calendar route error:", err);
    // Never leave the calendar empty — serve the fallback set.
    return NextResponse.json({ ok: true, events: buildFallbackEvents(), source: "fallback" });
  }
}
