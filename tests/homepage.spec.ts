import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { runQaAgent } from "../agent/graph";
import { BookingPage } from "./pages/booking.page";
import { HomePage } from "./pages/home.page";
import { NavPage, type FoundLink } from "./pages/nav.page";

async function expectLinks(nav: NavPage, links: FoundLink[]) {
  for (const link of links) {
    const status = await nav.statusOf(link.url);
    expect(status, `${link.label} ${link.url}`).toBeLessThan(400);
  }
}

test.describe("homepage", () => {
  test("status", async ({ page }) => {
    const home = new HomePage(page);
    expect(await home.open()).toBeLessThan(400);
  });

  test("one visible H1", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    const headings = await home.visibleHeadings();
    expect(headings).toHaveLength(1);
  });

  test("title", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    expect((await home.title()).trim().length).toBeGreaterThan(0);
  });

  test("meta description", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    expect((await home.metaDescription()).length).toBeGreaterThan(0);
  });

  test("pinch zoom", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    expect(await home.zoomDisabled()).toBe(false);
  });

  test("text contrast", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    const contrast = await home.contrast();
    expect(contrast.ratio).not.toBeNull();
    expect(contrast.ratio as number).toBeGreaterThanOrEqual(4.5);
  });

  test("nav links", async ({ page }) => {
    const home = new HomePage(page);
    const nav = new NavPage(page);
    await home.open();
    await expectLinks(nav, await nav.linksIn("header a, nav a, [role='navigation'] a"));
  });

  test("main links", async ({ page }) => {
    const home = new HomePage(page);
    const nav = new NavPage(page);
    await home.open();
    await expectLinks(nav, await nav.linksIn("main a"));
  });

  test("footer links", async ({ page }) => {
    const home = new HomePage(page);
    const nav = new NavPage(page);
    await home.open();
    await expectLinks(nav, await nav.linksIn("footer a"));
  });

  test("menu links", async ({ page }) => {
    const home = new HomePage(page);
    const nav = new NavPage(page);
    await home.open();
    await expectLinks(nav, await nav.menuLinks());
  });

  test("visible buttons", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    const steps = await home.exerciseButtons();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => !/submitted payment|card number/i.test(step.actual))).toBe(true);
  });

  test("phone menu", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    const menu = await home.phoneMenu();
    expect(menu.found && menu.opened && menu.closed).toBe(true);
  });

  test("booking stops at checkout", async ({ page }) => {
    const booking = new BookingPage(page);
    const stop = await booking.walkUntilCheckout();
    expect(stop.url).toMatch(/\/checkout(?:\/|$|\?)/i);
    expect(stop.filledFields).toBe(0);
  });

  test("unknown path", async ({ page }) => {
    const nav = new NavPage(page);
    const missing = await nav.unknownPath();
    expect(missing.status).toBe(404);
    expect(missing.url).not.toBe(nav.target);
  });

  test("console", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (/Failed to load resource|net::ERR/i.test(message.text())) return;
      errors.push(message.text());
    });
    const home = new HomePage(page);
    await home.open();
    expect(errors, errors[0] || "").toEqual([]);
  });

  test("first-view images", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    const images = await home.firstViewImages();
    expect(images.missingAlt).toBe(0);
  });

  test("text overflow", async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    expect(await home.overflowAt(390)).toBe(0);
  });

  test("accessibility", async ({ page }) => {
    const home = new HomePage(page);
    expect(await home.open()).toBeLessThan(400);
    const results = await new AxeBuilder({ page }).analyze();
    const summary = results.violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.help}`).join("\n");
    expect(results.violations, summary).toEqual([]);
  });
});

test.describe("agent gate", () => {
  test("runs without a Groq key and refuses payment", async () => {
    const previous = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const allowed = await runQaAgent(process.env.TARGET_URL || "https://www.seadwellers.com/");
      expect(allowed.allowed).toBe(true);
      expect(allowed.reasoning).toContain("Playwright specs run without a model");
      const refused = await runQaAgent("submit payment with a credit card");
      expect(refused.allowed).toBe(false);
      expect(refused.forbidden.length).toBeGreaterThan(0);
    } finally {
      if (previous) process.env.GROQ_API_KEY = previous;
    }
  });
});
