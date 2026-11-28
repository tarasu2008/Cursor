import { NextResponse } from "next/server";
import { createEmailToken, ensureAuthStore, findUserByEmail, isValidEmail } from "@/lib/authStore";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureAuthStore();
    const body = (await request.json()) as { email?: string };
    const email = (body.email || "").trim();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (user) {
      const token = await createEmailToken(user.id, "reset_password", 60);
      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    }

    // Always return neutral confirmation so callers cannot enumerate registered emails
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, we sent a password reset link.",
    });
  } catch {
    return NextResponse.json({ error: "Could not process request." }, { status: 500 });
  }
}
