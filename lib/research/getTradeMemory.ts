// ── Trade Memory Context ────────────────────────────────────────────────────────
// Fetches the last N trade signals given by the AI to this user.
// Used to detect: repeated level failures, over-trading, active open trade.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TradeSignal = {
  direction: "long" | "short" | null;
  entry_zone: string | null;
  sl_level: string | null;
  key_level_hint: string | null; // closest structural keyword (OB, FVG, PDH, swing...)
  date: string; // ISO timestamp
  session_id: string;
};

export type TradeMemoryContext = {
  signals: TradeSignal[];       // last ≤10 trade signals (direction confirmed only)
  signal_count_7d: number;      // trade signals in last 7 days
  last_direction: "long" | "short" | null;
  consecutive_same_direction: number; // streak of identical direction
  summary: string;
};

// ── Extraction helpers ─────────────────────────────────────────────────────────

function extractDirection(text: string): "long" | "short" | null {
  const t = text.toUpperCase();
  if (t.includes("YES LONG"))  return "long";
  if (t.includes("YES SHORT")) return "short";
  return null; // Stand Aside responses are excluded
}

function extractPrice(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-–]?\\s*([\\d,]+(\\.[\\d]+)?(\\s*[–\\-]\\s*[\\d,]+(\\.[\\d]+)?)?)`,
      "i"
    );
    const m = text.match(re);
    if (m) return m[1].trim().replace(",", "");
  }
  return null;
}

function extractKeyLevel(text: string): string | null {
  const patterns: [RegExp, string][] = [
    [/order\s*block/i, "orderblock"],
    [/\bfvg\b|fair\s*value\s*gap/i, "fvg"],
    [/\bpdh\b|prev.*day.*high/i, "PDH"],
    [/\bpdl\b|prev.*day.*low/i, "PDL"],
    [/weekly\s+high/i, "weekly_high"],
    [/weekly\s+low/i, "weekly_low"],
    [/swing\s+(high|low)/i, "swing"],
    [/liquidity/i, "liquidity"],
    [/support/i, "support"],
    [/resistance/i, "resistance"],
  ];
  for (const [re, label] of patterns) {
    if (re.test(text)) return label;
  }
  return null;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function getTradeMemory(
  userId: string,
  db: SupabaseClient
): Promise<TradeMemoryContext | null> {
  try {
    const { data, error } = await db
      .from("conversations")
      .select("message_ia, created_at, session_id")
      .eq("user_id", userId)
      .eq("mode", "trade_request")
      .order("created_at", { ascending: false })
      .limit(20); // fetch more rows, we filter down to trades with confirmed signals

    if (error || !data || data.length === 0) {
      return {
        signals: [],
        signal_count_7d: 0,
        last_direction: null,
        consecutive_same_direction: 0,
        summary: "No previous trade signals found.",
      };
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const signals: TradeSignal[] = [];
    let signal_count_7d = 0;

    for (const row of data) {
      const direction = extractDirection(row.message_ia);
      if (!direction) continue; // Stand Aside or no confirmed trade

      const rowTime = new Date(row.created_at).getTime();
      if (rowTime >= sevenDaysAgo) signal_count_7d++;

      if (signals.length < 10) {
        signals.push({
          direction,
          entry_zone: extractPrice(row.message_ia, ["Entry", "Entr[eé]e", "Zone d.entr[eé]e"]),
          sl_level: extractPrice(row.message_ia, ["Invalidation", "Stop Loss", "\\bSL\\b"]),
          key_level_hint: extractKeyLevel(row.message_ia),
          date: row.created_at,
          session_id: row.session_id,
        });
      }
    }

    if (signals.length === 0) {
      return {
        signals: [],
        signal_count_7d,
        last_direction: null,
        consecutive_same_direction: 0,
        summary: "Recent trade requests resulted in Stand Aside — no confirmed signals.",
      };
    }

    const lastDirection = signals[0].direction;

    // Compute consecutive streak of same direction
    let streak = 0;
    for (const s of signals) {
      if (s.direction === lastDirection) streak++;
      else break;
    }

    // Build summary
    const parts: string[] = [];
    parts.push(`Previous trade signals: ${signals.length} on record.`);

    if (signal_count_7d >= 4) {
      parts.push(`WARNING: ${signal_count_7d} trade signals in the last 7 days — elevated trading frequency. Raise quality threshold.`);
    }

    if (streak >= 3) {
      parts.push(`${streak} consecutive ${lastDirection?.toUpperCase()} signals in a row — verify the bias is still structurally justified.`);
    }

    // List last 5 signals compactly
    const signalLines = signals.slice(0, 5).map((s) => {
      const d = s.date.slice(0, 16).replace("T", " ");
      const lvl = s.key_level_hint ? ` [${s.key_level_hint}]` : "";
      return `${d} UTC | ${s.direction!.toUpperCase()} | Entry: ${s.entry_zone ?? "—"} | SL: ${s.sl_level ?? "—"}${lvl}`;
    });
    parts.push(...signalLines);

    return {
      signals,
      signal_count_7d,
      last_direction: lastDirection,
      consecutive_same_direction: streak,
      summary: parts.join("\n"),
    };
  } catch (err) {
    console.error("getTradeMemory error:", err);
    return null;
  }
}
