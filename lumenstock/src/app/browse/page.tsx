import type { Metadata } from "next";
import { AssetGrid } from "@/components/AssetGrid";
import { SearchForm } from "@/components/SearchForm";
import {
  categories,
  getCategory,
  getSubcategoriesForParent,
  getSubcategory,
  searchAssets,
} from "@/data/catalog";
import Link from "next/link";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = one(sp.q) || "";
  const category = one(sp.category) || "all";
  const subcategory = one(sp.subcategory) || "all";
  const cat = category !== "all" ? getCategory(category) : undefined;
  const sub = subcategory !== "all" ? getSubcategory(subcategory) : undefined;

  const label = sub?.name || cat?.name || (q ? `“${q}”` : "all images");
  const title = q ? `Search ${q}` : sub ? `${sub.name} images` : cat ? `${cat.name} stock photos` : "Browse stock images";
  const description = q
    ? `Royalty-free stock results for ${q} on Lumenstock.`
    : `Browse ${label} — HD royalty-free photos and illustrations with desktop, tablet, and phone downloads.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/browse${category !== "all" ? `?category=${category}` : ""}`,
    },
    openGraph: { title: `${title} · Lumenstock`, description },
  };
}

export default async function BrowsePage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = one(sp.q) || "";
  const type = one(sp.type) || "all";
  const orientation = one(sp.orientation) || "all";
  const category = one(sp.category) || "all";
  const subcategory = one(sp.subcategory) || "all";
  const people = one(sp.people) || "all";

  const results = searchAssets({ q, type, orientation, category, subcategory, people });
  const activeCategory = category !== "all" ? getCategory(category) : undefined;
  const subcats = activeCategory ? getSubcategoriesForParent(activeCategory.id) : [];
  const activeSub = subcategory !== "all" ? getSubcategory(subcategory) : undefined;

  const filterHref = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("type", key === "type" ? value : type);
    params.set("orientation", key === "orientation" ? value : orientation);
    params.set("category", key === "category" ? value : category);
    params.set("people", key === "people" ? value : people);
    const nextSub =
      key === "subcategory" ? value : key === "category" ? "all" : subcategory;
    if (nextSub && nextSub !== "all") params.set("subcategory", nextSub);
    return `/browse?${params.toString()}`;
  };

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Browse</h1>
        <p>
          Filter by type, orientation, people, category, and subcategory — the same discovery
          pattern customers expect from a stock marketplace.
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

      <div className="chip-row" style={{ marginBottom: "0.8rem" }}>
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

      {subcats.length > 0 && (
        <div className="chip-row" style={{ marginBottom: "1.2rem" }}>
          <Link
            href={filterHref("subcategory", "all")}
            className={`chip${subcategory === "all" ? " active" : ""}`}
          >
            All in {activeCategory?.name}
          </Link>
          {subcats.map((s) => (
            <Link
              key={s.id}
              href={filterHref("subcategory", s.id)}
              className={`chip${subcategory === s.id ? " active" : ""}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        {results.length} result{results.length === 1 ? "" : "s"}
        {q ? ` for “${q}”` : ""}
        {activeSub ? ` · ${activeSub.name}` : activeCategory ? ` · ${activeCategory.name}` : ""}
      </p>

      <AssetGrid assets={results} />
      <div style={{ height: "3rem" }} />
    </div>
  );
}
