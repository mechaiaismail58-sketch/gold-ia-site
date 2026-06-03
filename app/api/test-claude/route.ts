export const maxDuration = 30;

import Anthropic from "@anthropic-ai/sdk";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "Not available" }, { status: 404 });
  const secret = req.headers.get("x-admin-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const t0 = Date.now();
  const steps: string[] = [];

  try {
    // Step 1: Check env var
    const keyPresent = !!process.env.ANTHROPIC_API_KEY;
    const keyLength = process.env.ANTHROPIC_API_KEY?.length ?? 0;
    const keyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 10) ?? "MISSING";
    steps.push(`[1] key present=${keyPresent} len=${keyLength} prefix=${keyPrefix}...`);

    if (!keyPresent) {
      return Response.json({ ok: false, steps, error: "No API key" });
    }

    // Step 2: Create client
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    steps.push(`[2] client created in ${Date.now() - t0}ms`);

    // Step 3: Minimal API call — simplest possible request
    const t1 = Date.now();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say OK" }],
    });
    steps.push(`[3] API responded in ${Date.now() - t1}ms`);

    // Step 4: Extract text
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    steps.push(`[4] text="${text}" stop_reason=${response.stop_reason}`);

    return Response.json({
      ok: true,
      steps,
      text,
      total_ms: Date.now() - t0,
      model: response.model,
      usage: response.usage,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: { type?: string } };
    steps.push(`[ERROR] status=${e?.status} message=${e?.message?.slice(0, 200)} type=${e?.error?.type}`);
    return Response.json({
      ok: false,
      steps,
      total_ms: Date.now() - t0,
      error: e?.message?.slice(0, 300) ?? String(err),
    });
  }
}
