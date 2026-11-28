import { createHmac, timingSafeEqual } from "crypto";
import { packs, pricingPlans } from "@/data/catalog";
import { getAppBaseUrl } from "./email";

export type PaymentProvider = "stripe" | "razorpay" | "unconfigured";
export type BillingCycle = "monthly" | "annual";

export type BillingOffer = {
  id: string;
  label: string;
  description: string;
  amountUsdCents: number;
  credits: number;
  durationDays: number | null;
};

export function getActivePaymentProvider(): PaymentProvider {
  const preferred = (process.env.PAYMENT_PROVIDER || "").trim().toLowerCase();
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const hasRazorpay = Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim(),
  );

  if (preferred === "razorpay" && hasRazorpay) return "razorpay";
  if (preferred === "stripe" && hasStripe) return "stripe";
  if (hasStripe) return "stripe";
  if (hasRazorpay) return "razorpay";
  return "unconfigured";
}

export function getBillingOffer(offerId: string, cycle: BillingCycle = "monthly"): BillingOffer | null {
  const plan = pricingPlans.find((p) => p.id === offerId);
  if (plan) {
    const isAnnual = cycle === "annual";
    const totalDollars = isAnnual ? plan.annual * 12 : plan.monthly;
    const credits = isAnnual ? plan.downloads * 12 : plan.downloads;
    return {
      id: `${plan.id}-${cycle}`,
      label: `${plan.name} (${isAnnual ? "12 months" : "1 month"})`,
      description: `${credits} HD downloads · one-time payment, no auto-renewal`,
      amountUsdCents: totalDollars * 100,
      credits,
      durationDays: isAnnual ? 365 : 30,
    };
  }

  const pack = packs.find((p) => p.id === offerId);
  if (pack) {
    return {
      id: pack.id,
      label: `On-demand ${pack.count}-image pack`,
      description: `${pack.count} non-expiring HD download credits`,
      amountUsdCents: pack.price * 100,
      credits: pack.count,
      durationDays: null,
    };
  }
  return null;
}

export async function createStripeCheckoutSession(input: {
  userId: string;
  email: string;
  offer: BillingOffer;
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set.");

  const base = getAppBaseUrl();
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${base}/pricing?checkout=success&provider=stripe`);
  params.set("cancel_url", `${base}/pricing?checkout=cancelled`);
  params.set("customer_email", input.email);
  params.set("client_reference_id", input.userId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(input.offer.amountUsdCents));
  params.set("line_items[0][price_data][product_data][name]", `Lumenstock ${input.offer.label}`);
  params.set("line_items[0][price_data][product_data][description]", input.offer.description);
  params.set("metadata[userId]", input.userId);
  params.set("metadata[offerId]", input.offer.id);
  params.set("metadata[planLabel]", input.offer.label);
  params.set("metadata[credits]", String(input.offer.credits));
  params.set("metadata[durationDays]", String(input.offer.durationDays ?? 0));

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    throw new Error(data.error?.message || "Stripe checkout session failed.");
  }
  return { checkoutUrl: data.url, provider: "stripe" as const };
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.trim().split("=");
      return [k, v];
    }),
  );
  const timestamp = Number(parts.t);
  const sig = parts.v1;
  if (!timestamp || !sig) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createRazorpayPaymentLink(input: {
  userId: string;
  name: string;
  email: string;
  offer: BillingOffer;
}) {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new Error("Razorpay keys are not set.");

  const currency = (process.env.RAZORPAY_CURRENCY || "INR").trim().toUpperCase();
  const inrRate = Number(process.env.RAZORPAY_INR_RATE || "85");
  const amountSubunits =
    currency === "INR"
      ? Math.round((input.offer.amountUsdCents / 100) * inrRate * 100)
      : input.offer.amountUsdCents;

  const base = getAppBaseUrl();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountSubunits,
      currency,
      description: `Lumenstock — ${input.offer.label}`,
      customer: {
        name: input.name,
        email: input.email,
      },
      notify: { email: true, sms: false },
      reminder_enable: false,
      notes: {
        userId: input.userId,
        offerId: input.offer.id,
        planLabel: input.offer.label,
        credits: String(input.offer.credits),
        durationDays: String(input.offer.durationDays ?? 0),
      },
      callback_url: `${base}/pricing?checkout=success&provider=razorpay`,
      callback_method: "get",
    }),
  });

  const data = (await res.json()) as { short_url?: string; error?: { description?: string } };
  if (!res.ok || !data.short_url) {
    throw new Error(data.error?.description || "Razorpay payment link creation failed.");
  }
  return { checkoutUrl: data.short_url, provider: "razorpay" as const };
}

export function verifyRazorpayWebhookSignature(rawBody: string, signatureHeader: string, secret: string) {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
