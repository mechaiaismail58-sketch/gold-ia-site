import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("[create-checkout] POST called");

  try {
    // Step 1 — get session from request cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return req.headers
              .get("cookie")
              ?.split("; ")
              .find((c) => c.startsWith(`${name}=`))
              ?.split("=")
              .slice(1)
              .join("=");
          },
          set() {},
          remove() {},
        },
      }
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("[create-checkout] session present:", Boolean(session), "error:", sessionError?.message);

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    console.log("[create-checkout] user:", session.user.id);

    // Step 2 — init Stripe inside handler (never at module level)
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;

    console.log("[create-checkout] STRIPE_SECRET_KEY defined:", Boolean(secretKey));
    console.log("[create-checkout] STRIPE_PRICE_ID:", priceId);

    if (!secretKey) {
      return NextResponse.json({ error: "Stripe secret key not configured." }, { status: 500 });
    }
    if (!priceId) {
      return NextResponse.json({ error: "Stripe price ID not configured." }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });

    // Step 3 — create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://gold-ia-site.vercel.app/payment-success",
      cancel_url: "https://gold-ia-site.vercel.app/upgrade",
      metadata: { user_id: session.user.id },
      customer_email: session.user.email,
    });

    console.log("[create-checkout] session created:", checkoutSession.id, "url:", checkoutSession.url?.slice(0, 60));

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-checkout] ERROR:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
