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
      return NextResponse.json({ ok: false, error: "Calendar source unavailable." }, { status: 502 });
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

    return NextResponse.json({ ok: true, events });
  } catch (err) {
    console.error("Calendar route error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
