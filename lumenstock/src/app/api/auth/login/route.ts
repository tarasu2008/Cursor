import { NextResponse } from "next/server";
import { authenticateUser, ensureAuthStore } from "@/lib/authStore";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  try {
    ensureAuthStore();
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const result = authenticateUser(email, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const token = createSessionToken(result.user.id);
    const res = NextResponse.json({ user: result.user });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Could not log in." }, { status: 500 });
  }
}
