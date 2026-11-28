import { NextResponse } from "next/server";
import { ensureAuthStore, findUsersExpiringSoon, markRenewalNotified } from "@/lib/authStore";
import { sendRenewalReminderEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Daily cron endpoint for non-auto-renewing plan reminders.
 * Call with: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureAuthStore();
    const expiring = await findUsersExpiringSoon(3);
    let sent = 0;
    for (const user of expiring) {
      if (!user.planExpiresAt) continue;
      await sendRenewalReminderEmail({
        to: user.email,
        name: user.name,
        planId: user.planId || "creator",
        expiresAt: user.planExpiresAt,
      });
      await markRenewalNotified(user.id);
      sent += 1;
    }
    return NextResponse.json({ ok: true, notified: sent });
  } catch {
    return NextResponse.json({ error: "Cron job failed." }, { status: 500 });
  }
}
