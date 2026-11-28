import { NextResponse } from "next/server";
import { createEmailToken, createUser, ensureAuthStore } from "@/lib/authStore";
import { sendVerificationEmail } from "@/lib/email";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureAuthStore();
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }

    const result = await createUser({ name, email, password });
    if (!result.ok) {
      const status = result.error.includes("already exists") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    let verificationSent = false;
    if (!result.user.emailVerified) {
      try {
        const verifyToken = await createEmailToken(result.user.id, "verify_email", 60 * 24);
        const sent = await sendVerificationEmail({
          to: result.user.email,
          name: result.user.name,
          token: verifyToken,
        });
        verificationSent = sent.sent;
      } catch (err) {
        console.error("[Lumenstock signup verification email failed]", err);
      }
    }

    const token = createSessionToken(result.user.id);
    const res = NextResponse.json({
      user: result.user,
      verificationSent,
      notice: {
        cards: "We do not store card details.",
        renewal:
          "Subscriptions are not auto-renewed. Before your plan ends we email you a payment link to renew.",
        download: result.user.canDownload
          ? "Downloads are enabled for your account."
          : "Downloads unlock after a paid plan. Browse and preview freely until then.",
      },
    });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
