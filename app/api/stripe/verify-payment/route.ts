import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * GET /api/stripe/verify-payment?session_id=cs_xxx
 *
 * Fallback for when the webhook is slow or fails.
 * 1. Retrieves the Stripe checkout session by ID
 * 2. Confirms payment_status === "paid"
 * 3. Updates has_paid = true directly with service role key
 * 4. Returns { has_paid: true }
 *
 * This route is the source of truth for /payment-success — it does not
 * depend on the webhook having already fired.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  console.log("[verify-payment] called with session_id:", sessionId);

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id parameter." }, { status: 400 });
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();

  if (!authSession) {
    console.error("[verify-payment] no auth session");
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // ── Stripe retrieve ───────────────────────────────────────────────────────
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  let checkoutSession: Stripe.Checkout.Session;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify-payment] Stripe retrieve error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  console.log("[verify-payment] payment_status:", checkoutSession.payment_status, "metadata:", checkoutSession.metadata);

  if (checkoutSession.payment_status !== "paid") {
    return NextResponse.json({ has_paid: false, payment_status: checkoutSession.payment_status });
  }

  // ── Identify user ─────────────────────────────────────────────────────────
  const userId = checkoutSession.metadata?.user_id;
  if (!userId) {
    console.error("[verify-payment] no user_id in metadata");
    return NextResponse.json({ error: "No user_id in session metadata." }, { status: 400 });
  }

  // Security: the session must belong to the authenticated user
  if (userId !== authSession.user.id) {
    console.error("[verify-payment] user mismatch", userId, authSession.user.id);
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  // ── Update has_paid ───────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase service role not configured." }, { status: 500 });
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: dbError } = await admin
    .from("users")
    .update({ has_paid: true })
    .eq("id", userId);

  if (dbError) {
    console.error("[verify-payment] DB update failed:", dbError.code, dbError.message);
    return NextResponse.json({ error: "DB update failed: " + dbError.message }, { status: 500 });
  }

  console.log("[verify-payment] has_paid = true set for user:", userId);
  return NextResponse.json({ has_paid: true, user_id: userId });
}
