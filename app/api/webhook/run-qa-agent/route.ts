import { GET as auditGet, POST as auditPost } from "../../audit/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return auditGet();
}

export function POST(request: Request) {
  return auditPost(request);
}
