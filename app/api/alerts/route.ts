import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const db = admin ?? supabase;

  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const { data: alerts, error } = await (db as typeof supabase)
    .from("scan_alerts")
    .select("id, created_at, alert_type, price, message, severity, acknowledged")
    .gte("created_at", cutoff)
    .eq("acknowledged", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alerts: alerts ?? [] });
}
