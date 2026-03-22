import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("WEBHOOK: missing Stripe env vars");
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log("WEBHOOK: event", event.type, event.id);
  } catch (err) {
    console.error("WEBHOOK: signature failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    if (!userId) {
      console.error("WEBHOOK: pas de user_id dans metadata", session.metadata);
      return NextResponse.json({ received: true, warning: "missing_user_id" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceKey) {
      console.error("WEBHOOK: missing Supabase env vars");
      return NextResponse.json({ error: "DB not configured." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // MUST await before returning — Vercel kills the function after response
    const { error } = await supabase
      .from("users")
      .update({ has_paid: true })
      .eq("id", userId);

    if (error) {
      console.error("WEBHOOK UPDATE ERROR:", error);
      return NextResponse.json({ error: "DB update failed." }, { status: 500 });
    }

    console.log("WEBHOOK: has_paid mis à jour pour", userId);
  }

  return NextResponse.json({ received: true });
}
