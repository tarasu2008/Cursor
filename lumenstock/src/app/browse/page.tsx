import { AssetGrid } from "@/components/AssetGrid";
import { SearchForm } from "@/components/SearchForm";
import { categories, searchAssets } from "@/data/catalog";
import Link from "next/link";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function BrowsePage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = one(sp.q) || "";
  const type = one(sp.type) || "all";
  const orientation = one(sp.orientation) || "all";
  const category = one(sp.category) || "all";
  const people = one(sp.people) || "all";

  const results = searchAssets({ q, type, orientation, category, people });

  const filterHref = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("type", key === "type" ? value : type);
    params.set("orientation", key === "orientation" ? value : orientation);
    params.set("category", key === "category" ? value : category);
    params.set("people", key === "people" ? value : people);
    return `/browse?${params.toString()}`;
  };

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Browse</h1>
        <p>
          Filter by type, orientation, people, and category — the same discovery pattern customers
          expect from a stock marketplace.
        </p>
      </div>

      <SearchForm initialQuery={q} compact />

      <div className="chip-row" style={{ marginTop: "1.2rem", marginBottom: "0.8rem" }}>
        {[
          ["type", "all", "All types"],
          ["type", "photo", "Photo"],
          ["type", "illustration", "Illustration"],
          ["type", "vector", "Vector"],
          ["orientation", "all", "Any orientation"],
          ["orientation", "horizontal", "Horizontal"],
          ["orientation", "vertical", "Vertical"],
          ["people", "all", "People: any"],
          ["people", "with", "With people"],
          ["people", "none", "No people"],
        ].map(([key, value, label]) => {
          const active =
            (key === "type" && type === value) ||
            (key === "orientation" && orientation === value) ||
            (key === "people" && people === value);
          return (
            <Link
              key={`${key}-${value}`}
              href={filterHref(key, value)}
              className={`chip${active ? " active" : ""}`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="chip-row" style={{ marginBottom: "1.2rem" }}>
        <Link href={filterHref("category", "all")} className={`chip${category === "all" ? " active" : ""}`}>
          All categories
        </Link>
        {categories.slice(0, 18).map((c) => (
          <Link
            key={c.id}
            href={filterHref("category", c.id)}
            className={`chip${category === c.id ? " active" : ""}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        {results.length} result{results.length === 1 ? "" : "s"}
        {q ? ` for “${q}”` : ""}
      </p>

      <AssetGrid assets={results} />
      <div style={{ height: "3rem" }} />
    </div>
  );
}
