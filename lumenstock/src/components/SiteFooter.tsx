import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h4>Lumenstock</h4>
          <p>
            Royalty-free stock marketplace inspired by modern licensing platforms — with room to grow
            into an all-in-one creative studio.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link href="/browse">Browse</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contribute">Contribute</Link>
        </div>
        <div>
          <h4>Licenses</h4>
          <Link href="/pricing#licenses">Standard</Link>
          <Link href="/pricing#licenses">Enhanced</Link>
          <Link href="/roadmap">Canva-style studio (later)</Link>
        </div>
      </div>
    </footer>
  );
}
