import { auditReportSchema } from "@/lib/schema";
import { renderReportPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "The body must be JSON." }, { status: 400 });
  }

  const parsed = auditReportSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "The report could not be turned into a PDF." }, { status: 400 });
  }

  const pdf = await renderReportPdf(parsed.data);
  const host = safeHost(parsed.data.finalUrl);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="first-pass-${host}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "") || "report";
  } catch {
    return "report";
  }
}
