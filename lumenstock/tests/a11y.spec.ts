import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = [
  { name: "Home", path: "/" },
  { name: "All images", path: "/browse" },
  { name: "Categories", path: "/categories" },
  { name: "Pricing", path: "/pricing" },
  { name: "Roadmap", path: "/roadmap" },
  { name: "Privacy Policy", path: "/privacy" },
  { name: "Terms & Conditions", path: "/terms" },
  { name: "Asset detail", path: "/asset/fluid-amber-abstract-light-forms" },
];

for (const route of ROUTES) {
  test(`WCAG A/AA accessibility: ${route.name} (${route.path})`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.html),
    }));

    expect(summary, `Accessibility violations on ${route.path}`).toEqual([]);
  });
}
