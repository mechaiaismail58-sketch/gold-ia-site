// ── Trade Context — pending results + performance memory ───────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

type PendingTrade = {
  id: string;
  bias: string | null;
  entry: number | null;
  stop_loss: number | null;
  tp1: number | null;
  created_at: string;
};

export type PendingTradesContext = {
  count: number;
  trades: PendingTrade[];
  first_id: string; // oldest pending trade ID — used by UI for result buttons
  prompt: string;   // injected into AI context
};

export type PerformanceMemory = {
  winrate: number;
  total_completed: number;
  wins: number;
  losses: number;
  summary: string;
};

// ── Pending trades (>4h, result still 'pending') ───────────────────────────────

export async function getPendingTradesContext(
  userId: string,
  db: SupabaseClient
): Promise<PendingTradesContext | null> {
  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from("trades")
      .select("id, bias, entry, stop_loss, tp1, created_at")
      .eq("user_id", userId)
      .eq("result", "pending")
      .lt("created_at", fourHoursAgo)
      .gte("created_at", threeDaysAgo)
      .order("created_at", { ascending: false })
      .limit(3);

    // Also fetch scenario_pending trades from last 3 days
    const { data: scenarioData } = await db
      .from("trades")
      .select("id, bias, entry, stop_loss, tp1, created_at, justification")
      .eq("user_id", userId)
      .eq("result", "scenario_pending")
      .gte("created_at", threeDaysAgo)
      .order("created_at", { ascending: false })
      .limit(3);

    if ((error || !data || data.length === 0) && (!scenarioData || scenarioData.length === 0)) return null;

    const tradeLines = (data ?? []).map((t: PendingTrade) => {
      const d = new Date(t.created_at).toISOString().slice(0, 16).replace("T", " ");
      return `- Trade ${d} UTC : ${t.bias ?? "—"} | Entry ${t.entry ?? "—"} | SL ${t.stop_loss ?? "—"} | TP1 ${t.tp1 ?? "—"} — result unknown`;
    });

    const scenarioLines = (scenarioData ?? []).map((t: PendingTrade & { justification?: string }) => {
      const d = new Date(t.created_at).toISOString().slice(0, 16).replace("T", " ");
      const cond = (t as { justification?: string }).justification ?? "condition unspecified";
      return `- Scenario ${d} UTC : ${t.bias ?? "—"} | Entry ${t.entry ?? "—"} | SL ${t.stop_loss ?? "—"} | TP1 ${t.tp1 ?? "—"} | Condition: ${cond} — not yet triggered`;
    });

    const allData = data ?? [];
    const oldest = allData[allData.length - 1] as PendingTrade | undefined;

    const parts: string[] = [];
    if (tradeLines.length > 0) {
      parts.push(`PENDING TRADES (auto-invalidated if entry >100pts from current price, or older than 3 days):\n${tradeLines.join("\n")}`);
    }
    if (scenarioLines.length > 0) {
      parts.push(`PENDING SCENARIOS (conditional plans — not yet triggered):\n${scenarioLines.join("\n")}`);
    }

    const prompt = parts.join("\n\n");

    return {
      count: allData.length,
      trades: allData,
      first_id: oldest?.id ?? (scenarioData?.[0]?.id ?? ""),
      prompt,
    };
  } catch (err) {
    console.error("[getTradesContext] getPendingTradesContext error:", err);
    return null;
  }
}

// ── Performance memory (last 20 closed trades) ─────────────────────────────────

export async function getPerformanceMemory(
  userId: string,
  db: SupabaseClient
): Promise<PerformanceMemory | null> {
  try {
    const { data, error } = await db
      .from("trades")
      .select("bias, entry, stop_loss, tp1, tp2, rr, result, justification, lesson_learned, context_summary, created_at")
      .eq("user_id", userId)
      .neq("result", "pending")
      .neq("result", "still_open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return null;

    const wins = data.filter((t) => t.result === "tp1_hit" || t.result === "tp2_hit").length;
    const losses = data.filter((t) => t.result === "sl_hit").length;
    const total = wins + losses;
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Best setup: last TP2 hit with justification
    const bestSetup = data
      .filter((t) => t.result === "tp2_hit" && t.justification)
      .map((t: { justification: string }) => t.justification)
      .slice(0, 1)[0] ?? null;

    // Worst setup: last SL hit with justification
    const worstSetup = data
      .filter((t) => t.result === "sl_hit" && t.justification)
      .map((t: { justification: string }) => t.justification)
      .slice(0, 1)[0] ?? null;

    // Avoid patterns: common context in SL hits
    const avoidPatterns = data
      .filter((t) => t.result === "sl_hit" && t.context_summary)
      .map((t: { context_summary: string }) => t.context_summary)
      .slice(0, 2)
      .join(" | ") || null;

    // Lessons learned
    const lessons = data
      .filter((t) => t.lesson_learned)
      .map((t: { lesson_learned: string }) => t.lesson_learned)
      .slice(0, 3)
      .join(" | ") || null;

    const parts: string[] = [];
    parts.push(`PERFORMANCE MEMORY (last ${data.length} trades):`);
    parts.push(`Winrate: ${winrate}% (${wins}W / ${losses}L of ${total} completed trades)`);
    if (bestSetup) parts.push(`Best setup: ${bestSetup}`);
    if (worstSetup) parts.push(`Worst setup: ${worstSetup}`);
    if (avoidPatterns) parts.push(`Avoid: ${avoidPatterns}`);
    if (lessons) parts.push(`Lessons learned: ${lessons}`);

    return {
      winrate,
      total_completed: total,
      wins,
      losses,
      summary: parts.join("\n"),
    };
  } catch (err) {
    console.error("[getTradesContext] getPerformanceMemory error:", err);
    return null;
  }
}
