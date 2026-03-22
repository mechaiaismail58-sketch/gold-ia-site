import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createAdminClient();

    if (!admin) {
      return NextResponse.json(
        { error: "Service role key not configured. Please delete your account from the Supabase dashboard." },
        { status: 500 }
      );
    }

    // Delete profile row first (cascade may handle it, but be explicit)
    await admin.from("users").delete().eq("id", user.id);
    await admin.from("ai_analyses").delete().eq("user_id", user.id);

    // Delete auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Delete user error:", deleteError);
      return NextResponse.json({ error: "Account deletion failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    );
  }
}
