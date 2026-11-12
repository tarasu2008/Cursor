import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav">
        <Link href="/" className="brand" aria-label="Lumenstock home">
          <span className="brand-mark" aria-hidden />
          Lumenstock
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link href="/browse">Browse</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contribute">Contribute</Link>
          <Link href="/roadmap">Studio roadmap</Link>
        </nav>
        <div className="nav-cta">
          <Link href="/pricing" className="btn btn-ghost">
            Plans
          </Link>
          <Link href="/browse" className="btn btn-primary">
            Explore images
          </Link>
        </div>
      </div>
    </header>
  );
}
