import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: trades, error } = await supabase
      .from("trades")
      .select("id, bias, entry, stop_loss, tp1, tp2, rr, result, created_at, mode")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const completed = (trades ?? []).filter(t => ["tp1_hit", "tp2_hit", "sl_hit"].includes(t.result ?? ""));
    const wins = completed.filter(t => t.result === "tp1_hit" || t.result === "tp2_hit").length;
    const losses = completed.filter(t => t.result === "sl_hit").length;
    const winrate = completed.length > 0 ? Math.round((wins / completed.length) * 100) : null;

    return NextResponse.json({ trades: trades ?? [], winrate, wins, losses, total: completed.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
