export type MarketContext = {
  market_type: "XAUUSD / Gold";
  market_status: "OPEN" | "CLOSED";
  session_state: "WEEKDAY_ACTIVE" | "DAILY_BREAK" | "WEEKEND_CLOSED";
  active_session: "London" | "London/NY Overlap" | "New York" | "Asia" | "Overnight" | "Closed";
  session_liquidity: "High" | "Medium" | "Low";
  session_characteristics: string;
  is_weekend: boolean;
  now_utc: string;
  next_open_utc: string | null;
  next_open_note: string;
};

const SESSION_META: Record<
  MarketContext["active_session"],
  { liquidity: "High" | "Medium" | "Low"; characteristics: string }
> = {
  "London": {
    liquidity: "High",
    characteristics: "Strong directional bias early session, frequent breakouts and reversals, high institutional order flow, best window for trend-following and reversal setups",
  },
  "London/NY Overlap": {
    liquidity: "High",
    characteristics: "Peak liquidity window (13:00-16:00 UTC), most reliable breakouts, maximum institutional flow, highest-probability session for high-conviction entries",
  },
  "New York": {
    liquidity: "Medium",
    characteristics: "Continuation or reversal of London direction, key US data releases, potential late-session range (19:00-21:00 UTC), good for daytrade continuation setups",
  },
  "Asia": {
    liquidity: "Low",
    characteristics: "Range compression typical, minimal volatility, institutional activity low, scalp setups unreliable, mostly consolidation and liquidity building",
  },
  "Overnight": {
    liquidity: "Low",
    characteristics: "Minimal liquidity, structure largely unexploitable for intraday or scalp, avoid most active setups, wait for London open",
  },
  "Closed": {
    liquidity: "Low",
    characteristics: "Market closed — no live execution possible, conditional opening plans only",
  },
};

function deriveActiveSession(
  marketStatus: "OPEN" | "CLOSED",
  hour: number
): MarketContext["active_session"] {
  if (marketStatus === "CLOSED") return "Closed";
  // London: 07:00-13:00 UTC
  if (hour >= 7 && hour < 13) return "London";
  // London/NY Overlap: 13:00-16:00 UTC
  if (hour >= 13 && hour < 16) return "London/NY Overlap";
  // New York: 16:00-21:00 UTC
  if (hour >= 16 && hour < 21) return "New York";
  // Asia: 22:00-03:00 UTC (wraps midnight)
  if (hour >= 22 || hour < 3) return "Asia";
  return "Overnight";
}

function getNextSundayOpenUtc(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = (7 - day) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  d.setUTCHours(22, 0, 0, 0);
  return d;
}

export function getMarketContext(now = new Date()): MarketContext {
  const day = now.getUTCDay(); // 0 Sunday ... 6 Saturday
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;

  const dailyBreakStart = 21 * 60; // 21:00 UTC
  const dailyBreakEnd = 22 * 60;   // 22:00 UTC

  const isSaturday = day === 6;
  const isSundayBeforeOpen = day === 0 && totalMinutes < dailyBreakEnd;
  const isFridayAfterClose = day === 5 && totalMinutes >= dailyBreakStart;
  const isDailyBreakMonThu =
    day >= 1 && day <= 4 && totalMinutes >= dailyBreakStart && totalMinutes < dailyBreakEnd;

  let market_status: MarketContext["market_status"] = "OPEN";
  let session_state: MarketContext["session_state"] = "WEEKDAY_ACTIVE";
  let next_open_utc: string | null = null;
  let next_open_note = "Market active.";

  if (isSaturday || isSundayBeforeOpen || isFridayAfterClose) {
    market_status = "CLOSED";
    session_state = "WEEKEND_CLOSED";

    const nextOpen = getNextSundayOpenUtc(now);
    if (isSundayBeforeOpen) {
      nextOpen.setUTCHours(22, 0, 0, 0);
    }

    next_open_utc = nextOpen.toISOString();
    next_open_note =
      "Weekend closure. Standard gold market is closed; only conditional opening plans are allowed.";
  } else if (isDailyBreakMonThu) {
    market_status = "CLOSED";
    session_state = "DAILY_BREAK";

    const nextOpen = new Date(now);
    nextOpen.setUTCHours(22, 0, 0, 0);
    next_open_utc = nextOpen.toISOString();
    next_open_note =
      "Daily maintenance break. Avoid treating this as a live tradable session.";
  }

  const active_session = deriveActiveSession(market_status, hour);
  const sessionMeta = SESSION_META[active_session];

  return {
    market_type: "XAUUSD / Gold",
    market_status,
    session_state,
    active_session,
    session_liquidity: sessionMeta.liquidity,
    session_characteristics: sessionMeta.characteristics,
    is_weekend: isSaturday || isSundayBeforeOpen || isFridayAfterClose,
    now_utc: now.toISOString(),
    next_open_utc,
    next_open_note,
  };
}