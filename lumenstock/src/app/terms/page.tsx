import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Lumenstock Terms & Conditions covering royalty-free Standard and Enhanced image licenses, billing, credits, prohibited uses, and account rules.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms & Conditions · Lumenstock",
    description:
      "Read Lumenstock’s Terms & Conditions for HD stock image licensing, one-time payments, download credits, and usage rights.",
    url: `${siteConfig.url}/terms`,
    images: [{ url: "/samples/categories/nature.jpg", width: 1920, height: 1080, alt: "Lumenstock Terms and Conditions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms & Conditions · Lumenstock",
    description:
      "Royalty-free Standard and Enhanced image licensing terms, billing, and usage rights on Lumenstock.",
  },
};

export default function TermsPage() {
  return (
    <div className="container">
      <div className="page-hero">
        <p className="modal-kicker">Legal</p>
        <h1>Terms &amp; Conditions</h1>
        <p>
          Effective November 27, 2026 · Last updated November 27, 2026. By accessing Lumenstock,
          creating an account, or downloading imagery, you agree to these Terms &amp; Conditions.
        </p>
      </div>

      <article className="legal-doc">
        <section>
          <h2>1. Account Registration &amp; Access</h2>
          <p>
            Browsing and previewing device crop sizes on Lumenstock is free. Downloading HD master
            files requires a registered account with a valid email address and an active paid plan
            or credit pack. You are responsible for maintaining the confidentiality of your login
            credentials and all activity under your account.
          </p>
        </section>

        <section id="licenses">
          <h2>2. Royalty-Free Image Licenses</h2>
          <p>
            When you download an asset using a valid paid credit, Lumenstock grants you a
            worldwide, non-exclusive, non-transferable, perpetual royalty-free license to use the
            image under the license tier selected at download. You license usage rights; ownership
            and copyright of the underlying visual remain with Lumenstock or its licensors.
          </p>
          <ul>
            <li>
              <strong>Standard License:</strong> Permits commercial and personal use across
              websites, social media, digital advertising, presentations, editorial articles, apps,
              and physical print runs up to 500,000 copies. Does not permit resale merchandise or
              templates for resale.
            </li>
            <li>
              <strong>Enhanced License:</strong> Includes all Standard License rights plus unlimited
              print runs, physical merchandise for resale (apparel, posters, mugs, packaging), and
              digital templates distributed to end-users.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Prohibited Uses</h2>
          <p>Under all license tiers, you may not:</p>
          <ul>
            <li>
              Resell, redistribute, sublicense, or make standalone image files available on another
              stock platform, wallpaper app, or asset library.
            </li>
            <li>
              Use automated scrapers, bots, or scripts to bulk-download images or bypass download
              authentication and credit accounting.
            </li>
            <li>
              Use any image in defamatory, unlawful, hateful, deceptive, or sensitive contexts that
              imply endorsement by depicted people, brands, or places.
            </li>
            <li>
              Register any standalone Lumenstock image (or minimally altered version) as a
              trademark, service mark, or logo.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Pricing, Payments, Credits &amp; Refunds</h2>
          <ul>
            <li>
              <strong>One-time payments &amp; no auto-renewal:</strong> All plans (Starter, Creator,
              Studio — 1-month or 12-month passes) and On-demand credit packs are billed as one-time
              payments through Stripe or Razorpay. We never store card numbers and never
              automatically renew your plan.
            </li>
            <li>
              <strong>Credits:</strong> Each HD image download deducts 1 credit from your account
              balance. On-demand pack credits do not expire. Timed plan credits remain usable
              through the stated plan period.
            </li>
            <li>
              <strong>Refunds:</strong> Because digital image licenses are delivered immediately
              upon download, used credits are non-refundable. If you purchased a plan or pack by
              mistake and have used zero download credits, contact us within 7 days for a full
              refund review.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. AI-Generated &amp; Curated Visuals</h2>
          <p>
            Assets inside AI Generated and 3D Render categories are clearly labeled by category and
            type. Certain real-world photos may depict landmarks, architectural works, or public
            spaces; you are solely responsible for securing any additional model, property, or
            editorial clearances required for your specific commercial campaign.
          </p>
        </section>

        <section>
          <h2>6. Intellectual Property &amp; Copyright Takedowns</h2>
          <p>
            We respect intellectual property rights. If you believe any image on Lumenstock
            infringes your copyright or licensing terms, email{" "}
            <a href="mailto:tarasu2008@gmail.com">tarasu2008@gmail.com</a> with the exact asset URL,
            proof of ownership, and your contact details. Valid requests are promptly reviewed and
            removed.
          </p>
        </section>

        <section>
          <h2>7. Disclaimers &amp; Limitation of Liability</h2>
          <p>
            Lumenstock is provided on an “as is” and “as available” basis without warranties of
            uninterrupted availability or fitness for a particular purpose. To the maximum extent
            permitted by law, Lumenstock’s total liability for any claim arising from the service
            shall not exceed the fees you paid to Lumenstock during the 12 months preceding the
            claim.
          </p>
        </section>

        <section>
          <h2>8. Changes &amp; Contact</h2>
          <p>
            We may update these Terms from time to time by revising the effective date above.
            Continued use after updates constitutes acceptance. Questions? Email{" "}
            <a href="mailto:tarasu2008@gmail.com">tarasu2008@gmail.com</a> or read our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </article>
    </div>
  );
}
