import { NextResponse } from "next/server";
import { ensureAuthStore, grantPaymentEntitlement } from "@/lib/authStore";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { verifyStripeWebhookSignature } from "@/lib/payments";

export const runtime = "nodejs";

type StripeEvent = {
  type?: string;
  data?: {
    object?: {
      id?: string;
      payment_status?: string;
      amount_total?: number;
      currency?: string;
      client_reference_id?: string;
      metadata?: Record<string, string>;
    };
  };
};

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature") || "";
  if (!verifyStripeWebhookSignature(rawBody, sig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    await ensureAuthStore();
    const event = JSON.parse(rawBody) as StripeEvent;
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data?.object;
    if (!session?.id || session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const meta = session.metadata || {};
    const userId = meta.userId || session.client_reference_id || "";
    const credits = Math.max(0, Number.parseInt(meta.credits || "0", 10) || 0);
    const durationDays = Number.parseInt(meta.durationDays || "0", 10) || null;
    const planId = meta.offerId || "paid";
    const planLabel = meta.planLabel || planId;
    const amountCents = Number(session.amount_total || 0);
    const currency = (session.currency || "usd").toUpperCase();

    if (!userId || credits <= 0) {
      return NextResponse.json({ received: true, ignored: "missing_metadata" });
    }

    const granted = await grantPaymentEntitlement({
      userId,
      provider: "stripe",
      providerPaymentId: session.id,
      planId,
      credits,
      amountCents,
      currency,
      durationDays,
    });

    if (!granted.alreadyProcessed && granted.user) {
      await sendPaymentReceiptEmail({
        to: granted.user.email,
        name: granted.user.name,
        planLabel,
        amountFormatted: `${currency} ${(amountCents / 100).toFixed(2)}`,
        credits,
      });
    }

    return NextResponse.json({ received: true, processed: !granted.alreadyProcessed });
  } catch (err) {
    console.error("[Stripe webhook error]", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
