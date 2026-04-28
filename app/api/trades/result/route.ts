import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const VALID_RESULTS = ["tp1_hit", "tp2_hit", "sl_hit", "breakeven", "still_open"] as const;
type TradeResult = (typeof VALID_RESULTS)[number];

// ── Async outcome classifier — fire-and-forget after trade resolution ──────────

async function populateOutcome(params: {
  trade: { id: string; bias: string | null; entry: number | null; stop_loss: number | null; tp1: number | null; tp2: number | null; rr: number | null; confluence: number | null; justification: string | null; context_summary: string | null };
  result: string;
  pnl: number | null | undefined;
  userId: string;
  db: SupabaseClient;
}) {
  const { trade, result, pnl, userId, db } = params;

  // Map result to outcome format
  const outcomeResult = result === "tp1_hit" ? "tp1"
    : result === "tp2_hit" ? "tp2"
    : result === "sl_hit" ? "sl"
    : result === "breakeven" ? "breakeven"
    : "manual_close";

  // Compute direction from stored bias
  const biasLower = (trade.bias ?? "").toLowerCase();
  const direction = biasLower.includes("bull") || biasLower.includes("long") ? "long" : "short";

  // Compute R multiple from entry/SL/result
  let r_multiple: number | null = null;
  if (trade.entry && trade.stop_loss && trade.tp1) {
    const riskPts = Math.abs(trade.entry - trade.stop_loss);
    if (riskPts > 0) {
      if (outcomeResult === "tp1" && trade.tp1) {
        r_multiple = Math.abs(trade.tp1 - trade.entry) / riskPts;
      } else if (outcomeResult === "tp2" && trade.tp2) {
        r_multiple = Math.abs(trade.tp2 - trade.entry) / riskPts;
      } else if (outcomeResult === "sl") {
        r_multiple = -1;
      } else if (outcomeResult === "breakeven") {
        r_multiple = 0;
      }
    }
  }

  // Classify session from current UTC hour
  const hour = new Date().getUTCHours();
  const session = (hour >= 7 && hour < 12) ? "london"
    : (hour >= 12 && hour < 17) ? (hour < 14 ? "london_ny_overlap" : "ny")
    : (hour >= 22 || hour < 5) ? "asia"
    : "overnight";

  // Use Claude Haiku to classify setup_type + key_drivers + reason
  let setup_type = "other";
  let key_drivers: string[] = [];
  let success_reason: string | null = null;
  let failure_reason: string | null = null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const classifyPrompt = `Classify this XAUUSD trade outcome. Return ONLY valid JSON, no markdown.

Trade: ${direction} | Entry: ${trade.entry} | SL: ${trade.stop_loss} | TP1: ${trade.tp1}
Confluence: ${trade.confluence ?? "unknown"}/8
Setup notes: ${trade.justification ?? "none"}
Market context: ${trade.context_summary ?? "none"}
Result: ${outcomeResult}${pnl != null ? ` | PnL: ${pnl > 0 ? "+" : ""}${pnl}pts` : ""}

Return JSON:
{
  "setup_type": one of [ict_ob_retest, ict_fvg_fill, wyckoff_spring, wyckoff_upthrust, sweep_reversal, bos_retest, continuation_fvg, continuation_displacement, crt_reversal, amd_distribution, breaker_block, other],
  "key_drivers": array of 3-5 short tags like ["london_killzone","ob_confluence","weak_dxy"],
  "success_reason": "one sentence if tp1/tp2, else null",
  "failure_reason": "one sentence if sl/manual_close, else null"
}`;

    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: classifyPrompt }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim();
    const parsed = JSON.parse(text);
    setup_type    = parsed.setup_type    ?? "other";
    key_drivers   = parsed.key_drivers   ?? [];
    success_reason = parsed.success_reason ?? null;
    failure_reason = parsed.failure_reason ?? null;
  } catch (e) {
    console.error("[populateOutcome] classify error:", e);
  }

  await db.from("trade_outcomes").insert({
    trade_id:        trade.id,
    user_id:         userId,
    setup_type,
    session,
    confluence_score: trade.confluence ?? null,
    direction,
    result:          outcomeResult,
    points_pnl:      pnl ?? null,
    r_multiple,
    key_drivers,
    success_reason,
    failure_reason,
    chart_attached:  false,
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { trade_id, result, pnl, notes } = body ?? {};

    if (!trade_id || !result) {
      return NextResponse.json({ error: "trade_id and result are required" }, { status: 400 });
    }
    if (!VALID_RESULTS.includes(result as TradeResult)) {
      return NextResponse.json(
        { error: `result must be one of: ${VALID_RESULTS.join(", ")}` },
        { status: 400 }
      );
    }

    const db = createAdminClient() ?? supabase;

    // Fetch the trade — verifies ownership
    const { data: trade, error: fetchError } = await (db as typeof supabase)
      .from("trades")
      .select("id, bias, entry, stop_loss, tp1, tp2, rr, confluence, justification, context_summary")
      .eq("id", trade_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    // Generate lesson via Anthropic (skip for still_open — no final result yet)
    let lesson_learned: string | null = null;
    if (process.env.ANTHROPIC_API_KEY && result !== "still_open") {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const resultLabel: Record<string, string> = {
          tp1_hit: "TP1 hit (partial profit taken)",
          tp2_hit: "TP2 hit (full target reached)",
          sl_hit: "Stop Loss hit (loss)",
          breakeven: "Breakeven (SL moved to entry, no gain/loss)",
        };
        // Determine direction from stored bias — never infer from levels
        const biasLower = (trade.bias ?? "").toLowerCase();
        const direction = biasLower.includes("bull") || biasLower.includes("long") ? "Long"
          : biasLower.includes("bear") || biasLower.includes("short") ? "Short"
          : trade.bias ?? "Unknown";

        const lessonPrompt = `You are an institutional trade analyst reviewing a completed XAUUSD trade. Write a lesson learned in exactly 2-3 sentences.

Trade:
- Direction: ${direction}
- Entry: ${trade.entry} | SL: ${trade.stop_loss} | TP1: ${trade.tp1} | TP2: ${trade.tp2}
- R/R: ${trade.rr ?? "unknown"} | Confluence: ${trade.confluence ?? "unknown"}/8
- Setup justification: ${trade.justification ?? "none"}
- Market context at entry: ${trade.context_summary ?? "none"}
- Result: ${resultLabel[result] ?? result}${pnl != null ? ` | PnL: ${pnl > 0 ? "+" : ""}${pnl}` : ""}${notes ? `\n- Notes: ${notes}` : ""}

For a ${direction} trade: SL is ${direction === "Long" ? "below" : "above"} entry, TP is ${direction === "Long" ? "above" : "below"} entry.
Write 2-3 sentences covering: (1) what was correctly identified, (2) what was missed or went wrong if applicable, (3) one specific improvement for next time. Be direct and actionable. No fluff, no generic advice.`;

        const response = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 120,
          messages: [{ role: "user", content: lessonPrompt }],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lesson_learned = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim() || null;
      } catch (err) {
        console.error("[trades/result] lesson generation error:", err);
      }
    }

    // Update the trade record
    const { error: updateError } = await (db as typeof supabase)
      .from("trades")
      .update({
        result,
        result_pnl: pnl ?? null,
        result_notes: notes ?? null,
        lesson_learned,
        closed_at: result !== "still_open" ? new Date().toISOString() : null,
      })
      .eq("id", trade_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[trades/result] update error:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // ── Async: populate trade_outcomes for learning (fire-and-forget) ───────
    if (result !== "still_open" && process.env.ANTHROPIC_API_KEY) {
      populateOutcome({ trade, result, pnl, userId: user.id, db: db as typeof supabase }).catch(
        (e: unknown) => console.error("[trades/result] outcome population error:", e)
      );
    }

    return NextResponse.json({ ok: true, lesson_learned });
  } catch (err) {
    console.error("[trades/result] handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
