import { NextResponse } from "next/server";
import { consumeEmailToken, ensureAuthStore, updateUserPassword } from "@/lib/authStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureAuthStore();
    const body = (await request.json()) as { token?: string; password?: string };
    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) {
      return NextResponse.json({ error: "Reset token is missing." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const userId = await consumeEmailToken(token, "reset_password");
    if (!userId) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 },
      );
    }

    const updated = await updateUserPassword(userId, password);
    if (!updated.ok) {
      return NextResponse.json({ error: updated.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Password updated. You can now log in." });
  } catch {
    return NextResponse.json({ error: "Could not reset password." }, { status: 500 });
  }
}
