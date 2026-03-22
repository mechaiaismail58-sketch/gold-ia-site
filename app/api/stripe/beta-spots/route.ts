import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BETA_LIMIT = 100;

export async function GET() {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ spots_remaining: BETA_LIMIT, is_full: false });
    }

    const { count, error } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("has_paid", true);

    if (error) {
      console.error("[beta-spots] DB error:", error.message);
      return NextResponse.json({ spots_remaining: BETA_LIMIT, is_full: false });
    }

    const paid = count ?? 0;
    const spots_remaining = Math.max(0, BETA_LIMIT - paid);
    return NextResponse.json({ spots_remaining, is_full: spots_remaining === 0 });
  } catch (err) {
    console.error("[beta-spots] error:", err);
    return NextResponse.json({ spots_remaining: BETA_LIMIT, is_full: false });
  }
}
