import { auditReportSchema, type AuditReport, type Category, type DeviceReport, type Scenario } from "./schema";
import { assertPublicDns, parsePublicUrl } from "./guardrails";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT, runHomepageScenarios, type AxeSummary } from "./homepage-checks";
import { runLighthouseLab, type LabScores } from "./lighthouse-lab";

export async function auditUrl(raw: string): Promise<AuditReport> {
  const start = parsePublicUrl(raw);
  await assertPublicDns(start.hostname);
  const url = start.toString();
  const [desktopLab, mobileLab] = await Promise.all([
    labFor(url, "desktop"),
    labFor(url, "mobile"),
  ]);
  const desktopRun = await runHomepageScenarios(url, DESKTOP_VIEWPORT);
  const mobileRun = await runHomepageScenarios(url, MOBILE_VIEWPORT);
  const desktop = deviceReport("desktop", "Desktop", DESKTOP_VIEWPORT.width, desktopRun, desktopLab);
  const mobile = deviceReport("mobile", "Mobile", MOBILE_VIEWPORT.width, mobileRun, mobileLab);
  const home = desktopRun.scenarios.find((item) => item.name === "Homepage status");
  const desktopFailed = desktop.scenarios.filter((item) => !item.passed).length;
  const mobileFailed = mobile.scenarios.filter((item) => !item.passed).length;
  const report: AuditReport = {
    requestedUrl: start.toString(),
    finalUrl: home?.finalUrl || start.toString(),
    fetchedAt: new Date().toISOString(),
    summary: `Desktop ran ${desktop.scenarios.length} homepage checks. ${desktopFailed} failed. Mobile ran ${mobile.scenarios.length} homepage checks. ${mobileFailed} failed.`,
    scores: desktop.scores,
    limits: desktop.limits,
    categories: desktop.categories,
    scenarios: desktop.scenarios,
    devices: [mobile, desktop],
  };
  return auditReportSchema.parse(report);
}

async function labFor(url: string, formFactor: "mobile" | "desktop"): Promise<{ scores: LabScores | null; error: string | null }> {
  try {
    return { scores: await runLighthouseLab(url, formFactor), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lighthouse lab did not finish.";
    return { scores: null, error: message };
  }
}

function withLab(categories: Category[], lab: { scores: LabScores | null; error: string | null }): Category[] {
  const scores = lab.scores;
  const byId: Record<Category["id"], number | null> = {
    performance: scores?.performance ?? null,
    accessibility: scores?.accessibility ?? null,
    "best-practices": scores?.bestPractices ?? null,
    seo: scores?.seo ?? null,
  };
  return categories.map((category) => {
    const score = byId[category.id];
    const value = score === null ? lab.error || "Lighthouse lab did not return this score." : `Lighthouse lab score ${score}. Not a Chrome UX Report score.`;
    return {
      ...category,
      score,
      findings: [{ label: "Lighthouse lab", value, state: "info" as const }, ...category.findings].slice(0, 16),
    };
  });
}

function deviceReport(
  id: DeviceReport["id"],
  label: string,
  width: number,
  run: { scenarios: Scenario[]; skipped: number; capSeconds: number; axe: AxeSummary },
  lab: { scores: LabScores | null; error: string | null },
): DeviceReport {
  const categories = withLab(buildCategories(run.scenarios, run.skipped, run.axe), lab);
  const passed = run.scenarios.filter((item) => item.passed).length;
  const failed = run.scenarios.length - passed;
  const home = run.scenarios.find((item) => item.name === "Homepage status");
  const timing = run.scenarios.find((item) => item.name === "Load time");
  return {
    id,
    label,
    width,
    categories,
    scenarios: run.scenarios,
    scores: {
      passedPercent: Math.round((100 * passed) / Math.max(1, passed + failed + run.skipped)),
      passedCount: passed,
      total: Math.max(1, passed + failed + run.skipped),
      homepageStatus: home?.status ?? 0,
      homepageMs: timing ? Number(timing.actual.match(/\d+/)?.[0] || 0) : home?.ms ?? 0,
    },
    limits: { maxPages: run.scenarios.length, maxDepth: 1, opened: run.scenarios.length, capSeconds: run.capSeconds, remaining: run.skipped },
  };
}

function buildCategories(scenarios: Scenario[], skipped: number, axe: AxeSummary): Category[] {
  const performance = group(scenarios, (item) => item.name === "Homepage status" || item.name === "Load time");
  const practices = group(scenarios, (item) =>
    ["Pinch zoom", "First-view images", "Console", "Phone menu", "Text overflow"].includes(item.name),
  );
  const seoItems = group(
    scenarios,
    (item) =>
      ["Title", "Meta description", "Visible H1", "Page text", "Unknown path"].includes(item.name) ||
      item.name.startsWith("Nav:") ||
      item.name.startsWith("Footer:") ||
      item.name.startsWith("Menu:") ||
      item.name.startsWith("Main:"),
  );
  seoItems.skipped += skipped;
  const axeTally = { passed: axe.passes, failed: axe.violations.length, skipped: 0, ran: axe.passes + axe.violations.length };
  return [
    category("performance", "Performance", performance, listed(scenarios, (item) => item.name === "Homepage status" || item.name === "Load time", "Homepage timing from this browser. The circle is the Lighthouse lab score.")),
    category("accessibility", "Accessibility", axeTally, axeFindings(axe)),
    category("best-practices", "Best Practices", practices, listed(scenarios, (item) => ["Pinch zoom", "First-view images", "Console", "Phone menu", "Text overflow"].includes(item.name), "Zoom, images, console, and phone layout. The circle is the Lighthouse lab score.")),
    category("seo", "SEO", seoItems, seoFindings(scenarios)),
  ];
}

function group(scenarios: Scenario[], include: (item: Scenario) => boolean): { passed: number; failed: number; skipped: number; ran: number } {
  const items = scenarios.filter(include);
  const passed = items.filter((item) => item.passed).length;
  return { passed, failed: items.length - passed, skipped: 0, ran: items.length };
}

function category(
  id: Category["id"],
  label: string,
  tally: { passed: number; failed: number; skipped: number; ran: number },
  findings: Category["findings"],
): Category {
  const denominator = tally.passed + tally.failed + tally.skipped;
  const score = denominator === 0 ? null : Math.round((100 * tally.passed) / denominator);
  return {
    id,
    label,
    headline: `${tally.passed} passed · ${tally.failed} failed · ${tally.skipped} skipped · ${tally.ran} ran`,
    score,
    passed: tally.passed,
    failed: tally.failed,
    skipped: tally.skipped,
    ran: tally.ran,
    findings: findings.slice(0, 16),
  };
}

function listed(scenarios: Scenario[], include: (item: Scenario) => boolean, scope: string): Category["findings"] {
  const rows: Category["findings"] = scenarios.filter(include).slice(0, 14).map((item) => ({
    label: item.name,
    value: item.actual,
    state: item.passed ? "pass" : "fail",
  }));
  rows.push({ label: "Scope", value: scope, state: "info" });
  return rows;
}

function axeFindings(axe: AxeSummary): Category["findings"] {
  const rows: Category["findings"] = axe.violations.slice(0, 12).map((item) => ({
    label: item.id,
    value: `${item.impact}. ${item.help}`.slice(0, 180),
    state: "fail",
  }));
  rows.push({
    label: "axe-core",
    value: `${axe.passes} rules passed. ${axe.violations.length} failed on this viewport. The circle is the Lighthouse lab score.`,
    state: axe.violations.length ? "fail" : "pass",
  });
  return rows;
}

function seoFindings(scenarios: Scenario[]): Category["findings"] {
  const named = scenarios.filter((item) => ["Title", "Meta description", "Visible H1", "Page text", "Unknown path"].includes(item.name));
  const links = scenarios.filter((item) => item.name.startsWith("Nav:") || item.name.startsWith("Footer:") || item.name.startsWith("Menu:") || item.name.startsWith("Main:"));
  const failed = links.filter((item) => !item.passed).length;
  return [
    ...named.map((item) => ({ label: item.name, value: item.actual, state: item.passed ? ("pass" as const) : ("fail" as const) })),
    { label: "Links", value: `${links.length - failed} passed. ${failed} failed.`, state: failed ? "fail" : "pass" },
    { label: "Scope", value: "Title, meta description, headings, and link status. The circle is the Lighthouse lab score.", state: "info" },
  ];
}
