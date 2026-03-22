import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ── POST — save one exchange ──────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const { session_id, mode, message_user, message_ia, image_attached } = body ?? {};

    if (!session_id || !message_user || !message_ia) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const db = createAdminClient() ?? supabase;
    const { error } = await (db as typeof supabase).from("conversations").insert({
      user_id: user.id,
      session_id,
      mode: mode ?? "deep",
      message_user: String(message_user).slice(0, 4000),
      message_ia:   String(message_ia).slice(0, 8000),
      image_attached: Boolean(image_attached),
    });

    if (error) {
      console.error("[conversations] insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("conversations POST error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ── GET — list sessions OR get messages for a session ─────────────────────────
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session");

    const db = createAdminClient() ?? supabase;

    // ── Load all messages for one session ──────────────────────────────────
    if (sessionId) {
      const { data, error } = await (db as typeof supabase)
        .from("conversations")
        .select("mode, message_user, message_ia, image_attached, created_at")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, exchanges: data ?? [] });
    }

    // ── List sessions (history panel) ─────────────────────────────────────
    // Fetch the 120 most recent rows, group by session_id client-side
    const { data, error } = await (db as typeof supabase)
      .from("conversations")
      .select("session_id, mode, message_user, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Deduplicate by session_id — keep the oldest entry per session (first message)
    const seen = new Set<string>();
    const sessions: { session_id: string; mode: string; first_message: string; created_at: string }[] = [];

    // Reverse so oldest comes first for correct "first_message" extraction
    for (const row of [...(data ?? [])].reverse()) {
      if (!seen.has(row.session_id)) {
        seen.add(row.session_id);
        sessions.push({
          session_id:    row.session_id,
          mode:          row.mode ?? "deep",
          first_message: (row.message_user ?? "").slice(0, 80),
          created_at:    row.created_at,
        });
      }
    }

    // Sort sessions newest-first
    sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    console.error("conversations GET error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
