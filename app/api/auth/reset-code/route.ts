import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
    const { accessCode, confirmCode } = body ?? {};

    if (!accessCode || typeof accessCode !== "string") {
      return NextResponse.json({ error: "Access code is required." }, { status: 400 });
    }
    if (accessCode !== confirmCode) {
      return NextResponse.json({ error: "Codes do not match." }, { status: 400 });
    }
    if (accessCode.length < 3) {
      return NextResponse.json({ error: "Code too short (min. 3 characters)." }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(accessCode)) {
      return NextResponse.json({ error: "Code must contain at least one letter." }, { status: 400 });
    }
    if (!/[0-9]/.test(accessCode)) {
      return NextResponse.json({ error: "Code must contain at least one digit." }, { status: 400 });
    }
    if (!/[^a-zA-Z0-9]/.test(accessCode)) {
      return NextResponse.json({ error: "Code must contain at least one special character." }, { status: 400 });
    }

    const hashedAccessCode = await bcrypt.hash(accessCode.trim(), 12);

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    const { error } = await (dbClient as typeof supabase)
      .from("users")
      .update({ hashed_access_code: hashedAccessCode })
      .eq("id", user.id);

    if (error) {
      console.error("Reset code error:", error);
      return NextResponse.json({ error: "Code update failed." }, { status: 500 });
    }

    // Grant access
    const response = NextResponse.json({ ok: true });
    response.cookies.set("bd_access_verified", "1", {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (err) {
    console.error("Reset code error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
