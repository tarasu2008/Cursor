import { NextResponse } from "next/server";
import { assets } from "@/data/catalog";
import { ensureDatabaseSchema, getPool, hasDatabase } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { getActivePaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus: "ok" | "error" | "local" = "local";
  if (hasDatabase()) {
    try {
      await ensureDatabaseSchema();
      await getPool().query("SELECT 1");
      dbStatus = "ok";
    } catch {
      dbStatus = "error";
    }
  }

  const ok = dbStatus !== "error";
  return NextResponse.json(
    {
      ok,
      catalogCount: assets.length,
      storage: hasDatabase() ? "postgres" : "local_json",
      database: dbStatus,
      paymentProvider: getActivePaymentProvider(),
      emailProvider: isEmailConfigured() ? "resend" : "console",
      assetCdnConfigured: Boolean(process.env.NEXT_PUBLIC_ASSET_CDN_URL?.trim()),
    },
    { status: ok ? 200 : 503 },
  );
}
