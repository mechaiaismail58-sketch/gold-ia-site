import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    // ── 1. Authenticate ────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[create-checkout] session error:", sessionError.message);
      return NextResponse.json({ error: sessionError.message }, { status: 401 });
    }
    if (!session) {
      console.error("[create-checkout] no session");
      return NextResponse.json({ error: "Not authenticated. Please log in again." }, { status: 401 });
    }

    console.log("[create-checkout] user:", session.user.id);

    // ── 2. Validate env vars ───────────────────────────────────────────────
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId   = process.env.STRIPE_PRICE_ID;

    if (!secretKey) {
      console.error("[create-checkout] STRIPE_SECRET_KEY missing");
      return NextResponse.json({ error: "Stripe is not configured (missing secret key)." }, { status: 500 });
    }
    if (!priceId) {
      console.error("[create-checkout] STRIPE_PRICE_ID missing");
      return NextResponse.json({ error: "Stripe is not configured (missing price ID)." }, { status: 500 });
    }

    console.log("[create-checkout] key prefix:", secretKey.slice(0, 8), "priceId:", priceId);

    // ── 3. Create Stripe checkout session ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Hardcoded — avoids any env var misconfiguration
      success_url: "https://gold-ia-site.vercel.app/payment-success",
      cancel_url:  "https://gold-ia-site.vercel.app/upgrade",
      // CRITICAL: user_id in metadata so the webhook knows who to update
      metadata: { user_id: session.user.id },
      customer_email: session.user.email,
    });

    console.log("[create-checkout] created:", checkoutSession.id, checkoutSession.url?.slice(0, 50));

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-checkout] unhandled error:", msg);
    // Return the exact error message so the upgrade page can display it
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
