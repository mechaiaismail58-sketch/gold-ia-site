import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  // Diagnose env vars at runtime
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  console.log("[stripe/create-checkout] STRIPE_SECRET_KEY defined:", Boolean(secretKey));
  console.log("[stripe/create-checkout] STRIPE_SECRET_KEY prefix:", secretKey?.slice(0, 7));
  console.log("[stripe/create-checkout] STRIPE_PRICE_ID:", priceId);

  if (!secretKey) {
    console.error("[stripe/create-checkout] Missing STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }
  if (!priceId) {
    console.error("[stripe/create-checkout] Missing STRIPE_PRICE_ID");
    return NextResponse.json({ error: "Price not configured." }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "https://gold-ia-site.vercel.app";

    console.log("[stripe/create-checkout] Creating session for user:", user.id, "price:", priceId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/upgrade`,
      metadata: { user_id: user.id },
      customer_email: user.email,
    });

    console.log("[stripe/create-checkout] Session created:", session.id, "url:", session.url?.slice(0, 60));

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/create-checkout] Stripe error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed." },
      { status: 500 }
    );
  }
}
