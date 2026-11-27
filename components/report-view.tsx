"use client";

import { useState } from "react";
import type { AuditReport, SectionId } from "@/lib/schema";
import { ScoreRing } from "./score-ring";

const SECTIONS: { id: SectionId | "all"; label: string }[] = [
  { id: "all", label: "All checks" },
  { id: "performance", label: "Performance" },
  { id: "seo", label: "SEO" },
  { id: "links", label: "Links and 404s" },
  { id: "navigation", label: "Navigation" },
  { id: "ui", label: "UI issues" },
];

export function ReportView({ report }: { report: AuditReport }) {
  const [section, setSection] = useState<SectionId | "all">("all");
  const findings =
    section === "all" ? report.findings : report.findings.filter((item) => item.section === section);
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

  return (
    <div className="report">
      {report.source === "sample" ? (
        <div className="banner banner-sample" role="status">
          <strong>Sample report.</strong> These figures were written to show the layout. They are not a
          measurement of {report.requestedUrl}. {report.sampleReason ?? "Use Analyze for a live crawl."}
        </div>
      ) : (
        <div className="banner banner-live" role="status">
          <strong>Live crawl.</strong> Fetched just now. No form was submitted.
        </div>
      )}

      <header className="report-head">
        <p className="eyebrow">
          Run {report.runStatus} · {report.role} · confidence {report.confidence.toFixed(2)}
        </p>
        <h2>{report.finalUrl}</h2>
        <p className="summary">{report.summary}</p>
        <p className="meta-line">
          <span>{when}</span>
          <span>Observed: {report.exactText}</span>
        </p>
      </header>

      <div className="rings" aria-label="Section scores">
        <ScoreRing score={report.scores.overall} label="First-pass" detail="Mean of sections" />
        <ScoreRing score={report.scores.performance} label="Fetch speed" detail="Not Lighthouse" />
        <ScoreRing score={report.scores.seo} label="On-page SEO" detail="This document" />
        <ScoreRing score={report.scores.links} label="Links" detail="Sample plus 404 probe" />
        <ScoreRing score={report.scores.navigation} label="Navigation" detail="HTML only" />
        <ScoreRing score={report.scores.ui} label="UI signals" detail="Not a screenshot" />
      </div>
      <p className="score-note">{report.scoreNote}</p>

      <section className="facts">
        <h3>Document</h3>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{report.page.status ?? "—"}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{report.page.totalMs == null ? "—" : `${report.page.totalMs} ms`}</dd>
          </div>
          <div>
            <dt>Decoded HTML</dt>
            <dd>
              {report.page.decodedHtmlBytes == null
                ? "—"
                : `${report.page.decodedHtmlBytes.toLocaleString("en-US")} bytes`}
            </dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{report.page.title ?? "None"}</dd>
          </div>
          <div>
            <dt>H1</dt>
            <dd>{report.page.h1.length ? report.page.h1.join(" · ") : "None"}</dd>
          </div>
          <div>
            <dt>Canonical</dt>
            <dd>{report.page.canonical ?? "None"}</dd>
          </div>
        </dl>
        <p className="preconditions">
          <strong>Preconditions. </strong>
          {report.preconditions}
        </p>
      </section>

      <p className="score-note">
        HEALED means that check passed. OUTAGE means that check saw a defect. BLOCKED means it was
        refused or needs a browser. An OUTAGE on one check does not mean the site is down. The run
        status above is the only place that speaks for the document itself.
      </p>
      <div className="section-tabs" role="tablist" aria-label="Report sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            className={section === item.id ? "tab active" : "tab"}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="findings">
        {findings.map((item) => (
          <article key={item.id} className={`finding severity-${item.severity}`}>
            <header>
              <span className="tc">{item.id}</span>
              <span className={`pill severity-${item.severity}`}>{item.severity}</span>
              <span className={`pill status-${item.status}`}>{item.status}</span>
              <span className="confidence">confidence {item.confidence.toFixed(2)}</span>
            </header>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <dl className="finding-dl">
              <div>
                <dt>Observed</dt>
                <dd>{item.exactText}</dd>
              </div>
              <div>
                <dt>Expected</dt>
                <dd>{item.expected}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{item.role}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {(section === "all" || section === "links") && (
        <section className="table-block">
          <h3>Link sample</h3>
          <p>
            {report.links.discoveredSameHost} same-host links were found in the HTML.{" "}
            {report.links.checked.length} were requested. {report.links.skippedCount} were skipped.
            External hosts were not fetched
            {report.links.externalHosts.length ? `: ${report.links.externalHosts.join(", ")}` : ""}.
          </p>
          {report.links.checked.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {report.links.checked.map((row) => (
                    <tr key={row.url}>
                      <td className="url-cell">{row.url}</td>
                      <td>{row.status ?? "—"}</td>
                      <td>{row.ms == null ? "—" : `${row.ms} ms`}</td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No child link was requested.</p>
          )}
          {report.links.skippedSample.length > 0 ? (
            <ul className="skip-list">
              {report.links.skippedSample.map((row) => (
                <li key={row.url}>
                  <span className="url-cell">{row.url}</span> — {row.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <h3>robots.txt and sitemap</h3>
          <p>
            <strong>{report.robots.url || "robots.txt"}.</strong> {report.robots.note}
          </p>
          <p>
            <strong>{report.sitemap.url || "sitemap"}.</strong> {report.sitemap.note}
          </p>
        </section>
      )}

      {(section === "all" || section === "ui") && (
        <section className="table-block">
          <h3>Left alone on purpose</h3>
          {report.forms.length === 0 ? (
            <p>No form element was recorded on this document.</p>
          ) : (
            <ul>
              {report.forms.map((form) => (
                <li key={`${form.method}-${form.action}`}>
                  {form.method.toUpperCase()} {form.action} — {form.fields.join(", ") || "no named fields"}. Not
                  submitted.
                </li>
              ))}
            </ul>
          )}
          {report.controlsNotUsed.length > 0 ? (
            <p>Controls read and not activated: {report.controlsNotUsed.join("; ")}.</p>
          ) : null}
        </section>
      )}

      <section className="split">
        <div>
          <h3>Not measured</h3>
          <ul>
            {report.notMeasured.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Guardrails</h3>
          <ul>
            {report.guardrails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Agent nodes</h3>
          <p>Ran: {report.nodesRun.join(", ")}.</p>
          <p>Skipped: {report.nodesSkipped.join(", ")}.</p>
        </div>
      </section>
    </div>
  );
}
