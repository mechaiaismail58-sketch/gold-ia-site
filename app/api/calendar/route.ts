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

const HIGH_IMPACT_KEYWORDS = [
  "cpi", "consumer price index", "core cpi",
  "non-farm", "nonfarm", "nfp", "payroll",
  "fomc", "federal open market", "federal funds rate", "rate decision",
  "gdp", "gross domestic",
  "pce", "personal consumption expenditure",
];

const MEDIUM_IMPACT_KEYWORDS = [
  "ppi", "producer price",
  "retail sales",
  "ism", "purchasing managers",
  "jobless claims", "initial jobless", "initial claims", "continuing claims",
  "unemployment claims",
];

const LOW_IMPACT_KEYWORDS = [
  "fed", "federal reserve", "speaks", "speech", "testimony",
  "treasury", "dollar", "inflation", "interest rate", "monetary",
  "employment", "jolts", "durable goods", "industrial production",
  "capacity utilization", "consumer sentiment", "consumer confidence",
  "trade balance", "housing", "building permits", "existing home", "new home",
  "ism services", "ism manufacturing", "services pmi", "manufacturing pmi",
  "beige book", "crude oil inventories", "michigan",
];

function classifyImpact(title: string): "high" | "medium" | "low" | null {
  const t = title.toLowerCase();
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
        id: `${e.date}-${i}`,
        title: e.title,
        country: e.country,
        date: e.date,
        impact: classifyImpact(e.title)!,
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
