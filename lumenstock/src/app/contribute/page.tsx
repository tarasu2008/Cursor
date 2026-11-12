export const metadata = {
  title: "Contribute",
};

export default function ContributePage() {
  return (
    <div className="container">
      <div className="page-hero">
        <h1>Contribute</h1>
        <p>
          Upload pipeline modeled on professional stock contributor flows — metadata, categories,
          releases, then human review before publish.
        </p>
      </div>

      <section className="section" style={{ paddingTop: "1rem" }}>
        <div className="roadmap">
          <div className="roadmap-item">
            <strong>1. Upload</strong>
            <span>JPEG/TIFF, ≥4MP. Browser batch upload or FTPS for large files.</span>
          </div>
          <div className="roadmap-item">
            <strong>2. Tag</strong>
            <span>Title, 7–50 keywords, 1–2 categories. Optional model/property releases.</span>
          </div>
          <div className="roadmap-item">
            <strong>3. Review</strong>
            <span>Quality, metadata accuracy, IP, releases, and spam/similarity checks.</span>
          </div>
          <div className="roadmap-item">
            <strong>4. Earn</strong>
            <span>Royalty tiers 15–40% by downloads. Monthly payouts via PayPal/Payoneer-class rails.</span>
          </div>
        </div>

        <div
          className="detail-panel"
          style={{ marginTop: "1.5rem", position: "static", maxWidth: 640 }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Upload (demo)</h2>
          <p style={{ color: "var(--muted)" }}>
            Full contributor auth, quarantine storage, and review console come next. For now this
            captures the product intent.
          </p>
          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <span>Title</span>
            <input
              placeholder="Describe the visual"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "0.7rem 0.85rem",
                color: "var(--ink)",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <span>Keywords (comma separated)</span>
            <input
              placeholder="diwali, diya, festival, lights…"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "0.7rem 0.85rem",
                color: "var(--ink)",
              }}
            />
          </label>
          <button className="btn btn-primary" type="button">
            Submit for review
          </button>
        </div>
      </section>
    </div>
  );
}
