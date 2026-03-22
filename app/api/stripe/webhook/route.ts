import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// IMPORTANT: raw body needed for signature validation — do NOT parse as JSON
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2026-02-25.clover" as any,
  });

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature invalid." }, { status: 400 });
  }

  // Respond 200 immediately — Stripe requires a fast acknowledgement
  // Process the DB update asynchronously after the response is sent
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    if (!userId) {
      console.error("[stripe/webhook] Missing user_id in session metadata.");
      // Still return 200 — don't let Stripe retry (the data is just missing)
      return NextResponse.json({ received: true });
    }

    // Fire async — do not await so Stripe gets 200 immediately
    void (async () => {
      try {
        const admin = createAdminClient();
        if (!admin) {
          console.error("[stripe/webhook] No admin client.");
          return;
        }
        const { error } = await admin
          .from("users")
          .update({ has_paid: true })
          .eq("id", userId);
        if (error) {
          console.error("[stripe/webhook] DB update error:", error.message);
        } else {
          console.log(`[stripe/webhook] Access granted for user ${userId}`);
        }
      } catch (err) {
        console.error("[stripe/webhook] Unexpected error:", err);
      }
    })();
  }

  return NextResponse.json({ received: true });
}
