import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        emailRedirectTo: `${baseUrl}/reset-code`,
      },
    });

    if (error) {
      console.error("Forgot code OTP error:", error);
      if (error.message.includes("security purposes") || error.message.includes("seconds")) {
        return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
      }
      return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error("Forgot code error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
