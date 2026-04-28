import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketState =
  | "violent_selloff" | "selloff"
  | "violent_rally"   | "rally"
  | "ranging"         | "pre_event"
  | "asia_session"    | "london_open"
  | "ny_open";

const SUGGESTIONS: Record<MarketState, string[]> = {
  violent_selloff: [
    "Why is gold falling despite a weak DXY?",
    "Where is the next structural support?",
    "Is this a short opportunity or a trap?",
    "Is this a liquidation or a narrative shift?",
  ],
  selloff: [
    "What is driving gold lower right now?",
    "Key support levels to watch",
    "Should I wait for a bounce to short?",
    "What would flip this bearish structure?",
  ],
  violent_rally: [
    "Is this move sustainable or a trap?",
    "Where are the nearest liquidity targets above?",
    "Is this a buy or wait for pullback?",
    "What is driving this rally?",
  ],
  rally: [
    "What is the dominant driver of this move?",
    "Where is the next structural resistance?",
    "Give me a long setup on this momentum",
    "What would invalidate the bullish structure?",
  ],
  ranging: [
    "Is gold accumulating or distributing?",
    "What breaks this range — up or down?",
    "Best strategy for a ranging gold market",
    "What is the institutional positioning right now?",
  ],
  pre_event: [
    "Should I close my position before this event?",
    "What is the market pricing for this release?",
    "How will this event impact gold?",
    "Stand aside or trade through the event?",
  ],
  asia_session: [
    "Brief me for London open",
    "Key levels to watch today",
    "What is the institutional bias this week?",
    "Set up a conditional trade for London open",
  ],
  london_open: [
    "London open analysis",
    "Is there a London open sweep setup?",
    "What is the bias for today's session?",
    "Give me a trade for London session",
  ],
  ny_open: [
    "NY open analysis",
    "Will NY continue or reverse London?",
    "Give me a trade for NY session",
    "Where is price likely to go this session?",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "Give me a full gold analysis",
  "Quick market brief",
  "Give me a trade setup",
  "What are the key levels right now?",
];

function detectSessionState(): MarketState | null {
  const h = new Date().getUTCHours();
  const m = new Date().getUTCMinutes();
  const minutesUTC = h * 60 + m;

  // London open window: 07:00-07:30 UTC
  if (h === 7 && m < 30) return "london_open";
  // NY open window: 13:00-13:30 UTC
  if (h === 13 && m < 30) return "ny_open";
  // Asia session: 22:00-03:00 UTC
  if (h >= 22 || h < 3) return "asia_session";

  void minutesUTC; // used for future granularity
  return null;
}

export async function GET() {
  try {
    const db = createAdminClient();
    if (!db) {
      return NextResponse.json({
        state: "ranging",
        suggestions: DEFAULT_SUGGESTIONS,
        price: null,
        session: "UNKNOWN",
        scanAge: null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scan } = await (db as any)
      .from("market_scans")
      .select("bias, confluence_score, market_state, price, session, next_event, atr, created_at, price_change_pct")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const scanAge = scan?.created_at
      ? Math.round((Date.now() - new Date(scan.created_at).getTime()) / 1000)
      : null;

    // Determine market state — priority: pre_event > session > momentum
    let state: MarketState = "ranging";

    // Session-based overrides (highest priority timing signals)
    const sessionState = detectSessionState();

    // Check for imminent high-impact event
    const isPreEvent = scan?.next_event?.impact === "high" &&
      scan.next_event?.hours_until != null &&
      scan.next_event.hours_until <= 2;

    if (isPreEvent) {
      state = "pre_event";
    } else if (sessionState) {
      state = sessionState;
    } else {
      // Price momentum from scan
      const changePct: number = scan?.price_change_pct ?? 0;
      const bias: string = (scan?.bias ?? "neutral").toLowerCase();

      if (changePct <= -1.5) {
        state = "violent_selloff";
      } else if (changePct >= 1.5) {
        state = "violent_rally";
      } else if (changePct <= -0.5 || bias === "bearish") {
        state = "selloff";
      } else if (changePct >= 0.5 || bias === "bullish") {
        state = "rally";
      } else {
        state = "ranging";
      }
    }

    return NextResponse.json({
      state,
      suggestions: SUGGESTIONS[state] ?? DEFAULT_SUGGESTIONS,
      price: scan?.price ?? null,
      session: scan?.session ?? "UNKNOWN",
      scanAge,
    });
  } catch (err) {
    console.error("[suggestions] error:", err);
    return NextResponse.json({
      state: "ranging",
      suggestions: DEFAULT_SUGGESTIONS,
      price: null,
      session: "UNKNOWN",
      scanAge: null,
    });
  }
}
