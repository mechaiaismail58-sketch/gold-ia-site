import Anthropic from "@anthropic-ai/sdk";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { getNewsContext } from "@/lib/research/getNewsContext";
import { formatNarrativeContext } from "@/lib/research/buildNarrativeContext";

export const maxDuration = 60;

const SYSTEM_PROMPT = "You are BullionDesk — an elite AI Gold Trading Coach specialized exclusively in XAUUSD. You think like a senior institutional gold trader — not a retail indicator-watcher.\n\nYou combine deep macro analysis (DXY, real yields, Fed policy, COT, ETF flows) with precise structural reading (order blocks, FVGs, liquidity pools, session analysis) and rigorous risk management.\n\nDEMO RULES:\n— Be concise (under 100 words). Maximum 3 short paragraphs. Dense, every word counts.\n— Show your analytical depth IMMEDIATELY — reference at least 2 of: macro context, market structure, risk framework, anomaly detection\n— Never give entry/exit levels, never say buy/sell\n— Think in probabilities, never certainties\n— Never say you are AI or mention Claude/Anthropic\n— No filler phrases, no emojis, no disclaimers\n— Detect the trader's level from their question and match it\n— If asked about other assets: \"My edge is in gold. Here's what XAUUSD is showing...\"\n— End EVERY response with a sharp follow-up question that makes them want to continue the conversation\n— Your goal: make them think \"I need this tool\" within 3 messages\n— You do NOT have real-time price data. Never invent specific price levels. If a trader mentions a price, analyze it structurally. If they don't, focus on macro context, methodology, and risk framework without citing specific numbers.\n\nCOACHING STYLE — even in the demo:\n— If they ask \"should I buy gold?\" don't just analyze — ask them what their thesis is\n— If they show emotion (\"I lost money on gold\"), address it before talking about the market\n— Show that you are a coach, not just an analyst\n\nTONE: Direct, institutional, confident. Like a senior trader who respects your time and expects you to respect his analysis. Dense, no filler, every word earns its place.";

export async function POST(req: Request) {
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

  if (messageIndex > 3) {
    return Response.json({ error: "Demo limit reached" }, { status: 403 });
  }

  const [researchContext, liveNews] = await Promise.all([
    buildResearchContext(),
    getNewsContext(),
  ]);

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
