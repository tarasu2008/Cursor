import { parse, type HTMLElement } from "node-html-parser";
import {
  PRECONDITIONS,
  auditReportSchema,
  type AuditReport,
  type Category,
  type Scenario,
} from "./schema";
import {
  CrawlError,
  allowedHostsFor,
  assertPublicDns,
  isForbiddenUrl,
  parsePublicUrl,
} from "./guardrails";
import { isDisallowed, parseRobots } from "./robots";

const USER_AGENT = "QAFirstPass/0.1 (site audit; GET only; does not submit forms or sign in)";

export const MAX_PAGES = 12;
export const MAX_DEPTH = 2;
const BUDGET_MS = 55_000;
const HOME_TIMEOUT_MS = 12_000;
const CHILD_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_200_000;
const ASSET_EXT =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|eot|mp4|webm|pdf|zip|gz|xml|json)$/i;

type Mark = "pass" | "fail" | "skip";

type Opened = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ms: number;
  title: string | null;
  h1: string[];
  metaDescription: string | null;
  canonical: string | null;
  viewport: string | null;
  lang: string | null;
  robots: string | null;
  html: boolean;
  note: string | null;
  depth: number;
  label: string;
  htmlBody: string;
};

type Job = { url: string; depth: number; label: string };

export async function auditUrl(raw: string): Promise<AuditReport> {
  const start = parsePublicUrl(raw);
  await assertPublicDns(start.hostname);
  const hosts = allowedHostsFor(start.hostname);
  const deadline = Date.now() + BUDGET_MS;
  const seen = new Set<string>();
  const queue: Job[] = [];
  const pages: Opened[] = [];

  enqueue(queue, seen, { url: start.toString(), depth: 0, label: "Homepage" });
  let disallow: string[] = [];
  let robotsLoaded = false;
  let budgetSkips = 0;

  while (pages.length < MAX_PAGES && queue.length > 0) {
    if (Date.now() > deadline - 800) {
      budgetSkips = Math.min(queue.length, MAX_PAGES - pages.length);
      break;
    }
    const batch = queue.splice(0, Math.min(4, MAX_PAGES - pages.length));
    const fetched = await mapPool(batch, 4, async (job) => {
      try {
        const page = await openUrl(job.url, hosts, deadline, job.depth === 0 ? HOME_TIMEOUT_MS : CHILD_TIMEOUT_MS);
        return { job, page };
      } catch (error) {
        const message = error instanceof Error ? error.message : "The request failed.";
        return { job, page: failedOpen(job, message) };
      }
    });

    for (const item of fetched) {
      const page = item.page;
      page.depth = item.job.depth;
      page.label = item.job.label;
      pages.push(page);
      seen.add(normalize(page.finalUrl));
      if (!robotsLoaded && page.html) {
        disallow = await robotsRules(page.finalUrl, hosts, deadline);
        robotsLoaded = true;
      }
      if (page.html && page.htmlBody && page.depth < MAX_DEPTH) {
        for (const link of discoverLinks(page.htmlBody, page.finalUrl, hosts, disallow)) {
          enqueue(queue, seen, { url: link.url, depth: page.depth + 1, label: link.label });
        }
      }
    }
  }

  const homePage = pages[0];
  if (!homePage || homePage.status === 0) {
    throw new CrawlError(homePage?.note || "The homepage could not be opened.");
  }
  const home = pages[0];
  if (!home) throw new CrawlError("The homepage could not be opened.");

  const missingTarget = new URL("/qa-first-pass-missing", home.finalUrl);
  missingTarget.search = "";
  missingTarget.hash = "";
  let missing: Opened | null = null;
  let missingSkipped = false;
  if (Date.now() > deadline - 800) {
    missingSkipped = true;
  } else {
    try {
      missing = await openUrl(missingTarget.toString(), hosts, deadline, CHILD_TIMEOUT_MS);
      missing.depth = 1;
      missing.label = "Unknown path";
    } catch (error) {
      const message = error instanceof Error ? error.message : "The request failed.";
      missing = failedOpen({ url: missingTarget.toString(), depth: 1, label: "Unknown path" }, message);
    }
  }

  const coverageGap = Math.max(0, MAX_PAGES - pages.length - budgetSkips);
  const categories = buildCategories(pages, missing, missingSkipped, budgetSkips, coverageGap);
  const scenarios = buildScenarios(pages, missing);
  const automation = categories.find((item) => item.id === "automation");
  const report: AuditReport = {
    requestedUrl: start.toString(),
    finalUrl: home.finalUrl,
    fetchedAt: new Date().toISOString(),
    summary: `${pages.length} of ${MAX_PAGES} pages opened, depth ${MAX_DEPTH}. ${budgetSkips} queued pages were not opened. The unknown path ${missingSkipped ? "was not requested" : `returned HTTP ${missing?.status ?? 0}`}.`,
    scores: {
      passedPercent: automation?.score ?? 0,
      passedCount: automation?.passed ?? 0,
      total: Math.max(1, (automation?.passed ?? 0) + (automation?.failed ?? 0) + (automation?.skipped ?? 0)),
      homepageStatus: home.status,
      homepageMs: home.ms,
    },
    limits: { maxPages: MAX_PAGES, maxDepth: MAX_DEPTH, opened: pages.length },
    categories,
    scenarios,
  };
  return auditReportSchema.parse(report);
}

function buildScenarios(pages: Opened[], missing: Opened | null): Scenario[] {
  const scenarios = pages.map((page, index) => pageScenario(index + 1, page));
  if (missing) scenarios.push(missingScenario(scenarios.length + 1, missing));
  return scenarios;
}

function pageScenario(number: number, page: Opened): Scenario {
  const statusOk = page.status >= 200 && page.status < 400;
  const titleOk = Boolean(page.title);
  const h1Ok = page.h1.length === 1;
  const passed = statusOk && (!page.html || (titleOk && h1Ok));
  return {
    id: `TC-${String(number).padStart(2, "0")}`,
    name: page.depth === 0 ? "Open the submitted URL" : "Open a discovered page",
    control: page.depth === 0 ? "Submitted URL" : page.label || "Discovered link",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed,
    description:
      page.depth === 0
        ? "A public visitor opens the address they pasted. This scenario records the HTTP status, the title, and the H1 elements."
        : "The crawl opens a same-host link found in the header, nav, main, or footer. This scenario records the HTTP status, the title, and the H1 elements.",
    preconditions: `${PRECONDITIONS} Depth ${page.depth} of ${MAX_DEPTH}. The page cap is ${MAX_PAGES}.`,
    steps: [`Open ${page.requestedUrl} with GET.`, "Read the HTTP status, the title, and the H1 elements."],
    testData: `${page.label} — ${page.requestedUrl}`,
    expected: "The response status is below 400. When the response is HTML, the title is not empty and the document contains exactly one H1.",
    actual: [
      page.note,
      page.status === 0 ? "No HTTP status was returned." : `HTTP ${page.status} in ${page.ms} ms.`,
      `Final address: ${page.finalUrl}.`,
      page.title ? `Title: "${page.title}".` : page.html ? "No title element." : "Response was not HTML.",
      `H1 count: ${page.h1.length}.`,
      page.metaDescription ? "Meta description is present." : "No meta description element.",
      page.canonical ? "Canonical link is present." : "No canonical link.",
      page.viewport ? "Viewport meta element is present." : "No viewport meta element.",
      page.lang ? `Language: ${page.lang}.` : "No lang attribute on the html element.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function missingScenario(number: number, page: Opened): Scenario {
  return {
    id: `TC-${String(number).padStart(2, "0")}`,
    name: "Request an unknown path",
    control: "404 check",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed: page.status === 404,
    description: "A public visitor requests a path that is not a page on the host. This scenario checks that the response status is 404.",
    preconditions: PRECONDITIONS,
    steps: [`Open ${page.requestedUrl} with GET.`, "Read the HTTP status."],
    testData: page.requestedUrl,
    expected: "The response status is 404.",
    actual: [
      page.note,
      page.status === 0 ? "No HTTP status was returned." : `HTTP ${page.status} in ${page.ms} ms.`,
      `Final address: ${page.finalUrl}.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildCategories(
  pages: Opened[],
  missing: Opened | null,
  missingSkipped: boolean,
  budgetSkips: number,
  coverageGap: number,
): Category[] {
  const home = pages[0];
  const htmlPages = pages.filter((page) => page.html);
  const children = pages.slice(1);

  const load = scoreMarks(
    [
      ...pages.map((page) => (page.status >= 200 && page.status < 400 ? "pass" : "fail") as Mark),
      ...Array<"skip">(budgetSkips).fill("skip"),
    ],
    MAX_PAGES,
  );
  const titleMarks: Mark[] = [];
  for (const page of pages) {
    if (!page.html) {
      titleMarks.push("skip", "skip");
      continue;
    }
    titleMarks.push(page.title ? "pass" : "fail", page.h1.length === 1 ? "pass" : "fail");
  }
  titleMarks.push(...Array<"skip">(budgetSkips * 2).fill("skip"));
  const title = scoreMarks(titleMarks, MAX_PAGES * 2);

  const metaMarks: Mark[] = [];
  for (const page of pages) {
    if (!page.html) {
      metaMarks.push("skip", "skip", "skip", "skip");
      continue;
    }
    metaMarks.push(
      page.metaDescription ? "pass" : "fail",
      page.canonical ? "pass" : "fail",
      page.viewport ? "pass" : "fail",
      page.lang ? "pass" : "fail",
    );
  }
  metaMarks.push(...Array<"skip">(budgetSkips * 4).fill("skip"));
  const meta = scoreMarks(metaMarks, MAX_PAGES * 4);

  const linkMarks: Mark[] = children.map((page) => (page.status >= 200 && page.status < 400 ? "pass" : "fail"));
  linkMarks.push(...Array<"skip">(budgetSkips).fill("skip"));
  if (missingSkipped) linkMarks.push("skip");
  else if (missing) linkMarks.push(missing.status === 404 ? "pass" : "fail");
  const links = scoreMarks(linkMarks, MAX_PAGES);

  const autoMarks: Mark[] = [];
  for (const page of pages) {
    autoMarks.push(page.status >= 200 && page.status < 400 ? "pass" : "fail");
    if (!page.html) autoMarks.push("skip", "skip");
    else autoMarks.push(page.title ? "pass" : "fail", page.h1.length === 1 ? "pass" : "fail");
  }
  autoMarks.push(...Array<"skip">(budgetSkips * 3).fill("skip"));
  if (missingSkipped) autoMarks.push("skip");
  else if (missing) autoMarks.push(missing.status === 404 ? "pass" : "fail");
  const automation = scoreMarks(autoMarks, MAX_PAGES * 3 + 1);

  const titlePass = htmlPages.filter((page) => page.title).length;
  const h1Pass = htmlPages.filter((page) => page.h1.length === 1).length;
  const described = htmlPages.filter((page) => page.metaDescription).length;
  const canonical = htmlPages.filter((page) => page.canonical).length;
  const viewport = htmlPages.filter((page) => page.viewport).length;
  const lang = htmlPages.filter((page) => page.lang).length;
  const childFail = children.filter((page) => page.status < 200 || page.status >= 400).length;
  const statusFail = pages.filter((page) => page.status < 200 || page.status >= 400).length;

  return [
    category("load", "Load", load, [
      {
        label: "Status",
        value: `${pages.length - statusFail} below 400. ${statusFail} not below 400.`,
        state: statusFail ? "fail" : "pass",
      },
      {
        label: "First response",
        value: home ? `HTTP ${home.status} in ${home.ms} ms.` : "No response.",
        state: "info",
      },
      {
        label: "Coverage",
        value: coverageText(pages.length, budgetSkips, coverageGap),
        state: "info",
      },
    ]),
    category("document", "Title and headings", title, [
      {
        label: "Title",
        value: `${titlePass} of ${htmlPages.length} HTML pages have a title.`,
        state: titlePass === htmlPages.length && htmlPages.length > 0 ? "pass" : "fail",
      },
      {
        label: "H1",
        value: `${h1Pass} of ${htmlPages.length} HTML pages have exactly one H1.`,
        state: h1Pass === htmlPages.length && htmlPages.length > 0 ? "pass" : "fail",
      },
      { label: "Not scored", value: "H2 and H3 counts are not part of this score.", state: "info" },
    ]),
    category("meta", "Meta", meta, [
      fieldCount("Description", described, htmlPages.length),
      fieldCount("Canonical", canonical, htmlPages.length),
      fieldCount("Viewport", viewport, htmlPages.length),
      fieldCount("Language", lang, htmlPages.length),
      {
        label: "Not scored",
        value: "A robots meta element is not part of this score.",
        state: "info",
      },
    ]),
    category("links", "Links", links, [
      {
        label: "Discovered pages",
        value:
          children.length === 0
            ? "No same-host page past the submitted URL was opened."
            : `${children.length - childFail} of ${children.length} opened child pages returned a status below 400.`,
        state: children.length === 0 ? "info" : childFail ? "fail" : "pass",
      },
      {
        label: "Unknown path",
        value: missingSkipped
          ? "The 404 probe did not run."
          : `The unknown path returned HTTP ${missing?.status ?? 0}.`,
        state: missingSkipped ? "info" : missing?.status === 404 ? "pass" : "fail",
      },
      {
        label: "Scope",
        value: `Header, nav, main, and footer on the same host. Depth ${MAX_DEPTH}. Cap ${MAX_PAGES} pages.`,
        state: "info",
      },
    ]),
    category("automation", "Automation", automation, [
      {
        label: "Skeleton",
        value: `Same-host links from header, nav, main, and footer. GET only. Depth ${MAX_DEPTH}. Cap ${MAX_PAGES} pages.`,
        state: "info",
      },
      {
        label: "Checks",
        value: `${automation.passed} passed, ${automation.failed} failed, ${automation.skipped} skipped, ${automation.ran} ran.`,
        state: automation.failed ? "fail" : "info",
      },
      {
        label: "Recorded",
        value: "Each opened page records status, title, and H1 count. One unknown path is requested when time remains.",
        state: "info",
      },
    ]),
  ];
}

function fieldCount(label: string, present: number, total: number): Category["findings"][number] {
  return {
    label,
    value: total === 0 ? "No HTML page was opened." : `Present on ${present} of ${total} HTML pages.`,
    state: total === 0 ? "info" : present === total ? "pass" : "fail",
  };
}

function coverageText(opened: number, budgetSkips: number, coverageGap: number): string {
  const parts = [`Opened ${opened} of ${MAX_PAGES}.`];
  if (budgetSkips) parts.push(`${budgetSkips} queued pages were not opened before time ran out.`);
  if (coverageGap) parts.push(`${coverageGap} were not opened because no further same-host page was found within depth ${MAX_DEPTH}.`);
  return parts.join(" ");
}

function category(
  id: Category["id"],
  label: string,
  tally: Tally,
  findings: Category["findings"],
): Category {
  return {
    id,
    label,
    headline: `${tally.passed} passed · ${tally.failed} failed · ${tally.skipped} skipped · ${tally.ran} ran`,
    score: tally.score,
    passed: tally.passed,
    failed: tally.failed,
    skipped: tally.skipped,
    ran: tally.ran,
    findings,
  };
}

type Tally = { passed: number; failed: number; skipped: number; ran: number; score: number | null };

function scoreMarks(marks: Mark[], floor: number): Tally {
  const passed = marks.filter((mark) => mark === "pass").length;
  const failed = marks.filter((mark) => mark === "fail").length;
  const explicitSkip = marks.filter((mark) => mark === "skip").length;
  const ran = passed + failed;
  const skipped = explicitSkip + Math.max(0, floor - (ran + explicitSkip));
  const denominator = passed + failed + skipped;
  return {
    passed,
    failed,
    skipped,
    ran,
    score: denominator === 0 ? null : Math.round((100 * passed) / denominator),
  };
}

function enqueue(queue: Job[], seen: Set<string>, job: Job) {
  let key: string;
  try {
    key = normalize(job.url);
  } catch {
    return;
  }
  if (seen.has(key)) return;
  seen.add(key);
  queue.push({ ...job, url: key });
}

function normalize(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

function failedOpen(job: Job, note: string): Opened & { htmlBody: string } {
  return {
    requestedUrl: job.url,
    finalUrl: job.url,
    status: 0,
    ms: 0,
    title: null,
    h1: [],
    metaDescription: null,
    canonical: null,
    viewport: null,
    lang: null,
    robots: null,
    html: false,
    note,
    depth: job.depth,
    label: job.label,
    htmlBody: "",
  };
}

function discoverLinks(
  html: string,
  base: string,
  hosts: Set<string>,
  disallow: string[],
): { label: string; url: string }[] {
  const root = parse(html);
  const anchors = [
    ...root.querySelectorAll("header a"),
    ...root.querySelectorAll("nav a"),
    ...root.querySelectorAll("[role='navigation'] a"),
    ...root.querySelectorAll("main a"),
    ...root.querySelectorAll("footer a"),
  ];
  const baseUrl = new URL(base);
  const seen = new Set<string>();
  const found: { label: string; url: string }[] = [];
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript):/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    url.hash = "";
    if (!hosts.has(url.hostname.toLowerCase())) continue;
    if (isForbiddenUrl(url)) continue;
    if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) continue;
    if (ASSET_EXT.test(url.pathname)) continue;
    if (isDisallowed(url.pathname, disallow)) continue;
    if (sameDocument(url, baseUrl)) continue;
    const label = linkLabel(anchor) || "Link";
    if (/^(?:register|sign\s*in|log\s*in)\b/i.test(label)) continue;
    const key = normalize(url.toString());
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ label, url: key });
  }
  return found;
}

function linkLabel(anchor: HTMLElement): string {
  const aria = anchor.getAttribute("aria-label")?.trim() ?? "";
  const imgAlt = anchor
    .querySelectorAll("img")
    .map((img) => img.getAttribute("alt")?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return clean(anchor.text) || clean(aria) || clean(imgAlt);
}

function sameDocument(url: URL, base: URL): boolean {
  return normalize(url.toString()) === normalize(base.toString());
}

async function robotsRules(finalUrl: string, hosts: Set<string>, deadline: number): Promise<string[]> {
  try {
    const robotsUrl = new URL("/robots.txt", finalUrl).toString();
    const page = await openUrl(robotsUrl, hosts, deadline, 5000, 80_000);
    if (page.status !== 200) return [];
    return parseRobots(page.htmlBody).disallow;
  } catch {
    return [];
  }
}

async function openUrl(
  start: string,
  hosts: Set<string>,
  deadline: number,
  timeoutMs: number,
  maxBytes = MAX_BYTES,
): Promise<Opened & { htmlBody: string }> {
  let current = start;
  const hops: string[] = [];
  for (let hop = 0; hop < 5; hop += 1) {
    const url = new URL(current);
    if (!hosts.has(url.hostname.toLowerCase())) {
      throw new CrawlError(`Stopped. ${current} is outside the allowed host.`);
    }
    if (isForbiddenUrl(url)) {
      throw new CrawlError(`Stopped. ${current} is a checkout, payment, login, or delete URL.`);
    }
    await assertPublicDns(url.hostname);
    const remaining = deadline - Date.now();
    if (remaining < 400) throw new CrawlError("The time budget ran out.");
    const response = await requestOnce(current, Math.min(timeoutMs, remaining), maxBytes);
    hops.push(`${response.status} ${current}`);
    if (response.status >= 300 && response.status < 400 && response.location) {
      current = new URL(response.location, current).toString();
      continue;
    }
    const html = (response.contentType ?? "").toLowerCase().includes("html");
    const root = html ? parse(response.body) : null;
    const facts = documentFacts(root, current);
    return {
      requestedUrl: start,
      finalUrl: current,
      status: response.status,
      ms: response.ms,
      title: clean(root?.querySelector("title")?.text ?? "") || null,
      h1: (root?.querySelectorAll("h1") ?? []).map((el) => clean(el.text)).filter(Boolean),
      metaDescription: metaContent(root, "description"),
      canonical: facts.canonical,
      viewport: facts.viewport,
      lang: facts.lang,
      robots: facts.robots,
      html,
      note: hops.length > 1 ? `Redirects: ${hops.join(" | ")}.` : null,
      depth: 0,
      label: "",
      htmlBody: response.body,
    };
  }
  throw new CrawlError("Stopped after 5 redirects.");
}

function documentFacts(root: HTMLElement | null, base: string): {
  canonical: string | null;
  viewport: string | null;
  lang: string | null;
  robots: string | null;
} {
  if (!root) return { canonical: null, viewport: null, lang: null, robots: null };
  const canonicalTag = root.querySelectorAll("link").find((el) => (el.getAttribute("rel") || "").toLowerCase() === "canonical");
  const href = clean(canonicalTag?.getAttribute("href") ?? "");
  let canonical: string | null = null;
  if (href) {
    try {
      canonical = new URL(href, base).toString();
    } catch {
      canonical = href;
    }
  }
  return {
    canonical,
    viewport: metaContent(root, "viewport"),
    lang: clean(root.querySelector("html")?.getAttribute("lang") ?? "") || null,
    robots: metaContent(root, "robots"),
  };
}

async function requestOnce(url: string, timeoutMs: number, maxBytes: number): Promise<{
  status: number;
  body: string;
  ms: number;
  location: string | null;
  contentType: string | null;
}> {
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
    const body = await readBody(response, maxBytes);
    return {
      status: response.status,
      body,
      ms: Math.round(performance.now() - started),
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
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

async function readBody(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received + value.length > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      received = maxBytes;
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
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function metaContent(root: HTMLElement | null, name: string): string | null {
  if (!root) return null;
  const tag = root.querySelectorAll("meta").find((el) => (el.getAttribute("name") || "").toLowerCase() === name);
  return clean(tag?.getAttribute("content") ?? "") || null;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) continue;
        results[index] = await fn(item);
      }
    }),
  );
  return results;
}
