import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h4>Lumenstock</h4>
          <p>
            Royalty-free stock marketplace — we curate and sell HD images with desktop, tablet, and
            phone download sizes.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link href="/browse">All images</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div>
          <h4>Licenses & sizes</h4>
          <Link href="/pricing#licenses">Standard</Link>
          <Link href="/pricing#licenses">Enhanced</Link>
          <Link href="/roadmap">Studio roadmap</Link>
        </div>
      </div>
    </footer>
  );
}
