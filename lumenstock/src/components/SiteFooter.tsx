import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>Lumenstock</h4>
            <p>
              Royalty-free HD stock marketplace with 11,300+ curated visuals sized for desktop,
              tablet, and phone screens.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link href="/browse">All images</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/roadmap">Studio roadmap</Link>
          </div>
          <div>
            <h4>Licenses &amp; Legal</h4>
            <Link href="/pricing#licenses">Standard license</Link>
            <Link href="/pricing#licenses">Enhanced license</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Conditions</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Lumenstock. All rights reserved.</span>
          <span className="footer-legal-links">
            <Link href="/privacy">Privacy Policy</Link>
            <span aria-hidden>·</span>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <span aria-hidden>·</span>
            <span>No stored card details · No auto-renewal</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
