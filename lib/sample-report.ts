import {
  GUARDRAILS,
  NODES_RUN,
  NODES_SKIPPED,
  NOT_MEASURED,
  SCORE_NOTE,
  type AuditReport,
  type Finding,
} from "./schema";

export const DEMO_URL = "https://www.seadwellers.com/";

const findings: Finding[] = [
  {
    id: "TC-01",
    section: "performance",
    title: "HTML document response",
    description:
      "Sample only. A live pass times a GET of the document. That number is not Time to First Byte from the Chrome UX Report and not Largest Contentful Paint.",
    severity: "pass",
    status: "HEALED",
    role: "crawler",
    exactText: "Sample. HTTP 200 in 420 ms (180 ms to headers).",
    expected: "The HTML document returns a status below 400 in 1.8 seconds or less.",
    confidence: 0,
  },
  {
    id: "TC-02",
    section: "performance",
    title: "Core Web Vitals and the Lighthouse score",
    description:
      "Sample only. PageSpeed scores Total Blocking Time 30%, Largest Contentful Paint 25%, Cumulative Layout Shift 25%, First Contentful Paint 10%, and Speed Index 10%. This demo does not run Lighthouse.",
    severity: "notice",
    status: "BLOCKED",
    role: "crawler",
    exactText: "Sample. Not measured. No browser, no trace, no CrUX query.",
    expected: "A later browser pass records lab LCP, CLS, and Total Blocking Time.",
    confidence: 0,
  },
  {
    id: "TC-03",
    section: "seo",
    title: "Title element",
    description:
      "Sample only. The title is what a tab and often a search result show. Semrush warns under 11 characters or over 70. That is an editorial threshold.",
    severity: "pass",
    status: "HEALED",
    role: "public visitor",
    exactText: "Sample. “Key Largo Scuba Diving, Snorkeling & PADI Courses | Sea Dwellers” (64 characters).",
    expected: "Exactly one title, longer than 10 characters and 70 characters or fewer.",
    confidence: 0,
  },
  {
    id: "TC-04",
    section: "seo",
    title: "Meta description",
    description:
      "Sample only. A missing description is a warning in Semrush Site Audit. This row is illustrative, not a measurement.",
    severity: "pass",
    status: "HEALED",
    role: "public visitor",
    exactText: "Sample. A meta description is present in this illustration (148 characters).",
    expected: "One meta description, between 50 and 160 characters.",
    confidence: 0,
  },
  {
    id: "TC-05",
    section: "links",
    title: "Some checked same-host links returned an error status",
    description:
      "Sample only. A live pass GETs up to 8 same-host links and records the status. The URL below is an illustration of how a 404 row looks. It was not requested.",
    severity: "error",
    status: "OUTAGE",
    role: "crawler",
    exactText: "Sample. HTTP 404 https://www.seadwellers.com/this-path-is-not-real",
    expected: "Each sampled same-host link returns a final status below 400.",
    confidence: 0,
  },
  {
    id: "TC-06",
    section: "navigation",
    title: "Menu labels that are not links",
    description:
      "Sample only. A live pass lists nav text that is not inside an anchor. Those items may be JavaScript menus. This row uses placeholder labels.",
    severity: "warning",
    status: "BLOCKED",
    role: "public visitor",
    exactText: "Sample. Courses, About Us, Dive Favorites",
    expected: "Each top-level destination is an anchor, or its submenu links are in the server HTML.",
    confidence: 0,
  },
  {
    id: "TC-07",
    section: "ui",
    title: "Forms observed and not submitted",
    description:
      "Sample only. A live pass records action, method, and field names and does not press submit. The form below is invented so the guardrail is visible.",
    severity: "notice",
    status: "BLOCKED",
    role: "guardrail",
    exactText: "Sample. POST /contact-us fields: name (text), email (email), message (textarea). Not submitted.",
    expected: "No POST is sent. Field values stay empty. Checkout and login are not attempted.",
    confidence: 0,
  },
  {
    id: "TC-08",
    section: "ui",
    title: "Rendered layout, contrast, and crashes",
    description:
      "Sample only. Overlap, contrast, and console errors need a browser. They are always out of scope for the fetch crawl.",
    severity: "notice",
    status: "BLOCKED",
    role: "public visitor",
    exactText: "Sample. Not measured. No screenshot and no console log.",
    expected:
      "At 390px and 1280px, no text overflows its box, and the console shows no uncaught exception on load.",
    confidence: 0,
  },
];

export function sampleReport(reason: string | null = null): AuditReport {
  return {
    source: "sample",
    sampleReason: reason,
    requestedUrl: DEMO_URL,
    finalUrl: DEMO_URL,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    runStatus: "HEALED",
    role: "public visitor",
    exactText: "Sample. No live request was used for these figures.",
    confidence: 0,
    summary:
      "This is a sample report for https://www.seadwellers.com/. The numbers and the 404 row were written to show the layout. They are not a measurement of that site. A live crawl uses the Analyze button.",
    preconditions:
      "Role: public visitor, not signed in. This sample has no screen and no request. Forms, checkout, and sign-in stay unused in the live crawl as well.",
    scores: {
      overall: 74,
      performance: 80,
      seo: 86,
      links: 75,
      navigation: 70,
      ui: 60,
    },
    scoreNote: SCORE_NOTE,
    page: {
      status: 200,
      decodedHtmlBytes: 420000,
      contentLengthHeader: null,
      headerMs: 180,
      totalMs: 420,
      contentType: "text/html; charset=utf-8",
      contentEncoding: null,
      cacheControl: null,
      title: "Sample title — not read from the site",
      metaDescription: "Sample description — not read from the site.",
      canonical: DEMO_URL,
      robotsMeta: null,
      xRobotsTag: null,
      viewport: "width=device-width, initial-scale=1",
      lang: "en",
      h1: ["Sample H1 — not read from the site"],
      hops: [{ url: DEMO_URL, status: 200, location: null }],
    },
    robots: {
      url: "https://www.seadwellers.com/robots.txt",
      status: 200,
      note: "Sample. Not fetched.",
    },
    sitemap: {
      url: "https://www.seadwellers.com/sitemap.xml",
      status: 200,
      note: "Sample. Not fetched. URLs inside a sitemap are not crawled in this demo.",
    },
    links: {
      discoveredSameHost: 40,
      checked: [
        {
          url: "https://www.seadwellers.com/key-largo-scuba-diving-rates",
          status: 200,
          ms: 310,
          note: "Sample. Not fetched.",
        },
        {
          url: "https://www.seadwellers.com/this-path-is-not-real",
          status: 404,
          ms: 280,
          note: "Sample. This path was not requested.",
        },
      ],
      skippedSample: [
        {
          url: "https://www.seadwellers.com/checkout",
          reason: "Sample. Checkout is not fetched.",
        },
      ],
      skippedCount: 1,
      externalHosts: ["example.com"],
    },
    forms: [
      {
        action: "https://www.seadwellers.com/contact-us",
        method: "post",
        fields: ["name (text)", "email (email)", "message (textarea)"],
      },
    ],
    controlsNotUsed: ["Sample. Register / Sign In"],
    guardrails: GUARDRAILS,
    findings,
    notMeasured: NOT_MEASURED,
    nodesRun: NODES_RUN,
    nodesSkipped: NODES_SKIPPED,
  };
}

export function isDemoHost(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return host === "seadwellers.com" || host === "www.seadwellers.com";
  } catch {
    return false;
  }
}
