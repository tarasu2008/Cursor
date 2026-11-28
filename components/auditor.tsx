"use client";

import { useState } from "react";
import type { AuditReport, Category, DeviceReport, Scenario } from "@/lib/schema";

const DEMO_URL = "https://www.seadwellers.com/";

export function Auditor() {
  const [url, setUrl] = useState(DEMO_URL);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [deviceId, setDeviceId] = useState<DeviceReport["id"]>("desktop");
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as AuditReport | { error?: string };
      if (!response.ok || !("categories" in payload)) {
        setReport(null);
        setError("error" in payload && payload.error ? payload.error : "The homepage could not be opened.");
        return;
      }
      setDeviceId("desktop");
      setReport(payload);
    } catch {
      setReport(null);
      setError("The audit could not be reached.");
    } finally {
      setPending(false);
    }
  }

  async function download() {
    if (!report) return;
    setDownloading(true);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!response.ok) {
        setError("The report file could not be created.");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName(report.finalUrl);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("The report file could not be created.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <header className="bar">
        <h1 className="brand">
          <Mark />
          First Pass
        </h1>
        {report ? (
          <button type="button" className="ghost" onClick={() => void download()} disabled={downloading}>
            {downloading ? "Preparing…" : "Download report"}
          </button>
        ) : null}
      </header>
      <main>
        <p className="lead">Check your site</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void analyze();
          }}
        >
          <label htmlFor="site-url">Website URL</label>
          <div className="url-row">
            <input
              id="site-url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              required
              placeholder="https://www.seadwellers.com/"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button type="submit" disabled={pending}>
              {pending ? "Analyzing…" : "Analyze"}
            </button>
          </div>
          <p className="quiet">Mobile and Desktop scores for Performance, Accessibility, Best Practices, and SEO, plus homepage checks.</p>
          {pending ? (
            <p className="progress" role="status">
              <span className="progress-track">
                <span className="progress-fill" />
              </span>
              Running Mobile and Desktop scores, then homepage checks.
            </p>
          ) : null}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        {report ? <Results report={report} deviceId={deviceId} onDevice={setDeviceId} /> : null}
      </main>
    </>
  );
}

function Results({
  report,
  deviceId,
  onDevice,
}: {
  report: AuditReport;
  deviceId: DeviceReport["id"];
  onDevice: (id: DeviceReport["id"]) => void;
}) {
  const tabs = [...report.devices].sort((left, right) => Number(left.id === "desktop") - Number(right.id === "desktop"));
  const selected = report.devices.find((device) => device.id === deviceId) ?? tabs.find((device) => device.id === "desktop") ?? tabs[0];
  if (!selected) return null;
  return (
    <section className="results" aria-live="polite">
      <div className="device-tabs" role="tablist" aria-label="Form factor">
        {tabs.map((device) => (
          <button
            key={device.id}
            type="button"
            role="tab"
            id={`device-tab-${device.id}`}
            aria-selected={device.id === selected.id}
            aria-controls="device-panel"
            onClick={() => onDevice(device.id)}
          >
            <FormIcon id={device.id} />
            {device.label}
          </button>
        ))}
      </div>
      <DevicePanel key={selected.id} device={selected} />
    </section>
  );
}

function PointerIcon() {
  return (
    <svg className="row-pointer" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 3.2v12.1l2.7-2.4 2.6 5.1 2.2-1.1-2.6-5 4-.4L7 3.2z" />
    </svg>
  );
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1a73e8" />
      <path d="M8 16.5h10.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 11.5 21.2 16.5 16 21.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FormIcon({ id }: { id: DeviceReport["id"] }) {
  if (id === "mobile") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DevicePanel({ device }: { device: DeviceReport }) {
  const failed = device.scenarios.filter((item) => !item.passed).length;
  const passed = device.scenarios.length - failed;
  return (
    <section className="device" id="device-panel" role="tabpanel" aria-labelledby={`device-tab-${device.id}`}>
      <div className="gauge-card">
        {device.categories.map((category) => (
          <Gauge key={category.id} category={category} />
        ))}
        <p className="legend">
          <span className="swatch poor" /> 0–49
          <span className="swatch ok" /> 50–89
          <span className="swatch good" /> 90–100
        </p>
        <p className="score-note">
          Lighthouse lab scores. {passed} passed and {failed} failed in the homepage checks at {device.width}px.
          {device.limits.remaining > 0
            ? ` Stopped at ${Math.round(device.limits.capSeconds / 60)} minutes. ${device.limits.remaining} controls were not opened.`
            : ""}
        </p>
      </div>
      <section className="check-groups" aria-label="Homepage checks">
        <h2>Homepage checks</h2>
        {checkGroups(device.scenarios).map((group) => (
          <details key={group.label} className="check-group">
            <summary>
              <span className="group-label">{group.label}</span>
              <span className="group-headline">
                {group.failed} failed · {group.passed} passed
              </span>
            </summary>
            <ol className="scenarios">
              {group.items.map((scenario) => (
                <li key={scenario.id}>
                  <details className="scenario">
                    <summary>
                      <span className={scenario.passed ? "pill pass" : "pill fail"}>{scenario.passed ? "Pass" : "Fail"}</span>
                      <span className="scenario-name">{rowTitle(scenario)}</span>
                      <span className="scenario-actual">{oneLine(scenario.actual)}</span>
                      <PointerIcon />
                    </summary>
                    <dl className="scenario-detail">
                      <div>
                        <dt>URL</dt>
                        <dd>{scenario.finalUrl}</dd>
                      </div>
                      <div>
                        <dt>Expected</dt>
                        <dd>{oneLine(scenario.expected)}</dd>
                      </div>
                      <div>
                        <dt>Actual</dt>
                        <dd>{oneLine(scenario.actual)}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{scenario.passed ? "Pass" : "Fail"}{scenario.status > 0 ? ` · HTTP ${scenario.status}` : ""}</dd>
                      </div>
                    </dl>
                  </details>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </section>
      <div className="groups">
        {device.categories.map((category) => (
          <details key={category.id} open={category.score === null || category.score < 90}>
            <summary>
              <i className={`marker ${band(category.score)}`} aria-hidden="true" />
              <span className="group-label">{category.label}</span>
              <span className="group-headline">{category.headline}</span>
              <span className={`group-score ${band(category.score)}`}>{category.score === null ? "–" : category.score}</span>
            </summary>
            <ul>
              {category.findings.map((finding, index) => (
                <li key={`${category.id}-${index}`} className={finding.state}>
                  <i className={`marker ${finding.state === "pass" ? "good" : finding.state === "fail" ? "poor" : "info"}`} aria-hidden="true" />
                  <span className="finding-label">{finding.label}</span>
                  <span className="finding-value">{finding.value}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

function Gauge({ category }: { category: Category }) {
  const tone = band(category.score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const amount = ((category.score ?? 0) / 100) * circumference;
  const spoken = category.score === null ? "not scored" : String(category.score);
  return (
    <figure className={`gauge ${tone}`} aria-label={`${category.label} ${spoken}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="gauge-fill" cx="60" cy="60" r="48" />
        <circle className="gauge-track" cx="60" cy="60" r={radius} />
        <circle
          className="gauge-arc"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={`${amount} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="68">
          {category.score === null ? "–" : category.score}
        </text>
      </svg>
      <figcaption>{category.label}</figcaption>
      <div className="score-bar" aria-hidden="true">
        <span className={tone} style={{ width: `${category.score ?? 0}%` }} />
      </div>
      <p className="gauge-measure">{measures(category.id)}</p>
      <p className="gauge-counts">
        {category.passed} pass · {category.failed} fail
        <br />
        {category.skipped} skipped · {category.ran} ran
      </p>
    </figure>
  );
}

function measures(id: Category["id"]): string {
  if (id === "performance") return "Lighthouse lab, not our load timing.";
  return "Lighthouse lab.";
}

function checksFirst(scenarios: Scenario[]): Scenario[] {
  return [...scenarios].sort((left, right) => Number(left.passed) - Number(right.passed));
}

const CHECK_GROUPS: Array<{ label: string; match: (name: string) => boolean }> = [
  { label: "SEO", match: (name) => ["Title", "Title length", "Meta description", "Meta description length", "Visible H1", "Headings", "Page text", "Content length", "Canonical", "HTML language", "Schema", "Image alt", "Analytics", "Heap"].includes(name) },
  { label: "Indexing", match: (name) => ["Indexing", "Robots.txt", "XML sitemap", "Unknown path"].includes(name) },
  { label: "Links", match: (name) => /^(Nav|Footer|Main|Menu):/.test(name) },
  { label: "Usability", match: (name) => ["Pinch zoom", "Device width", "Phone menu", "Text overflow", "Text contrast", "Favicon", "Frames", "Deprecated HTML", "Doctype", "First-view images"].includes(name) },
  { label: "Performance", match: (name) => ["Homepage status", "Load time", "Compression", "Console"].includes(name) },
  { label: "Social", match: (name) => ["Open Graph", "Twitter card", "Social profiles"].includes(name) },
  { label: "Security", match: (name) => ["HTTPS", "Mixed content", "HSTS"].includes(name) },
  { label: "Accessibility", match: (name) => name === "Accessibility" || name.startsWith("Accessibility:") },
  { label: "Actions", match: (name) => name === "Buttons" || name.startsWith("Button:") || name.startsWith("Booking") },
];

function checkGroups(scenarios: Scenario[]): Array<{ label: string; items: Scenario[]; failed: number; passed: number }> {
  const used = new Set<string>();
  const groups = CHECK_GROUPS.map((group) => {
    const items = checksFirst(scenarios.filter((item) => group.match(item.name)));
    for (const item of items) used.add(item.id);
    const failed = items.filter((item) => !item.passed).length;
    return { label: group.label, items, failed, passed: items.length - failed };
  }).filter((group) => group.items.length > 0);
  const rest = checksFirst(scenarios.filter((item) => !used.has(item.id)));
  if (rest.length > 0) {
    const failed = rest.filter((item) => !item.passed).length;
    groups.push({ label: "Other", items: rest, failed, passed: rest.length - failed });
  }
  return [...groups.filter((group) => group.failed > 0), ...groups.filter((group) => group.failed === 0)];
}

function band(score: number | null): "good" | "ok" | "poor" | "none" {
  if (score === null) return "none";
  if (score >= 90) return "good";
  if (score >= 50) return "ok";
  return "poor";
}

function rowTitle(scenario: Scenario): string {
  const parts = scenario.name.split(":");
  if (parts.length < 2) return scenario.name.replace(/\bLink\b/g, pathTitle(scenario.requestedUrl));
  const kind = parts[0]?.trim() || scenario.name;
  const label = parts.slice(1).join(":").trim();
  if (label && !/^link$/i.test(label)) return scenario.name;
  return `${kind}: ${pathTitle(scenario.requestedUrl)}`;
}

function pathTitle(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path && path !== "/" ? path : "Home";
  } catch {
    return "Page";
  }
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fileName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "");
    return `first-pass-${host || "report"}.pdf`;
  } catch {
    return "first-pass-report.pdf";
  }
}
