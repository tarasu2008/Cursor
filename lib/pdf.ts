import PDFDocument from "pdfkit";
import type { AuditReport } from "./schema";

const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

export function renderReportPdf(report: AuditReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: "First Pass report" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const when = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(new Date(report.fetchedAt));

    doc.font(FONT_BOLD).fontSize(28).fillColor("#1d1d1f").text("First Pass", { lineGap: 2 });
    doc.moveDown(0.4);
    doc.font(FONT).fontSize(12).fillColor("#6e6e73").text(safe(report.finalUrl));
    doc.moveDown(0.2);
    doc.text(safe(when));
    doc.moveDown(0.8);
    doc.font(FONT).fontSize(12).fillColor("#1d1d1f").text(safe(report.summary), { lineGap: 3 });
    doc.moveDown(0.4);
    doc
      .font(FONT)
      .fontSize(11)
      .fillColor("#6e6e73")
      .text(
        report.categories
          .map(
            (item) =>
              `${item.label} ${item.score === null ? "not scored" : item.score} (${item.passed} passed, ${item.failed} failed, ${item.skipped} skipped, ${item.ran} ran)`,
          )
          .join(". "),
      );
    doc.moveDown(0.3);
    doc.font(FONT).fontSize(11).fillColor("#6e6e73").text("The scenarios below are the requests this run made.");

    for (const scenario of report.scenarios) {
      doc.moveDown(1.2);
      if (doc.y > 680) doc.addPage();
      doc
        .font(FONT_BOLD)
        .fontSize(14)
        .fillColor("#1d1d1f")
        .text(`${scenario.id}  ${safe(scenario.name)}  ${scenario.passed ? "Pass" : "Fail"}`);
      doc.moveDown(0.45);
      section(doc, "Description", scenario.description);
      section(doc, "Preconditions", scenario.preconditions);
      doc.font(FONT_BOLD).fontSize(11).fillColor("#1d1d1f").text("Steps");
      doc.moveDown(0.15);
      scenario.steps.forEach((step, index) => {
        doc.font(FONT).fontSize(11).fillColor("#1d1d1f").text(`${index + 1}. ${safe(step)}`, { lineGap: 2 });
      });
      doc.moveDown(0.35);
      section(doc, "Test data", scenario.testData);
      section(doc, "Expected result", scenario.expected);
      section(doc, "Actual result", scenario.actual);
    }

    doc.end();
  });
}

function section(doc: InstanceType<typeof PDFDocument>, label: string, body: string) {
  doc.font(FONT_BOLD).fontSize(11).fillColor("#1d1d1f").text(label);
  doc.moveDown(0.12);
  doc.font(FONT).fontSize(11).fillColor("#1d1d1f").text(safe(body), { lineGap: 2 });
  doc.moveDown(0.35);
}

function safe(value: string): string {
  return value.replace(/[^\t\n\r\u0020-\u00ff]/g, " ");
}
