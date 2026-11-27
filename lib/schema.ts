import { z } from "zod";

export const agentStatusSchema = z.enum(["HEALED", "OUTAGE", "BLOCKED"]);
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const sectionSchema = z.enum([
  "performance",
  "seo",
  "links",
  "navigation",
  "ui",
]);
export type SectionId = z.infer<typeof sectionSchema>;

export const severitySchema = z.enum(["error", "warning", "notice", "pass"]);
export type Severity = z.infer<typeof severitySchema>;

export const findingSchema = z.object({
  id: z.string().regex(/^TC-\d+$/),
  section: sectionSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  severity: severitySchema,
  status: agentStatusSchema,
  role: z.string().min(1),
  exactText: z.string().min(1),
  expected: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type Finding = z.infer<typeof findingSchema>;

export const auditReportSchema = z.object({
  source: z.enum(["live", "sample"]),
  sampleReason: z.string().nullable(),
  requestedUrl: z.string(),
  finalUrl: z.string(),
  fetchedAt: z.string(),
  runStatus: agentStatusSchema,
  role: z.string(),
  exactText: z.string(),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  preconditions: z.string(),
  scores: z.object({
    overall: z.number().nullable(),
    performance: z.number().nullable(),
    seo: z.number().nullable(),
    links: z.number().nullable(),
    navigation: z.number().nullable(),
    ui: z.number().nullable(),
  }),
  scoreNote: z.string(),
  page: z.object({
    status: z.number().nullable(),
    decodedHtmlBytes: z.number().nullable(),
    contentLengthHeader: z.number().nullable(),
    headerMs: z.number().nullable(),
    totalMs: z.number().nullable(),
    contentType: z.string().nullable(),
    contentEncoding: z.string().nullable(),
    cacheControl: z.string().nullable(),
    title: z.string().nullable(),
    metaDescription: z.string().nullable(),
    canonical: z.string().nullable(),
    robotsMeta: z.string().nullable(),
    xRobotsTag: z.string().nullable(),
    viewport: z.string().nullable(),
    lang: z.string().nullable(),
    h1: z.array(z.string()),
    hops: z.array(
      z.object({
        url: z.string(),
        status: z.number(),
        location: z.string().nullable(),
      }),
    ),
  }),
  robots: z.object({
    url: z.string(),
    status: z.number().nullable(),
    note: z.string(),
  }),
  sitemap: z.object({
    url: z.string(),
    status: z.number().nullable(),
    note: z.string(),
  }),
  links: z.object({
    discoveredSameHost: z.number(),
    checked: z.array(
      z.object({
        url: z.string(),
        status: z.number().nullable(),
        ms: z.number().nullable(),
        note: z.string(),
      }),
    ),
    skippedSample: z.array(z.object({ url: z.string(), reason: z.string() })),
    skippedCount: z.number(),
    externalHosts: z.array(z.string()),
  }),
  forms: z.array(
    z.object({
      action: z.string(),
      method: z.string(),
      fields: z.array(z.string()),
    }),
  ),
  controlsNotUsed: z.array(z.string()),
  guardrails: z.array(z.string()),
  findings: z.array(findingSchema),
  notMeasured: z.array(z.string()),
  nodesRun: z.array(z.string()),
  nodesSkipped: z.array(z.string()),
});

export type AuditReport = z.infer<typeof auditReportSchema>;

export const SCORE_NOTE =
  "Section scores use only checks this pass could finish. 90 and above is called good, 50 to 89 needs improvement, and below 50 is poor — the same words PageSpeed uses for a Lighthouse category, applied here to a different set of checks. This is not a Lighthouse performance score and not a Semrush Site Health score. Notices and checks marked BLOCKED are left out of the arithmetic.";

export const NOT_MEASURED = [
  "Chrome UX Report field data: 28-day 75th percentile LCP, INP, CLS, FCP, and TTFB.",
  "Lighthouse lab metrics and the performance score: FCP, Speed Index, LCP, Total Blocking Time, and CLS, including simulated slow-4G and Moto G Power conditions.",
  "Lighthouse insights such as render-blocking requests, image delivery, cache lifetimes, and layout-shift culprits. Those need a rendered trace.",
  "Rendered UI: overlap, overflow, contrast, font size, tap targets, and screenshots at a phone or desktop viewport.",
  "JavaScript crashes, console errors, and white screens after hydration.",
  "Dropdowns, mobile menus, and any control that is not a real link in the server HTML.",
  "Form filling, login, payment, booking, and every POST or DELETE. Those actions are refused, not merely unmeasured.",
  "A sitewide crawl: duplicate titles across pages, orphan pages, redirect chains for the whole site, and the full broken-link graph.",
  "A generated Playwright project. That is a later phase and is not produced by this demo.",
];

export const GUARDRAILS = [
  "GET only. No POST, PUT, PATCH, or DELETE.",
  "Forms are inventoried and never submitted. Fields are not typed into.",
  "Checkout, cart, payment, billing, login, and account-delete URLs are not fetched.",
  "Sign-in, register, pay, and book controls are named and not activated.",
  "Only the host you pasted, plus its www or apex twin, is fetched. Other hosts are listed and left alone.",
  "Private, loopback, link-local, and single-label hosts are refused before any request.",
  "No cookies are stored or sent back. No login. No API keys.",
  "Each request has a timeout. The whole crawl has a time budget and a page cap.",
  "Child links that robots.txt disallows for User-agent: * are not fetched.",
];

export const NODES_RUN = ["input_guardrail", "fetch_crawl", "output_guardrail"];
export const NODES_SKIPPED = ["rag_retrieval", "browser_llm_reasoning"];
