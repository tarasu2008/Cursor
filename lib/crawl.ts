import { auditReportSchema, type AuditReport, type Category, type Scenario } from "./schema";
import { assertPublicDns, parsePublicUrl } from "./guardrails";
import { runHomepageScenarios } from "./homepage-checks";

export async function auditUrl(raw: string): Promise<AuditReport> {
  const start = parsePublicUrl(raw);
  await assertPublicDns(start.hostname);
  const { scenarios, skipped, capSeconds } = await runHomepageScenarios(start.toString());
  const home = scenarios.find((item) => item.name === "Homepage status");
  const categories = buildCategories(scenarios, skipped);
  const automation = categories.find((item) => item.id === "automation");
  const failed = scenarios.filter((item) => !item.passed).length;
  const report: AuditReport = {
    requestedUrl: start.toString(),
    finalUrl: home?.finalUrl || start.toString(),
    fetchedAt: new Date().toISOString(),
    summary: `${scenarios.length} homepage checks ran. ${failed} failed.${skipped > 0 ? ` ${skipped} controls were not opened before the ${Math.round(capSeconds / 60)} minute cap.` : ""}`,
    scores: {
      passedPercent: automation?.score ?? 0,
      passedCount: automation?.passed ?? 0,
      total: Math.max(1, (automation?.passed ?? 0) + (automation?.failed ?? 0) + (automation?.skipped ?? 0)),
      homepageStatus: home?.status ?? 0,
      homepageMs: home?.ms ?? 0,
    },
    limits: { maxPages: scenarios.length, maxDepth: 1, opened: scenarios.length, capSeconds, remaining: skipped },
    categories,
    scenarios,
  };
  return auditReportSchema.parse(report);
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
    category("load", "Load", load, "The homepage HTTP status."),
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
