import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { BETA_PROMPT } from "@/lib/prompts";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { resend } from "@/lib/resend";
import { morningBriefTemplate } from "@/lib/emails/templates";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" });
  }

  if (!resend) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" });
  }

  try {
    const ctx = await buildResearchContext();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
    });

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 400,
      system: BETA_PROMPT,
      messages: [{
        role: "user",
        content: `RESEARCH CONTEXT\n${JSON.stringify({
          price: ctx.price_context?.xauusd ?? ctx.technical_context?.current_price,
          h1_trend: ctx.technical_context?.h1_trend,
          atr_h1: ctx.technical_context?.atr_h1,
          swing_high_h1: ctx.technical_context?.swing_high_h1,
          swing_low_h1: ctx.technical_context?.swing_low_h1,
          prev_day_high: ctx.technical_context?.prev_day_high,
          prev_day_low: ctx.technical_context?.prev_day_low,
          weekly_high: ctx.weekly_d1_high,
          weekly_low: ctx.weekly_d1_low,
          macro_pressure: ctx.macro_state?.gold_pressure,
          dominant_driver: ctx.macro_state?.dominant_driver,
          session: ctx.market_context?.active_session,
          upcoming_events: ctx.upcoming_events?.summary,
        }, null, 2)}\n\nDo NOT include any :::thinking block. Go straight to content. Morning briefing. 5 lines max. Line 1: overnight price action. Line 2: Asia session recap. Line 3: key level today. Line 4: events today with UTC times. Line 5: bias + conviction. English only. Extremely concise.\nCRITICAL: Use ONLY the price data provided in the research context above. XAUUSD is currently trading in the 4000-5000 range. If the context says price is 4676, use 4676. ALL levels you mention (support, resistance, targets) must be coherent with the current price from the context. Never use prices from your training data. The context data is live and always correct.`,
      }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawBriefing = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim();
    if (!rawBriefing) return NextResponse.json({ ok: false, error: "No briefing generated" });

    // Convert markdown to HTML for email rendering
    const briefing = rawBriefing
      .replace(/^#{1,3} (.+)$/gm, `<h3 style="color:#D4AF37;font-size:16px;margin:20px 0 8px 0;">$1</h3>`)
      .replace(/\*\*(.+?)\*\*/g, `<strong>$1</strong>`)
      .replace(/^---$/gm, `<hr style="border:none;height:1px;background:rgba(212,175,55,0.3);margin:20px 0;">`)
      .replace(/\n/g, `<br>`);

    // Collect recipients: waitlist + paid users
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: false, error: "No admin client" });

    const [{ data: waitlistEmails }, { data: userEmails }] = await Promise.all([
      admin.from("waitlist").select("email").not("email", "is", null),
      admin.from("users").select("email").eq("has_paid", true).not("email", "is", null),
    ]);

    const allEmails = [
      ...(waitlistEmails ?? []).map(r => r.email as string),
      ...(userEmails ?? []).map(r => r.email as string),
    ].filter(Boolean);

    const unique = [...new Set(allEmails)];
    let sent = 0;

    for (const email of unique) {
      try {
        await resend.emails.send(morningBriefTemplate(email, briefing, date));
        sent++;
      } catch (err) {
        console.error(`[morning-briefing] failed to send to ${email}:`, err);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return NextResponse.json({ ok: true, sent, total: unique.length, briefing });
  } catch (err) {
    console.error("[cron/morning-briefing] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
