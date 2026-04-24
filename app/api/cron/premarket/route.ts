import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { sendPreMarketEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const ctx = await buildResearchContext();
    const goldPrice = ctx.price_context?.xauusd ?? ctx.technical_context?.current_price ?? null;
    const bias = ctx.technical_state?.bias !== "Data not found" ? ctx.technical_state?.bias : null;

    const userMsg = `Generate a concise pre-market gold brief for ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })} UTC. Keep it to 3-5 paragraphs: key levels for today, macro context, technical structure, and main watch points. Institutional tone. No emojis.`;

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${goldPrice ? `XAUUSD: ${goldPrice.toFixed(2)}\n` : ""}H1 Trend: ${ctx.technical_context?.h1_trend ?? "—"}\nM30: ${ctx.technical_context?.m30_structure ?? "—"}\nMacro: ${ctx.macro_state?.gold_pressure ?? "—"}\n\n${userMsg}`,
        },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brief = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim();
    if (!brief) return NextResponse.json({ ok: false, error: "No brief generated" });

    // Fetch all users who have email
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: false, error: "No admin client" });

    const { data: users } = await admin.from("users").select("email").not("email", "is", null);

    let sent = 0;
    for (const u of users ?? []) {
      if (u.email) {
        await sendPreMarketEmail({
          email: u.email,
          brief,
          goldPrice,
          bias: bias ?? undefined,
        });
        sent++;
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[cron/premarket] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
