"use client";

import { useState } from "react";
import type { AuditReport, Category } from "@/lib/schema";

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
          <p className="quiet">
            Public pages only. Up to 12 pages, 2 links deep. Nothing is submitted.
          </p>
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
                Opened {report.limits.opened} of {report.limits.maxPages} pages, {report.limits.maxDepth} links deep.
                A score is passes divided by passes, failures, and checks that did not run.
              </p>
            </div>
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

function fileName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "");
    return `first-pass-${host || "report"}.pdf`;
  } catch {
    return "first-pass-report.pdf";
  }
}
