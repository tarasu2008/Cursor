import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { ensureAuthStore } from "@/lib/authStore";
import { getSessionUser } from "@/lib/session";
import { downloadSizes } from "@/data/downloadSizes";

export const runtime = "nodejs";

/**
 * Authenticated download gate.
 * Requires a registered session user who is paid or super_admin.
 * Returns the master image bytes (client may still crop); blocks anonymous access.
 */
export async function POST(request: Request) {
  try {
    ensureAuthStore();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Log in with a registered email to download.", code: "auth_required" },
        { status: 401 },
      );
    }
    if (!user.canDownload) {
      return NextResponse.json(
        {
          error: "Downloads require an active paid plan. Choose a plan on Pricing, or contact support.",
          code: "payment_required",
        },
        { status: 402 },
      );
    }

    const body = (await request.json()) as {
      imageUrl?: string;
      sizeId?: string;
      title?: string;
      license?: string;
    };

    const imageUrl = (body.imageUrl || "").trim();
    if (!imageUrl.startsWith("/samples/")) {
      return NextResponse.json({ error: "Invalid image." }, { status: 400 });
    }

    const rel = imageUrl.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), "public", rel);
    const publicRoot = path.join(process.cwd(), "public");
    if (!filePath.startsWith(publicRoot) || !existsSync(filePath)) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    const size = downloadSizes.find((s) => s.id === body.sizeId);
    const bytes = readFileSync(filePath);
    const safeTitle = (body.title || "image")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const license = body.license === "enhanced" ? "enhanced" : "standard";
    const sizePart = size ? size.id : "master";
    const filename = `lumenstock-${safeTitle}-${sizePart}-${license}.jpg`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Lumenstock-User": user.email,
        "X-Lumenstock-Size": size ? `${size.width}x${size.height}` : "master",
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
