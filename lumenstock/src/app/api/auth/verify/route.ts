import { NextResponse } from "next/server";
import { consumeEmailToken, ensureAuthStore, markEmailVerified } from "@/lib/authStore";
import { getAppBaseUrl } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base = getAppBaseUrl();
  try {
    await ensureAuthStore();
    const { searchParams } = new URL(request.url);
    const token = (searchParams.get("token") || "").trim();
    if (!token) {
      return NextResponse.redirect(`${base}/?verified=invalid`);
    }
    const userId = await consumeEmailToken(token, "verify_email");
    if (!userId) {
      return NextResponse.redirect(`${base}/?verified=expired`);
    }
    await markEmailVerified(userId);
    return NextResponse.redirect(`${base}/?verified=1`);
  } catch {
    return NextResponse.redirect(`${base}/?verified=error`);
  }
}
