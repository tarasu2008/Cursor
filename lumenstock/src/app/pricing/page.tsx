import type { Metadata } from "next";
import { packs, pricingPlans } from "@/data/catalog";

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

      <section className="section" style={{ paddingTop: "1rem" }}>
        <div className="pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.id} className={`price-card${plan.featured ? " featured" : ""}`}>
              <div>
                <h3>{plan.name}</h3>
                <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>{plan.blurb}</p>
              </div>
              <div className="price">
                ${plan.annual}
                <span> /mo annual</span>
              </div>
              <div style={{ color: "var(--faint)", fontSize: "0.9rem" }}>
                or ${plan.monthly}/mo month-to-month · {plan.downloads} downloads
              </div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button className={`btn ${plan.featured ? "btn-primary" : "btn-ghost"}`} type="button">
                Choose {plan.name}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>On-demand packs</h2>
            <p>Credits that do not expire — ideal for one-off projects.</p>
          </div>
        </div>
        <div className="packs">
          {packs.map((p) => (
            <div key={p.id} className="pack">
              <strong>
                {p.count} images · ${p.price}
              </strong>
              <div style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 4 }}>
                ${(p.price / p.count).toFixed(2)} per image
              </div>
            </div>
          ))}
        </div>
      </section>

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
