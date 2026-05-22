import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_ACCOUNT_TYPES    = ["prop_firm", "personal", "both"] as const;
const VALID_ACCOUNT_SIZES    = ["under_5k", "5k_25k", "25k_100k", "100k_plus"] as const;
const VALID_EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
const VALID_PROP_FIRM_PHASES  = ["challenge_1", "challenge_2", "funded", "personal"] as const;
const VALID_PRIMARY_ASSETS   = ["forex", "metals", "indices", "futures", "energy", "crypto"] as const;
const VALID_HORIZONS         = ["scalp", "daytrade", "swing"] as const;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const {
      account_type,
      prop_firm,
      prop_firm_phase,
      account_size,
      primary_assets,
      experience_level,
      trading_horizon,
    } = body ?? {};

    if (!VALID_ACCOUNT_SIZES.includes(account_size)) {
      return NextResponse.json({ error: "Invalid account size." }, { status: 400 });
    }
    if (!VALID_EXPERIENCE_LEVELS.includes(experience_level)) {
      return NextResponse.json({ error: "Invalid experience level." }, { status: 400 });
    }

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    const updatePayload: Record<string, unknown> = {
      account_size,
      experience_level,
      onboarding_completed: true,
      trading_horizon: VALID_HORIZONS.includes(trading_horizon) ? trading_horizon : "daytrade",
      trading_style: VALID_HORIZONS.includes(trading_horizon) ? trading_horizon : "daytrade",
    };

    if (VALID_ACCOUNT_TYPES.includes(account_type)) {
      updatePayload.account_type = account_type;
    }
    if (typeof prop_firm === "string" && prop_firm.length > 0) {
      updatePayload.prop_firm = prop_firm;
    }
    if (VALID_PROP_FIRM_PHASES.includes(prop_firm_phase)) {
      updatePayload.prop_firm_phase = prop_firm_phase;
    }
    if (Array.isArray(primary_assets) && primary_assets.every((a: unknown) => VALID_PRIMARY_ASSETS.includes(a as never))) {
      updatePayload.primary_assets = primary_assets;
    }

    const { error } = await (dbClient as typeof supabase)
      .from("users")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      console.error("Onboarding save error:", error);
      // If columns don't exist yet (migration not run), save what we can
      const fallbackPayload = {
        account_size,
        experience_level,
        onboarding_completed: true,
        trading_horizon: updatePayload.trading_horizon,
        trading_style: updatePayload.trading_style,
      };
      const { error: fallbackError } = await (dbClient as typeof supabase)
        .from("users")
        .update(fallbackPayload)
        .eq("id", user.id);
      if (fallbackError) {
        return NextResponse.json({ error: "Failed to save onboarding data." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Onboarding route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
