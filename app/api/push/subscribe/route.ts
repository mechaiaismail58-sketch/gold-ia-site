import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const admin = createAdminClient();
    const db = admin ?? supabase;
    const { data } = await (db as typeof supabase)
      .from("push_subscriptions")
      .select("scalp_alerts, swing_alerts")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({ ok: true, scalp_alerts: data?.scalp_alerts ?? null, swing_alerts: data?.swing_alerts ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { subscription, scalp_alerts = true, swing_alerts = true } = await req.json();
    if (!subscription?.endpoint) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

    const admin = createAdminClient();
    const db = admin ?? supabase;

    const { error } = await (db as typeof supabase)
      .from("push_subscriptions")
      .upsert({ user_id: user.id, subscription, scalp_alerts, swing_alerts }, { onConflict: "user_id" });

    if (error) {
      console.error("Subscribe error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const admin = createAdminClient();
    const db = admin ?? supabase;
    await (db as typeof supabase).from("push_subscriptions").delete().eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { scalp_alerts, swing_alerts } = await req.json();
    const admin = createAdminClient();
    const db = admin ?? supabase;

    await (db as typeof supabase)
      .from("push_subscriptions")
      .update({ scalp_alerts, swing_alerts })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
