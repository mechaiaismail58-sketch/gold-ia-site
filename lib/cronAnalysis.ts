import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import type { EnrichedResearchContext } from "@/lib/research/buildResearchContext";
import { sendPushNotification } from "@/lib/pushNotifications";
import { sendTradeAlertEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

export type CronMode = "scalp" | "swing";

function extractTradeFields(text: string): {
  decision: string;
  entry: string | null;
  tp1: string | null;
  tp2: string | null;
  invalidation: string | null;
  score: string | null;
  direction: "LONG" | "SHORT" | null;
} {
  const upper = text.toUpperCase();
  const isLong = upper.includes("YES LONG") || upper.includes("DIRECTION: LONG") || upper.includes("BIAS: LONG");
  const isShort = upper.includes("YES SHORT") || upper.includes("DIRECTION: SHORT") || upper.includes("BIAS: SHORT");
  const isNo = upper.includes("PERMISSION = NO") || upper.includes("STAND ASIDE") || upper.includes("NO —") || upper.includes("NO TRADE");

  const direction = isLong ? "LONG" : isShort ? "SHORT" : null;
  const decision = isLong ? "YES LONG" : isShort ? "YES SHORT" : isNo ? "NO" : "ANALYSIS";

  const extract = (pattern: RegExp) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : null;
  };

  const entry = extract(/entry[:\s]+\$?([\d,. ]+)/i) ?? extract(/entry zone[:\s]+\$?([\d,. ]+)/i);
  const tp1 = extract(/tp1[:\s]+\$?([\d,. ]+)/i) ?? extract(/target 1[:\s]+\$?([\d,. ]+)/i);
  const tp2 = extract(/tp2[:\s]+\$?([\d,. ]+)/i) ?? extract(/target 2[:\s]+\$?([\d,. ]+)/i);
  const invalidation = extract(/invalidation[:\s]+\$?([\d,. ]+)/i) ?? extract(/sl[:\s]+\$?([\d,. ]+)/i) ?? extract(/stop[:\s]+\$?([\d,. ]+)/i);
  const score = extract(/score[:\s]+([\d]+(?:\/100)?)/i) ?? extract(/conviction[:\s]+([\d]+(?:\/100)?)/i);

  return { decision, entry, tp1, tp2, invalidation, score, direction };
}

function serializeCronContext(ctx: EnrichedResearchContext): string {
  const lines: string[] = [];
  const pc = ctx.price_context;
  if (pc?.xauusd) lines.push(`XAUUSD: ${pc.xauusd.toFixed(2)}`);
  if (pc?.dxy) lines.push(`DXY: ${pc.dxy.toFixed(2)}`);

  const tc = ctx.technical_context;
  if (tc) {
    if (tc.current_price) lines.push(`Price: ${tc.current_price.toFixed(2)}`);
    if (tc.h1_trend) lines.push(`H1 Trend: ${tc.h1_trend}`);
    if (tc.m30_structure) lines.push(`M30: ${tc.m30_structure}`);
    if (tc.range_position_pct != null) lines.push(`Range pos: ${tc.range_position_pct.toFixed(0)}%`);
    if (tc.atr_h1 != null) lines.push(`ATR H1: ${tc.atr_h1.toFixed(1)}`);
    if (tc.fvg_bullish_h1) lines.push(`FVG Bull H1: ${tc.fvg_bullish_h1.low.toFixed(2)}-${tc.fvg_bullish_h1.high.toFixed(2)}`);
    if (tc.fvg_bearish_h1) lines.push(`FVG Bear H1: ${tc.fvg_bearish_h1.low.toFixed(2)}-${tc.fvg_bearish_h1.high.toFixed(2)}`);
    if (tc.orderblock_bullish_h1) lines.push(`OB Bull H1: ${tc.orderblock_bullish_h1.low.toFixed(2)}-${tc.orderblock_bullish_h1.high.toFixed(2)}`);
    if (tc.orderblock_bearish_h1) lines.push(`OB Bear H1: ${tc.orderblock_bearish_h1.low.toFixed(2)}-${tc.orderblock_bearish_h1.high.toFixed(2)}`);
    if (tc.swing_high_h1) lines.push(`Swing High H1: ${tc.swing_high_h1.toFixed(2)}`);
    if (tc.swing_low_h1) lines.push(`Swing Low H1: ${tc.swing_low_h1.toFixed(2)}`);
    if (tc.prev_day_high) lines.push(`PDH: ${tc.prev_day_high.toFixed(2)}`);
    if (tc.prev_day_low) lines.push(`PDL: ${tc.prev_day_low.toFixed(2)}`);
    if (tc.volatility_state) lines.push(`Volatility: ${tc.volatility_state}`);
  }

  const mc = ctx.macro_context;
  if (mc?.us10y) lines.push(`US10Y: ${mc.us10y.toFixed(2)}% (${mc.us10y_direction})`);
  if (mc?.real_yield_10y) lines.push(`Real Yield: ${mc.real_yield_10y.toFixed(2)}%`);

  const ms = ctx.macro_state;
  if (ms?.gold_pressure && ms.gold_pressure !== "Data not found") lines.push(`Gold pressure: ${ms.gold_pressure}`);

  const mkt = ctx.market_context;
  if (mkt) lines.push(`Market: ${mkt.market_status} | Session: ${mkt.active_session}`);

  if (ctx.cot_context?.summary) lines.push(`COT: ${ctx.cot_context.summary}`);
  if (ctx.intermarket_context?.summary) lines.push(`Intermarket: ${ctx.intermarket_context.summary}`);
  if (ctx.etf_flows?.summary) lines.push(`ETF: ${ctx.etf_flows.summary}`);
  if (ctx.oi_signal?.note) lines.push(`OI: ${ctx.oi_signal.note}`);

  const ic = ctx.indicator_context;
  if (ic?.summary) lines.push(`Indicators: ${ic.summary}`);

  if (ctx.upcoming_events?.summary) lines.push(`Events: ${ctx.upcoming_events.summary}`);

  return lines.join("\n");
}

export async function runCronAnalysis(mode: CronMode) {
  // Build context
  const rawContext = await buildResearchContext();
  const context = serializeCronContext(rawContext);
  const horizon = mode === "scalp" ? "scalp" : "swing";

  const userMessage = mode === "scalp"
    ? `Run a full scalp trade analysis for XAUUSD right now. Use H1/M30 data, FVG, Order Blocks, current session liquidity. Give entry, TP1, TP2, invalidation if trade is valid.`
    : `Run a full swing trade analysis for XAUUSD. Use D1/H4 structure, macro context, weekly levels. Give entry, TP1, TP2, invalidation if trade is valid.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `${context}\n\n${userMessage}` }],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseText = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim();
  const { decision, entry, tp1, tp2, invalidation, score, direction } = extractTradeFields(responseText);

  // Only send push if it's a valid trade signal with levels
  if (!direction || !entry || !tp1 || !tp2) {
    console.log(`[cron/${mode}] No valid trade signal — decision: ${decision}`);
    return { sent: 0, decision };
  }

  // Build notification payload
  const title = `BULLION DESK — ${direction} XAUUSD`;
  const scoreText = score ? ` · Score ${score}` : "";
  const body = `Entry ${entry} · TP1 ${tp1} · TP2 ${tp2} · SL ${invalidation ?? "—"}${scoreText}`;

  console.log(`[cron/${mode}] Signal: ${title} | ${body}`);

  // Fetch subscriptions for users with relevant alert enabled
  const admin = createAdminClient();
  if (!admin) {
    console.error("[cron] No admin client");
    return { sent: 0, decision };
  }

  const alertCol = mode === "scalp" ? "scalp_alerts" : "swing_alerts";
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("subscription, user_id")
    .eq(alertCol, true);

  if (error || !subs?.length) {
    console.log(`[cron/${mode}] No subscribers`);
    return { sent: 0, decision };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gold-ia-site.vercel.app";
  let sent = 0;
  const expired: string[] = [];

  for (const row of subs) {
    const ok = await sendPushNotification(row.subscription as any, {
      title,
      body,
      url: siteUrl,
    });
    if (ok) {
      sent++;
    } else {
      expired.push(row.user_id);
    }
  }

  // Clean up expired subscriptions
  if (expired.length) {
    await admin.from("push_subscriptions").delete().in("user_id", expired);
  }

  // Save analysis to DB
  await admin.from("ai_analyses").insert({
    user_id: subs[0]?.user_id ?? null,
    mode: horizon,
    analysis_mode: "deep",
    decision,
    summary: body,
  }).select().single();

  // Send email alerts to subscribed users
  {
    const userIds = subs.map((s) => s.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from("users")
        .select("email")
        .in("id", userIds);

      for (const u of users ?? []) {
        if (u.email) {
          sendTradeAlertEmail({
            email: u.email,
            direction: direction!,
            mode,
            entry: entry!,
            tp1: tp1!,
            tp2: tp2!,
            invalidation,
            score,
          }).catch(() => {});
        }
      }
    }
  }

  console.log(`[cron/${mode}] Pushed to ${sent}/${subs.length} subscribers`);
  return { sent, decision };
}
