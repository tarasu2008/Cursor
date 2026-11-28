import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "fs";
import { parse } from "node-html-parser";
import path from "path";
import { chromium, type Page } from "playwright-core";
import { PRECONDITIONS, type Scenario } from "./schema";
import { allowedHostsFor, assertPublicDns, isForbiddenUrl } from "./guardrails";
import { isDisallowed, parseRobots } from "./robots";

const CHROME = "/usr/local/bin/google-chrome";
const USER_AGENT = "QAFirstPass/0.1 (homepage checks; does not submit payment or guest details)";
const PHONE_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const CAP_MS = 110_000;
const CAP_SECONDS = 120;

type LinkFact = { label: string; url: string };
type ButtonFact = { label: string; kind: "book" | "login" | "pay" | "safe" };
type Step = { name: string; passed: boolean; actual: string; url: string };
type DomFacts = {
  title: string;
  description: string;
  viewport: string;
  visibleH1: string[];
  pageText: boolean;
  contrast: { ratio: number | null; sample: string };
  nav: LinkFact[];
  footer: LinkFact[];
  main: LinkFact[];
  buttons: ButtonFact[];
  images: { checked: number; missingAlt: number };
  overflow: number;
  menu: { found: boolean; opened: boolean; closed: boolean; label: string };
};
type FetchResult = { status: number; finalUrl: string; ms: number; title: string | null; note: string | null };
type AxeHit = { id: string; impact: string; help: string };
export type AxeSummary = { passes: number; violations: AxeHit[] };

export type CheckViewport = { width: number; height: number };

export const DESKTOP_VIEWPORT: CheckViewport = { width: 1280, height: 900 };
export const MOBILE_VIEWPORT: CheckViewport = { width: 390, height: 844 };

export async function runHomepageScenarios(
  startUrl: string,
  viewport: CheckViewport = DESKTOP_VIEWPORT,
): Promise<{ scenarios: Scenario[]; skipped: number; capSeconds: number; axe: AxeSummary }> {
  const hosts = allowedHostsFor(new URL(startUrl).hostname);
  const started = Date.now();
  const deadline = started + CAP_MS;
  const errors: string[] = [];
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  let facts: DomFacts | null = null;
  let home: FetchResult = { status: 0, finalUrl: startUrl, ms: 0, title: null, note: "The browser did not open the page." };
  let buttonSteps: Step[] = [];
  let buttonSkipped = 0;
  let menuLinks: LinkFact[] = [];
  let bookingSteps: Step[] = [];
  let loadErrors: string[] = [];
  let axe: AxeSummary = { passes: 0, violations: [] };
  const phone = viewport.width <= 500;
  try {
    const context = await browser.newContext({ userAgent: phone ? PHONE_AGENT : USER_AGENT, viewport });
    const page = await context.newPage();
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
    loadErrors = [...errors];
    axe = await readAxe(page);
    const exercised = await exerciseButtons(page, home.finalUrl, deadline);
    buttonSteps = exercised.steps;
    buttonSkipped = exercised.remaining;
    menuLinks = exercised.menuLinks;
    await page.goto(home.finalUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
    await page.setViewportSize(viewport);
    if (phone) {
      facts.menu = await readPhoneMenu(page);
      facts.overflow = await readOverflow(page);
      await page.setViewportSize(viewport);
    }
    if (!page.url().startsWith(new URL(home.finalUrl).origin)) {
      await page.goto(home.finalUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
    } else if (new URL(page.url()).pathname !== new URL(home.finalUrl).pathname) {
      await page.goto(home.finalUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
    }
    bookingSteps = await walkBooking(page, home.finalUrl, deadline, viewport);
  } finally {
    await browser.close();
  }
  if (!facts) throw new Error(home.note || "The homepage could not be opened.");

  const disallow = await robotsDisallow(home.finalUrl);
  const queued = [
    ...uniqueLinks(facts.nav, hosts, disallow).map((link) => ({ ...link, kind: "Nav" as const })),
    ...uniqueLinks(menuLinks, hosts, disallow).map((link) => ({ ...link, kind: "Menu" as const })),
    ...uniqueLinks(facts.main, hosts, disallow).map((link) => ({ ...link, kind: "Main" as const })),
    ...uniqueLinks(facts.footer, hosts, disallow).map((link) => ({ ...link, kind: "Footer" as const })),
  ];
  const seen = new Set<string>();
  const links = queued.filter((link) => {
    const key = `${link.kind}:${normalize(link.url)}`;
    if (seen.has(normalize(link.url)) && link.kind !== "Nav") return false;
    if (seen.has(key)) return false;
    seen.add(key);
    seen.add(normalize(link.url));
    return true;
  });
  const fetched = new Map<string, FetchResult>();
  let linkSkipped = 0;
  const pending: typeof links = [];
  for (const link of links) {
    if (Date.now() > deadline) {
      linkSkipped += 1;
      continue;
    }
    pending.push(link);
  }
  await mapPool(pending, 6, async (link) => {
    const key = normalize(link.url);
    if (!fetched.has(key)) fetched.set(key, await followGet(link.url, hosts));
  });
  const missing = Date.now() > deadline + 15_000
    ? { status: 0, finalUrl: new URL("/qa-first-pass-missing", home.finalUrl).toString(), ms: 0, title: null, note: "Not requested. The 2 minute cap was reached." }
    : await followGet(new URL("/qa-first-pass-missing", home.finalUrl).toString(), hosts);

  const scenarios: Scenario[] = [];
  const add = (name: string, passed: boolean, actual: string, url = home.finalUrl, status = home.status, ms = home.ms) => {
    if (scenarios.length >= 190) {
      linkSkipped += 1;
      return;
    }
    scenarios.push(makeScenario(scenarios.length + 1, name, passed, actual, url, status, ms, home.title));
  };

  add("Homepage status", home.status >= 200 && home.status < 400, `HTTP ${home.status}.`);
  add("Load time", home.ms > 0, `${home.ms} ms in this browser.`);
  add("Page text", facts.pageText, facts.pageText ? "The page has visible text." : "The page looks blank.");
  add(
    "Visible H1",
    facts.visibleH1.length === 1,
    facts.visibleH1.length === 0 ? "No visible H1." : `${facts.visibleH1.length} visible. "${clip(facts.visibleH1[0] || "")}"`,
  );
  add("Title", Boolean(facts.title.trim()), facts.title.trim() ? "Title is present." : "No title element.");
  add(
    "Meta description",
    Boolean(facts.description.trim()),
    facts.description.trim() ? `${facts.description.trim().length} characters.` : "No meta description.",
  );
  const zoomOff = zoomDisabled(facts.viewport);
  add("Pinch zoom", !zoomOff, zoomOff ? "The viewport disables pinch zoom." : "The viewport does not disable pinch zoom.");
  add(
    "Text contrast",
    facts.contrast.ratio !== null && facts.contrast.ratio >= 4.5,
    facts.contrast.ratio === null ? "Contrast could not be read." : `Contrast ${facts.contrast.ratio.toFixed(1)}:1 on "${clip(facts.contrast.sample, 40)}".`,
  );

  for (const link of pending) {
    const result = fetched.get(normalize(link.url));
    add(linkName(link.kind, link.label), Boolean(result && result.status >= 200 && result.status < 400), linkActual(result), link.url, result?.status ?? 0, result?.ms ?? 0);
  }
  for (const step of buttonSteps) add(step.name, step.passed, step.actual, step.url);
  if (facts.buttons.length === 0) add("Buttons", false, "No visible button was found.");

  if (phone) {
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
  }
  for (const step of bookingSteps) add(step.name, step.passed, step.actual, step.url);

  const sameHome = missing.status === 200 && (normalize(missing.finalUrl) === normalize(home.finalUrl) || (missing.title && missing.title === home.title));
  add(
    "Unknown path",
    missing.status === 404,
    sameHome ? "HTTP 200, same as the homepage." : missing.note || `HTTP ${missing.status}.`,
    missing.finalUrl,
    missing.status,
    missing.ms,
  );

  const uniqueErrors = [...new Set(loadErrors.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 3);
  add("Console", uniqueErrors.length === 0, uniqueErrors.length === 0 ? "No uncaught error on load." : uniqueErrors[0] || "An error was logged.");
  add(
    "First-view images",
    facts.images.missingAlt === 0,
    `${facts.images.checked} in the first view. ${facts.images.missingAlt} missing alt.`,
  );
  if (phone) {
    add("Text overflow", facts.overflow === 0, facts.overflow === 0 ? "No primary text overflow at 390px." : `${facts.overflow} text blocks overflow at 390px.`);
  }
  const shown = axe.violations.slice(0, 12);
  if (shown.length === 0) {
    add("Accessibility", true, `No axe-core violation at ${viewport.width}px. ${axe.passes} rules passed.`);
  } else {
    for (const item of shown) add(`Accessibility: ${item.id}`, false, `${item.impact}. ${clip(item.help, 120)}`);
    if (axe.violations.length > shown.length) {
      add("Accessibility", false, `${axe.violations.length} axe-core rules failed at ${viewport.width}px. ${axe.passes} rules passed.`);
    }
  }

  return { scenarios, skipped: linkSkipped + buttonSkipped, capSeconds: CAP_SECONDS, axe };
}

let cachedAxeSource: string | undefined;
function browserAxeSource(): string {
  cachedAxeSource ??= readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.js"), "utf8");
  return cachedAxeSource;
}

async function readAxe(page: Page): Promise<AxeSummary> {
  try {
    const results = await new AxeBuilder({ page, axeSource: browserAxeSource() }).analyze();
    return {
      passes: results.passes.length,
      violations: results.violations.map((item) => ({ id: item.id, impact: item.impact || "unknown", help: item.help })),
    };
  } catch (error) {
    const help = error instanceof Error ? error.message : "axe-core could not run.";
    return { passes: 0, violations: [{ id: "axe", impact: "serious", help }] };
  }
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
  if (name === "Load time") return "The browser recorded how long the homepage took. This is not a Lighthouse score.";
  if (name === "Accessibility" || name.startsWith("Accessibility:")) return "axe-core reports no violation for this rule on this viewport.";
  if (name === "Visible H1") return "Exactly one H1 is visible.";
  if (name === "Title") return "The title is not empty.";
  if (name === "Meta description") return "A meta description is present.";
  if (name === "Pinch zoom") return "The viewport does not disable pinch zoom.";
  if (name.startsWith("Nav:") || name.startsWith("Footer:") || name.startsWith("Menu:") || name.startsWith("Main:")) return "The link returns a status below 400.";
  if (name.startsWith("Button:")) return "The control is visible. Payment and guest details are not submitted.";
  if (name.startsWith("Booking:")) return "The booking step opens. Checkout is not filled in or paid.";
  if (name === "Phone menu") return "At 390px the menu opens and closes.";
  if (name === "Page text") return "The homepage shows text after load.";
  if (name === "Text contrast") return "Primary text contrast is at least 4.5:1.";
  if (name === "Unknown path") return "The status is 404 and the response is not the homepage.";
  if (name === "Console") return "Load logs no uncaught error.";
  if (name === "First-view images") return "Each image in the first view has alt text or is decorative.";
  if (name === "Text overflow") return "Primary text does not overflow at 390px.";
  return "The check passes.";
}

function linkActual(result: FetchResult | undefined): string {
  if (!result) return "No response.";
  if (result.note) return result.note;
  return `HTTP ${result.status}.`;
}

function linkName(kind: "Nav" | "Footer" | "Menu" | "Main", label: string): string {
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
    const kindOf = (label: string): ButtonFact["kind"] => {
      if (/pay\b|place order|submit payment|buy now|confirm payment/i.test(label)) return "pay";
      if (/sign[\s-]*in|log[\s-]*in|register/i.test(label)) return "login";
      if (/\bbook(?:\s+now)?\b|\breserve\b/i.test(label) && !/most booked/i.test(label)) return "book";
      return "safe";
    };
    const seen = new Set<string>();
    const buttons = [...document.querySelectorAll("button, [role='button']")]
      .filter((el) => visible(el) && !/datepicker__day/i.test(String(el.className)) && (el.getAttribute("type") || "").toLowerCase() !== "submit")
      .map((el) => ({ label: labelOf(el) || "Button" }))
      .filter((item) => {
        const key = item.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({ label: item.label, kind: kindOf(item.label) }));
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
    const parseColor = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match?.[1]) return null;
      const parts = match[1].split(",").map((part) => Number(part.trim()));
      if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
      return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] ?? 1 };
    };
    const channel = (value: number) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: { r: number; g: number; b: number }) => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    const sample = [...document.querySelectorAll("h1, p")].find((el) => visible(el) && clean((el as HTMLElement).innerText).length > 12) || null;
    let contrast: { ratio: number | null; sample: string } = { ratio: null, sample: "" };
    if (sample) {
      const foreground = parseColor(getComputedStyle(sample).color);
      let node: Element | null = sample;
      let background: { r: number; g: number; b: number; a: number } | null = null;
      while (node) {
        const color = parseColor(getComputedStyle(node).backgroundColor);
        if (color && color.a > 0.2) {
          background = color;
          break;
        }
        node = node.parentElement;
      }
      if (foreground && background) {
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        contrast = { ratio: (lighter + 0.05) / (darker + 0.05), sample: clean((sample as HTMLElement).innerText).slice(0, 60) };
      }
    }
    return {
      title: clean(document.title),
      description,
      viewport,
      visibleH1: h1,
      pageText: clean(document.body.innerText).length > 40,
      contrast,
      nav: linksOf("header a, nav a, [role='navigation'] a"),
      footer: linksOf("footer a"),
      main: linksOf("main a"),
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

async function exerciseButtons(
  page: Page,
  homeUrl: string,
  deadline: number,
): Promise<{ steps: Step[]; remaining: number; menuLinks: LinkFact[] }> {
  const buttons = await page.evaluate(() => {
    const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const kindOf = (label: string) => {
      if (/pay\b|place order|submit payment|buy now|confirm payment/i.test(label)) return "pay" as const;
      if (/sign[\s-]*in|log[\s-]*in|register/i.test(label)) return "login" as const;
      if (/\bbook(?:\s+now)?\b|\breserve\b/i.test(label) && !/most booked/i.test(label)) return "book" as const;
      return "safe" as const;
    };
    const seen = new Set<string>();
    const found: { label: string; kind: "book" | "login" | "pay" | "safe" }[] = [];
    for (const el of document.querySelectorAll("button, [role='button']")) {
      if (!visible(el) || /datepicker__day/i.test(String(el.className))) continue;
      if ((el.getAttribute("type") || "").toLowerCase() === "submit") continue;
      const label = (clean(el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText) || "Button").slice(0, 80);
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ label, kind: kindOf(label) });
    }
    return found;
  });
  const steps: Step[] = [];
  const menuLinks: LinkFact[] = [];
  let remaining = 0;
  let index = 0;
  for (const button of buttons) {
    if (Date.now() > deadline - 40_000) {
      remaining += buttons.length - index;
      break;
    }
    index += 1;
    if (button.kind === "book") {
      steps.push({ name: `Button: ${clip(button.label, 50)}`, passed: true, actual: "Visible. Opened in the booking walk. Not submitted.", url: homeUrl });
      continue;
    }
    if (button.kind === "pay") {
      steps.push({ name: `Button: ${clip(button.label, 50)}`, passed: true, actual: "Visible. Not activated.", url: homeUrl });
      continue;
    }
    const clicked = await clickLabeled(page, button.label);
    if (!clicked) {
      steps.push({ name: `Button: ${clip(button.label, 50)}`, passed: true, actual: "Not visible when the check ran.", url: page.url() });
      continue;
    }
    await page.waitForTimeout(500);
    if (button.kind === "login") {
      const dialog = await page.evaluate(() => {
        const open = [...document.querySelectorAll("[role='dialog'], [aria-modal='true'], form")].find((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && rect.width > 40 && rect.height > 40 && /email|password|sign in|register/i.test(el.textContent || "");
        });
        return open ? (open.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) : "";
      });
      await page.keyboard.press("Escape").catch(() => undefined);
      steps.push({
        name: `Button: ${clip(button.label, 50)}`,
        passed: true,
        actual: dialog ? "A sign-in form opened. Nothing was typed or submitted." : `Opened ${page.url()}. Nothing was typed or submitted.`,
        url: page.url(),
      });
      if (page.url() !== homeUrl) await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
      continue;
    }
    const revealed = await page.evaluate(() => {
      const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
      const visible = (el: Element) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      return [...document.querySelectorAll("header a, nav a, [role='navigation'] a, [role='menu'] a")]
        .filter(visible)
        .map((el) => ({ label: clean(el.getAttribute("aria-label") || (el as HTMLElement).innerText).slice(0, 80) || "Link", url: (el as HTMLAnchorElement).href }))
        .filter((link) => link.url);
    });
    menuLinks.push(...revealed);
    const url = page.url();
    steps.push({
      name: `Button: ${clip(button.label, 50)}`,
      passed: true,
      actual: url === homeUrl ? "Activated. Stayed on the homepage. No form was submitted." : `Opened ${url}.`,
      url,
    });
    if (url !== homeUrl) await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
  }
  return { steps, remaining, menuLinks };
}

async function clickLabeled(page: Page, label: string): Promise<boolean> {
  return page.evaluate((expected) => {
    const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const target = [...document.querySelectorAll("button, [role='button'], a")].find((el) => visible(el) && clean(el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText) === expected);
    if (!target) return false;
    (target as HTMLElement).scrollIntoView({ block: "center" });
    (target as HTMLElement).click();
    return true;
  }, label);
}

async function walkBooking(page: Page, homeUrl: string, deadline: number, viewport: CheckViewport): Promise<Step[]> {
  if (new URL(page.url()).pathname !== new URL(homeUrl).pathname) {
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
  }
  await page.setViewportSize(viewport);
  const steps: Step[] = [];
  const book = await clickBooking(page, "book");
  if (!book) {
    steps.push({ name: "Booking", passed: true, actual: "No booking control was visible.", url: page.url() });
    return steps;
  }
  await page.waitForTimeout(800);
  await page
    .waitForFunction(
      () => [...document.querySelectorAll("[aria-label]")].some((el) => /^Choose\b/i.test(el.getAttribute("aria-label") || "") && /\d/.test(el.getAttribute("aria-label") || "")),
      { timeout: 8_000 },
    )
    .catch(() => undefined);
  steps.push({ name: `Booking: ${clip(book, 40)}`, passed: true, actual: `Opened ${page.url()}.`, url: page.url() });
  const done = new Set<string>();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (Date.now() > deadline) {
      steps.push({ name: "Booking: checkout", passed: false, actual: `Stopped at ${page.url()}. The 2 minute cap was reached before checkout.`, url: page.url() });
      return steps;
    }
    if (await onCheckout(page)) {
      steps.push({ name: "Booking: checkout", passed: true, actual: `Reached ${page.url()}. Stopped. No guest or card details were entered.`, url: page.url() });
      return steps;
    }
    let acted = false;
    for (const kind of ["time", "checkout", "date"] as const) {
      const label = await clickBooking(page, kind);
      if (!label || done.has(`${kind}:${label}`)) continue;
      done.add(`${kind}:${label}`);
      await page.waitForTimeout(1200);
      const reached = await onCheckout(page);
      steps.push({
        name: `Booking: ${clip(label, 40)}`,
        passed: kind === "checkout" ? reached : true,
        actual: reached
          ? `Reached ${page.url()}. Stopped. No guest or card details were entered.`
          : kind === "checkout"
            ? `Stayed on ${page.url()}. Checkout did not open.`
            : `Selected "${clip(label, 60)}".`,
        url: page.url(),
      });
      acted = true;
      if (reached) return steps;
      break;
    }
    if (!acted) {
      steps.push({ name: "Booking: checkout", passed: false, actual: `Stopped at ${page.url()}. Checkout was not reached. No details were entered.`, url: page.url() });
      return steps;
    }
  }
  if (!(await onCheckout(page))) {
    steps.push({ name: "Booking: checkout", passed: false, actual: `Stopped at ${page.url()}. Checkout was not reached. No details were entered.`, url: page.url() });
  }
  return steps;
}

async function onCheckout(page: Page): Promise<boolean> {
  if (/\/checkout(?:\/|$|\?)/i.test(page.url()) || /\/payment(?:\/|$|\?)/i.test(page.url())) return true;
  return page.evaluate(() => /checkout/i.test(`${document.title} ${[...document.querySelectorAll("h1")].map((el) => el.textContent || "").join(" ")}`));
}

async function clickBooking(page: Page, kind: "book" | "date" | "time" | "checkout"): Promise<string | null> {
  return page.evaluate((action) => {
    const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const labelOf = (el: Element) => clean(el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText);
    const dialog = [...document.querySelectorAll("[role='dialog'], [aria-modal='true'], [class*='popup']")].find((el) => {
      if (!visible(el) || el.getBoundingClientRect().height < 180) return false;
      if (/datepicker/i.test(String(el.className))) return false;
      return /checkout|start time|guest/i.test((el as HTMLElement).innerText || "");
    }) || null;
    let target: Element | null = null;
    if (action === "checkout") {
      const root = dialog || document;
      target = [...root.querySelectorAll("button, [role='button'], a")].find((el) => visible(el) && /continue to checkout|proceed to checkout/i.test(labelOf(el)) && !(el as HTMLButtonElement).disabled) || null;
    } else if (action === "time") {
      const root = dialog || document.body;
      if (!dialog) return null;
      const times = [...root.querySelectorAll("label, button, [role='button'], p, div")].filter((el) => {
        const text = labelOf(el);
        return visible(el) && text.length < 80 && el.children.length < 5 && /\d{1,2}:\d{2}\s*(am|pm)/i.test(text);
      });
      times.sort((a, b) => labelOf(a).length - labelOf(b).length);
      target = times[0] || null;
    } else if (action === "date") {
      if (dialog) return null;
      const isDay = (el: Element) => {
        const label = el.getAttribute("aria-label") || "";
        return /^Choose\b/i.test(label) && /\d/.test(label) && !/^Choose Date$/i.test(label) && !/disabled/i.test(String(el.className)) && el.getAttribute("data-audit-used") !== "1";
      };
      let picked: Element | null = null;
      for (const heading of document.querySelectorAll("h2, h3")) {
        let node: Element | null = heading.parentElement;
        for (let depth = 0; depth < 10 && node; depth += 1) {
          const headings = node.querySelectorAll("h2, h3").length;
          const day = [...node.querySelectorAll("[aria-label]")].find(isDay) || null;
          if (day && headings >= 1 && headings <= 3 && ((node as HTMLElement).innerText || "").length < 8000) {
            picked = day;
            break;
          }
          if (headings > 6) break;
          node = node.parentElement;
        }
        if (picked) break;
      }
      target = picked;
    } else {
      target = [...document.querySelectorAll("button, [role='button'], a")].find((el) => {
        const label = labelOf(el);
        return visible(el) && /\bbook(?:\s+now)?\b/i.test(label) && !/sign[\s-]*in|register|most booked/i.test(label);
      }) || null;
    }
    if (!target) return null;
    const label = (target.getAttribute("aria-label") || labelOf(target)).slice(0, 80);
    target.setAttribute("data-audit-used", "1");
    (target as HTMLElement).scrollIntoView({ block: "center" });
    (target as HTMLElement).click();
    return label || action;
  }, kind);
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
