import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Columns this endpoint manages on public.users.
// account_size + trading_style already exist; prop_firm + max_drawdown are
// added by supabase/trader_profile_migration.sql. The save path degrades
// gracefully if the migration hasn't been run yet (unknown columns are
// stripped and retried), so the app never 500s on a missing column.
const PROFILE_COLUMNS = ["prop_firm", "account_size", "max_drawdown", "trading_style"] as const;

type ProfileColumn = (typeof PROFILE_COLUMNS)[number];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    // Try the full select; if a column is missing (pre-migration), fall back
    // to the columns that always exist so the badge still renders.
    let profile: Record<string, unknown> | null = null;
    const full = await (dbClient as typeof supabase)
      .from("users")
      .select(PROFILE_COLUMNS.join(", "))
      .eq("id", user.id)
      .single();

    if (!full.error) {
      profile = full.data as unknown as Record<string, unknown>;
    } else {
      const safe = await (dbClient as typeof supabase)
        .from("users")
        .select("account_size, trading_style")
        .eq("id", user.id)
        .single();
      profile = (safe.data as unknown as Record<string, unknown>) ?? null;
    }

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("[trader-profile GET]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Build the update payload from recognised fields only.
    const payload: Partial<Record<ProfileColumn, string | number | null>> = {};
    if (typeof body.prop_firm === "string") payload.prop_firm = body.prop_firm.trim() || null;
    if (typeof body.account_size === "string" || typeof body.account_size === "number") {
      payload.account_size = String(body.account_size).trim() || null;
    }
    if (body.max_drawdown === null || body.max_drawdown === "") {
      payload.max_drawdown = null;
    } else if (body.max_drawdown != null) {
      const n = Number(String(body.max_drawdown).replace(/[^0-9.]/g, ""));
      payload.max_drawdown = Number.isFinite(n) ? n : null;
    }
    if (typeof body.trading_style === "string") payload.trading_style = body.trading_style.trim() || null;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid profile fields provided." }, { status: 400 });
    }

    const admin = createAdminClient();
    const dbClient = admin ?? supabase;

    // Resilient update: if the DB rejects an unknown column (migration not yet
    // run), drop that column from the payload and retry. Worst case we persist
    // only the columns that exist and report which ones were skipped.
    const working: Record<string, string | number | null> = { ...payload };
    const skipped: string[] = [];
    let lastError: string | null = null;

    for (let attempt = 0; attempt < PROFILE_COLUMNS.length + 1; attempt++) {
      if (Object.keys(working).length === 0) break;
      const { error } = await (dbClient as typeof supabase)
        .from("users")
        .update(working)
        .eq("id", user.id);

      if (!error) {
        return NextResponse.json({
          ok: true,
          saved: working,
          skipped,
          needs_migration: skipped.length > 0,
        });
      }

      lastError = error.message;
      // PostgREST surfaces unknown columns as: "Could not find the 'x' column ..."
      // or Postgres 42703 "column users.x does not exist".
      const missing = PROFILE_COLUMNS.find(
        (c) => c in working && new RegExp(`['." ]${c}['." ]`).test(error.message)
      );
      if (!missing) break;
      delete working[missing];
      skipped.push(missing);
    }

    console.error("[trader-profile POST] update failed:", lastError, "skipped:", skipped);
    return NextResponse.json(
      { error: "Could not save profile.", detail: lastError, skipped },
      { status: 500 }
    );
  } catch (err) {
    console.error("[trader-profile POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
