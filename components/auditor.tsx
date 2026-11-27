"use client";

import { useState } from "react";
import type { AuditReport } from "@/lib/schema";

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
      if (!response.ok || !("scenarios" in payload)) {
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
    <main>
      <header className="top">
        <a href="#open">First Pass</a>
      </header>

      <section className="hero" id="open">
        <h1>Open the homepage.</h1>
        <p className="lede">
          Paste an address. First Pass opens that page and the links in its header, then lists what came back.
        </p>
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
              {pending ? "Opening…" : "Analyze"}
            </button>
          </div>
        </form>
        <p className="quiet">Public pages only. Nothing is submitted.</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {report ? (
        <section className="results" aria-live="polite">
          <div className="scores">
            <div>
              <p className="figure">{report.scores.passedPercent}</p>
              <p className="caption">
                Passed · {report.scores.passedCount} of {report.scores.total} opened
              </p>
            </div>
            <div>
              <p className="figure">{report.scores.homepageMs}</p>
              <p className="caption">Homepage · HTTP {report.scores.homepageStatus}</p>
            </div>
          </div>
          <p className="summary">{report.summary}</p>
          <button type="button" className="download" onClick={() => void download()} disabled={downloading}>
            {downloading ? "Preparing…" : "Download report"}
          </button>
          <ul className="rows">
            {report.scenarios.map((scenario) => (
              <li key={scenario.id}>
                <span className={scenario.passed ? "mark pass" : "mark fail"} aria-hidden="true" />
                <span className="name">{scenario.control}</span>
                <span className="status">{scenario.status || "—"}</span>
                <span className="time">{scenario.ms ? `${scenario.ms} ms` : ""}</span>
                <span className="title">{scenario.title ?? scenario.finalUrl}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function fileName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "");
    return `first-pass-${host || "report"}.pdf`;
  } catch {
    return "first-pass-report.pdf";
  }
}
