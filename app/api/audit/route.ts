import { NextResponse } from "next/server";
import { z } from "zod";
import { auditUrl } from "@/lib/crawl";
import { CrawlError, GuardrailError } from "@/lib/guardrails";
import { auditReportSchema } from "@/lib/schema";
import { isDemoHost, sampleReport } from "@/lib/sample-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  url: z.string().optional(),
  sample: z.boolean().optional(),
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
  return NextResponse.json(
    {
      error: "Send POST { url } to run a live crawl, or POST { sample: true } for the sample report.",
    },
    { status: 405 },
  );
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
    return NextResponse.json({ error: "Send { url: string } or { sample: true }." }, { status: 400 });
  }

  if (parsed.data.sample) {
    return NextResponse.json(auditReportSchema.parse(sampleReport(null)));
  }

  const url = parsed.data.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Paste a URL first." }, { status: 400 });
  }

  if (limited()) {
    return NextResponse.json(
      { error: "This demo accepts 8 live crawls a minute. Wait and try again, or open the sample report." },
      { status: 429 },
    );
  }

  try {
    const report = await auditUrl(url);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof GuardrailError) {
      return NextResponse.json(
        {
          error: error.message,
          runStatus: error.status,
          role: error.role,
          exactText: error.message,
          confidence: 1,
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "The crawl failed before a report could be built.";
    if (error instanceof CrawlError && isDemoHost(url)) {
      return NextResponse.json(
        auditReportSchema.parse(
          sampleReport(
            `The live crawl did not finish (${message}). The sample below is not a measurement of the site.`,
          ),
        ),
      );
    }

    return NextResponse.json(
      { error: message, runStatus: "OUTAGE", role: "crawler", exactText: message, confidence: 0.5 },
      { status: error instanceof CrawlError ? 502 : 500 },
    );
  }
}
