"use client";

import { useState } from "react";
import type { AuditReport, Category, Scenario } from "@/lib/schema";

const DEMO_URL = "https://www.seadwellers.com/";

export function Auditor() {
  const [url, setUrl] = useState(DEMO_URL);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
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
        <h1>First Pass</h1>
        {report ? (
          <button type="button" className="ghost" onClick={() => void download()} disabled={downloading}>
            {downloading ? "Preparing…" : "Download report"}
          </button>
        ) : null}
      </header>
      <main>
        <p className="lead">Check a public site.</p>
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
          <p className="quiet">Public pages only. A run stops at about 2 minutes. Checkout is not filled in or paid.</p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        {report ? (
          <section className="results" aria-live="polite">
            <div className="gauge-card">
              {report.categories.map((category) => (
                <Gauge key={category.id} category={category} />
              ))}
              <p className="legend">
                <span className="swatch poor" /> 0–49
                <span className="swatch ok" /> 50–89
                <span className="swatch good" /> 90–100
              </p>
              <p className="score-note">
                {report.scenarios.filter((item) => item.passed).length} passed and{" "}
                {report.scenarios.filter((item) => !item.passed).length} failed. Automation counts every check below.
                {report.limits.remaining > 0
                  ? ` Stopped at ${Math.round(report.limits.capSeconds / 60)} minutes. ${report.limits.remaining} controls were not opened.`
                  : ""}
              </p>
            </div>
            <details className="homepage-checks" open>
              <summary>Homepage checks</summary>
              <ol className="scenarios">
                {report.scenarios.map((scenario) => (
                  <li key={scenario.id}>
                    <span className={scenario.passed ? "pill pass" : "pill fail"}>{scenario.passed ? "Pass" : "Fail"}</span>
                    <span className="scenario-name">{rowTitle(scenario)}</span>
                    <span className="scenario-actual">{oneLine(scenario.actual)}</span>
                  </li>
                ))}
              </ol>
            </details>
            <div className="groups">
              {report.categories.map((category) => (
                <details key={category.id} open={category.score === null || category.score < 90}>
                  <summary>
                    <i className={`marker ${band(category.score)}`} aria-hidden="true" />
                    <span className="group-label">{category.label}</span>
                    <span className="group-headline">{category.headline}</span>
                    <span className={`group-score ${band(category.score)}`}>
                      {category.score === null ? "–" : category.score}
                    </span>
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
        ) : null}
      </main>
    </>
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
      <p className="gauge-counts">
        {category.passed} pass · {category.failed} fail
        <br />
        {category.skipped} skipped · {category.ran} ran
      </p>
    </figure>
  );
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
