export const metadata = {
  title: "Studio roadmap",
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
            <p>Marketplace foundation from the Shutterstock-style analysis.</p>
          </div>
        </div>
        <div className="chip-row">
          {[
            "Search & filters",
            "46 categories (26 + 20 extended)",
            "Asset detail + licenses",
            "Subscriptions & packs",
            "Contribute flow (demo)",
            "Sample catalog",
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
