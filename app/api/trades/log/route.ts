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
    const db = createAdminClient() ?? supabase;

    const { data: inserted, error } = await (db as typeof supabase)
      .from("trades")
      .insert({
        user_id:      user.id,
        bias,
        entry:        Number(entry),
        stop_loss:    sl != null ? Number(sl) : null,
        tp1:          tp1 != null ? Number(tp1) : null,
        tp2:          tp2 != null ? Number(tp2) : null,
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
