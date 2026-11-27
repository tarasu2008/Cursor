import type { Metadata } from "next";
import { packs, pricingPlans, siteConfig } from "@/data/catalog";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing & image licenses",
  description:
    "Lumenstock one-time plans and on-demand image packs with Standard and Enhanced licenses, desktop, tablet, and phone download sizes, and zero auto-renewal.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing & image licenses · Lumenstock",
    description:
      "Transparent one-time plans and non-expiring credit packs for 11,300+ HD stock images. No stored cards, no auto-renewal.",
    url: `${siteConfig.url}/pricing`,
    images: [{ url: "/samples/categories/nature.jpg", width: 1920, height: 1080, alt: "Lumenstock Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing & image licenses · Lumenstock",
    description:
      "One-time HD stock plans and on-demand credit packs with Standard and Enhanced licenses.",
    images: ["/samples/categories/nature.jpg"],
  },
};

export default function PricingPage() {
  const pricingJsonLd = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Lumenstock HD Stock Image Plans & Packs",
    url: `${siteConfig.url}/pricing`,
    itemListElement: [
      ...pricingPlans.map((plan) => ({
        "@type": "Offer",
        name: `Lumenstock ${plan.name} Plan`,
        description: `${plan.blurb} — ${plan.downloads} HD downloads/month`,
        price: plan.annual,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${siteConfig.url}/pricing`,
      })),
      ...packs.map((pack) => ({
        "@type": "Offer",
        name: `Lumenstock ${pack.count}-Image Pack`,
        description: `${pack.count} non-expiring HD download credits`,
        price: pack.price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${siteConfig.url}/pricing`,
      })),
    ],
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
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
