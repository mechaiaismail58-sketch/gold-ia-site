import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HIGH_KEYWORDS = ["cpi", "nfp", "payroll", "fomc", "federal funds", "rate decision", "gdp", "pce", "ppi", "retail sales", "unemployment rate"];
const MED_PATTERNS  = ["speaks", "speech", "testimony", "minutes", "beige book"];

function classifyImpact(title: string): "high" | "medium" | "low" {
  const t = title.toLowerCase();
  if (MED_PATTERNS.some(k => t.includes(k))) return "medium";
  if (HIGH_KEYWORDS.some(k => t.includes(k))) return "high";
  return "low";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = createAdminClient() ?? supabase;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const [tradesRes, statsRes, eventsRes] = await Promise.allSettled([
      (db as typeof supabase)
        .from("trades")
        .select("id, bias, entry, stop_loss, tp1, tp2, confluence, result, created_at")
        .eq("user_id", user.id).eq("result", "pending").gte("created_at", threeDaysAgo)
        .order("created_at", { ascending: false }).limit(5),

      (db as typeof supabase)
        .from("trades").select("result").eq("user_id", user.id)
        .neq("result", "pending").neq("result", "still_open").neq("result", "scenario_pending")
        .order("created_at", { ascending: false }).limit(50),

      fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
        headers: { "User-Agent": "Mozilla/5.0 Bullion-Desk/1.0" },
        next: { revalidate: 300 },
      }),
    ]);

    const activeTrades = (tradesRes.status === "fulfilled" && !tradesRes.value.error)
      ? (tradesRes.value.data ?? []) : [];

    let wins = 0, losses = 0;
    if (statsRes.status === "fulfilled" && !statsRes.value.error) {
      const rows = statsRes.value.data ?? [];
      wins   = rows.filter((r: { result: string }) => r.result === "tp1_hit" || r.result === "tp2_hit").length;
      losses = rows.filter((r: { result: string }) => r.result === "sl_hit").length;
    }
    const totalTrades = wins + losses;
    const winrate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    let events: Array<{ title: string; date: string; impact: string }> = [];
    if (eventsRes.status === "fulfilled" && eventsRes.value.ok) {
      const raw = await eventsRes.value.json();
      const now = Date.now(), in48h = now + 48 * 60 * 60 * 1000;
      events = (raw as Array<{ title: string; country: string; date: string }>)
        .filter(e => e.country === "USD" && Date.parse(e.date) >= now && Date.parse(e.date) <= in48h)
        .map(e => ({ title: e.title, date: e.date, impact: classifyImpact(e.title) }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);
    }

    // Tradability score
    const hour = new Date().getUTCHours();
    const dow  = new Date().getUTCDay();
    const isKillzone   = (hour >= 7 && hour < 10) || (hour >= 12 && hour < 15);
    const isTradeHours = hour >= 6 && hour < 22;
    const soonHigh     = events.some(e => e.impact === "high" && new Date(e.date).getTime() - Date.now() < 2 * 60 * 60 * 1000);
    const sessionBonus = isKillzone ? 1.5 : isTradeHours ? 0 : -1.5;
    const dayBonus     = (dow >= 1 && dow <= 4) ? 0.5 : (dow === 5) ? 0 : -2.0;
    const eventPenalty = soonHigh ? -1.5 : 0;
    const score        = Math.max(0, Math.min(10, parseFloat((5.0 + sessionBonus + dayBonus + eventPenalty).toFixed(1))));
    const label        = score > 6.5 ? "Actionable" : score >= 4 ? "Caution" : "Stand Aside";
    const summaryParts: string[] = [];
    if (isKillzone)              summaryParts.push("Killzone active");
    else if (!isTradeHours)      summaryParts.push("Low liquidity hours");
    if (dow === 0 || dow === 6)  summaryParts.push("Weekend");
    if (soonHigh)                summaryParts.push("HIGH event < 2h");
    if (activeTrades.length > 0) summaryParts.push(`${activeTrades.length} signal${activeTrades.length > 1 ? "s" : ""} pending`);

    return NextResponse.json({
      tradability_score:   score,
      tradability_label:   label,
      tradability_summary: summaryParts.length > 0 ? summaryParts.join(" · ") : "No significant flags",
      active_trades:       activeTrades,
      wins, losses, total_trades: totalTrades, winrate,
      events,
      timestamp: Date.now(),
    }, { headers: { "Cache-Control": "max-age=30, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("[dashboard/data]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
