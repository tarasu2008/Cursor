import Link from "next/link";
import { AssetGrid } from "@/components/AssetGrid";
import { BrandWordmark } from "@/components/BrandWordmark";
import { SearchForm } from "@/components/SearchForm";
import { assets, categories } from "@/data/catalog";

export default function HomePage() {
  const featured = assets.filter((a) => !a.subcategoryId).slice(0, 8);
  const core = categories.filter((c) => c.group === "core").slice(0, 10);
  const extended = categories.filter((c) => c.group === "extended").slice(0, 8);

  return (
    <>
      <section className="hero">
        <div className="hero-media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assets[0].imageUrl} alt="" />
        </div>
        <div className="container hero-content">
          <BrandWordmark className="hero-brand" accent />
          <h1>
            License luminous
            <br />
            <span>stock imagery</span>
          </h1>
          <p className="hero-lead">
            Browse our curated HD catalog, pick a license, then download the perfect desktop, tablet,
            or phone size — ready to grow into an all-in-one creative studio.
          </p>
          <SearchForm />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Trending now</h2>
              <p>Sample catalog spanning sports, festivals, workspace, aerial, and more.</p>
            </div>
            <Link href="/browse" className="btn btn-soft">
              View all
            </Link>
          </div>
          <AssetGrid assets={featured} />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Core categories</h2>
              <p>The 26 stock classics customers already expect.</p>
            </div>
            <Link href="/categories">See all categories</Link>
          </div>
          <div className="chip-row">
            {core.map((c) => (
              <Link key={c.id} href={`/browse?category=${c.id}`} className="chip">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Lumenstock extras</h2>
              <p>Categories most stock sites under-serve — AI, 3D, cutouts, cultural, ESG, and more.</p>
            </div>
          </div>
          <div className="chip-row">
            {extended.map((c) => (
              <Link key={c.id} href={`/browse?category=${c.id}`} className="chip">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
