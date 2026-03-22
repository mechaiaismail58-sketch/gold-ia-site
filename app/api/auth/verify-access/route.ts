import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body?.code;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Access code is required." }, { status: 400 });
    }

    // ── Get authenticated user ────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // ── Fetch hashed access code ──────────────────────────────────────────────
    // Try admin client first (no RLS issues), fall back to user-authenticated client
    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    const { data: profile, error: profileError } = await (dbClient as typeof supabase)
      .from("users")
      .select("hashed_access_code")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return NextResponse.json(
        { error: "Profile not found. Please delete and recreate your account.", profileNotFound: true },
        { status: 404 }
      );
    }

    // ── Compare codes ─────────────────────────────────────────────────────────
    const match = await bcrypt.compare(code.trim(), profile.hashed_access_code);

    if (!match) {
      return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });
    }

    // ── Set session cookie (session-only — expires when browser closes) ────────
    const response = NextResponse.json({ ok: true });
    response.cookies.set("bd_access_verified", "1", {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      // No maxAge → session cookie
    });

    return response;
  } catch (err) {
    console.error("Verify-access error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    );
  }
}
