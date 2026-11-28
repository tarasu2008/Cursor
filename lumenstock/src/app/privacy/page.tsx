import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Lumenstock collects, uses, protects, and stores account, email, download, and payment data — including our no-stored-cards policy.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · Lumenstock",
    description:
      "Read Lumenstock’s Privacy Policy covering accounts, password security, payments, emails, and data deletion rights.",
    url: `${siteConfig.url}/privacy`,
    images: [{ url: "/samples/categories/nature.jpg", width: 1920, height: 1080, alt: "Lumenstock Privacy Policy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy · Lumenstock",
    description:
      "How Lumenstock handles account data, emails, downloads, and hosted payments without storing card details.",
  },
};

export default function PrivacyPage() {
  return (
    <div className="container">
      <div className="page-hero">
        <p className="modal-kicker">Legal</p>
        <h1>Privacy Policy</h1>
        <p>
          Effective November 27, 2026 · Last updated November 27, 2026. This Privacy Policy explains
          what data Lumenstock collects, how we use it, and the choices you control.
        </p>
      </div>

      <article className="legal-doc">
        <section>
          <h2>1. Information We Collect</h2>
          <p>
            When you create a Lumenstock account or license HD imagery, we collect only the
            information required to operate the service securely:
          </p>
          <ul>
            <li>
              <strong>Account details:</strong> Your name, email address, account role, email
              verification status, and a salted one-way cryptographic hash of your password
              (<code>scrypt</code>). We never store plaintext passwords.
            </li>
            <li>
              <strong>Licensing &amp; credit records:</strong> Your selected plan or on-demand
              credit pack, remaining download credits, plan expiry date, and payment confirmation
              references (provider name, transaction ID, amount, currency, and timestamp).
            </li>
            <li>
              <strong>Download history:</strong> Which images, output sizes, and license tiers
              (Standard or Enhanced) you downloaded, used to enforce credit balances and support
              your commercial license proof.
            </li>
            <li>
              <strong>Session cookie:</strong> A single signed, HTTP-only session cookie
              (<code>lumenstock_session</code>) used strictly to keep you logged in.
            </li>
          </ul>
        </section>

        <section>
          <h2>2. Payment Data &amp; No Stored Cards</h2>
          <p>
            Lumenstock <strong>never collects, processes, or stores your credit card, debit card, or UPI credentials</strong>{" "}
            on our servers. All payments are completed on hosted checkout pages operated by our
            payment processors (<strong>Stripe</strong> or <strong>Razorpay</strong>). We receive
            only signed webhook confirmations containing the payment status, amount, and transaction
            identifier so we can unlock your download credits.
          </p>
          <p>
            Because we do not store payment methods, subscriptions are <strong>not auto-renewed</strong>.
            Before a timed plan expires, we email you an optional one-time renewal link.
          </p>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>Authenticate your account, verify your email address, and process password resets.</li>
            <li>Verify paid entitlements and deliver requested HD image downloads.</li>
            <li>
              Send strictly necessary transactional emails (email verification, password resets,
              payment receipts, and plan-expiry renewal links) via our email delivery provider
              (<strong>Resend</strong>).
            </li>
            <li>Prevent abuse, unauthorized bulk scraping, and fraudulent payment activity.</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Storage, Security &amp; Third-Party Processors</h2>
          <p>
            Account, payment reference, and download records are stored in encrypted managed
            PostgreSQL databases over TLS. We share personal data only with core infrastructure
            providers required to operate Lumenstock:
          </p>
          <ul>
            <li>
              <strong>Hosting &amp; Database:</strong> Managed cloud hosting and PostgreSQL database
              providers.
            </li>
            <li>
              <strong>Payment Gateways:</strong> Stripe and/or Razorpay, solely when you initiate
              checkout.
            </li>
            <li>
              <strong>Transactional Email:</strong> Resend, solely to deliver account and billing
              emails to your registered address.
            </li>
          </ul>
          <p>We do not sell, rent, or trade your personal information to advertisers or data brokers.</p>
        </section>

        <section>
          <h2>5. Cookies &amp; Local Storage</h2>
          <p>
            Lumenstock uses an essential HTTP-only authentication cookie to maintain your signed-in
            session and browser local storage to sync basic UI session state across tabs. We do not
            run third-party behavioral ad trackers.
          </p>
        </section>

        <section>
          <h2>6. Data Retention &amp; Your Rights</h2>
          <p>
            We keep your account and licensing records while your account remains active so you can
            demonstrate valid commercial licenses for downloaded images. Subject to applicable law
            (including GDPR, CCPA, and India DPDP Act), you may request access to, correction of,
            export of, or deletion of your personal data at any time by contacting us.
          </p>
        </section>

        <section>
          <h2>7. Children’s Privacy</h2>
          <p>
            Lumenstock is intended for individuals aged 16 and older (or the age of digital consent
            in your jurisdiction). We do not knowingly collect personal data from children.
          </p>
        </section>

        <section>
          <h2>8. Contact Us</h2>
          <p>
            For privacy inquiries, data access, or account deletion requests, email{" "}
            <a href="mailto:tarasu2008@gmail.com">tarasu2008@gmail.com</a>. Please also review our{" "}
            <Link href="/terms">Terms &amp; Conditions</Link>.
          </p>
        </section>
      </article>
    </div>
  );
}
