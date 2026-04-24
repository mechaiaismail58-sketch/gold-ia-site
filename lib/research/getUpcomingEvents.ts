// ── Upcoming Events (High + Medium Impact) ───────────────────────────────────
// Fetches the Forex Factory economic calendar, filters to HIGH and MEDIUM USD
// events in the next 24 hours, and enriches with gold-specific impact context.
// Fed speakers are classified as MEDIUM — they do NOT trigger blackout.

type FFEvent = {
  title:    string;
  country:  string;
  date:     string;
  impact:   string;
  forecast: string;
  previous: string;
};

export type UpcomingEvent = {
  title:           string;
  datetime_utc:    string;
  minutes_until:   number;
  proximity_level: "imminent" | "near" | "distant"; // <30min | 30min–2h | 2h–24h
  gold_impact:     string;
  impact_level:    "high" | "medium";
};

export type UpcomingEventsContext = {
  events:            UpcomingEvent[];
  nearest_event:     UpcomingEvent | null;
  blackout_active:   boolean;  // true if HIGH impact event within 30 min
  pre_event_active:  boolean;  // true if HIGH impact event within 2h
  summary:           string;
};

// ── MEDIUM impact: Fed speakers, FOMC minutes, Beige Book ────────────────────
// Checked FIRST to prevent matching HIGH patterns on the same event

const MEDIUM_IMPACT_PATTERNS: [RegExp, string][] = [
  [
    /speaks|speech|testimony|remarks|press conference|fomc minutes|meeting minutes|beige book/i,
    "Fed communication shapes rate expectations — can move gold 10–30$ on hawkish/dovish surprise",
  ],
  [
    /powell|fed chair|fed governor|fed president|waller|goolsbee|daly|barkin|kashkari|bostic|mester|logan|bullard|warsh|kugler|williams/i,
    "Fed official remarks — watch for policy signals, can move gold 10–30$",
  ],
];

// ── HIGH impact: hard data and FOMC rate decisions ────────────────────────────

const HIGH_IMPACT_PATTERNS: [RegExp, string][] = [
  [/\bcpi\b|consumer price index/i,          "CPI surprise often triggers immediate 10–20$ gold repricing"],
  [/non.?farm|nonfarm|payroll|nfp/i,         "Strong NFP = USD rally / gold sell-off; Weak NFP = USD weakness / gold bid"],
  [/fomc statement|rate decision|federal funds rate|federal open market/i, "FOMC decisions can trigger 20–40$ moves — most significant gold event"],
  [/\bgdp\b|gross domestic/i,                "GDP drives risk sentiment and USD; miss = gold safe-haven bid"],
  [/\bpce\b|personal consumption expenditure/i, "Fed's preferred inflation measure — direct impact on rate path and gold"],
  [/\bppi\b|producer price/i,                "Leading inflation indicator — feeds into CPI expectations and gold bias"],
  [/retail sales/i,                           "Consumer spending data — affects growth outlook and USD/gold relationship"],
  [/unemployment rate/i,                      "Monthly labor benchmark — significant impact on Fed policy path and gold"],
  [/ism manufacturing|ism services|ism non-manufacturing|purchasing managers|services pmi|manufacturing pmi/i, "PMI/ISM signals economic momentum — moves gold via USD and risk sentiment"],
  [/initial.*claim|jobless.*claim/i,          "Weekly labor market signal — influences Fed rate path and gold indirectly"],
];

function classifyEvent(title: string): { goldImpact: string; impactLevel: "high" | "medium" } | null {
  // MEDIUM patterns checked first (fed speakers could match HIGH patterns too)
  for (const [pattern, impact] of MEDIUM_IMPACT_PATTERNS) {
    if (pattern.test(title)) return { goldImpact: impact, impactLevel: "medium" };
  }
  for (const [pattern, impact] of HIGH_IMPACT_PATTERNS) {
    if (pattern.test(title)) return { goldImpact: impact, impactLevel: "high" };
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
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;

    const raw: FFEvent[] = await res.json();
    const now   = Date.now();
    const in24h = now + 24 * 60 * 60 * 1_000;

    const events: UpcomingEvent[] = [];

    for (const e of raw) {
      if (e.country !== "USD") continue;

      const classified = classifyEvent(e.title);
      if (!classified) continue;

      const eventTime = new Date(e.date).getTime();
      if (isNaN(eventTime)) continue;
      if (eventTime <= now || eventTime > in24h) continue;

      const minutes_until = Math.round((eventTime - now) / 60_000);

      const proximity_level: UpcomingEvent["proximity_level"] =
        minutes_until < 30  ? "imminent" :
        minutes_until < 120 ? "near"     : "distant";

      events.push({
        title:           e.title,
        datetime_utc:    new Date(eventTime).toISOString().slice(0, 16) + " UTC",
        minutes_until,
        proximity_level,
        gold_impact:     classified.goldImpact,
        impact_level:    classified.impactLevel,
      });
    }

    events.sort((a, b) => a.minutes_until - b.minutes_until);

    const nearest_event = events[0] ?? null;

    // Blackout only triggers for HIGH impact events
    const blackout_active  = events.some((e) => e.proximity_level === "imminent" && e.impact_level === "high");
    const pre_event_active = events.some((e) => (e.proximity_level === "imminent" || e.proximity_level === "near") && e.impact_level === "high");

    if (events.length === 0) {
      return {
        events:           [],
        nearest_event:    null,
        blackout_active:  false,
        pre_event_active: false,
        summary:          "No high or medium-impact USD events in the next 24 hours.",
      };
    }

    const parts: string[] = [
      `Events in next 24h: ${events.filter((e) => e.impact_level === "high").length} HIGH, ${events.filter((e) => e.impact_level === "medium").length} MEDIUM`,
    ];

    if (blackout_active) {
      parts.push(`BLACKOUT ACTIVE: ${nearest_event!.title} in ${nearest_event!.minutes_until} min — Stand Aside unless exceptional setup`);
    } else if (pre_event_active) {
      const nearHigh = events.find((e) => e.impact_level === "high" && (e.proximity_level === "imminent" || e.proximity_level === "near"));
      if (nearHigh) {
        parts.push(`PRE-EVENT ALERT: ${nearHigh.title} in ${nearHigh.minutes_until} min — wider SL required, higher conviction threshold`);
      }
    }

    for (const e of events.slice(0, 6)) {
      const h       = Math.floor(e.minutes_until / 60);
      const m       = e.minutes_until % 60;
      const timeStr = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;

      if (e.impact_level === "medium") {
        // Format medium events with MEDIUM prefix — no blackout triggered
        parts.push(`MEDIUM — ${e.title} at ${e.datetime_utc.slice(11, 16)} UTC (T-${timeStr}) — ${e.gold_impact}`);
      } else {
        parts.push(`[${e.proximity_level.toUpperCase()}] ${e.title} — ${e.datetime_utc} (T-${timeStr})`);
      }
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
