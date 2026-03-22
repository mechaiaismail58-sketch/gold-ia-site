import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Create auth user
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: authData, error: authError } = await anonClient.auth.signUp({ email, password });

    if (authError) {
      let msg = authError.message;
      if (msg.includes("already registered") || msg.includes("User already registered")) {
        msg = "An account with this email already exists.";
      } else if (msg.includes("security purposes") || msg.includes("seconds")) {
        msg = "Too many attempts. Please wait a moment.";
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Account could not be created." }, { status: 500 });
    }

    // Duplicate email detection
    if (!authData.user.identities || authData.user.identities.length === 0) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
    }

    const userId = authData.user.id;

    // Create profile row using admin client
    const admin = createAdminClient();
    if (admin) {
      const { error: insertError } = await admin.from("users").upsert({
        id: userId,
        email,
        trading_horizon: "daytrade",
      });
      if (insertError) {
        console.error("Signup insert error:", insertError);
        // Don't block signup if profile insert fails — user can still log in
      }
    }

    // Send welcome email (fire-and-forget — don't block signup)
    sendWelcomeEmail(email).catch(() => {});

    // If no session returned → email confirmation required
    if (!authData.session) {
      return NextResponse.json({
        ok: true,
        needsEmailConfirmation: true,
        message: "Account created. Check your email to confirm, then sign in.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    );
  }
}
