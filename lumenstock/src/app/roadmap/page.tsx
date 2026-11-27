import type { Metadata } from "next";
import { siteConfig } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Studio roadmap",
  description:
    "See what’s next for Lumenstock — design editor, templates, brand kits, and creative tools built on top of our 11,300+ HD stock library.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Studio roadmap · Lumenstock",
    description:
      "Upcoming creative studio tools built on top of Lumenstock’s 11,300+ HD royalty-free stock catalog.",
    url: `${siteConfig.url}/roadmap`,
    images: [{ url: "/samples/categories/workspace.jpg", width: 1920, height: 1080, alt: "Lumenstock Studio Roadmap" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Studio roadmap · Lumenstock",
    description: "Upcoming creative studio tools on Lumenstock.",
    images: ["/samples/categories/workspace.jpg"],
  },
};

const later = [
  {
    title: "Drag-drop design editor",
    why: "Compose licensed stock into finished creatives without leaving Lumenstock.",
  },
  {
    title: "Template library",
    why: "Social, ads, presentations, and print — Canva-style starting points.",
  },
  {
    title: "Brand kit",
    why: "Shared logos, colors, and fonts for teams.",
  },
  {
    title: "Magic resize",
    why: "One layout → story, feed, banner, and print exports.",
  },
  {
    title: "Background remover & AI enhance",
    why: "Instant cutouts and cleanup on licensed assets.",
  },
  {
    title: "Elements library",
    why: "Shapes, stickers, text styles layered on stock.",
  },
  {
    title: "Team collaboration",
    why: "Folders, comments, and approvals.",
  },
  {
    title: "Video editor + music sync",
    why: "Extend the marketplace into motion.",
  },
  {
    title: "Print & merchandise",
    why: "Fulfill Enhanced-license merch use cases.",
  },
  {
    title: "AI design from prompt",
    why: "Generate layouts that auto-pull licensed catalog images.",
  },
];

export default function RoadmapPage() {
  return (
    <div className="container">
      <div className="page-hero">
        <h1>All-in-one studio roadmap</h1>
        <p>
          Today Lumenstock is a stock marketplace. Next we layer Canva-class creative tools on top of
          licensed assets — one site for find, license, and make.
        </p>
      </div>

      <section className="section" style={{ paddingTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h2>Shipping now</h2>
            <p>Marketplace foundation from our stock-platform research.</p>
          </div>
        </div>
        <div className="chip-row">
          {[
            "Instant search & autocomplete",
            "48 categories & 178 subcategories",
            "50 HD images per category & subcategory (11,300 total)",
            "Desktop / tablet / phone & wallpaper sizes",
            "Asset detail + crop preview + licenses",
            "One-time plans & packs (Stripe + Razorpay)",
          ].map((item) => (
            <span key={item} className="chip active">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Later — Canva-inspired features</h2>
            <p>Documented for the next build phase; not in the MVP UI yet.</p>
          </div>
        </div>
        <div className="roadmap">
          {later.map((item) => (
            <div key={item.title} className="roadmap-item">
              <strong>{item.title}</strong>
              <span>{item.why}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
