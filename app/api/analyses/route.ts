import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { mode, analysis_mode, decision, summary } = body ?? {};

    const admin = createAdminClient();
    const db = admin ?? supabase;

    const { error } = await (db as typeof supabase)
      .from("ai_analyses")
      .insert({ user_id: user.id, mode, analysis_mode, decision, summary });

    if (error) {
      console.error("[analyses] Supabase insert error:", error.code, error.message, error.details);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Analyses route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
