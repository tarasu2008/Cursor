import { parse, type HTMLElement } from "node-html-parser";
import {
  GUARDRAILS,
  NODES_RUN,
  NODES_SKIPPED,
  NOT_MEASURED,
  SCORE_NOTE,
  type AgentStatus,
  type AuditReport,
  type Finding,
  type SectionId,
  type Severity,
  auditReportSchema,
} from "./schema";
import {
  CrawlError,
  allowedHostsFor,
  assertPublicDns,
  isForbiddenUrl,
  parsePublicUrl,
} from "./guardrails";
import { isDisallowed, parseRobots } from "./robots";

const USER_AGENT =
  "QAFirstPass/0.1 (site audit demo; GET only; does not submit forms or sign in)";

const PAGE_BUDGET_MS = 20_000;
const DOCUMENT_TIMEOUT_MS = 10_000;
const CHILD_TIMEOUT_MS = 7_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_SIDE_BYTES = 100_000;
const MAX_LINK_CHECKS = 8;

const ASSET_EXT =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|eot|mp4|webm|pdf|zip|gz|xml|json)$/i;

type Hop = { url: string; status: number; location: string | null };

type FetchResult = {
  status: number;
  headers: Headers;
  body: string;
  truncated: boolean;
  headerMs: number;
  totalMs: number;
  location: string | null;
};

const PRECONDITIONS =
  "Role: public visitor, not signed in. Screen: none — this pass is a server fetch, so there is no viewport, no tap, and no scroll. Data: the HTML, headers, and status codes the host returns to a GET with no cookies. Forms, checkout, and sign-in are observed only.";

export async function auditUrl(raw: string): Promise<AuditReport> {
  const start = parsePublicUrl(raw);
  await assertPublicDns(start.hostname);
  const hosts = allowedHostsFor(start.hostname);
  const deadline = Date.now() + PAGE_BUDGET_MS;
  const findings: Finding[] = [];
  let seq = 1;
  const id = () => `TC-${String(seq++).padStart(2, "0")}`;

  const document = await fetchFollowing(start.toString(), hosts, deadline, DOCUMENT_TIMEOUT_MS);
  if (document.stopped || !document.page) {
    const exact = document.stopped ?? "No document was returned.";
    const report = baseReport({
      requestedUrl: start.toString(),
      finalUrl: document.hops.at(-1)?.url ?? start.toString(),
      runStatus: "BLOCKED",
      exactText: exact,
      confidence: 0.95,
      summary: exact,
      page: emptyPage(document.hops),
      findings: [
        finding(id(), "links", {
          title: "Crawl stopped before the document was read",
          description:
            "The start URL redirected, and the next hop was outside the allowed host or into a flow this auditor refuses. No further requests were made.",
          severity: "warning",
          status: "BLOCKED",
          role: "guardrail",
          exactText: exact,
          expected:
            "The document is served from the host that was pasted, or from its www or apex twin, without passing through checkout, payment, or login.",
          confidence: 0.95,
        }),
      ],
    });
    return auditReportSchema.parse(report);
  }

  const pageRes = document.page;
  const finalUrl = document.finalUrl;
  const contentType = pageRes.headers.get("content-type");
  const isHtml = (contentType ?? "").toLowerCase().includes("html");
  const decodedBytes = Buffer.byteLength(pageRes.body, "utf8");
  const contentLength = numberHeader(pageRes.headers.get("content-length"));

  const root = isHtml ? parse(pageRes.body) : null;
  const title = textOrNull(root?.querySelector("title")?.text);
  const metaDescription = metaContent(root, "description");
  const robotsMeta = metaContent(root, "robots");
  const viewport = metaContent(root, "viewport");
  const canonical =
    root?.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;
  const lang = root?.querySelector("html")?.getAttribute("lang")?.trim() || null;
  const h1 = (root?.querySelectorAll("h1") ?? [])
    .map((el) => cleanText(el.text))
    .filter(Boolean);
  const xRobots = pageRes.headers.get("x-robots-tag");

  const page = {
    status: pageRes.status,
    decodedHtmlBytes: isHtml ? decodedBytes : null,
    contentLengthHeader: contentLength,
    headerMs: Math.round(pageRes.headerMs),
    totalMs: Math.round(pageRes.totalMs),
    contentType,
    contentEncoding: pageRes.headers.get("content-encoding"),
    cacheControl: pageRes.headers.get("cache-control"),
    title,
    metaDescription,
    canonical,
    robotsMeta,
    xRobotsTag: xRobots,
    viewport,
    lang,
    h1,
    hops: document.hops,
  };

  const origin = new URL(finalUrl).origin;
  const robotsUrl = `${origin}/robots.txt`;
  const defaultSitemap = `${origin}/sitemap.xml`;

  const [robotsFetch, earlySitemap] = await Promise.all([
    safeSideFetch(robotsUrl, hosts, deadline),
    safeSideFetch(defaultSitemap, hosts, deadline),
  ]);

  let robotsNote = "robots.txt was not requested.";
  let robotsStatus: number | null = null;
  let disallow: string[] = [];
  let sitemapUrl = defaultSitemap;
  let sitemapFetch = earlySitemap;

  if (robotsFetch) {
    robotsStatus = robotsFetch.status;
    if (robotsFetch.status === 200) {
      const parsedRobots = parseRobots(robotsFetch.body);
      disallow = parsedRobots.disallow;
      const hasAgent = /user-agent\s*:/i.test(robotsFetch.body);
      robotsNote = hasAgent
        ? `HTTP 200. User-agent groups found. Disallow rules for *: ${disallow.length === 0 ? "none" : disallow.slice(0, 8).join(", ")}.`
        : "HTTP 200, but no User-agent line was found in the first 100 KB.";
      const fromRobots = parsedRobots.sitemaps.find((entry) => {
        try {
          const u = new URL(entry);
          return hosts.has(u.hostname.toLowerCase());
        } catch {
          return false;
        }
      });
      if (fromRobots && fromRobots !== defaultSitemap) {
        sitemapUrl = fromRobots;
        sitemapFetch = await safeSideFetch(fromRobots, hosts, deadline);
      }
    } else if (robotsFetch.status === 404) {
      robotsNote = "HTTP 404. Crawlers will assume the site does not restrict them with robots.txt.";
    } else {
      robotsNote = `HTTP ${robotsFetch.status}. The file was not treated as a rule set.`;
    }
  } else {
    robotsNote = "The robots.txt request did not finish inside the time budget.";
  }

  let sitemapStatus: number | null = sitemapFetch?.status ?? null;
  let sitemapNote = "sitemap.xml was not requested.";
  if (!sitemapFetch) {
    sitemapNote = "The sitemap request did not finish inside the time budget.";
  } else if (sitemapFetch.status === 200) {
    const locs = sitemapFetch.body.match(/<loc>/gi)?.length ?? 0;
    const kind = /<sitemapindex/i.test(sitemapFetch.body)
      ? "a sitemap index"
      : /<urlset/i.test(sitemapFetch.body)
        ? "a urlset"
        : "a 200 response that is not clearly a sitemap";
    sitemapNote = sitemapFetch.truncated
      ? `HTTP 200, ${kind}. At least ${locs} <loc> entries in the first 100 KB. The rest was not read, and those URLs were not crawled.`
      : `HTTP 200, ${kind}. ${locs} <loc> entries. Those URLs were not crawled in this pass.`;
  } else if (sitemapFetch.status === 404) {
    sitemapNote = "HTTP 404. No sitemap at this URL.";
  } else {
    sitemapNote = `HTTP ${sitemapFetch.status}.`;
  }

  addDocumentFindings({
    id,
    findings,
    pageRes,
    isHtml,
    decodedBytes,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    xRobots,
    viewport,
    lang,
    h1,
    finalUrl,
    hops: document.hops,
    robotsStatus,
    robotsNote,
    sitemapStatus,
    sitemapNote,
    root,
    html: pageRes.body,
  });

  const linkPlan = root
    ? planLinks(root, finalUrl, hosts, disallow)
    : { discovered: 0, chosen: [] as string[], skipped: [] as { url: string; reason: string }[], externalHosts: [] as string[] };

  const canFanOut = pageRes.status >= 200 && pageRes.status < 400 && isHtml;
  const checked: AuditReport["links"]["checked"] = [];
  if (canFanOut) {
    const queue = linkPlan.chosen.slice(0, MAX_LINK_CHECKS);
    const results = await mapPool(queue, 4, async (target) => {
      if (Date.now() > deadline - 500) {
        return { url: target, status: null, ms: null, note: "Skipped: time budget used up." };
      }
      try {
        const result = await fetchFollowing(target, hosts, deadline, CHILD_TIMEOUT_MS);
        if (result.stopped || !result.page) {
          return {
            url: target,
            status: result.hops.at(-1)?.status ?? null,
            ms: null,
            note: result.stopped ?? "Stopped.",
          };
        }
        const status = result.page.status;
        const note =
          result.hops.length > 1
            ? `Final HTTP ${status} after ${result.hops.length - 1} same-host redirect${result.hops.length === 2 ? "" : "s"}.`
            : `HTTP ${status}.`;
        return { url: target, status, ms: Math.round(result.page.totalMs), note };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed.";
        return { url: target, status: null, ms: null, note: message };
      }
    });
    checked.push(...results);
  }

  const soft = canFanOut ? await probeUnknownPath(origin, hosts, deadline) : null;

  const completed = checked.filter((row) => row.status != null);
  const broken = completed.filter((row) => (row.status ?? 0) >= 400);
  const ok = completed.filter((row) => (row.status ?? 0) < 400);
  const unfinished = checked.filter((row) => row.status == null);

  if (!canFanOut) {
    findings.push(
      finding(id(), "links", {
        title: "Same-host link sample was not fetched",
        description:
          "Child links are fetched only after the start URL returns an HTML document with a status below 400. That condition was not met, so no further pages were requested.",
        severity: "notice",
        status: "BLOCKED",
        role: "crawler",
        exactText: `Start status ${pageRes.status}. HTML: ${isHtml ? "yes" : "no"}.`,
        expected:
          "The start URL returns HTML with a 2xx or 3xx status, and then up to 8 same-host links from the nav are checked.",
        confidence: 0.9,
      }),
    );
  } else if (completed.length === 0) {
    findings.push(
      finding(id(), "links", {
        title: "No same-host link check finished",
        description:
          "The homepage listed links, but none of the selected checks returned a status before the timeout. A missing status is not the same as a 404.",
        severity: "notice",
        status: "BLOCKED",
        role: "crawler",
        exactText: unfinished.map((row) => `${row.url} — ${row.note}`).join(" | ") || "No link was checked.",
        expected: "Each selected same-host link returns an HTTP status within 7 seconds.",
        confidence: 0.7,
      }),
    );
  } else if (broken.length === 0) {
    findings.push(
      finding(id(), "links", {
        title: "Checked same-host links returned a status below 400",
        description:
          "A short sample of same-host links, nav links first, was requested with GET. The body was discarded. This is not a crawl of the whole site.",
        severity: "pass",
        status: "HEALED",
        role: "crawler",
        exactText: `${ok.length} of ${completed.length} finished checks returned a status below 400.`,
        expected: "Every link in this sample returns a final status below 400.",
        confidence: 0.86,
      }),
    );
  } else {
    findings.push(
      finding(id(), "links", {
        title: "Some checked same-host links returned an error status",
        description:
          "A visitor who uses these links would land on an error response, or the server refused the crawler. Confirm in a normal browser before deleting the link: some hosts block unknown clients and still work for people.",
        severity: "error",
        status: "OUTAGE",
        role: "crawler",
        exactText: broken
          .map((row) => `${row.status} ${row.url}`)
          .slice(0, 8)
          .join(" | "),
        expected: "Each sampled same-host link returns a final status below 400.",
        confidence: 0.8,
      }),
    );
  }

  if (unfinished.length > 0 && completed.length > 0) {
    findings.push(
      finding(id(), "links", {
        title: "Some link checks did not finish",
        description:
          "These URLs were selected and then skipped or timed out. They are not counted as broken.",
        severity: "notice",
        status: "BLOCKED",
        role: "crawler",
        exactText: unfinished
          .map((row) => `${row.url} — ${row.note}`)
          .slice(0, 6)
          .join(" | "),
        expected: "Each selected link returns a status within the time budget.",
        confidence: 0.6,
      }),
    );
  }

  if (soft) {
    findings.push(
      finding(id(), "links", {
        title: "Unknown path response",
        description:
          "A path that does not exist on a normal site should return 404. A 200, or a redirect to the homepage, often means a soft 404: the visitor sees a page and the status hides the miss.",
        severity: soft.status === 404 ? "pass" : soft.status == null ? "notice" : "warning",
        status: soft.status === 404 ? "HEALED" : soft.status == null ? "BLOCKED" : "OUTAGE",
        role: "crawler",
        exactText: soft.exactText,
        expected: "A nonsense path on this host returns HTTP 404.",
        confidence: soft.status == null ? 0.4 : 0.84,
      }),
    );
  }

  const forms = root ? collectForms(root, finalUrl) : [];
  const controls = root ? collectControls(root) : [];
  addUiAndNavFindings({ id, findings, root, forms, controls, viewport, isHtml });

  const softCounted = soft != null && soft.status != null;
  const softOk = soft?.status === 404;
  const linkDenom = completed.length + (softCounted ? 1 : 0);
  const linkOk = ok.length + (softOk ? 1 : 0);
  const linksScore = linkDenom === 0 ? null : Math.round((100 * linkOk) / linkDenom);
  const performance = scoreFromFindings(findings, "performance");
  const seo = scoreFromFindings(findings, "seo");
  const navigation = scoreFromFindings(findings, "navigation");
  const ui = scoreFromFindings(findings, "ui");
  const parts = [performance, seo, linksScore, navigation, ui].filter(
    (value): value is number => value != null,
  );
  const overall = parts.length
    ? Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length)
    : null;

  const runStatus: AgentStatus =
    pageRes.status >= 500 || pageRes.status === 0
      ? "OUTAGE"
      : pageRes.status >= 400
        ? "OUTAGE"
        : "HEALED";

  const summary = buildSummary({
    status: pageRes.status,
    totalMs: Math.round(pageRes.totalMs),
    title,
    checked: completed.length,
    broken: broken.length,
    finalUrl,
  });

  const report: AuditReport = {
    source: "live",
    sampleReason: null,
    requestedUrl: start.toString(),
    finalUrl,
    fetchedAt: new Date().toISOString(),
    runStatus,
    role: "public visitor",
    exactText: `HTTP ${pageRes.status} for ${finalUrl} in ${Math.round(pageRes.totalMs)} ms.`,
    confidence: 0.9,
    summary,
    preconditions: PRECONDITIONS,
    scores: {
      overall,
      performance,
      seo,
      links: linksScore,
      navigation,
      ui,
    },
    scoreNote: SCORE_NOTE,
    page,
    robots: { url: robotsUrl, status: robotsStatus, note: robotsNote },
    sitemap: { url: sitemapUrl, status: sitemapStatus, note: sitemapNote },
    links: {
      discoveredSameHost: linkPlan.discovered,
      checked,
      skippedSample: linkPlan.skipped.slice(0, 12),
      skippedCount: linkPlan.skipped.length,
      externalHosts: linkPlan.externalHosts.slice(0, 8),
    },
    forms,
    controlsNotUsed: controls,
    guardrails: GUARDRAILS,
    findings,
    notMeasured: NOT_MEASURED,
    nodesRun: NODES_RUN,
    nodesSkipped: NODES_SKIPPED,
  };

  return auditReportSchema.parse(report);
}

function buildSummary(input: {
  status: number;
  totalMs: number;
  title: string | null;
  checked: number;
  broken: number;
  finalUrl: string;
}): string {
  const titleBit = input.title ? ` Title: “${input.title}”.` : " No title element was found.";
  const linkBit =
    input.checked === 0
      ? " No child link check finished."
      : ` ${input.checked} same-host links were checked; ${input.broken} returned a status of 400 or higher.`;
  return `The document at ${input.finalUrl} returned HTTP ${input.status} in ${input.totalMs} ms.${titleBit}${linkBit} Core Web Vitals, rendered layout, and JavaScript errors were not measured. No form was submitted.`;
}

function addDocumentFindings(input: {
  id: () => string;
  findings: Finding[];
  pageRes: FetchResult;
  isHtml: boolean;
  decodedBytes: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  xRobots: string | null;
  viewport: string | null;
  lang: string | null;
  h1: string[];
  finalUrl: string;
  hops: Hop[];
  robotsStatus: number | null;
  robotsNote: string;
  sitemapStatus: number | null;
  sitemapNote: string;
  root: HTMLElement | null;
  html: string;
}) {
  const { id, findings, pageRes } = input;
  const redirects = Math.max(0, input.hops.length - 1);

  findings.push(
    finding(id(), "performance", {
      title: "HTML document response",
      description:
        "This is how long a GET of the document took, from send to the end of the body we kept. It is not Time to First Byte from the Chrome UX Report, and it is not Largest Contentful Paint.",
      severity:
        pageRes.status >= 500 || pageRes.totalMs > 3000
          ? "error"
          : pageRes.status >= 400 || pageRes.totalMs > 1800
            ? "warning"
            : "pass",
      status: pageRes.status < 400 && pageRes.totalMs <= 1800 ? "HEALED" : "OUTAGE",
      role: "crawler",
      exactText: `HTTP ${pageRes.status} in ${Math.round(pageRes.totalMs)} ms (${Math.round(pageRes.headerMs)} ms to headers).`,
      expected: "The HTML document returns a status below 400 in 1.8 seconds or less.",
      confidence: 0.9,
    }),
  );

  findings.push(
    finding(id(), "performance", {
      title: "Redirects before the document",
      description:
        "Each hop is an extra request before the visitor sees the page. One hop to add or remove www is common. A long chain wastes the first load.",
      severity: redirects <= 1 ? "pass" : redirects === 2 ? "warning" : "error",
      status: redirects <= 1 ? "HEALED" : "OUTAGE",
      role: "crawler",
      exactText:
        redirects === 0
          ? `No redirect. First response was HTTP ${pageRes.status}.`
          : input.hops
              .map((hop) => `${hop.status} ${hop.url}${hop.location ? ` → ${hop.location}` : ""}`)
              .join(" | "),
      expected: "The pasted URL reaches the document in 0 or 1 redirect.",
      confidence: 0.92,
    }),
  );

  if (input.isHtml) {
    const kb = Math.round(input.decodedBytes / 1024);
    const severity: Severity = kb > 2048 ? "error" : kb > 1024 ? "warning" : kb > 200 ? "notice" : "pass";
    findings.push(
      finding(id(), "performance", {
        title: "Decoded HTML size",
        description:
          "This is the size of the HTML document after decoding, capped at 2 MB. Semrush treats HTML over 2 MB as an error. Script and CSS linked from the page are not included. This is not the rendered page weight.",
        severity,
        status: severity === "error" || severity === "warning" ? "OUTAGE" : "HEALED",
        role: "crawler",
        exactText: `${input.decodedBytes.toLocaleString("en-US")} bytes (${kb} KB) of decoded HTML. Content-Encoding: ${pageRes.headers.get("content-encoding") ?? "not set"}.`,
        expected: "Decoded HTML stays under 1 MB, and under Semrush's 2 MB error line.",
        confidence: 0.9,
      }),
    );
  }

  findings.push(
    finding(id(), "performance", {
      title: "Core Web Vitals and the Lighthouse score",
      description:
        "PageSpeed's performance score is a weighted lab score: Total Blocking Time 30%, Largest Contentful Paint 25%, Cumulative Layout Shift 25%, First Contentful Paint 10%, Speed Index 10%. Field data is the Chrome UX Report 75th percentile. Neither can be measured by fetching HTML.",
      severity: "notice",
      status: "BLOCKED",
      role: "crawler",
      exactText: "Not measured. No browser, no trace, no CrUX query.",
      expected:
        "A later browser pass records lab LCP, CLS, and Total Blocking Time, and shows field data only when a CrUX sample exists.",
      confidence: 0.99,
    }),
  );

  const https = new URL(input.finalUrl).protocol === "https:";
  findings.push(
    finding(id(), "seo", {
      title: "HTTPS on the final document",
      description:
        "The final URL after same-host redirects should be https. This check does not grade the certificate chain or mixed content.",
      severity: https ? "pass" : "error",
      status: https ? "HEALED" : "OUTAGE",
      role: "crawler",
      exactText: input.finalUrl,
      expected: "The document URL starts with https://.",
      confidence: 0.95,
    }),
  );

  if (!input.isHtml) {
    findings.push(
      finding(id(), "seo", {
        title: "Response was not HTML",
        description:
          "Title, meta description, headings, and links are read from HTML. This response was something else, so those checks were not run.",
        severity: "notice",
        status: "BLOCKED",
        role: "crawler",
        exactText: input.pageRes.headers.get("content-type") ?? "No content-type header.",
        expected: "The start URL returns a text/html document.",
        confidence: 0.9,
      }),
    );
    return;
  }

  const titleLen = input.title?.length ?? 0;
  findings.push(
    finding(id(), "seo", {
      title: "Title element",
      description:
        "The title is the string a browser tab and, often, a search result use. Semrush warns when a title is 10 characters or shorter, or longer than 70. Those are editorial thresholds, not a Google ranking formula.",
      severity: !input.title ? "error" : titleLen <= 10 || titleLen > 70 ? "warning" : "pass",
      status: !input.title || titleLen <= 10 || titleLen > 70 ? "OUTAGE" : "HEALED",
      role: "public visitor",
      exactText: input.title ? `“${input.title}” (${titleLen} characters)` : "No title element.",
      expected: "Exactly one title, longer than 10 characters and 70 characters or fewer.",
      confidence: input.title ? 0.7 : 0.95,
    }),
  );

  const descLen = input.metaDescription?.length ?? 0;
  findings.push(
    finding(id(), "seo", {
      title: "Meta description",
      description:
        "Search engines may use this as the snippet. Semrush files a missing description as a warning. A very short or very long description is an editorial warning in this pass, not a measured ranking change.",
      severity: !input.metaDescription ? "warning" : descLen < 50 || descLen > 160 ? "warning" : "pass",
      status: input.metaDescription && descLen >= 50 && descLen <= 160 ? "HEALED" : "OUTAGE",
      role: "public visitor",
      exactText: input.metaDescription
        ? `“${input.metaDescription}” (${descLen} characters)`
        : "No meta name=description.",
      expected: "One meta description, between 50 and 160 characters.",
      confidence: 0.62,
    }),
  );

  findings.push(
    finding(id(), "seo", {
      title: "H1 heading",
      description:
        "One H1 should state what the page is. Zero leaves the outline to whatever the browser or a script paints later. More than one makes the outline ambiguous in the server HTML. This pass cannot see headings that JavaScript inserts.",
      severity: input.h1.length === 1 ? "pass" : "warning",
      status: input.h1.length === 1 ? "HEALED" : "OUTAGE",
      role: "public visitor",
      exactText: input.h1.length === 0 ? "No H1 in the server HTML." : input.h1.map((item) => `“${item}”`).join(" | "),
      expected: "The server HTML contains exactly one H1.",
      confidence: 0.88,
    }),
  );

  let canonicalExact = "No canonical link.";
  let canonicalSeverity: Severity = "warning";
  let canonicalStatus: AgentStatus = "OUTAGE";
  if (input.canonical) {
    try {
      const canon = new URL(input.canonical, input.finalUrl);
      const here = new URL(input.finalUrl);
      const same =
        canon.hostname.toLowerCase() === here.hostname.toLowerCase() &&
        canon.pathname.replace(/\/$/, "") === here.pathname.replace(/\/$/, "");
      canonicalExact = canon.toString();
      canonicalSeverity = same ? "pass" : "warning";
      canonicalStatus = same ? "HEALED" : "OUTAGE";
      if (!same) canonicalExact = `${canon.toString()} (differs from ${here.toString()})`;
    } catch {
      canonicalExact = input.canonical;
      canonicalSeverity = "warning";
    }
  }
  findings.push(
    finding(id(), "seo", {
      title: "Canonical link",
      description:
        "A canonical tells a crawler which URL is the preferred copy of this page. This pass checks that the tag exists and points at the same host and path that was fetched. It does not compare the tag to an index.",
      severity: canonicalSeverity,
      status: canonicalStatus,
      role: "crawler",
      exactText: canonicalExact,
      expected: "A rel=canonical points at the same host and path as the fetched document.",
      confidence: 0.8,
    }),
  );

  const noindex = /noindex/i.test(`${input.robotsMeta ?? ""} ${input.xRobots ?? ""}`);
  findings.push(
    finding(id(), "seo", {
      title: "Indexability of this URL",
      description:
        "A noindex robots meta tag or X-Robots-Tag asks crawlers not to index the URL. This pass does not read Search Console, so it cannot say whether the URL is actually indexed.",
      severity: noindex ? "error" : "pass",
      status: noindex ? "OUTAGE" : "HEALED",
      role: "crawler",
      exactText: `meta robots: ${input.robotsMeta ?? "not set"}. X-Robots-Tag: ${input.xRobots ?? "not set"}.`,
      expected: "Neither the robots meta tag nor X-Robots-Tag contains noindex, unless the page is meant to stay out of search.",
      confidence: 0.9,
    }),
  );

  findings.push(
    finding(id(), "seo", {
      title: "html lang",
      description:
        "The lang attribute names the language of the document for browsers and assistive tech. It is not a substitute for hreflang, which this pass does not validate.",
      severity: input.lang ? "pass" : "warning",
      status: input.lang ? "HEALED" : "OUTAGE",
      role: "public visitor",
      exactText: input.lang ? `lang="${input.lang}"` : "No lang attribute on <html>.",
      expected: 'The html element has a lang attribute, for example lang="en".',
      confidence: 0.9,
    }),
  );

  findings.push(
    finding(id(), "seo", {
      title: "robots.txt",
      description:
        "robots.txt is fetched from the same host. A missing file is a notice, not a defect. Format is checked only for a User-agent line and Disallow rules aimed at *. Sitemap URLs inside the file are noted, not crawled.",
      severity: input.robotsStatus === 200 && /no User-agent/.test(input.robotsNote) ? "warning" : "notice",
      status: input.robotsStatus === 200 && /no User-agent/.test(input.robotsNote) ? "OUTAGE" : "HEALED",
      role: "crawler",
      exactText: input.robotsNote,
      expected: "If robots.txt exists, it returns HTTP 200 and contains a User-agent line.",
      confidence: input.robotsStatus == null ? 0.4 : 0.85,
    }),
  );

  findings.push(
    finding(id(), "seo", {
      title: "Sitemap discovery",
      description:
        "The default /sitemap.xml is requested, or a same-host Sitemap line from robots.txt. Entries are counted in the first 100 KB only. They are not fetched one by one.",
      severity: "notice",
      status: "HEALED",
      role: "crawler",
      exactText: input.sitemapNote,
      expected: "A sitemap returns HTTP 200 and lists canonical 200 URLs. This pass only checks that a sitemap responds.",
      confidence: input.sitemapStatus == null ? 0.4 : 0.8,
    }),
  );

  if (input.root) {
    const clone = parse(input.html);
    for (const el of clone.querySelectorAll("script, style, noscript")) el.remove();
    const visible = cleanText(clone.querySelector("body")?.text ?? "");
    const ratio = input.html.length === 0 ? 0 : visible.length / input.html.length;
    const low = ratio <= 0.1;
    findings.push(
      finding(id(), "seo", {
        title: "Text to HTML ratio",
        description:
          "Semrush warns when visible text is 10% or less of the HTML. This pass removes script, style, and noscript, then divides the remaining text length by the original HTML length. It is a rough ratio, not a quality judgment.",
        severity: low ? "warning" : "pass",
        status: low ? "OUTAGE" : "HEALED",
        role: "crawler",
        exactText: `${visible.length.toLocaleString("en-US")} text characters / ${input.html.length.toLocaleString("en-US")} HTML characters = ${(ratio * 100).toFixed(1)}%.`,
        expected: "Visible text is more than 10% of the HTML length.",
        confidence: 0.5,
      }),
    );
  }
}

function addUiAndNavFindings(input: {
  id: () => string;
  findings: Finding[];
  root: HTMLElement | null;
  forms: AuditReport["forms"];
  controls: string[];
  viewport: string | null;
  isHtml: boolean;
}) {
  const { id, findings, root } = input;
  if (!input.isHtml || !root) {
    findings.push(
      finding(id(), "navigation", {
        title: "Navigation was not read",
        description: "Menu labels are read from HTML. This response had no HTML document to read.",
        severity: "notice",
        status: "BLOCKED",
        role: "public visitor",
        exactText: "No HTML document.",
        expected: "The server HTML includes a nav landmark with named same-host links.",
        confidence: 0.9,
      }),
    );
    return;
  }

  const nav = root.querySelector("nav");
  const navLinks = nav ? anchorsOf(nav) : [];
  findings.push(
    finding(id(), "navigation", {
      title: "Nav landmark and its links",
      description:
        "A nav landmark is how a visitor and a crawler find the main menu in HTML. Links inside it were counted. Opening a menu that depends on JavaScript was not attempted.",
      severity: nav && navLinks.length >= 3 ? "pass" : "warning",
      status: nav && navLinks.length >= 3 ? "HEALED" : "OUTAGE",
      role: "public visitor",
      exactText: nav
        ? `${navLinks.length} links in <nav>: ${navLinks
            .slice(0, 8)
            .map((link) => link.label || link.href)
            .join(", ") || "none"}.`
        : "No <nav> element in the server HTML.",
      expected: "The server HTML contains a <nav> with at least 3 same-host links whose text names the destination.",
      confidence: 0.84,
    }),
  );

  const nonLinks = nav ? nonLinkMenuLabels(nav) : [];
  if (nonLinks.length > 0) {
    findings.push(
      finding(id(), "navigation", {
        title: "Menu labels that are not links",
        description:
          "These labels sit in the nav and are not inside an anchor. A visitor may still open them with a click that this pass does not perform. A crawler cannot follow them.",
        severity: "warning",
        status: "OUTAGE",
        role: "public visitor",
        exactText: nonLinks.slice(0, 8).join(", "),
        expected:
          "Each top-level destination is an anchor with an href, or the label's submenu links are present in the server HTML.",
        confidence: 0.72,
      }),
    );
  }

  findings.push(
    finding(id(), "navigation", {
      title: "Dropdowns and the mobile menu",
      description:
        "A senior QA pass opens every menu at a phone width and a desktop width, including labels that are buttons. This pass does not run a browser, so those paths were not walked.",
      severity: "notice",
      status: "BLOCKED",
      role: "public visitor",
      exactText: "Not opened. No click, no viewport.",
      expected:
        "Each menu control reveals its panel, the panel's links respond, and the panel can be closed, at 390px and at 1280px wide.",
      confidence: 0.99,
    }),
  );

  const images = root.querySelectorAll("img");
  const missingAlt = images.filter((img) => img.getAttribute("alt") == null);
  findings.push(
    finding(id(), "ui", {
      title: "Image alt attributes in server HTML",
      description:
        "An img without an alt attribute has no text alternative in the HTML. An empty alt is allowed for a decorative image; this pass cannot tell whether the image is decorative. CSS backgrounds are not counted.",
      severity: missingAlt.length === 0 ? "pass" : "warning",
      status: missingAlt.length === 0 ? "HEALED" : "OUTAGE",
      role: "public visitor",
      exactText:
        missingAlt.length === 0
          ? `${images.length} img elements, and each has an alt attribute.`
          : `${missingAlt.length} of ${images.length} img elements have no alt attribute. First src values: ${missingAlt
              .slice(0, 4)
              .map((img) => img.getAttribute("src") ?? "(no src)")
              .join(", ")}.`,
      expected: "Every img in the server HTML has an alt attribute.",
      confidence: 0.9,
    }),
  );

  const emptyLinks = anchorsOf(root).filter((link) => !link.label);
  findings.push(
    finding(id(), "ui", {
      title: "Links with no accessible name",
      description:
        "A link needs visible text, an aria-label, or an image alt so a visitor knows where it goes. This is the same class of issue Lighthouse calls 'links do not have descriptive text', limited to the server HTML.",
      severity: emptyLinks.length === 0 ? "pass" : "warning",
      status: emptyLinks.length === 0 ? "HEALED" : "OUTAGE",
      role: "public visitor",
      exactText:
        emptyLinks.length === 0
          ? "Every anchor in the server HTML has text, an aria-label, or an image alt."
          : `${emptyLinks.length} anchors have no name. Examples: ${emptyLinks
              .slice(0, 5)
              .map((link) => link.href)
              .join(", ")}.`,
      expected: "Every anchor has visible text, aria-label, or an image alt that names the destination.",
      confidence: 0.8,
    }),
  );

  const locksScale = /maximum-scale\s*=\s*1\b|user-scalable\s*=\s*no/i.test(input.viewport ?? "");
  findings.push(
    finding(id(), "ui", {
      title: "Viewport meta",
      description:
        "A viewport meta tag lets a phone lay the page out at the device width. maximum-scale=1 or user-scalable=no blocks pinch-zoom. Overlap and contrast still need a rendered browser.",
      severity: !input.viewport ? "error" : locksScale ? "warning" : "pass",
      status: !input.viewport || locksScale ? "OUTAGE" : "HEALED",
      role: "public visitor",
      exactText: input.viewport ? `content="${input.viewport}"` : "No viewport meta tag.",
      expected:
        'A viewport meta tag sets width=device-width and initial-scale, and does not set maximum-scale=1 or user-scalable=no.',
      confidence: 0.92,
    }),
  );

  findings.push(
    finding(id(), "ui", {
      title: "Rendered layout, contrast, and crashes",
      description:
        "Overlap, text overflow, contrast, and console errors are what a senior QA pass looks for on the painted page. Fetching HTML cannot see them.",
      severity: "notice",
      status: "BLOCKED",
      role: "public visitor",
      exactText: "Not measured. No screenshot and no console log.",
      expected:
        "At 390px and 1280px, no text overflows its box, contrast meets the intended reading text, and the console shows no uncaught exception on load.",
      confidence: 0.99,
    }),
  );

  if (input.forms.length === 0) {
    findings.push(
      finding(id(), "ui", {
        title: "Forms in the server HTML",
        description:
          "No form element was present in the HTML this pass received. A booking or sign-in form can still appear after JavaScript runs. Absence here is not proof the site has no forms.",
        severity: "notice",
        status: "BLOCKED",
        role: "guardrail",
        exactText: "0 form elements in the server HTML. None were submitted, because there was nothing to submit.",
        expected:
          "If a form is present, its action, method, and field names are recorded, and no submit, login, or payment request is sent.",
        confidence: 0.75,
      }),
    );
  } else {
    const described = input.forms
      .map((form) => `${form.method.toUpperCase()} ${form.action} fields: ${form.fields.join(", ") || "(none named)"}`)
      .join(" | ");
    findings.push(
      finding(id(), "ui", {
        title: "Forms observed and not submitted",
        description:
          "The form is listed so a later test case can name the fields. This pass does not type, does not press submit, and does not follow a payment or login action.",
        severity: "notice",
        status: "BLOCKED",
        role: "guardrail",
        exactText: described,
        expected: "No POST is sent. Field values stay empty. Checkout and login are not attempted.",
        confidence: 0.95,
      }),
    );
  }

  if (input.controls.length > 0) {
    findings.push(
      finding(id(), "ui", {
        title: "Sign-in, pay, or similar controls left unused",
        description:
          "These controls match words this auditor is not allowed to activate. They were read from the HTML and not clicked.",
        severity: "notice",
        status: "BLOCKED",
        role: "guardrail",
        exactText: input.controls.slice(0, 8).join(" | "),
        expected: "The control is visible in the report and receives no click, no keystrokes, and no request.",
        confidence: 0.8,
      }),
    );
  }
}

function planLinks(
  root: HTMLElement,
  base: string,
  hosts: Set<string>,
  disallow: string[],
): {
  discovered: number;
  chosen: string[];
  skipped: { url: string; reason: string }[];
  externalHosts: string[];
} {
  const baseUrl = new URL(base);
  const nav = root.querySelector("nav");
  const ordered = [
    ...(nav ? anchorsOf(nav) : []),
    ...anchorsOf(root),
  ];
  const seen = new Set<string>();
  const chosen: string[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const external = new Set<string>();
  let discovered = 0;

  for (const link of ordered) {
    let url: URL;
    try {
      url = new URL(link.href, base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    if (!hosts.has(url.hostname.toLowerCase())) {
      external.add(url.hostname.toLowerCase());
      continue;
    }
    discovered += 1;
    if (url.hostname === baseUrl.hostname && url.pathname === baseUrl.pathname && url.search === baseUrl.search) {
      skipped.push({ url: key, reason: "Same document as the start URL." });
      continue;
    }
    if (isForbiddenUrl(url)) {
      skipped.push({ url: key, reason: "Checkout, payment, login, or delete path. Not fetched." });
      continue;
    }
    if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) {
      skipped.push({ url: key, reason: "Framework asset or API path. Not fetched." });
      continue;
    }
    if (ASSET_EXT.test(url.pathname)) {
      skipped.push({ url: key, reason: "Static asset. Not fetched." });
      continue;
    }
    if (isDisallowed(url.pathname, disallow)) {
      skipped.push({ url: key, reason: "Disallowed by robots.txt for User-agent: *. Not fetched." });
      continue;
    }
    if (chosen.length >= MAX_LINK_CHECKS) {
      skipped.push({ url: key, reason: "Over the 8-link sample. Not fetched." });
      continue;
    }
    chosen.push(key);
  }

  return { discovered, chosen, skipped, externalHosts: [...external] };
}

function anchorsOf(root: HTMLElement): { href: string; label: string }[] {
  return root.querySelectorAll("a").map((anchor) => {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    const aria = anchor.getAttribute("aria-label")?.trim() ?? "";
    const imgAlt = anchor
      .querySelectorAll("img")
      .map((img) => img.getAttribute("alt")?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    const label = cleanText(anchor.text) || aria || imgAlt;
    return { href, label };
  }).filter((link) => link.href && !link.href.startsWith("#"));
}

function nonLinkMenuLabels(nav: HTMLElement): string[] {
  const labels: string[] = [];
  for (const el of nav.querySelectorAll("p, button")) {
    if (insideAnchor(el) || el.querySelector("a")) continue;
    const text = cleanText(el.text).replace(/\s*arrow right\s*/i, "").trim();
    if (!text || text.length > 40) continue;
    if (/^arrow/i.test(text)) continue;
    labels.push(text);
  }
  return [...new Set(labels)];
}

function insideAnchor(el: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  while (current) {
    if (current.tagName === "A") return true;
    current = current.parentNode as HTMLElement | null;
  }
  return false;
}

function collectForms(root: HTMLElement, base: string): AuditReport["forms"] {
  return root.querySelectorAll("form").map((form) => {
    const actionAttr = form.getAttribute("action")?.trim() || base;
    let action = actionAttr;
    try {
      action = new URL(actionAttr, base).toString();
    } catch {
      action = actionAttr;
    }
    const fields = form
      .querySelectorAll("input, textarea, select")
      .map((field) => {
        const name = field.getAttribute("name") || field.getAttribute("id") || field.getAttribute("type") || "unnamed";
        const type = field.getAttribute("type");
        return type ? `${name} (${type})` : name;
      })
      .slice(0, 20);
    return {
      action,
      method: (form.getAttribute("method") || "get").toLowerCase(),
      fields,
    };
  });
}

function collectControls(root: HTMLElement): string[] {
  const pattern = /\b(sign\s*in|register|log\s*in|checkout|pay|add to cart|book now|subscribe)\b/i;
  const labels: string[] = [];
  for (const el of root.querySelectorAll("button, a, [role='button']")) {
    const text = cleanText(el.text);
    if (!text || !pattern.test(text)) continue;
    if (insideAnchor(el) && el.tagName !== "A") continue;
    labels.push(el.tagName === "A" ? `${text} → ${el.getAttribute("href") ?? ""}` : text);
  }
  return [...new Set(labels)].slice(0, 12);
}

async function probeUnknownPath(
  origin: string,
  hosts: Set<string>,
  deadline: number,
): Promise<{ status: number | null; exactText: string } | null> {
  const token = `qa-first-pass-${Date.now().toString(36)}`;
  const url = `${origin}/${token}`;
  try {
    const result = await fetchFollowing(url, hosts, deadline, CHILD_TIMEOUT_MS);
    if (result.stopped || !result.page) {
      return { status: null, exactText: `${url} — ${result.stopped ?? "no response"}` };
    }
    const landed = result.finalUrl;
    const status = result.page.status;
    return {
      status,
      exactText: `GET ${url} → HTTP ${status} at ${landed}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return { status: null, exactText: `${url} — ${message}` };
  }
}

async function fetchFollowing(
  start: string,
  hosts: Set<string>,
  deadline: number,
  timeoutMs: number,
): Promise<{ page: FetchResult | null; finalUrl: string; hops: Hop[]; stopped: string | null }> {
  let current = start;
  const hops: Hop[] = [];
  for (let hop = 0; hop < 5; hop += 1) {
    const url = new URL(current);
    if (!hosts.has(url.hostname.toLowerCase())) {
      return {
        page: null,
        finalUrl: current,
        hops,
        stopped: `Stopped. ${current} is outside the allowed host.`,
      };
    }
    if (isForbiddenUrl(url)) {
      return {
        page: null,
        finalUrl: current,
        hops,
        stopped: `Stopped. ${current} is a checkout, payment, login, or delete URL.`,
      };
    }
    await assertPublicDns(url.hostname);
    const remaining = deadline - Date.now();
    if (remaining < 500) {
      throw new CrawlError("The crawl time budget ran out.");
    }
    const page = await requestOnce(current, Math.min(timeoutMs, remaining));
    hops.push({ url: current, status: page.status, location: page.location });
    if (page.status >= 300 && page.status < 400 && page.location) {
      const next = new URL(page.location, current);
      current = next.toString();
      continue;
    }
    return { page, finalUrl: current, hops, stopped: null };
  }
  throw new CrawlError("Stopped after 5 redirects.");
}

async function requestOnce(url: string, timeoutMs: number, maxBytes = MAX_HTML_BYTES): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "user-agent": USER_AGENT,
        "accept-language": "en",
      },
    });
    const headerMs = performance.now() - started;
    const location = response.headers.get("location");
    const { body, truncated } = await readBody(response, maxBytes);
    return {
      status: response.status,
      headers: response.headers,
      body,
      truncated,
      headerMs,
      totalMs: performance.now() - started,
      location,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new CrawlError(`Timed out after ${timeoutMs} ms: ${url}`);
    }
    const message = error instanceof Error ? error.message : "Request failed.";
    throw new CrawlError(`Could not fetch ${url}. ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { body: "", truncated: false };
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received + value.length > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      received = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.length;
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return { body: new TextDecoder("utf-8", { fatal: false }).decode(merged), truncated };
}

async function safeSideFetch(url: string, hosts: Set<string>, deadline: number): Promise<FetchResult | null> {
  try {
    const parsed = new URL(url);
    if (!hosts.has(parsed.hostname.toLowerCase())) return null;
    if (isForbiddenUrl(parsed)) return null;
    await assertPublicDns(parsed.hostname);
    const remaining = deadline - Date.now();
    if (remaining < 800) return null;
    return await requestOnce(url, Math.min(CHILD_TIMEOUT_MS, remaining), MAX_SIDE_BYTES);
  } catch {
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}

function scoreFromFindings(findings: Finding[], section: SectionId): number | null {
  const rows = findings.filter(
    (item) => item.section === section && item.status !== "BLOCKED" && item.severity !== "notice",
  );
  if (rows.length === 0) return null;
  const earned = rows.reduce((sum, item) => {
    if (item.severity === "pass") return sum + 1;
    if (item.severity === "warning") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((100 * earned) / rows.length);
}

function finding(
  id: string,
  section: SectionId,
  fields: Omit<Finding, "id" | "section">,
): Finding {
  return { id, section, ...fields };
}

function metaContent(root: HTMLElement | null, name: string): string | null {
  if (!root) return null;
  const tag = root
    .querySelectorAll("meta")
    .find((el) => (el.getAttribute("name") || "").toLowerCase() === name);
  const content = tag?.getAttribute("content")?.trim();
  return content || null;
}

function textOrNull(value: string | undefined): string | null {
  const cleaned = cleanText(value ?? "");
  return cleaned || null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function numberHeader(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyPage(hops: Hop[]): AuditReport["page"] {
  return {
    status: hops.at(-1)?.status ?? null,
    decodedHtmlBytes: null,
    contentLengthHeader: null,
    headerMs: null,
    totalMs: null,
    contentType: null,
    contentEncoding: null,
    cacheControl: null,
    title: null,
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    xRobotsTag: null,
    viewport: null,
    lang: null,
    h1: [],
    hops,
  };
}

function baseReport(partial: {
  requestedUrl: string;
  finalUrl: string;
  runStatus: AgentStatus;
  exactText: string;
  confidence: number;
  summary: string;
  page: AuditReport["page"];
  findings: Finding[];
}): AuditReport {
  return {
    source: "live",
    sampleReason: null,
    requestedUrl: partial.requestedUrl,
    finalUrl: partial.finalUrl,
    fetchedAt: new Date().toISOString(),
    runStatus: partial.runStatus,
    role: "guardrail",
    exactText: partial.exactText,
    confidence: partial.confidence,
    summary: partial.summary,
    preconditions: PRECONDITIONS,
    scores: {
      overall: null,
      performance: null,
      seo: null,
      links: null,
      navigation: null,
      ui: null,
    },
    scoreNote: SCORE_NOTE,
    page: partial.page,
    robots: { url: "", status: null, note: "Not requested." },
    sitemap: { url: "", status: null, note: "Not requested." },
    links: {
      discoveredSameHost: 0,
      checked: [],
      skippedSample: [],
      skippedCount: 0,
      externalHosts: [],
    },
    forms: [],
    controlsNotUsed: [],
    guardrails: GUARDRAILS,
    findings: partial.findings,
    notMeasured: NOT_MEASURED,
    nodesRun: NODES_RUN,
    nodesSkipped: NODES_SKIPPED,
  };
}
