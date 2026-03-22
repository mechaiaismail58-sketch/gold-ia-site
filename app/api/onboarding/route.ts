import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_HORIZONS = ["scalp", "daytrade", "swing"] as const;
const VALID_ACCOUNT_SIZES = ["under_5k", "5k_25k", "25k_100k", "100k_plus"] as const;
const VALID_EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { trading_horizon, account_size, experience_level } = body ?? {};

    if (!VALID_HORIZONS.includes(trading_horizon)) {
      return NextResponse.json({ error: "Invalid trading horizon." }, { status: 400 });
    }
    if (!VALID_ACCOUNT_SIZES.includes(account_size)) {
      return NextResponse.json({ error: "Invalid account size." }, { status: 400 });
    }
    if (!VALID_EXPERIENCE_LEVELS.includes(experience_level)) {
      return NextResponse.json({ error: "Invalid experience level." }, { status: 400 });
    }

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    const { error } = await (dbClient as typeof supabase)
      .from("users")
      .update({
        trading_horizon,
        trading_style:  trading_horizon, // mirror — trading_style is the AI-facing alias
        account_size,
        experience_level,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Onboarding save error:", error);
      return NextResponse.json({ error: "Failed to save onboarding data." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Onboarding route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
