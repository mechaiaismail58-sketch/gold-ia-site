import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const admin = createAdminClient();
    const db = (admin ?? supabase) as typeof supabase;
    const today = todayUTC();

    const [profileResult, snapshotResult] = await Promise.all([
      db.from("users")
        .select("prop_firm, prop_firm_phase, account_type")
        .eq("id", user.id)
        .single(),
      db.from("account_snapshots")
        .select("account_balance, daily_dd, total_dd, daily_profit, total_profit, trade_count_today, trade_count_month, trading_days, best_day_profit, updated_at")
        .eq("user_id", user.id)
        .eq("snapshot_date", today)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      profile:  profileResult.data  ?? null,
      snapshot: snapshotResult.data ?? null,
    });
  } catch (err) {
    console.error("GET /api/account/snapshot error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const toNum = (v: unknown) => {
      const n = parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };

    const payload = {
      user_id:             user.id,
      snapshot_date:       todayUTC(),
      account_balance:     toNum(body.account_balance),
      daily_dd:            toNum(body.daily_dd),
      total_dd:            toNum(body.total_dd),
      daily_profit:        toNum(body.daily_profit),
      total_profit:        toNum(body.total_profit),
      trade_count_today:   toNum(body.trade_count_today),
      trade_count_month:   toNum(body.trade_count_month),
      trading_days:        toNum(body.trading_days),
      best_day_profit:     toNum(body.best_day_profit),
      updated_at:          new Date().toISOString(),
    };

    const admin = createAdminClient();
    const db = (admin ?? supabase) as typeof supabase;

    const { data: snapshot, error } = await db
      .from("account_snapshots")
      .upsert(payload, { onConflict: "user_id,snapshot_date" })
      .select()
      .single();

    if (error) {
      console.error("account_snapshots upsert error:", error);
      return NextResponse.json({ error: "Failed to save snapshot." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("POST /api/account/snapshot error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
