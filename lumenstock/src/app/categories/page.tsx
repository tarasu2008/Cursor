import type { Metadata } from "next";
import Link from "next/link";
import {
  assets,
  categories,
  getAssetCountForCategory,
  getAssetCountForSubcategory,
  getSubcategoriesForParent,
  siteConfig,
} from "@/data/catalog";

export const metadata: Metadata = {
  title: "Image categories & subcategories",
  description:
    "Browse 48 Lumenstock HD stock photo categories and 178 subcategories — 50 HD images each, including phone and desktop wallpapers.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Image categories & subcategories · Lumenstock",
    description:
      "Explore 48 stock categories and 178 subcategories with 50 HD images each, plus phone and desktop wallpapers.",
    url: `${siteConfig.url}/categories`,
    images: [{ url: "/samples/categories/nature.jpg", width: 1920, height: 1080, alt: "Lumenstock categories" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Image categories & subcategories · Lumenstock",
    description:
      "Explore 48 stock categories and 178 subcategories with 50 HD images each on Lumenstock.",
    images: ["/samples/categories/nature.jpg"],
  },
};

export default function CategoriesPage() {
  const wallpapers = categories.filter(
    (c) => c.id === "phone-wallpapers" || c.id === "desktop-wallpapers",
  );
  const main = categories.filter(
    (c) => c.id !== "phone-wallpapers" && c.id !== "desktop-wallpapers",
  );

  const renderCategory = (c: (typeof categories)[number]) => {
    const subs = getSubcategoriesForParent(c.id);
    const cover =
      assets.find((a) => a.categoryIds.includes(c.id) && !a.subcategoryId)?.imageUrl ||
      `/samples/categories/${c.id}.jpg`;
    const isPhone = c.id === "phone-wallpapers";
    const isDesktop = c.id === "desktop-wallpapers";
    const isWallpaper = isPhone || isDesktop;

    return (
      <article key={c.id} className={`category-block${isWallpaper ? " wallpaper-block" : ""}`}>
        <Link href={`/browse?category=${c.id}`} className="category-block-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={`${c.name} HD stock images`}
            loading="lazy"
            className={isPhone ? "phone-cover" : undefined}
          />
          <div>
            <strong>
              {c.name} <em className="count-pill">{getAssetCountForCategory(c.id)} HD images</em>
            </strong>
            <span>{c.description}</span>
          </div>
        </Link>
        {subs.length > 0 && (
          <div
            className={`subcategory-grid${isPhone ? " phone-wallpaper-grid" : ""}${isDesktop ? " desktop-wallpaper-grid" : ""}`}
          >
            {subs.map((s) => {
              const thumb =
                assets.find((a) => a.subcategoryId === s.id)?.imageUrl ||
                `/samples/subcategories/${s.id}.jpg`;
              const subCount = getAssetCountForSubcategory(s.id);
              return (
                <Link
                  key={s.id}
                  href={`/browse?category=${c.id}&subcategory=${s.id}`}
                  className={`subcategory-card${isPhone ? " phone-frame-card" : ""}`}
                >
                  <div className={isPhone ? "phone-frame" : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt={`${s.name} — ${c.name} HD stock photos`} loading="lazy" />
                    {isPhone && (
                      <div className="phone-frame-chrome" aria-hidden>
                        <span className="phone-frame-time">9:41</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <strong>
                      {s.name} <em className="count-pill">{subCount} HD</em>
                    </strong>
                    <span>{s.description}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </article>
    );
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Lumenstock Image Categories & Subcategories",
    url: `${siteConfig.url}/categories`,
    description:
      "48 HD stock image categories and 178 subcategories with 50 unique royalty-free HD visuals each.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categories.length,
      itemListElement: categories.map((c, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: c.name,
        url: `${siteConfig.url}/browse?category=${c.id}`,
      })),
    },
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <div className="page-hero">
        <h1>Categories</h1>
        <p>
          Explore stock categories with curated subcategories, plus phone lock/home wallpapers and
          desktop monitor wallpapers.
        </p>
      </div>

      <section className="section" style={{ paddingTop: "1rem" }}>
        <div className="category-stack">{main.map(renderCategory)}</div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Wallpapers</h2>
            <p>Phone lock screens, home screens, and desktop monitor backgrounds — ready to save.</p>
          </div>
        </div>
        <div className="category-stack">{wallpapers.map(renderCategory)}</div>
      </section>
    </div>
  );
}
