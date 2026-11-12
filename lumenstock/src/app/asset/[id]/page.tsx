import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetGrid } from "@/components/AssetGrid";
import { assets, categories, getAsset } from "@/data/catalog";
import { LicensePicker } from "./LicensePicker";

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return assets.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const asset = getAsset(id);
  return { title: asset?.title ?? "Asset" };
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;
  const asset = getAsset(id);
  if (!asset) notFound();

  const cats = categories.filter((c) => asset.categoryIds.includes(c.id));
  const related = assets.filter((a) => a.id !== asset.id && a.categoryIds.some((c) => asset.categoryIds.includes(c))).slice(0, 4);

  return (
    <div className="container">
      <div className="detail">
        <div className="detail-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.imageUrl} alt={asset.title} />
        </div>
        <aside className="detail-panel">
          <h1>{asset.title}</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>{asset.description}</p>
          <div className="kv">
            <div>
              <strong style={{ color: "var(--ink)" }}>Contributor:</strong> {asset.contributor}
            </div>
            <div>
              <strong style={{ color: "var(--ink)" }}>Type:</strong> {asset.type}
            </div>
            <div>
              <strong style={{ color: "var(--ink)" }}>Size:</strong> {asset.width}×{asset.height}px
            </div>
            <div>
              <strong style={{ color: "var(--ink)" }}>Orientation:</strong> {asset.orientation}
            </div>
          </div>
          <div className="chip-row">
            {cats.map((c) => (
              <Link key={c.id} href={`/browse?category=${c.id}`} className="chip">
                {c.name}
              </Link>
            ))}
          </div>
          <div className="chip-row" style={{ marginTop: "0.7rem" }}>
            {asset.keywords.map((k) => (
              <Link key={k} href={`/browse?q=${encodeURIComponent(k)}`} className="chip">
                {k}
              </Link>
            ))}
          </div>
          <LicensePicker />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <h2>Related images</h2>
              <p>More from overlapping categories.</p>
            </div>
          </div>
          <AssetGrid assets={related} />
        </section>
      )}
    </div>
  );
}
