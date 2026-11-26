import { NextResponse } from "next/server";
import { createEmailToken, ensureAuthStore } from "@/lib/authStore";
import { sendVerificationEmail } from "@/lib/email";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    await ensureAuthStore();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Log in first." }, { status: 401 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    const token = await createEmailToken(user.id, "verify_email", 60 * 24);
    const sent = await sendVerificationEmail({ to: user.email, name: user.name, token });
    return NextResponse.json({ ok: true, sent: sent.sent, mode: sent.mode });
  } catch {
    return NextResponse.json({ error: "Could not send verification email." }, { status: 500 });
  }
}
