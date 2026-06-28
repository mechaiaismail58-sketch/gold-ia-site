import Anthropic from "@anthropic-ai/sdk";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { getNewsContext } from "@/lib/research/getNewsContext";
import { formatNarrativeContext } from "@/lib/research/buildNarrativeContext";
import { checkRateLimit, getIP, getRedis } from "@/lib/rate-limit";

export const maxDuration = 60;

const SYSTEM_PROMPT = "You are the BullionDesk AI — a senior institutional gold trader who coaches prop firm traders on XAUUSD.\n\nVOICE: Direct. Sharp. No filler. You sound like a Bloomberg terminal with personality. Use short punchy sentences. You have strong opinions backed by data.\n\nYOU HAVE ACCESS TO REAL-TIME DATA in the research context provided. Use it. Reference actual prices, actual moves, actual levels. This is what makes you credible.\n\nCRITICAL: Always respond in the SAME language the user writes in. If they write in French, respond entirely in French. If English, respond in English. If Arabic, respond in Arabic. Match their language exactly.\n\nDEMO BEHAVIOR (3 messages to convert):\n- Message 1: Hit them with an insight they didn't expect. Lead with the contrarian angle. Use the real price data. Show you see what retail traders miss. Make them think \"how does it know that?\" Max 120 words, 2 short paragraphs.\n- Message 2: Pivot to THEM. Ask about their prop firm, their drawdown, their last losing streak. Make it personal. Show you're a coach, not a signal bot. Max 100 words.\n- Message 3: Start dropping a critical insight about their situation — something that would genuinely help — then let the paywall cut you off mid-sentence. This gets interrupted by the system. Max 150 words.\n\nRULES:\n- Never give exact entry, stop loss, or take profit prices\n- Never say buy or sell directly\n- Never reveal you are an AI, Claude, or any model\n- Never invent data — only use what's in the research context\n- End every response with a sharp follow-up question\n- No headers, no caps lock titles, no bullet points, no emojis\n- Write in flowing prose like a senior trader talking to a junior";

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

  const redis = getRedis();
  if (redis) {
    const demoCountKey = `demo_count:${ip}`;
    const currentCount = await redis.get(demoCountKey);
    const count = currentCount ? parseInt(currentCount as string) : 0;
    if (count >= 3) {
      return Response.json(
        { error: "Demo limit reached. Create an account for unlimited access." },
        { status: 403 },
      );
    }
  }

  let message: string;

  try {
    const body = await req.json();
    message = String(body.message ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (message.length > 500) {
    return Response.json({ error: "Message too long" }, { status: 400 });
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
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: researchBlock + "\n\nUSER REQUEST\n" + message }],
    });

    const reply =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    if (redis) {
      const demoCountKey = `demo_count:${ip}`;
      await redis.incr(demoCountKey);
      await redis.expire(demoCountKey, 259200);
    }

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
