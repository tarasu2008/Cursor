import Link from "next/link";
import { categories } from "@/data/catalog";

export const metadata = {
  title: "Categories",
};

export default function CategoriesPage() {
  const core = categories.filter((c) => c.group === "core");
  const extended = categories.filter((c) => c.group === "extended");

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Categories</h1>
        <p>
          Start with the 26 classic stock categories, then browse Lumenstock extensions that most
          marketplaces under-index.
        </p>
      </div>

      <section className="section" style={{ paddingTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h2>Core stock taxonomy</h2>
            <p>Aligned with industry-standard contributor categories.</p>
          </div>
        </div>
        <div className="roadmap">
          {core.map((c) => (
            <Link key={c.id} href={`/browse?category=${c.id}`} className="roadmap-item">
              <strong>{c.name}</strong>
              <span>{c.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Extended Lumenstock categories</h2>
            <p>Differentiators for an all-in-one creative platform.</p>
          </div>
        </div>
        <div className="roadmap">
          {extended.map((c) => (
            <Link key={c.id} href={`/browse?category=${c.id}`} className="roadmap-item">
              <strong>{c.name}</strong>
              <span>{c.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
