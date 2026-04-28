import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { bias, entry, sl, tp1, tp2, confluence, type, condition } = body ?? {};

    if (!bias || entry == null) {
      return NextResponse.json({ error: "bias and entry are required" }, { status: 400 });
    }

    const isScenario = type === "scenario";

    // Normalise direction so the lesson generator always has a clean value
    const rawBias = String(bias).toLowerCase();
    const isLong = rawBias.includes("long") || rawBias.includes("bull");
    const isShort = rawBias.includes("short") || rawBias.includes("bear");
    const normalisedBias = isLong ? "Bullish" : isShort ? "Bearish" : String(bias);

    const entryNum = Number(entry);
    const slNum    = sl  != null ? Number(sl)  : null;
    const tp1Num   = tp1 != null ? Number(tp1) : null;
    const tp2Num   = tp2 != null ? Number(tp2) : null;

    // Validate Entry/SL/TP direction coherence
    if (slNum != null) {
      if (isLong  && slNum >= entryNum) console.warn("[trades/log] Long but SL >= entry:", slNum, entryNum);
      if (isShort && slNum <= entryNum) console.warn("[trades/log] Short but SL <= entry:", slNum, entryNum);
    }
    if (tp1Num != null) {
      if (isLong  && tp1Num <= entryNum) console.warn("[trades/log] Long but TP1 <= entry:", tp1Num, entryNum);
      if (isShort && tp1Num >= entryNum) console.warn("[trades/log] Short but TP1 >= entry:", tp1Num, entryNum);
    }

    const db = createAdminClient() ?? supabase;

    const { data: inserted, error } = await (db as typeof supabase)
      .from("trades")
      .insert({
        user_id:      user.id,
        bias:         normalisedBias,
        entry:        entryNum,
        stop_loss:    slNum,
        tp1:          tp1Num,
        tp2:          tp2Num,
        confluence:   confluence != null ? Number(confluence) : null,
        result:       isScenario ? "scenario_pending" : "pending",
        source:       isScenario ? "scenario" : "user_logged",
        justification: isScenario && condition ? String(condition) : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[trades/log] insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trade_id: inserted?.id ?? null });
  } catch (err) {
    console.error("[trades/log] handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
