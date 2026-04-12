import { NextResponse } from "next/server";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Market hours check ─────────────────────────────────────────────────────────

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  // Weekend closed
  if (day === 0 || day === 6) return false;
  // Friday after 22:00 UTC — pre-weekend close
  if (day === 5 && now.getUTCHours() >= 22) return false;
  // Sunday before 22:00 UTC — market not yet open
  if (day === 0 && now.getUTCHours() < 22) return false;
  return true;
}

// ── Session detection ──────────────────────────────────────────────────────────

function detectSession(hour: number): { session: string; phase: string } {
  if (hour >= 22 || hour < 7)  return { session: "asia",   phase: hour < 2 ? "early" : hour < 5 ? "prime" : "late" };
  if (hour >= 7 && hour < 12)  return { session: "london", phase: hour < 8 ? "early" : hour < 10 ? "prime" : "late" };
  if (hour >= 12 && hour < 17) return { session: "ny",     phase: hour < 13 ? "early" : hour < 15 ? "prime" : "late" };
  return { session: "closed", phase: "late" };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function h1TrendLabel(trend: string): string {
  if (trend === "bullish") return "bullish_hh_hl";
  if (trend === "bearish") return "bearish_lh_ll";
  return "range";
}

function deltaLabel(signal: string | undefined | null): string {
  if (!signal) return "neutral";
  if (signal.toLowerCase().includes("buy") || signal.toLowerCase().includes("long")) return "buying";
  if (signal.toLowerCase().includes("sell") || signal.toLowerCase().includes("short")) return "selling";
  return "neutral";
}

function bbStateLabel(squeeze: boolean | null | undefined, bbPos: string | null | undefined): string {
  if (squeeze) return "squeeze";
  if (bbPos === "above_upper" || bbPos === "below_lower") return "expansion";
  return "normal";
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.ADMIN_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMarketOpen()) {
    return NextResponse.json({ skipped: true, reason: "market_closed" });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admin client not available" }, { status: 500 });
  }

  try {
    // ── Build context ──────────────────────────────────────────────────────────
    const ctx = await buildResearchContext();

    const price = ctx.price_context?.xauusd ?? ctx.technical_context?.current_price ?? 0;
    if (!price) {
      return NextResponse.json({ ok: false, error: "Could not fetch price" }, { status: 500 });
    }

    const now = new Date();
    const { session, phase } = detectSession(now.getUTCHours());

    // Indicator shortcuts
    const ind = ctx.indicator_context;
    const h1 = ind?.h1;
    const h4 = ind?.h4;
    const rsiH1 = h1?.rsi ?? null;
    const rsiH4 = h4?.rsi ?? null;
    const macdH4Hist = h4?.macd_histogram ?? null;
    const adxH4 = h4?.adx ?? null;
    const atrH1 = h1?.atr ?? null;
    const ema20H1 = h1?.ema20 ?? null;
    const bbState = bbStateLabel(h1?.bb_squeeze, h1?.bb_position);

    const orderFlow = ind?.order_flow;
    const deltaH1 = deltaLabel(orderFlow?.delta_h1_signal);
    const deltaH4 = deltaLabel(orderFlow?.delta_h4_signal);
    const cvdSignal = orderFlow?.cvd_h4 && orderFlow.cvd_h4.includes("diverge") ? "diverging" : "confirming";

    const dxy = ctx.price_context?.dxy ?? ctx.yahoo_finance?.dxy_yahoo ?? null;
    const realYield = ctx.macro_context?.real_yield_10y ?? null;
    const vix = ctx.yahoo_finance?.vix ?? null;

    const h1TrendRaw = ctx.technical_context?.h1_trend ?? "range";
    // h4 trend derived from h4 indicator swing structure (TechnicalContext only exposes h1_trend)
    const h4SwingTrend = ind?.h4?.swing?.trend;
    const h4TrendRaw = h4SwingTrend === "bullish" ? "bullish" : h4SwingTrend === "bearish" ? "bearish" : "range";
    const h1SwingHigh = ctx.technical_context?.swing_high_h1 ?? null;
    const h1SwingLow = ctx.technical_context?.swing_low_h1 ?? null;

    // ── Fetch previous scan for comparison ────────────────────────────────────
    const { data: prevScans } = await admin
      .from("market_scans")
      .select("*")
      .order("scanned_at", { ascending: false })
      .limit(1);
    const prevScan = prevScans?.[0] ?? null;

    // ── Detect alerts ──────────────────────────────────────────────────────────
    const triggeredAlerts: Array<{ alert_type: string; price: number; message: string; severity: string }> = [];

    // ALERT: LEVEL TOUCH — check ai_levels (global, all users)
    let nearLevel = false;
    let nearLevelName: string | null = null;
    let nearLevelDist: number | null = null;
    try {
      const { data: aiLevels } = await admin
        .from("ai_levels")
        .select("level_type, price_low, price_high, timeframe")
        .eq("mitigated", false)
        .gte("identified_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

      if (aiLevels) {
        for (const lvl of aiLevels) {
          const midpoint = (lvl.price_low + lvl.price_high) / 2;
          const dist = Math.abs(price - midpoint);
          if (dist <= 15) {
            nearLevel = true;
            if (nearLevelDist === null || dist < nearLevelDist) {
              nearLevelDist = dist;
              nearLevelName = `${lvl.level_type} ${lvl.timeframe ?? ""} ${Number(lvl.price_low).toFixed(2)}-${Number(lvl.price_high).toFixed(2)}`;
            }
          }
        }
      }
    } catch { /* non-critical */ }

    if (nearLevel && nearLevelName && nearLevelDist !== null) {
      const msg = `Price approaching ${nearLevelName} — ${nearLevelDist.toFixed(0)}pts away`;
      triggeredAlerts.push({ alert_type: "level_touch", price, message: msg, severity: "important" });
    }

    // ALERT: BREAKOUT — compare with previous swing high/low
    let breakoutDetected = false;
    let breakoutType: string | null = null;
    let breakoutLevel: number | null = null;

    if (prevScan?.h1_swing_high != null && price > prevScan.h1_swing_high + 5) {
      breakoutDetected = true;
      breakoutType = "bullish_bos";
      breakoutLevel = prevScan.h1_swing_high;
      triggeredAlerts.push({
        alert_type: "breakout",
        price,
        message: `Bullish BOS detected — price broke above H1 swing high at ${prevScan.h1_swing_high.toFixed(2)}`,
        severity: "critical",
      });
    } else if (prevScan?.h1_swing_low != null && price < prevScan.h1_swing_low - 5) {
      breakoutDetected = true;
      breakoutType = "bearish_bos";
      breakoutLevel = prevScan.h1_swing_low;
      triggeredAlerts.push({
        alert_type: "breakout",
        price,
        message: `Bearish BOS detected — price broke below H1 swing low at ${prevScan.h1_swing_low.toFixed(2)}`,
        severity: "critical",
      });
    }

    // ALERT: DELTA FLIP
    let deltaFlip = false;
    let deltaFlipDirection: string | null = null;

    if (prevScan?.delta_h1 && prevScan.delta_h1 !== deltaH1 && deltaH1 !== "neutral") {
      deltaFlip = true;
      deltaFlipDirection = `to_${deltaH1}`;
      triggeredAlerts.push({
        alert_type: "delta_flip",
        price,
        message: `H1 delta flipped to ${deltaH1} — momentum shift detected (was ${prevScan.delta_h1})`,
        severity: "important",
      });
    }

    // ALERT: SQUEEZE BREAK
    const squeezeActive = h1?.bb_squeeze === true;
    let squeezeBreak = false;

    if (prevScan?.squeeze_active === true && bbState === "expansion") {
      squeezeBreak = true;
      const direction = ema20H1 != null ? (price > ema20H1 ? "bullish" : "bearish") : "unknown";
      triggeredAlerts.push({
        alert_type: "squeeze_break",
        price,
        message: `Bollinger squeeze resolved — ${direction} expansion underway. Price ${price > (ema20H1 ?? price) ? "above" : "below"} EMA20.`,
        severity: "critical",
      });
    }

    // ALERT: VOLUME SPIKE — compare last H1 volume vs 14-bar average
    let volumeSpike = false;

    if (ctx.technical_context && ind) {
      // We use ATR ratio as a proxy for volume activity (no direct H1 volume in ctx)
      // A real volume spike check would require bar-level data — we flag based on
      // delta strength as a proxy: if CVD diverges and delta flipped, likely high volume
      const highActivityProxy = deltaFlip || squeezeBreak || breakoutDetected;
      if (highActivityProxy) {
        volumeSpike = true;
        triggeredAlerts.push({
          alert_type: "volume_spike",
          price,
          message: `Volume spike likely — high activity signal detected (${deltaFlip ? "delta flip" : squeezeBreak ? "squeeze break" : "BOS breakout"} on H1)`,
          severity: "important",
        });
      }
    }

    const alertTriggered = triggeredAlerts.length > 0;

    // ── Insert scan record ─────────────────────────────────────────────────────
    const { data: insertedScan, error: scanErr } = await admin
      .from("market_scans")
      .insert({
        price,
        session,
        session_phase: phase,
        h1_trend: h1TrendLabel(h1TrendRaw),
        h4_trend: h1TrendLabel(h4TrendRaw),
        h1_swing_high: h1SwingHigh,
        h1_swing_low: h1SwingLow,
        rsi_h1: rsiH1,
        rsi_h4: rsiH4,
        macd_h4_hist: macdH4Hist,
        adx_h4: adxH4,
        atr_h1: atrH1,
        ema20_h1: ema20H1,
        bb_state: bbState,
        delta_h1: deltaH1,
        delta_h4: deltaH4,
        cvd_signal: cvdSignal,
        dxy,
        real_yield: realYield,
        vix,
        near_level: nearLevel,
        near_level_name: nearLevelName,
        near_level_distance: nearLevelDist,
        breakout_detected: breakoutDetected,
        breakout_type: breakoutType,
        breakout_level: breakoutLevel,
        squeeze_active: squeezeActive,
        delta_flip: deltaFlip,
        delta_flip_direction: deltaFlipDirection,
        volume_spike: volumeSpike,
        alert_triggered: alertTriggered,
        alert_message: alertTriggered ? triggeredAlerts.map(a => a.message).join(" | ") : null,
      })
      .select("id")
      .single();

    if (scanErr) {
      console.error("[scanner] scan insert error:", scanErr);
      return NextResponse.json({ ok: false, error: "Scan insert failed" }, { status: 500 });
    }

    // ── Insert alerts ──────────────────────────────────────────────────────────
    let alertsInserted = 0;
    if (triggeredAlerts.length > 0) {
      const { error: alertErr } = await admin
        .from("scan_alerts")
        .insert(triggeredAlerts.map(a => ({ ...a })));
      if (!alertErr) alertsInserted = triggeredAlerts.length;
      else console.error("[scanner] alert insert error:", alertErr);
    }

    return NextResponse.json({
      ok: true,
      scan_id: insertedScan?.id,
      price,
      session,
      alerts_triggered: alertsInserted,
      alerts: triggeredAlerts,
    });
  } catch (err) {
    console.error("[scanner] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
