import { parse, type HTMLElement } from "node-html-parser";
import {
  PRECONDITIONS,
  auditReportSchema,
  type AuditReport,
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
        page: {
          requestedUrl: control.url,
          finalUrl: control.url,
          status: 0,
          ms: 0,
          title: null,
          h1: [],
          metaDescription: null,
          html: false,
          note: message,
        } satisfies Opened,
      };
    }
  });

  const scenarios: Scenario[] = [homepageScenario(home)];
  for (const row of opened) {
    if (!row) continue;
    scenarios.push(controlScenario(scenarios.length + 1, row.control.label, row.page));
  }

  const passedCount = scenarios.filter((item) => item.passed).length;
  const report: AuditReport = {
    requestedUrl: start.toString(),
    finalUrl: home.finalUrl,
    fetchedAt: new Date().toISOString(),
    summary: `${passedCount} of ${scenarios.length} opened pages returned a status below 400 and a title. Homepage HTTP ${home.status} in ${home.ms} ms.`,
    scores: {
      passedPercent: Math.round((100 * passedCount) / scenarios.length),
      passedCount,
      total: scenarios.length,
      homepageStatus: home.status,
      homepageMs: home.ms,
    },
    scenarios,
  };
  return auditReportSchema.parse(report);
}

function homepageScenario(page: Opened & { htmlBody: string }): Scenario {
  const title = page.title;
  const passed = page.status >= 200 && page.status < 400 && Boolean(title) && page.h1.length === 1;
  const h1Text = page.h1.length === 0 ? "No H1." : page.h1.map((item) => `"${item}"`).join(", ");
  return {
    id: "TC-01",
    name: "Open the homepage",
    control: "Homepage",
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    ms: page.ms,
    title,
    passed,
    description:
      "A public visitor opens the address they pasted. This scenario checks the HTTP status, the document title, and the first H1 that came back with that response.",
    preconditions: PRECONDITIONS,
    steps: [
      `Open ${page.requestedUrl}.`,
      "Read the HTTP status, the document title, and the text of each H1 in the response.",
    ],
    testData: page.requestedUrl,
    expected: "The response status is below 400. The title is not empty. The document contains exactly one H1.",
    actual: [
      page.note,
      `HTTP ${page.status} in ${page.ms} ms.`,
      `Final address: ${page.finalUrl}.`,
      title ? `Title: "${title}".` : "No title element.",
      `H1: ${h1Text}.`,
      page.metaDescription ? `Meta description: "${page.metaDescription}".` : "No meta description element.",
    ]
      .filter(Boolean)
      .join(" "),
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
