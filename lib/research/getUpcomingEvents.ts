// ── Upcoming High-Impact Events ─────────────────────────────────────────────────
// Fetches the Forex Factory economic calendar, filters to High-Impact USD events
// in the next 24 hours, and enriches with gold-specific impact context.

type FFEvent = {
  title: string;
  country: string;
  date: string; // ISO 8601 or custom format
  impact: string;
  forecast: string;
  previous: string;
};

export type UpcomingEvent = {
  title: string;
  datetime_utc: string;
  minutes_until: number;
  proximity_level: "imminent" | "near" | "distant"; // <30min | 30min–2h | 2h–24h
  gold_impact: string;
};

export type UpcomingEventsContext = {
  events: UpcomingEvent[];
  nearest_event: UpcomingEvent | null;
  blackout_active: boolean;  // true if any event within 30 min
  pre_event_active: boolean; // true if any event within 2h
  summary: string;
};

// ── High-impact keywords (gold-relevant USD events) ───────────────────────────

const HIGH_IMPACT_PATTERNS: [RegExp, string][] = [
  [/\bcpi\b|consumer price index/i, "CPI surprise often triggers immediate 10–20$ gold repricing"],
  [/non.?farm|nonfarm|payroll|nfp/i, "Strong NFP = USD rally / gold sell-off; Weak NFP = USD weakness / gold bid"],
  [/fomc|federal open market|rate decision|federal funds rate/i, "FOMC decisions can trigger 20–40$ moves — most significant gold event"],
  [/\bgdp\b|gross domestic/i, "GDP drives risk sentiment and USD; miss = gold safe-haven bid"],
  [/\bpce\b|personal consumption expenditure/i, "Fed's preferred inflation measure — direct impact on rate path and gold"],
  [/\bppi\b|producer price/i, "Leading inflation indicator — feeds into CPI expectations and gold bias"],
  [/powell|fed chair|fed speak|fomc member|federal reserve.*speak|yellen|waller|goolsbee|daly|barkin|kashkari|bostic|mester|logan|bullard/i, "Fed communication directly shapes rate expectations — can move gold 5–15$"],
  [/initial.*claim|jobless.*claim/i, "Labor market signal — influences Fed rate path and gold indirectly"],
  [/retail sales/i, "Consumer spending data — affects growth outlook and USD/gold relationship"],
];

function classifyHighImpact(title: string): string | null {
  for (const [pattern, impact] of HIGH_IMPACT_PATTERNS) {
    if (pattern.test(title)) return impact;
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getUpcomingEvents(): Promise<UpcomingEventsContext | null> {
  try {
    const res = await fetch(
      "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
      {
        headers: { "User-Agent": "Mozilla/5.0 Bullion-Desk/1.0", "Accept": "application/json" },
        next: { revalidate: 300 }, // cache 5 min
      }
    );
    if (!res.ok) return null;

    const raw: FFEvent[] = await res.json();
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;

    const events: UpcomingEvent[] = [];

    for (const e of raw) {
      if (e.country !== "USD") continue;

      const goldImpact = classifyHighImpact(e.title);
      if (!goldImpact) continue; // skip non-high-impact events

      const eventTime = new Date(e.date).getTime();
      if (isNaN(eventTime)) continue;
      if (eventTime <= now || eventTime > in24h) continue; // only future events in next 24h

      const minutes_until = Math.round((eventTime - now) / 60_000);

      const proximity_level: UpcomingEvent["proximity_level"] =
        minutes_until < 30  ? "imminent" :
        minutes_until < 120 ? "near"     : "distant";

      events.push({
        title: e.title,
        datetime_utc: new Date(eventTime).toISOString().slice(0, 16) + " UTC",
        minutes_until,
        proximity_level,
        gold_impact: goldImpact,
      });
    }

    // Sort by soonest first
    events.sort((a, b) => a.minutes_until - b.minutes_until);

    const nearest_event = events[0] ?? null;
    const blackout_active  = events.some((e) => e.proximity_level === "imminent");
    const pre_event_active = events.some((e) => e.proximity_level === "imminent" || e.proximity_level === "near");

    if (events.length === 0) {
      return {
        events: [],
        nearest_event: null,
        blackout_active: false,
        pre_event_active: false,
        summary: "No high-impact USD events in the next 24 hours.",
      };
    }

    const parts: string[] = [`High-impact events in next 24h: ${events.length}`];

    if (blackout_active) {
      parts.push(`BLACKOUT ACTIVE: ${nearest_event!.title} in ${nearest_event!.minutes_until} min — Stand Aside unless exceptional setup`);
    } else if (pre_event_active) {
      parts.push(`PRE-EVENT ALERT: ${nearest_event!.title} in ${nearest_event!.minutes_until} min — wider SL required, higher conviction threshold`);
    }

    for (const e of events.slice(0, 4)) {
      const h = Math.floor(e.minutes_until / 60);
      const m = e.minutes_until % 60;
      const timeStr = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
      parts.push(`[${e.proximity_level.toUpperCase()}] ${e.title} — ${e.datetime_utc} (T-${timeStr})`);
    }

    return {
      events,
      nearest_event,
      blackout_active,
      pre_event_active,
      summary: parts.join("\n"),
    };
  } catch (err) {
    console.error("getUpcomingEvents error:", err);
    return null;
  }
}
