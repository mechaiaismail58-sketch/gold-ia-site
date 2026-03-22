import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    const { data: profile } = await (dbClient as typeof supabase)
      .from("users")
      .select("trading_horizon, account_size, experience_level, onboarding_completed")
      .eq("id", user.id)
      .single();

    return NextResponse.json({ ok: true, profile: profile ?? null });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { trading_horizon } = body ?? {};

    if (!["scalp", "daytrade", "swing"].includes(trading_horizon)) {
      return NextResponse.json({ error: "Invalid trading horizon." }, { status: 400 });
    }

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    const { error } = await (dbClient as typeof supabase)
      .from("users")
      .update({ trading_horizon })
      .eq("id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Profile route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
