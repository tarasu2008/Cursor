import { NextResponse } from "next/server";
import { ensureAuthStore } from "@/lib/authStore";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    ensureAuthStore();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
