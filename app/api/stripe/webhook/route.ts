import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// IMPORTANT: raw body needed for signature validation — do NOT parse as JSON
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[webhook] Received POST request");

  // Check env vars immediately
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[webhook] STRIPE_SECRET_KEY defined:", Boolean(secretKey));
  console.log("[webhook] STRIPE_WEBHOOK_SECRET defined:", Boolean(webhookSecret));
  console.log("[webhook] SUPABASE_URL defined:", Boolean(supabaseUrl));
  console.log("[webhook] SUPABASE_SERVICE_ROLE_KEY defined:", Boolean(serviceRoleKey));

  if (!secretKey || !webhookSecret) {
    console.error("[webhook] Missing Stripe env vars");
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("[webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log("[webhook] Signature verified. Event type:", event.type, "| ID:", event.id);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature invalid." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log("[webhook] Session ID:", session.id);
    console.log("[webhook] Session metadata:", JSON.stringify(session.metadata));
    console.log("[webhook] Payment status:", session.payment_status);

    const userId = session.metadata?.user_id;

    if (!userId) {
      console.error("[webhook] CRITICAL: user_id missing from session metadata. Full metadata:", session.metadata);
      // Return 200 so Stripe doesn't retry — the data is simply missing upstream
      return NextResponse.json({ received: true, warning: "missing_user_id" });
    }

    console.log("[webhook] Updating has_paid for user:", userId);

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[webhook] Missing Supabase service role config — cannot update DB");
      return NextResponse.json({ error: "DB not configured." }, { status: 500 });
    }

    // Use service role client directly — bypasses RLS
    // MUST await before returning response (fire-and-forget is killed by Vercel before completion)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: try UPDATE — works when trigger already created the row (normal case)
    const { data, error } = await admin
      .from("users")
      .update({ has_paid: true })
      .eq("id", userId)
      .select("id, has_paid");

    if (error) {
      console.error("[webhook] DB update FAILED:", error.code, error.message, error.details);
      // Return 500 so Stripe retries
      return NextResponse.json({ error: "DB update failed." }, { status: 500 });
    }

    if (data?.length === 0) {
      // Step 2: row missing (trigger race condition) — fetch email from auth then upsert
      console.warn("[webhook] No row found for user:", userId, "— attempting upsert fallback");

      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
      if (authErr || !authUser?.user) {
        console.error("[webhook] Could not fetch auth user for upsert:", authErr?.message);
        return NextResponse.json({ error: "User not found in auth." }, { status: 500 });
      }

      const { data: upsertData, error: upsertError } = await admin
        .from("users")
        .upsert(
          {
            id: userId,
            email: authUser.user.email ?? "",
            has_paid: true,
            hashed_access_code: "none",
          },
          { onConflict: "id" }
        )
        .select("id, has_paid");

      if (upsertError) {
        console.error("[webhook] Upsert fallback FAILED:", upsertError.code, upsertError.message);
        return NextResponse.json({ error: "DB upsert failed." }, { status: 500 });
      }

      console.log("[webhook] Upsert fallback SUCCESS. Data:", JSON.stringify(upsertData));
    } else {
      console.log("[webhook] DB update SUCCESS. Rows affected:", data?.length, "| Data:", JSON.stringify(data));
    }
  } else {
    console.log("[webhook] Ignored event type:", event.type);
  }

  return NextResponse.json({ received: true });
}
