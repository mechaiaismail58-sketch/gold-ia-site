import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getIP } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(getIP(req), "login");
    if (rl.limited) return rl.response;
  } catch {
    // Upstash unreachable or slow — let the request through rather than blocking login
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      console.error("Login Supabase error:", error?.message, error?.status);
      let msg = "Invalid email or password.";
      if (error?.message?.toLowerCase().includes("email not confirmed")) {
        msg = "Email not confirmed. Check your inbox.";
      } else if (error?.message?.toLowerCase().includes("invalid login")) {
        msg = "Invalid email or password.";
      } else if (error?.message) {
        msg = error.message;
      }
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
