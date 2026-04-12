import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const alert_id = body?.alert_id;
  if (!alert_id) return NextResponse.json({ error: "alert_id required" }, { status: 400 });

  const admin = createAdminClient();
  const db = admin ?? supabase;

  const { error } = await (db as typeof supabase)
    .from("scan_alerts")
    .update({ acknowledged: true })
    .eq("id", alert_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
