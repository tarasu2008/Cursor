import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing & image licenses",
  description:
    "Lumenstock subscription plans and on-demand image packs with standard and enhanced licenses, plus desktop, tablet, and phone download sizes.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="container">
      <div className="page-hero">
        <h1>Pricing</h1>
        <p>
          Subscriptions for steady creators, on-demand packs when you only need a few downloads —
          the same commerce pattern as major stock platforms.
        </p>
        <p className="billing-callout">
          We never store card details. Plans are not auto-renewed — before a subscription ends we
          email you a payment link to renew.
        </p>
      </div>

      <PricingClient />

      <section id="licenses" className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Licenses</h2>
            <p>Royalty-free terms — you license use, you do not buy copyright.</p>
          </div>
        </div>
        <div className="roadmap">
          <div className="roadmap-item">
            <strong>Standard</strong>
            <span>Digital + print (up to 500k). No merchandise. Baseline indemnification.</span>
          </div>
          <div className="roadmap-item">
            <strong>Enhanced</strong>
            <span>Unlimited reproduction, merchandise, templates, higher indemnification.</span>
          </div>
          <div className="roadmap-item">
            <strong>Editorial (soon)</strong>
            <span>Single-context news/human-interest use — not for advertising.</span>
          </div>
          <div className="roadmap-item">
            <strong>Premier / Enterprise (soon)</strong>
            <span>Custom seats, indemnification, and sensitive-use negotiation.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
