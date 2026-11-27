"use client";

import { useEffect, useState } from "react";
import type { AuditReport } from "@/lib/schema";
import { DEMO_URL } from "@/lib/sample-report";
import { ReportView } from "./report-view";

type Failure = {
  error: string;
  runStatus?: string;
  role?: string;
  exactText?: string;
};

export function Auditor() {
  const [url, setUrl] = useState(DEMO_URL);
  const [pending, setPending] = useState<"live" | "sample" | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    if (!report) return;
    document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);

  async function run(sample: boolean) {
    setPending(sample ? "sample" : "live");
    setFailure(null);
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sample ? { sample: true } : { url }),
      });
      const payload = (await response.json()) as AuditReport | Failure;
      if (!response.ok || !("findings" in payload)) {
        const errorPayload = payload as Failure;
        setReport(null);
        setFailure({
          error: errorPayload.error || "The audit did not return a report.",
          runStatus: errorPayload.runStatus,
          role: errorPayload.role,
          exactText: errorPayload.exactText,
        });
        return;
      }
      setReport(payload);
    } catch {
      setReport(null);
      setFailure({ error: "The browser could not reach the audit API." });
    } finally {
      setPending(null);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="mark" href="#analyze">
          <span>FP</span>
          First Pass
        </a>
        <p>A first QA audit without a Playwright project.</p>
      </header>

      <section className="hero" id="analyze">
        <p className="eyebrow">For small teams and freelancers</p>
        <h1>Paste a URL. Read the audit the way PageSpeed lays out a result.</h1>
        <p className="lede">
          First Pass fetches the page, a short sample of same-host links, and the on-page signals a
          senior QA would write down before opening a browser. It does not log in, submit a form, or
          touch checkout. Core Web Vitals and visual bugs stay marked as not run until a later browser
          agent exists.
        </p>
        <form
          className="url-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(false);
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
            <button type="submit" disabled={pending !== null}>
              {pending === "live" ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </form>
        <div className="hero-actions">
          <button type="button" className="ghost" disabled={pending !== null} onClick={() => void run(true)}>
            {pending === "sample" ? "Loading sample…" : "View the sample report"}
          </button>
          <p>The sample is labeled. It is not a measurement of Sea Dwellers.</p>
        </div>
        {pending === "live" ? (
          <ol className="steps" aria-live="polite">
            <li>Input guardrail: public http(s) only, no checkout or login URL.</li>
            <li>Fetch crawl: document, robots.txt, sitemap, up to 8 same-host links, one unknown path.</li>
            <li>Output guardrail: the report must match the schema before it is shown.</li>
          </ol>
        ) : null}
        {failure ? (
          <div className="banner banner-block" role="alert">
            <strong>{failure.runStatus ?? "Stopped"}.</strong> {failure.error}
            {failure.role ? <span> Role: {failure.role}.</span> : null}
          </div>
        ) : null}
      </section>

      {report ? (
        <div id="report">
          <ReportView report={report} />
        </div>
      ) : (
        <HomeExplainer />
      )}
    </main>
  );
}

function HomeExplainer() {
  return (
    <section className="explainer">
      <h2>What a first version can honestly say</h2>
      <div className="cards">
        <article>
          <h3>PageSpeed Insights</h3>
          <p>
            One URL. Field data from Chrome users over 28 days, and one Lighthouse lab run. It does
            not click through a site or hunt broken links.
          </p>
        </article>
        <article>
          <h3>Semrush Site Audit</h3>
          <p>
            A crawler across many pages: indexability, status codes, titles, duplicate content,
            broken links, and more than 140 checks. It does not open a menu or judge a layout.
          </p>
        </article>
        <article>
          <h3>This demo</h3>
          <p>
            A bounded GET crawl and a report with the same reading order as a QA write-up: what was
            observed, what was expected, and what was refused. Playwright export comes later.
          </p>
        </article>
      </div>
    </section>
  );
}
