import { NextResponse } from "next/server";
import { ensureAuthStore } from "@/lib/authStore";
import {
  createRazorpayPaymentLink,
  createStripeCheckoutSession,
  getActivePaymentProvider,
  getBillingOffer,
  type BillingCycle,
} from "@/lib/payments";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureAuthStore();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Please log in or sign up before choosing a plan.", code: "auth_required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { offerId?: string; cycle?: BillingCycle };
    const offerId = (body.offerId || "").trim();
    const cycle: BillingCycle = body.cycle === "annual" ? "annual" : "monthly";
    const offer = getBillingOffer(offerId, cycle);
    if (!offer) {
      return NextResponse.json({ error: "Unknown plan or credit pack." }, { status: 400 });
    }

    const provider = getActivePaymentProvider();
    if (provider === "unconfigured") {
      return NextResponse.json(
        {
          error:
            "Payment gateway is not configured yet. Add STRIPE_SECRET_KEY or RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in your environment variables to enable live checkout.",
          code: "gateway_unconfigured",
        },
        { status: 503 },
      );
    }

    const result =
      provider === "stripe"
        ? await createStripeCheckoutSession({ userId: user.id, email: user.email, offer })
        : await createRazorpayPaymentLink({
            userId: user.id,
            name: user.name,
            email: user.email,
            offer,
          });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
