import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_RESULTS = ["tp1_hit", "tp2_hit", "sl_hit", "breakeven", "still_open"] as const;
type TradeResult = (typeof VALID_RESULTS)[number];

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

    return NextResponse.json({ ok: true, lesson_learned });
  } catch (err) {
    console.error("[trades/result] handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
