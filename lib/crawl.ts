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

const USER_AGENT =
  "QAFirstPass/0.1 (homepage audit; GET only; does not submit forms or sign in)";

const BUDGET_MS = 25_000;
const HOME_TIMEOUT_MS = 12_000;
const CHILD_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_200_000;
const MAX_CONTROLS = 16;
const ASSET_EXT =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|eot|mp4|webm|pdf|zip|gz|xml|json)$/i;

type Opened = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ms: number;
  title: string | null;
  h1: string[];
  metaDescription: string | null;
  html: boolean;
  note: string | null;
};

export async function auditUrl(raw: string): Promise<AuditReport> {
  const start = parsePublicUrl(raw);
  await assertPublicDns(start.hostname);
  const hosts = allowedHostsFor(start.hostname);
  const deadline = Date.now() + BUDGET_MS;

  const home = await openUrl(start.toString(), hosts, deadline, HOME_TIMEOUT_MS);
  const disallow = await robotsRules(home.finalUrl, hosts, deadline);
  const controls = home.html
    ? discoverControls(home.htmlBody, home.finalUrl, hosts, disallow)
    : [];

  const opened = await mapPool(controls, 4, async (control) => {
    if (Date.now() > deadline - 700) return null;
    try {
      const page = await openUrl(control.url, hosts, deadline, CHILD_TIMEOUT_MS);
      return { control, page };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The request failed.";
      return {
        control,
        page: blankOpen(control.url, message),
      };
    }
  });

  const links = opened.flatMap((row) => (row ? [row] : []));
  const missingTarget = new URL("/qa-first-pass-missing", home.finalUrl);
  missingTarget.search = "";
  missingTarget.hash = "";
  let missing: Opened;
  try {
    missing = await openUrl(missingTarget.toString(), hosts, deadline, CHILD_TIMEOUT_MS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request failed.";
    missing = blankOpen(missingTarget.toString(), message);
  }

  const facts = home.html ? documentFacts(home.htmlBody, home.finalUrl) : emptyFacts();
  const scenarios: Scenario[] = [
    loadScenario(home),
    documentScenario(home, facts),
    metaScenario(home, facts),
  ];
  for (const row of links) {
    scenarios.push(controlScenario(scenarios.length + 1, row.control.label, row.page));
  }
  scenarios.push(missingScenario(scenarios.length + 1, missing));

  const failedLinks = links.filter((row) => linkFailed(row.page)).length;
  const passedCount = scenarios.filter((item) => item.passed).length;
  const report: AuditReport = {
    requestedUrl: start.toString(),
    finalUrl: home.finalUrl,
    fetchedAt: new Date().toISOString(),
    summary: `HTTP ${home.status} in ${home.ms} ms. ${failedLinks} of ${links.length} opened header links failed. The unknown path returned HTTP ${missing.status}.`,
    scores: {
      passedPercent: Math.round((100 * passedCount) / scenarios.length),
      passedCount,
      total: scenarios.length,
      homepageStatus: home.status,
      homepageMs: home.ms,
    },
    categories: buildCategories(home, facts, links, missing),
    scenarios,
  };
  return auditReportSchema.parse(report);
}

function loadScenario(page: Opened): Scenario {
  const passed = page.status >= 200 && page.status < 400;
  return {
    id: "TC-01",
    name: "Open the homepage",
    control: "Load",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed,
    description: "A public visitor opens the address they pasted. This scenario checks the HTTP status and the time of that response.",
    preconditions: PRECONDITIONS,
    steps: [`Open ${page.requestedUrl} with GET.`, "Read the HTTP status and the elapsed time."],
    testData: page.requestedUrl,
    expected: "The response status is below 400.",
    actual: [page.note, `HTTP ${page.status} in ${page.ms} ms.`, `Final address: ${page.finalUrl}.`].filter(Boolean).join(" "),
  };
}

function documentScenario(page: Opened, facts: DocFacts): Scenario {
  const passed = Boolean(page.title) && page.h1.length === 1;
  const h1Text = page.h1.length === 0 ? "No H1." : page.h1.map((item) => `"${item}"`).join(", ");
  return {
    id: "TC-02",
    name: "Read the title and headings",
    control: "Title and headings",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed,
    description: "A public visitor reads the document that came back for the pasted address. This scenario checks the title element and the H1 elements.",
    preconditions: PRECONDITIONS,
    steps: ["Read the title element.", "Count the H1 elements and read their text.", "Count the H2 and H3 elements."],
    testData: page.finalUrl,
    expected: "The title is not empty. The document contains exactly one H1.",
    actual: [
      page.title ? `Title: "${page.title}".` : "No title element.",
      `H1: ${h1Text}.`,
      `H2 count: ${facts.h2}.`,
      `H3 count: ${facts.h3}.`,
    ].join(" "),
  };
}

function metaScenario(page: Opened, facts: DocFacts): Scenario {
  const passed = Boolean(page.metaDescription) && Boolean(facts.canonical) && Boolean(facts.viewport) && Boolean(facts.lang);
  return {
    id: "TC-03",
    name: "Read the meta elements",
    control: "Meta",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed,
    description:
      "A public visitor reads the document that came back for the pasted address. This scenario checks the meta description, canonical link, viewport meta element, and html lang attribute.",
    preconditions: PRECONDITIONS,
    steps: [
      "Read the meta description.",
      "Read the canonical link.",
      "Read the viewport meta element.",
      "Read the lang attribute on the html element.",
    ],
    testData: page.finalUrl,
    expected: "The description, canonical link, viewport meta element, and html lang attribute are present.",
    actual: [
      page.metaDescription
        ? `Meta description: ${page.metaDescription.length} characters. "${page.metaDescription}".`
        : "No meta description element.",
      facts.canonical ? `Canonical: ${facts.canonical}.` : "No canonical link.",
      facts.viewport ? `Viewport: ${facts.viewport}.` : "No viewport meta element.",
      facts.lang ? `Language: ${facts.lang}.` : "No lang attribute on the html element.",
      facts.robots ? `Robots: ${facts.robots}.` : "No robots meta element.",
    ].join(" "),
  };
}

function controlScenario(number: number, label: string, page: Opened): Scenario {
  const passed = page.status >= 200 && page.status < 400 && (!page.html || Boolean(page.title));
  return {
    id: `TC-${String(number).padStart(2, "0")}`,
    name: `Open ${label}`,
    control: label,
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed,
    description: `A public visitor uses the "${label}" control on the homepage. This scenario checks the page that control opens.`,
    preconditions: `${PRECONDITIONS} The homepage response contained a link whose visible name is "${label}".`,
    steps: [
      `On the homepage, find the control named "${label}".`,
      `Open ${page.requestedUrl} with GET.`,
      "Read the HTTP status and the document title.",
    ],
    testData: `${label} — ${page.requestedUrl}`,
    expected: "The response status is below 400. When the response is HTML, the title is not empty.",
    actual: [
      page.note,
      page.status === 0 ? "No HTTP status was returned." : `HTTP ${page.status} in ${page.ms} ms.`,
      `Final address: ${page.finalUrl}.`,
      page.title ? `Title: "${page.title}".` : page.html ? "No title element." : "Response was not HTML.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function missingScenario(number: number, page: Opened): Scenario {
  const passed = page.status === 404;
  return {
    id: `TC-${String(number).padStart(2, "0")}`,
    name: "Request an unknown path",
    control: "404 check",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title: page.title,
    passed,
    description: "A public visitor requests a path that is not a page on the site. This scenario checks that the response status is 404.",
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

type DocFacts = { lang: string | null; canonical: string | null; viewport: string | null; robots: string | null; h2: number; h3: number };
type LinkRow = { control: { label: string; url: string }; page: Opened };

function buildCategories(home: Opened, facts: DocFacts, links: LinkRow[], missing: Opened): Category[] {
  const loadPass = home.status >= 200 && home.status < 400;
  const titlePass = Boolean(home.title);
  const h1Pass = home.h1.length === 1;
  const h1Value =
    home.h1.length === 0 ? "0 headings." : `${home.h1.length} heading${home.h1.length === 1 ? "" : "s"}. ${home.h1.map((item) => `"${item}"`).join(" ")}`;
  const metaFindings = [
    {
      label: "Description",
      value: home.metaDescription
        ? `${home.metaDescription.length} characters. "${clip(home.metaDescription)}"`
        : "No meta description element.",
      state: home.metaDescription ? "pass" : "fail",
    },
    {
      label: "Canonical",
      value: facts.canonical ?? "No canonical link.",
      state: facts.canonical ? "pass" : "fail",
    },
    {
      label: "Viewport",
      value: facts.viewport ?? "No viewport meta element.",
      state: facts.viewport ? "pass" : "fail",
    },
    {
      label: "Language",
      value: facts.lang ?? "No lang attribute on the html element.",
      state: facts.lang ? "pass" : "fail",
    },
  ] as const;
  const metaPassed = metaFindings.filter((item) => item.state === "pass").length;
  const failed = links.filter((row) => linkFailed(row.page));
  const missingPass = missing.status === 404;

  return [
    {
      id: "load",
      label: "Load",
      headline: `HTTP ${home.status} · ${home.ms} ms`,
      score: loadPass ? 100 : 0,
      findings: [
        { label: "HTTP status", value: String(home.status || "none"), state: loadPass ? "pass" : "fail" },
        { label: "Time", value: `${home.ms} ms`, state: "info" },
        { label: "Final address", value: home.finalUrl, state: "info" },
        ...(home.note ? [{ label: "Redirects", value: home.note, state: "info" as const }] : []),
      ],
    },
    {
      id: "document",
      label: "Title and headings",
      headline: `${home.title ? clip(home.title, 80) : "No title"} · ${home.h1.length} H1`,
      score: Math.round((100 * [titlePass, h1Pass].filter(Boolean).length) / 2),
      findings: [
        { label: "Title", value: home.title ? `"${home.title}"` : "No title element.", state: titlePass ? "pass" : "fail" },
        { label: "H1", value: h1Value, state: h1Pass ? "pass" : "fail" },
        { label: "H2", value: `${facts.h2} headings`, state: "info" },
        { label: "H3", value: `${facts.h3} headings`, state: "info" },
      ],
    },
    {
      id: "meta",
      label: "Meta",
      headline: `${metaPassed} of ${metaFindings.length} present`,
      score: Math.round((100 * metaPassed) / metaFindings.length),
      findings: [
        ...metaFindings,
        { label: "Robots", value: facts.robots ?? "No robots meta element.", state: "info" },
      ],
    },
    {
      id: "links",
      label: "Failed links",
      headline: links.length === 0 ? "None opened" : `${failed.length} of ${links.length} failed`,
      score: links.length === 0 ? null : Math.round((100 * (links.length - failed.length)) / links.length),
      findings: [
        {
          label: "Opened",
          value:
            links.length === 0
              ? "No header or nav links were opened."
              : `${failed.length} of ${links.length} opened header and nav links failed.`,
          state: links.length === 0 ? "info" : failed.length === 0 ? "pass" : "fail",
        },
        ...failed.map((row) => ({
          label: "Link",
          value:
            row.page.status === 0
              ? `${row.page.requestedUrl}. ${row.page.note || "No HTTP status."}`
              : `${row.page.finalUrl}. HTTP ${row.page.status} in ${row.page.ms} ms.${row.page.html && !row.page.title ? " No title element." : ""}`,
          state: "fail" as const,
        })),
      ],
    },
    {
      id: "missing",
      label: "404 check",
      headline: missing.status === 0 ? "No response" : `HTTP ${missing.status}`,
      score: missingPass ? 100 : 0,
      findings: [
        { label: "Requested", value: missing.requestedUrl, state: "info" },
        {
          label: "HTTP status",
          value: missing.status === 0 ? missing.note || "No HTTP status." : String(missing.status),
          state: missingPass ? "pass" : "fail",
        },
        { label: "Time", value: `${missing.ms} ms`, state: "info" },
        ...(missing.finalUrl !== missing.requestedUrl
          ? [{ label: "Final address", value: missing.finalUrl, state: "info" as const }]
          : []),
      ],
    },
  ];
}

function linkFailed(page: Opened): boolean {
  if (page.status < 200 || page.status >= 400) return true;
  return page.html && !page.title;
}

function blankOpen(url: string, note: string): Opened {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 0,
    ms: 0,
    title: null,
    h1: [],
    metaDescription: null,
    html: false,
    note,
  };
}

function emptyFacts(): DocFacts {
  return { lang: null, canonical: null, viewport: null, robots: null, h2: 0, h3: 0 };
}

function documentFacts(html: string, base: string): DocFacts {
  const root = parse(html);
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
    lang: clean(root.querySelector("html")?.getAttribute("lang") ?? "") || null,
    canonical,
    viewport: metaContent(root, "viewport"),
    robots: metaContent(root, "robots"),
    h2: root.querySelectorAll("h2").map((el) => clean(el.text)).filter(Boolean).length,
    h3: root.querySelectorAll("h3").map((el) => clean(el.text)).filter(Boolean).length,
  };
}

function clip(value: string, max = 400): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function discoverControls(
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
    const key = url.toString();
    if (seen.has(key)) continue;
    const label = linkLabel(anchor);
    if (!label) continue;
    if (/^(?:register|sign\s*in|log\s*in)\b/i.test(label)) continue;
    seen.add(key);
    found.push({ label, url: key });
    if (found.length >= MAX_CONTROLS) break;
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
  return (
    url.hostname.toLowerCase() === base.hostname.toLowerCase() &&
    url.pathname.replace(/\/$/, "") === base.pathname.replace(/\/$/, "") &&
    url.search === base.search
  );
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
    const h1 = (root?.querySelectorAll("h1") ?? []).map((el) => clean(el.text)).filter(Boolean);
    return {
      requestedUrl: start,
      finalUrl: current,
      status: response.status,
      ms: response.ms,
      title: clean(root?.querySelector("title")?.text ?? "") || null,
      h1,
      metaDescription: metaContent(root, "description"),
      html,
      note: hops.length > 1 ? `Redirects: ${hops.join(" | ")}.` : null,
      htmlBody: response.body,
    };
  }
  throw new CrawlError("Stopped after 5 redirects.");
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
