import { NextResponse } from "next/server";
import { z } from "zod";
import { auditUrl } from "@/lib/crawl";
import { CrawlError, GuardrailError } from "@/lib/guardrails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  url: z.string().min(1),
});

const recent: number[] = [];

function limited(): boolean {
  const now = Date.now();
  while (recent.length > 0 && recent[0] !== undefined && now - recent[0] > 60_000) {
    recent.shift();
  }
  if (recent.length >= 8) return true;
  recent.push(now);
  return false;
}

export async function GET() {
  return NextResponse.json({ error: "Send POST { url } to open a homepage." }, { status: 405 });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "The body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a URL first." }, { status: 400 });
  }

  if (limited()) {
    return NextResponse.json(
      { error: "This demo opens 8 homepages a minute. Wait and try again." },
      { status: 429 },
    );
  }

  try {
    const report = await auditUrl(parsed.data.url);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof GuardrailError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof CrawlError ? error.message : "The homepage could not be opened.";
    return NextResponse.json({ error: message }, { status: error instanceof CrawlError ? 502 : 500 });
  }
}
