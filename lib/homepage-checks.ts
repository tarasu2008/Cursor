import { parse } from "node-html-parser";
import { chromium, type Page } from "playwright-core";
import { PRECONDITIONS, type Scenario } from "./schema";
import { allowedHostsFor, assertPublicDns, isForbiddenUrl } from "./guardrails";
import { isDisallowed, parseRobots } from "./robots";

const CHROME = "/usr/local/bin/google-chrome";
const USER_AGENT = "QAFirstPass/0.1 (homepage checks; GET only; does not submit forms)";
const NAV_CAP = 25;
const FOOTER_CAP = 40;
const BUTTON_CAP = 8;

type LinkFact = { label: string; url: string };
type ButtonFact = { label: string; href: string | null; submit: boolean; menu: boolean };
type DomFacts = {
  title: string;
  description: string;
  viewport: string;
  visibleH1: string[];
  nav: LinkFact[];
  footer: LinkFact[];
  buttons: ButtonFact[];
  images: { checked: number; missingAlt: number };
  overflow: number;
  menu: { found: boolean; opened: boolean; closed: boolean; label: string };
};
type FetchResult = { status: number; finalUrl: string; ms: number; title: string | null; note: string | null };

export async function runHomepageScenarios(startUrl: string): Promise<{ scenarios: Scenario[]; linkSkipped: number }> {
  const hosts = allowedHostsFor(new URL(startUrl).hostname);
  const started = Date.now();
  const errors: string[] = [];
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  let facts: DomFacts | null = null;
  let home: FetchResult = { status: 0, finalUrl: startUrl, ms: 0, title: null, note: "The browser did not open the page." };
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource|net::ERR/i.test(text)) return;
      errors.push(text);
    });
    const response = await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => undefined);
    home = {
      status: response?.status() ?? 0,
      finalUrl: page.url(),
      ms: Date.now() - started,
      title: await page.title(),
      note: null,
    };
    facts = await readDesktop(page);
    facts.menu = await readPhoneMenu(page);
    facts.overflow = await readOverflow(page);
  } finally {
    await browser.close();
  }
  if (!facts) throw new Error(home.note || "The homepage could not be opened.");

  const disallow = await robotsDisallow(home.finalUrl);
  const nav = uniqueLinks(facts.nav, hosts, disallow).slice(0, NAV_CAP);
  const footerAll = uniqueLinks(facts.footer, hosts, disallow);
  const footer = footerAll.slice(0, FOOTER_CAP);
  const linkSkipped = Math.max(0, footerAll.length - footer.length);
  const jobs = new Map<string, Promise<FetchResult>>();
  const load = (url: string) => {
    const key = normalize(url);
    const existing = jobs.get(key);
    if (existing) return existing;
    const pending = followGet(url, hosts);
    jobs.set(key, pending);
    return pending;
  };
  await mapPool([...nav, ...footer], 6, async (link) => {
    await load(link.url);
  });
  const fetched = new Map<string, FetchResult>();
  await Promise.all([...jobs.entries()].map(async ([key, pending]) => fetched.set(key, await pending)));
  const missing = await followGet(new URL("/qa-first-pass-missing", home.finalUrl).toString(), hosts);

  const scenarios: Scenario[] = [];
  const add = (name: string, passed: boolean, actual: string, url = home.finalUrl, status = home.status, ms = home.ms) => {
    scenarios.push(makeScenario(scenarios.length + 1, name, passed, actual, url, status, ms, home.title));
  };

  add("Homepage status", home.status >= 200 && home.status < 400, `HTTP ${home.status} in ${home.ms} ms.`);
  add(
    "Visible H1",
    facts.visibleH1.length === 1,
    facts.visibleH1.length === 0 ? "No visible H1." : `${facts.visibleH1.length} visible. "${clip(facts.visibleH1[0] || "")}"`,
  );
  add("Title", Boolean(facts.title.trim()), facts.title.trim() ? `Title is present.` : "No title element.");
  add(
    "Meta description",
    Boolean(facts.description.trim()),
    facts.description.trim() ? `${facts.description.trim().length} characters.` : "No meta description.",
  );
  const zoomOff = zoomDisabled(facts.viewport);
  add("Pinch zoom", !zoomOff, zoomOff ? "The viewport disables pinch zoom." : "The viewport does not disable pinch zoom.");

  for (const link of nav) {
    const result = fetched.get(normalize(link.url));
    add(linkName("Nav", link.label), Boolean(result && result.status >= 200 && result.status < 400), linkActual(result), link.url, result?.status ?? 0, result?.ms ?? 0);
  }
  for (const button of facts.buttons.slice(0, BUTTON_CAP)) {
    add(`Button: ${button.label}`, true, buttonLine(button));
  }
  if (facts.buttons.length === 0) add("Primary buttons", false, "No visible button or call to action was found.");

  add(
    "Phone menu",
    facts.menu.found && facts.menu.opened && facts.menu.closed,
    !facts.menu.found
      ? "No menu button was visible at 390px."
      : facts.menu.opened && facts.menu.closed
        ? `Opened and closed${facts.menu.label ? ` "${facts.menu.label}"` : ""}.`
        : facts.menu.opened
          ? "The menu opened and did not close."
          : "The menu button did not open.",
  );

  const sameHome = missing.status === 200 && (normalize(missing.finalUrl) === normalize(home.finalUrl) || (missing.title && missing.title === home.title));
  add(
    "Unknown path",
    missing.status === 404,
    sameHome ? "HTTP 200, same as the homepage." : missing.note || `HTTP ${missing.status}.`,
    missing.finalUrl,
    missing.status,
    missing.ms,
  );

  const uniqueErrors = [...new Set(errors.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 3);
  add("Console", uniqueErrors.length === 0, uniqueErrors.length === 0 ? "No uncaught error on load." : uniqueErrors[0] || "An error was logged.");

  for (const link of footer) {
    const result = fetched.get(normalize(link.url));
    add(linkName("Footer", link.label), Boolean(result && result.status >= 200 && result.status < 400), linkActual(result), link.url, result?.status ?? 0, result?.ms ?? 0);
  }

  add(
    "First-view images",
    facts.images.missingAlt === 0,
    `${facts.images.checked} in the first view. ${facts.images.missingAlt} missing alt.`,
  );
  add("Text overflow", facts.overflow === 0, facts.overflow === 0 ? "No primary text overflow at 390px." : `${facts.overflow} text blocks overflow at 390px.`);

  return { scenarios, linkSkipped };
}

function makeScenario(
  number: number,
  name: string,
  passed: boolean,
  actual: string,
  url: string,
  status: number,
  ms: number,
  title: string | null,
): Scenario {
  return {
    id: `TC-${String(number).padStart(2, "0")}`,
    name,
    control: name,
    requestedUrl: url,
    finalUrl: url,
    status,
    ms,
    title,
    passed,
    description: `Check: ${name}.`,
    preconditions: PRECONDITIONS,
    steps: [`Open the submitted homepage.`, `Record ${name}.`],
    testData: url,
    expected: expectedFor(name),
    actual,
  };
}

function expectedFor(name: string): string {
  if (name === "Homepage status") return "The HTTP status is below 400.";
  if (name === "Visible H1") return "Exactly one H1 is visible.";
  if (name === "Title") return "The title is not empty.";
  if (name === "Meta description") return "A meta description is present.";
  if (name === "Pinch zoom") return "The viewport does not disable pinch zoom.";
  if (name.startsWith("Nav:") || name.startsWith("Footer:")) return "The link returns a status below 400.";
  if (name.startsWith("Button:")) return "The control is visible. No form is submitted.";
  if (name === "Phone menu") return "At 390px the menu opens and closes.";
  if (name === "Unknown path") return "The status is 404 and the response is not the homepage.";
  if (name === "Console") return "Load logs no uncaught error.";
  if (name === "First-view images") return "Each image in the first view has alt text or is decorative.";
  if (name === "Text overflow") return "Primary text does not overflow at 390px.";
  return "The check passes.";
}

function buttonLine(button: ButtonFact): string {
  if (button.submit || /book|register|sign\s*in|log\s*in|pay|checkout|cart/i.test(button.label)) {
    return "Visible. Not activated.";
  }
  if (button.menu) return "Visible. It is the menu control.";
  return "Visible. Not used to submit a form.";
}

function linkActual(result: FetchResult | undefined): string {
  if (!result) return "No response.";
  if (result.note) return result.note;
  return `HTTP ${result.status}.`;
}

function linkName(kind: "Nav" | "Footer", label: string): string {
  return `${kind}: ${clip(label || "Link", 60)}`;
}

async function readDesktop(page: Page): Promise<DomFacts> {
  return page.evaluate(() => {
    const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const labelOf = (el: Element) =>
      clean(el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText).slice(0, 80);
    const abs = (href: string) => {
      try {
        return new URL(href, location.href).href;
      } catch {
        return "";
      }
    };
    const linksOf = (selector: string) =>
      [...document.querySelectorAll(selector)]
        .map((el) => ({ label: labelOf(el) || "Link", url: abs(el.getAttribute("href") || "") }))
        .filter((link) => link.url);
    const h1 = [...document.querySelectorAll("h1")].filter(visible).map((el) => clean((el as HTMLElement).innerText)).filter(Boolean);
    const description = clean(document.querySelector('meta[name="description" i]')?.getAttribute("content"));
    const viewport = clean(document.querySelector('meta[name="viewport" i]')?.getAttribute("content"));
    const buttonNodes = [
      ...document.querySelectorAll("header button, header [role='button'], main button, main [role='button']"),
    ].filter((el) => visible(el) && el.getBoundingClientRect().top < window.innerHeight);
    const ctaNodes = [...document.querySelectorAll("header a, main a")].filter((el) => {
      if (!visible(el) || el.getBoundingClientRect().top >= window.innerHeight) return false;
      return /\b(book|register|sign[\s-]*in|log[\s-]*in)\b/i.test(labelOf(el));
    });
    const seen = new Set<string>();
    const buttons = [...buttonNodes, ...ctaNodes]
      .map((el) => {
        const label = labelOf(el) || "Button";
        const href = el.getAttribute("href");
        return {
          label,
          href: href ? abs(href) : null,
          submit: (el.getAttribute("type") || "").toLowerCase() === "submit" || el.closest("form") !== null && el.tagName === "BUTTON",
          menu: /menu|navigation/i.test(`${label} ${el.className}`) || el.hasAttribute("aria-controls") || el.hasAttribute("aria-expanded"),
        };
      })
      .filter((item) => {
        const key = item.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const images = [...document.querySelectorAll("img")].filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0;
    });
    const missingAlt = images.filter((img) => {
      const alt = img.getAttribute("alt");
      const role = (img.getAttribute("role") || "").toLowerCase();
      if (role === "presentation" || role === "none" || img.getAttribute("aria-hidden") === "true") return false;
      return alt === null;
    }).length;
    return {
      title: clean(document.title),
      description,
      viewport,
      visibleH1: h1,
      nav: linksOf("header a, nav a, [role='navigation'] a"),
      footer: linksOf("footer a"),
      buttons,
      images: { checked: images.length, missingAlt },
      overflow: 0,
      menu: { found: false, opened: false, closed: false, label: "" },
    };
  });
}

async function readOverflow(page: Page): Promise<number> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return [...document.querySelectorAll("main h1, main h2, main p, h1, h2")].filter((el) => {
      if (!visible(el)) return false;
      return el.scrollWidth > el.clientWidth + 2;
    }).length;
  });
}

async function readPhoneMenu(page: Page): Promise<DomFacts["menu"]> {
  await page.setViewportSize({ width: 390, height: 844 });
  const found = await page.evaluate(() => {
    const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    document.querySelector("[data-audit-menu]")?.removeAttribute("data-audit-menu");
    const buttons = [...document.querySelectorAll("button, [role='button'], [aria-expanded], [aria-controls]")].filter(
      (el) => visible(el) && (el.getAttribute("type") || "").toLowerCase() !== "submit",
    );
    const labelOf = (el: Element) => clean(el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText);
    const named = (el: Element) => /menu|navigat/i.test(labelOf(el));
    const pick =
      buttons.find((el) => named(el) && (el.hasAttribute("aria-expanded") || el.hasAttribute("aria-controls"))) ||
      buttons.find((el) => named(el)) ||
      buttons.find((el) => /menu|hamburger|nav-toggle/i.test(String(el.className)) && el.closest("header, nav"));
    if (!pick) return null;
    pick.setAttribute("data-audit-menu", "1");
    return { label: labelOf(pick).slice(0, 60), expanded: pick.getAttribute("aria-expanded") };
  });
  if (!found) return { found: false, opened: false, closed: false, label: "" };
  const panelOpen = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-audit-menu='1']");
      const panelId = el?.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      const style = panel ? getComputedStyle(panel) : null;
      const shown = Boolean(style && style.display !== "none" && style.visibility !== "hidden" && panel && panel.getBoundingClientRect().height > 0);
      return el?.getAttribute("aria-expanded") === "true" || shown;
    });
  const press = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-audit-menu='1']") as HTMLElement | null;
      el?.scrollIntoView({ block: "center" });
      el?.click();
    });
  await press();
  await page.waitForTimeout(450);
  const didOpen = await panelOpen();
  await press();
  await page.waitForTimeout(450);
  const stillOpen = await panelOpen();
  return { found: true, opened: didOpen, closed: didOpen && !stillOpen, label: found.label };
}

function uniqueLinks(links: LinkFact[], hosts: Set<string>, disallow: string[]): LinkFact[] {
  const seen = new Set<string>();
  const found: LinkFact[] = [];
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (!hosts.has(url.hostname.toLowerCase())) continue;
    if (isForbiddenUrl(url)) continue;
    if (/\b(checkout|cart|payment)\b/i.test(link.label)) continue;
    if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) continue;
    if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|pdf|zip)$/i.test(url.pathname)) continue;
    if (isDisallowed(url.pathname, disallow)) continue;
    const key = normalize(url.toString());
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ label: link.label, url: key });
  }
  return found;
}

async function followGet(start: string, hosts: Set<string>): Promise<FetchResult> {
  const started = Date.now();
  let current = start;
  try {
    for (let hop = 0; hop < 5; hop += 1) {
      const url = new URL(current);
      if (!hosts.has(url.hostname.toLowerCase())) {
        return { status: 0, finalUrl: current, ms: Date.now() - started, title: null, note: "Redirected away from the host." };
      }
      if (isForbiddenUrl(url)) {
        return { status: 0, finalUrl: current, ms: Date.now() - started, title: null, note: "Not opened. Checkout, payment, login, or delete." };
      }
      await assertPublicDns(url.hostname);
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "user-agent": USER_AGENT },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        current = new URL(response.headers.get("location") || "", current).toString();
        continue;
      }
      const html = (response.headers.get("content-type") || "").includes("html");
      const body = html ? await response.text() : "";
      const title = html ? (parse(body.slice(0, 200_000)).querySelector("title")?.text || "").replace(/\s+/g, " ").trim() : "";
      return { status: response.status, finalUrl: current, ms: Date.now() - started, title: title || null, note: null };
    }
    return { status: 0, finalUrl: current, ms: Date.now() - started, title: null, note: "Stopped after redirects." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request failed.";
    return { status: 0, finalUrl: current, ms: Date.now() - started, title: null, note: message };
  }
}

async function robotsDisallow(finalUrl: string): Promise<string[]> {
  try {
    const response = await fetch(new URL("/robots.txt", finalUrl), {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return parseRobots(await response.text()).disallow;
  } catch {
    return [];
  }
}

function zoomDisabled(viewport: string): boolean {
  const value = viewport.toLowerCase().replace(/\s/g, "");
  if (!value) return false;
  if (/user-scalable=(no|0)/.test(value)) return true;
  const max = value.match(/maximum-scale=([0-9.]+)/);
  return Boolean(max && Number(max[1]) <= 1);
}

function normalize(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

function clip(value: string, max = 90): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) continue;
        await fn(item);
      }
    }),
  );
}
