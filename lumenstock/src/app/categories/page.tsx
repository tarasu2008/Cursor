import type { Metadata } from "next";
import Link from "next/link";
import { assets, categories, getSubcategoriesForParent } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Image categories & subcategories",
  description:
    "Browse Lumenstock stock photo categories and subcategories — animals, nature, phone wallpapers, desktop wallpapers, and more — with HD samples for each.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Image categories & subcategories · Lumenstock",
    description:
      "Explore core and extended stock categories with curated subcategory galleries, including phone and desktop wallpapers.",
    url: "/categories",
  },
};

export default function CategoriesPage() {
  const core = categories.filter((c) => c.group === "core");
  const extended = categories.filter((c) => c.group === "extended");
  const wallpapers = extended.filter(
    (c) => c.id === "phone-wallpapers" || c.id === "desktop-wallpapers",
  );
  const otherExtended = extended.filter(
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
          <img src={cover} alt="" className={isPhone ? "phone-cover" : undefined} />
          <div>
            <strong>{c.name}</strong>
            <span>{c.description}</span>
          </div>
        </Link>
        {subs.length > 0 && (
          <div className={`subcategory-grid${isPhone ? " phone-wallpaper-grid" : ""}${isDesktop ? " desktop-wallpaper-grid" : ""}`}>
            {subs.map((s) => {
              const thumb = `/samples/subcategories/${s.id}.jpg`;
              return (
                <Link
                  key={s.id}
                  href={`/browse?category=${c.id}&subcategory=${s.id}`}
                  className={`subcategory-card${isPhone ? " phone-frame-card" : ""}`}
                >
                  <div className={isPhone ? "phone-frame" : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt="" />
                    {isPhone && (
                      <div className="phone-frame-chrome" aria-hidden>
                        <span className="phone-frame-time">9:41</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <strong>{s.name}</strong>
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

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Categories</h1>
        <p>
          Browse core stock categories with curated subcategories, plus phone lock/home wallpapers and
          desktop monitor wallpapers.
        </p>
      </div>

      <section className="section" style={{ paddingTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h2>Wallpapers</h2>
            <p>Phone lock screens, home screens, and desktop monitor backgrounds — ready to save.</p>
          </div>
        </div>
        <div className="category-stack">{wallpapers.map(renderCategory)}</div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Core stock taxonomy</h2>
            <p>Each category includes curated subcategories with one HD image each.</p>
          </div>
        </div>
        <div className="category-stack">{core.map(renderCategory)}</div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Extended Lumenstock categories</h2>
            <p>Differentiators with focused subcategory branches.</p>
          </div>
        </div>
        <div className="category-stack">{otherExtended.map(renderCategory)}</div>
      </section>
    </div>
  );
}
