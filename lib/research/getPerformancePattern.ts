import { createAdminClient } from "@/lib/supabase/server";

export async function getPerformancePattern(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    if (!admin) return null;

    const { data: trades, error } = await admin
      .from("trades")
      .select("bias, result, created_at")
      .not("result", "eq", "pending")
      .not("result", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !trades || trades.length === 0) return null;

    const completed = trades.filter(t =>
      t.result === "tp1_hit" || t.result === "tp2_hit" || t.result === "sl_hit"
    );
    if (completed.length === 0) return null;

    const wins = completed.filter(t => t.result === "tp1_hit" || t.result === "tp2_hit").length;
    const winrate = Math.round((wins / completed.length) * 100);

    // Winrate by session (UTC hour of creation)
    const bySession: Record<string, { w: number; t: number }> = {
      London: { w: 0, t: 0 },
      NY: { w: 0, t: 0 },
      Asia: { w: 0, t: 0 },
    };
    for (const t of completed) {
      const h = new Date(t.created_at).getUTCHours();
      const session = h >= 7 && h < 12 ? "London" : h >= 12 && h < 20 ? "NY" : "Asia";
      bySession[session].t++;
      if (t.result === "tp1_hit" || t.result === "tp2_hit") bySession[session].w++;
    }

    // Winrate by bias
    const byBias: Record<string, { w: number; t: number }> = {};
    for (const t of completed) {
      const bias = (t.bias ?? "unknown").toLowerCase();
      if (!byBias[bias]) byBias[bias] = { w: 0, t: 0 };
      byBias[bias].t++;
      if (t.result === "tp1_hit" || t.result === "tp2_hit") byBias[bias].w++;
    }

    const sessionParts = Object.entries(bySession)
      .filter(([, v]) => v.t >= 3)
      .map(([s, v]) => `${s}: ${Math.round((v.w / v.t) * 100)}% (${v.t} trades)`)
      .join(", ");

    const biasParts = Object.entries(byBias)
      .filter(([, v]) => v.t >= 3)
      .map(([b, v]) => `${b}: ${Math.round((v.w / v.t) * 100)}%`)
      .join(", ");

    const sessionsSorted = Object.entries(bySession).filter(([, v]) => v.t >= 3).sort((a, b) => (b[1].w / b[1].t) - (a[1].w / a[1].t));
    const best = sessionsSorted[0]?.[0] ?? null;
    const worst = sessionsSorted[sessionsSorted.length - 1]?.[0] ?? null;

    const parts = [
      `PERFORMANCE PATTERN (last ${completed.length} completed trades):`,
      `Winrate: ${winrate}%.`,
      sessionParts ? `By session — ${sessionParts}.` : null,
      best && worst && best !== worst ? `Best session: ${best}. Worst: ${worst}.` : null,
      biasParts ? `By bias — ${biasParts}.` : null,
    ].filter(Boolean).join(" ");

    return parts;
  } catch {
    return null;
  }
}
