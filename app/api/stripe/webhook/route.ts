import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// IMPORTANT: raw body needed for signature validation — do NOT parse as JSON
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    if (!userId) {
      console.error("[stripe/webhook] Missing user_id in session metadata.");
      return NextResponse.json({ error: "Missing user_id." }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      console.error("[stripe/webhook] No admin client.");
      return NextResponse.json({ error: "Server error." }, { status: 500 });
    }

    const { error } = await admin
      .from("users")
      .update({ has_paid: true })
      .eq("id", userId);

    if (error) {
      console.error("[stripe/webhook] DB update error:", error.message);
      return NextResponse.json({ error: "DB update failed." }, { status: 500 });
    }

    console.log(`[stripe/webhook] Access granted for user ${userId}`);
  }

  return NextResponse.json({ received: true });
}
