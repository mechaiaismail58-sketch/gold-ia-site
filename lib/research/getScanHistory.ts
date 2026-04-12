import { createAdminClient } from "@/lib/supabase/server";

export type ScanHistorySummary = string | null;

type ScanRow = {
  scanned_at: string;
  price: number;
  session: string | null;
  h1_trend: string | null;
  h4_trend: string | null;
  delta_h1: string | null;
  delta_h4: string | null;
  delta_flip: boolean | null;
  delta_flip_direction: string | null;
  bb_state: string | null;
  squeeze_active: boolean | null;
  ema20_h1: number | null;
  near_level: boolean | null;
  near_level_name: string | null;
  near_level_distance: number | null;
  breakout_detected: boolean | null;
  breakout_type: string | null;
  breakout_level: number | null;
  volume_spike: boolean | null;
};

type AlertRow = {
  created_at: string;
  alert_type: string;
  message: string;
  severity: string;
};

export async function getScanHistory(): Promise<ScanHistorySummary> {
  try {
    const admin = createAdminClient();
    if (!admin) return null;

    const cutoff3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const cutoff4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const [scansResult, alertsResult] = await Promise.all([
      admin
        .from("market_scans")
        .select("scanned_at,price,session,h1_trend,h4_trend,delta_h1,delta_h4,delta_flip,delta_flip_direction,bb_state,squeeze_active,ema20_h1,near_level,near_level_name,near_level_distance,breakout_detected,breakout_type,breakout_level,volume_spike")
        .gte("scanned_at", cutoff3h)
        .order("scanned_at", { ascending: true })
        .limit(12),
      admin
        .from("scan_alerts")
        .select("created_at,alert_type,message,severity")
        .gte("created_at", cutoff4h)
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const scans = (scansResult.data ?? []) as ScanRow[];
    const alerts = (alertsResult.data ?? []) as AlertRow[];

    if (scans.length === 0 && alerts.length === 0) return null;
    if (scans.length === 0) {
      // Only alerts, no scan data
      const alertLines = alerts.map(a => `— [${a.severity.toUpperCase()}] ${a.message}`).join("\n");
      return `ACTIVE ALERTS (unacknowledged)\n${alertLines}`;
    }

    const lines: string[] = [];

    // ── Price trajectory ───────────────────────────────────────────────────────
    const first = scans[0];
    const last = scans[scans.length - 1];
    const trajectory: string[] = [];
    const step = Math.max(1, Math.floor(scans.length / 4));
    for (let i = 0; i < scans.length; i += step) trajectory.push(scans[i].price.toFixed(2));
    if (trajectory[trajectory.length - 1] !== last.price.toFixed(2)) trajectory.push(last.price.toFixed(2));
    const totalMove = last.price - first.price;
    const moveDir = totalMove > 5 ? "bullish" : totalMove < -5 ? "bearish" : "flat";
    lines.push(`MARKET SCANNER (last ${scans.length} scans, ${Math.round((Date.now() - new Date(first.scanned_at).getTime()) / 60000)}min window)`);
    lines.push(`Price trajectory: ${trajectory.join(" → ")} (${moveDir} ${totalMove > 0 ? "+" : ""}${totalMove.toFixed(0)}pts)`);

    // ── Structure evolution ────────────────────────────────────────────────────
    const h1Trends = scans.map(s => s.h1_trend).filter(Boolean);
    const uniqueTrends = [...new Set(h1Trends)];
    let structureEvol = "stable";
    if (uniqueTrends.length > 1) {
      const firstTrend = h1Trends[0];
      const lastTrend = h1Trends[h1Trends.length - 1];
      if (firstTrend !== lastTrend) {
        structureEvol = `shifted from ${firstTrend ?? "unknown"} to ${lastTrend ?? "unknown"}`;
      } else {
        structureEvol = `stable ${lastTrend ?? "unknown"}`;
      }
    } else if (uniqueTrends.length === 1) {
      structureEvol = `consistently ${uniqueTrends[0] ?? "unknown"}`;
    }
    lines.push(`Structure evolution: ${structureEvol}`);

    // ── Delta evolution ────────────────────────────────────────────────────────
    const deltas = scans.map(s => s.delta_h1).filter(Boolean);
    const flipScans = scans.filter(s => s.delta_flip);
    let deltaEvol = "neutral throughout";
    if (flipScans.length > 0) {
      const lastFlip = flipScans[flipScans.length - 1];
      const flipMinAgo = Math.round((Date.now() - new Date(lastFlip.scanned_at).getTime()) / 60000);
      deltaEvol = `flipped to ${lastFlip.delta_flip_direction?.replace("to_", "") ?? "unknown"} ${flipMinAgo}min ago`;
    } else if (deltas.length > 0) {
      const uniqueDeltas = [...new Set(deltas)];
      if (uniqueDeltas.length === 1) deltaEvol = `consistently ${uniqueDeltas[0]}`;
      else deltaEvol = `choppy (${uniqueDeltas.join(" / ")})`;
    }
    lines.push(`Delta evolution: ${deltaEvol}`);

    // ── Key observations ───────────────────────────────────────────────────────
    const observations: string[] = [];

    // Price range analysis
    const allPrices = scans.map(s => s.price);
    const rangeHigh = Math.max(...allPrices);
    const rangeLow = Math.min(...allPrices);
    const totalRange = rangeHigh - rangeLow;
    if (totalRange < 20 && scans.length >= 8) {
      observations.push(`Price in tight range ${rangeLow.toFixed(2)}-${rangeHigh.toFixed(2)} for ${Math.round((Date.now() - new Date(first.scanned_at).getTime()) / 60000)}min — breakout energy building`);
    } else if (totalRange > 50 && scans.length >= 4) {
      observations.push(`Strong ${moveDir} impulse — ${totalRange.toFixed(0)}pts in ${Math.round((Date.now() - new Date(first.scanned_at).getTime()) / 60000)}min`);
    }

    // Level touches — how many times did price come near the same level?
    const levelTouchMap = new Map<string, number>();
    for (const s of scans) {
      if (s.near_level && s.near_level_name) {
        levelTouchMap.set(s.near_level_name, (levelTouchMap.get(s.near_level_name) ?? 0) + 1);
      }
    }
    for (const [levelName, count] of levelTouchMap.entries()) {
      if (count >= 2) {
        const windowMin = Math.round((Date.now() - new Date(first.scanned_at).getTime()) / 60000);
        observations.push(`Price tested ${levelName} ${count} times in ${windowMin}min — level is being worked`);
      }
    }

    // Squeeze resolution
    const squeezeResolved = scans.some((s, i) => {
      if (i === 0) return false;
      return scans[i - 1].squeeze_active === true && s.bb_state === "expansion";
    });
    if (squeezeResolved) {
      const resolveIdx = scans.findIndex((s, i) => i > 0 && scans[i - 1].squeeze_active === true && s.bb_state === "expansion");
      if (resolveIdx > 0) {
        const resolveMinAgo = Math.round((Date.now() - new Date(scans[resolveIdx].scanned_at).getTime()) / 60000);
        const direction = scans[resolveIdx].price > (scans[resolveIdx].ema20_h1 ?? scans[resolveIdx].price) ? "bullish" : "bearish";
        observations.push(`Bollinger squeeze resolved ${resolveMinAgo}min ago — expanding ${direction}`);
      }
    } else if (last.squeeze_active) {
      observations.push(`Bollinger squeeze currently active — breakout pending`);
    }

    // Volume spikes
    const volumeSpikes = scans.filter(s => s.volume_spike);
    if (volumeSpikes.length > 0) {
      const lastSpike = volumeSpikes[volumeSpikes.length - 1];
      const spikeMinAgo = Math.round((Date.now() - new Date(lastSpike.scanned_at).getTime()) / 60000);
      observations.push(`Volume spike detected ${spikeMinAgo}min ago — institutional activity on that candle`);
    }

    // Breakout detected
    const breakoutScans = scans.filter(s => s.breakout_detected);
    if (breakoutScans.length > 0) {
      const lastBo = breakoutScans[breakoutScans.length - 1];
      const boMinAgo = Math.round((Date.now() - new Date(lastBo.scanned_at).getTime()) / 60000);
      const boDir = lastBo.breakout_type?.includes("bullish") ? "bullish" : "bearish";
      observations.push(`${boDir} BOS detected ${boMinAgo}min ago at ${lastBo.breakout_level?.toFixed(2) ?? "unknown"}`);
    }

    if (observations.length > 0) {
      lines.push("Key observations:");
      observations.slice(0, 3).forEach(o => lines.push(`— ${o}`));
    }

    // ── Active alerts ──────────────────────────────────────────────────────────
    if (alerts.length > 0) {
      lines.push("ACTIVE ALERTS (unacknowledged)");
      alerts.forEach(a => {
        const minAgo = Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000);
        lines.push(`— [${a.severity.toUpperCase()}] ${a.message} (${minAgo}min ago)`);
      });
    }

    return lines.join("\n");
  } catch (err) {
    console.error("[getScanHistory] error:", err);
    return null;
  }
}
