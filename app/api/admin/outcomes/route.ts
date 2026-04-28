import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Admin client unavailable" }, { status: 500 });

  const { data, error } = await db
    .from("trade_outcomes")
    .select("setup_type, session, confluence_score, direction, result, points_pnl, r_multiple, key_drivers, created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ total: 0, message: "No outcomes yet" });

  // ── Aggregations ────────────────────────────────────────────────────────────

  const wins = (r: { result: string }) => r.result === "tp1" || r.result === "tp2";
  const wr = (rows: typeof data) => {
    const w = rows.filter(wins).length;
    const total = rows.filter(r => r.result !== "manual_close").length;
    return total > 0 ? `${Math.round((w / total) * 100)}% (${w}/${total})` : "n/a";
  };
  const avgR = (rows: typeof data) => {
    const rs = rows.map(r => r.r_multiple).filter((v): v is number => v != null);
    return rs.length > 0 ? parseFloat((rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(2)) : null;
  };

  // By setup_type
  const setupTypes = [...new Set(data.map(r => r.setup_type))];
  const by_setup = Object.fromEntries(
    setupTypes.map(s => {
      const rows = data.filter(r => r.setup_type === s);
      return [s, { count: rows.length, winrate: wr(rows), avg_r: avgR(rows) }];
    })
  );

  // By session
  const sessions = [...new Set(data.map(r => r.session))];
  const by_session = Object.fromEntries(
    sessions.map(s => {
      const rows = data.filter(r => r.session === s);
      return [s, { count: rows.length, winrate: wr(rows), avg_r: avgR(rows) }];
    })
  );

  // By confluence bucket
  const buckets: Record<string, typeof data> = { "5-6": [], "7": [], "8": [], "9": [] };
  for (const r of data) {
    const c = r.confluence_score;
    if (c == null) continue;
    if (c <= 6) buckets["5-6"].push(r);
    else if (c === 7) buckets["7"].push(r);
    else if (c === 8) buckets["8"].push(r);
    else if (c >= 9) buckets["9"].push(r);
  }
  const by_confluence = Object.fromEntries(
    Object.entries(buckets).map(([k, rows]) => [
      k, { count: rows.length, winrate: wr(rows), avg_r: avgR(rows) }
    ])
  );

  return NextResponse.json({
    total: data.length,
    overall_winrate: wr(data),
    overall_avg_r: avgR(data),
    by_setup,
    by_session,
    by_confluence,
  });
}
