import { NextResponse } from "next/server";
import { ensureAuthStore, grantPaymentEntitlement } from "@/lib/authStore";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { verifyRazorpayWebhookSignature } from "@/lib/payments";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: Record<string, string>;
      };
    };
    payment_link?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: Record<string, string>;
      };
    };
  };
};

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-razorpay-signature") || "";
  if (!verifyRazorpayWebhookSignature(rawBody, sig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Razorpay signature." }, { status: 400 });
  }

  try {
    await ensureAuthStore();
    const data = JSON.parse(rawBody) as RazorpayWebhookPayload;
    if (data.event !== "payment_link.paid" && data.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const paymentEntity = data.payload?.payment?.entity;
    const linkEntity = data.payload?.payment_link?.entity;
    const notes = linkEntity?.notes || paymentEntity?.notes || {};
    const providerPaymentId = paymentEntity?.id || linkEntity?.id || "";
    const userId = notes.userId || "";
    const credits = Math.max(0, Number.parseInt(notes.credits || "0", 10) || 0);
    const durationDays = Number.parseInt(notes.durationDays || "0", 10) || null;
    const planId = notes.offerId || "paid";
    const planLabel = notes.planLabel || planId;
    const amountCents = Number(paymentEntity?.amount || linkEntity?.amount || 0);
    const currency = (paymentEntity?.currency || linkEntity?.currency || "INR").toUpperCase();

    if (!providerPaymentId || !userId || credits <= 0) {
      return NextResponse.json({ received: true, ignored: "missing_notes" });
    }

    const granted = await grantPaymentEntitlement({
      userId,
      provider: "razorpay",
      providerPaymentId,
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
    console.error("[Razorpay webhook error]", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
