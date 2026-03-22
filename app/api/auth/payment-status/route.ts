import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ has_paid: false, error: "Unauthorized." }, { status: 401 });
    }

    // Use admin client to bypass RLS — same as middleware
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ has_paid: false, error: "Server error." }, { status: 500 });
    }

    const { data: profile } = await admin
      .from("users")
      .select("has_paid")
      .eq("id", user.id)
      .single();

    return NextResponse.json({ has_paid: profile?.has_paid ?? false });
  } catch {
    return NextResponse.json({ has_paid: false }, { status: 500 });
  }
}
