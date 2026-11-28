import { auditReportSchema, type AuditReport, type Category, type DeviceReport, type Scenario } from "./schema";
import { assertPublicDns, parsePublicUrl } from "./guardrails";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT, runHomepageScenarios } from "./homepage-checks";

export async function auditUrl(raw: string): Promise<AuditReport> {
  const start = parsePublicUrl(raw);
  await assertPublicDns(start.hostname);
  const desktopRun = await runHomepageScenarios(start.toString(), DESKTOP_VIEWPORT);
  const mobileRun = await runHomepageScenarios(start.toString(), MOBILE_VIEWPORT);
  const desktop = deviceReport("desktop", "Desktop", DESKTOP_VIEWPORT.width, desktopRun);
  const mobile = deviceReport("mobile", "Mobile", MOBILE_VIEWPORT.width, mobileRun);
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

function deviceReport(
  id: DeviceReport["id"],
  label: string,
  width: number,
  run: { scenarios: Scenario[]; skipped: number; capSeconds: number },
): DeviceReport {
  const categories = buildCategories(run.scenarios, run.skipped);
  const automation = categories.find((item) => item.id === "automation");
  const home = run.scenarios.find((item) => item.name === "Homepage status");
  return {
    id,
    label,
    width,
    categories,
    scenarios: run.scenarios,
    scores: {
      passedPercent: automation?.score ?? 0,
      passedCount: automation?.passed ?? 0,
      total: Math.max(1, (automation?.passed ?? 0) + (automation?.failed ?? 0) + (automation?.skipped ?? 0)),
      homepageStatus: home?.status ?? 0,
      homepageMs: home?.ms ?? 0,
    },
    limits: { maxPages: run.scenarios.length, maxDepth: 1, opened: run.scenarios.length, capSeconds: run.capSeconds, remaining: run.skipped },
  };
}

function buildCategories(scenarios: Scenario[], skipped: number): Category[] {
  const load = group(scenarios, (item) => item.name === "Homepage status");
  const document = group(scenarios, (item) => item.name === "Visible H1" || item.name === "Title" || item.name === "Text contrast" || item.name === "Page text");
  const meta = group(scenarios, (item) => item.name === "Meta description" || item.name === "Pinch zoom");
  const links = group(
    scenarios,
    (item) =>
      item.name.startsWith("Nav:") ||
      item.name.startsWith("Footer:") ||
      item.name.startsWith("Menu:") ||
      item.name.startsWith("Main:") ||
      item.name.startsWith("Button:") ||
      item.name.startsWith("Booking:") ||
      item.name === "Phone menu" ||
      item.name === "Unknown path",
  );
  links.skipped += skipped;
  const automation = group(scenarios, () => true);
  automation.skipped += skipped;
  return [
    category("load", "Load test", load, "The page-load check: the homepage HTTP status."),
    category("document", "Title and headings", document, "A title, one visible H1, readable text, and contrast."),
    category("meta", "Meta", meta, "Meta description and pinch zoom."),
    category("links", "Links", links, "Navigation, buttons, menu items, and the booking walk."),
    category("automation", "Automation", automation, "Every homepage check that ran."),
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
  detail: string,
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
    findings: [
      {
        label: "Result",
        value: `${tally.passed} passed. ${tally.failed} failed. ${tally.skipped} did not run.`,
        state: tally.failed ? "fail" : tally.skipped ? "info" : "pass",
      },
      { label: "Scope", value: detail, state: "info" },
    ],
  };
}
