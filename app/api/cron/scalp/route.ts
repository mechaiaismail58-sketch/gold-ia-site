import { NextResponse } from "next/server";
import { runCronAnalysis } from "@/lib/cronAnalysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCronAnalysis("scalp");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/scalp] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
