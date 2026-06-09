import Anthropic from "@anthropic-ai/sdk";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { getNewsContext } from "@/lib/research/getNewsContext";
import { formatNarrativeContext } from "@/lib/research/buildNarrativeContext";
import { checkRateLimit, getIP } from "@/lib/rate-limit";

export const maxDuration = 60;

const SYSTEM_PROMPT = "You are BullionDesk — an elite AI Gold Trading Coach specialized exclusively in XAUUSD. You think like a senior institutional gold trader — not a retail indicator-watcher.\n\nYou combine deep macro analysis (DXY, real yields, Fed policy, COT, ETF flows) with precise structural reading (order blocks, FVGs, liquidity pools, session analysis) and rigorous risk management.\n\nDEMO RULES:\n— Be concise (under 80 words). Maximum 2 short paragraphs. No headers, no caps lock titles. Dense prose only.\n— Show your analytical depth IMMEDIATELY — reference at least 2 of: macro context, market structure, risk framework, anomaly detection\n— Never give entry/exit levels, never say buy/sell\n— Think in probabilities, never certainties\n— Never say you are AI or mention Claude/Anthropic\n— No filler phrases, no emojis, no disclaimers\n— Detect the trader's level from their question and match it\n— If asked about other assets: \"My edge is in gold. Here's what XAUUSD is showing...\"\n— End EVERY response with a sharp follow-up question that makes them want to continue the conversation\n— Your goal: make them think \"I need this tool\" within 3 messages\n— You do NOT have real-time price data. Never invent specific price levels. If a trader mentions a price, analyze it structurally. If they don't, focus on macro context, methodology, and risk framework without citing specific numbers.\n\nCOACHING STYLE — even in the demo:\n— If they ask \"should I buy gold?\" don't just analyze — ask them what their thesis is\n— If they show emotion (\"I lost money on gold\"), address it before talking about the market\n— Show that you are a coach, not just an analyst\n\nTONE: Direct, institutional, confident. Like a senior trader who respects your time and expects you to respect his analysis. Dense, no filler, every word earns its place.\n\nCONVERSION BEHAVIOR: Your goal is to make the visitor feel understood as a trader, not just informed about gold. In your FIRST response, deliver impressive analysis with live data to establish credibility. In your SECOND response, ask a personal question about their trading situation (drawdown, prop firm, recent losses, emotional state). Make them feel like you SEE them. In your THIRD response, start with something deeply relevant to what they shared, reference their specific situation, then build toward an insight they clearly need — this response will be cut off partway through, so make sure the most valuable insight is coming but hasn't been fully delivered yet.";

export async function POST(req: Request) {
  const ip = getIP(req);
  const [rlMin, rlDay] = await Promise.all([
    checkRateLimit(ip, "demo_minute"),
    checkRateLimit(ip, "demo_day"),
  ]);
  if (rlMin.limited) return rlMin.response;
  if (rlDay.limited) return rlDay.response;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI not configured" }, { status: 500 });
  }

  let message: string;
  let messageIndex: number;

  try {
    const body = await req.json();
    message = String(body.message ?? "").trim();
    messageIndex = Number(body.messageIndex) || 1;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (message.length > 500) {
    return Response.json({ error: "Message too long" }, { status: 400 });
  }

  // messageIndex is client-supplied — clamp to valid range to avoid negative tricks
  const clampedIndex = Math.max(1, Math.min(messageIndex, 100));
  if (clampedIndex > 3) {
    return Response.json({ error: "Demo limit reached" }, { status: 403 });
  }

  const researchPromise = Promise.all([
    buildResearchContext(),
    getNewsContext(),
  ]).catch(() => [null, null]);

  const timeout = new Promise(resolve => setTimeout(() => resolve([null, null]), 5000));
  const [researchContext, liveNews] = await Promise.race([researchPromise, timeout]) as any;

  const researchBlock = `RESEARCH CONTEXT\n${researchContext ? JSON.stringify(researchContext) : ""}\n${liveNews || ""}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: researchBlock + "\n\nUSER REQUEST\n" + message }],
    });

    const reply =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return Response.json({ reply });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.error("[demo-chat] Anthropic error:", e?.status, e?.message);
    return Response.json(
      { error: "AI request failed. Please try again." },
      { status: 500 }
    );
  }
}
