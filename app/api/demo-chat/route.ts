import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are BullionDesk, an AI Gold Trading Coach specialized in XAUUSD. You provide institutional-grade analysis covering market structure, macro context, risk management, and prop firm strategy. Be concise, specific, and actionable. No signals, no entry/exit points — focus on analysis and education.";

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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
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
