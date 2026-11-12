import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { findUserById, publicUser, type PublicUser } from "./authStore";

const COOKIE = "lumenstock_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function secret() {
  return process.env.LUMENSTOCK_SESSION_SECRET || "lumenstock-dev-session-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string) {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const body = Buffer.from(JSON.stringify({ uid: userId, exp }), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): { userId: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return { userId: parsed.uid };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  const user = findUserById(verified.userId);
  if (!user) return null;
  return publicUser(user);
}

export { COOKIE as SESSION_COOKIE };
