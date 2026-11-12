import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssetGrid } from "@/components/AssetGrid";
import {
  assetPath,
  assets,
  categories,
  getAsset,
  getSubcategory,
  siteConfig,
} from "@/data/catalog";
import { DownloadPicker } from "./DownloadPicker";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return assets.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const asset = getAsset(slug);
  if (!asset) return { title: "Image not found" };

  const url = `${siteConfig.url}${assetPath(asset)}`;
  const image = `${siteConfig.url}${asset.imageUrl}`;
  const title = `${asset.title} — royalty-free stock image`;
  const description = `${asset.description} Download HD desktop, tablet, and phone sizes from Lumenstock.`;

  return {
    title: asset.title,
    description,
    keywords: asset.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: siteConfig.name,
      images: [{ url: image, width: asset.width, height: asset.height, alt: asset.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function AssetPage({ params }: Props) {
  const { slug } = await params;
  const asset = getAsset(slug);
  if (!asset) notFound();

  // Canonicalize legacy /asset/ls-0003 links to the image-name URL
  if (slug === asset.id && slug !== asset.slug) {
    redirect(assetPath(asset));
  }

  const cats = categories.filter((c) => asset.categoryIds.includes(c.id));
  const sub = asset.subcategoryId ? getSubcategory(asset.subcategoryId) : undefined;
  const related = assets
    .filter((a) => a.id !== asset.id && a.categoryIds.some((c) => asset.categoryIds.includes(c)))
    .slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: asset.title,
    description: asset.description,
    contentUrl: `${siteConfig.url}${asset.imageUrl}`,
    url: `${siteConfig.url}${assetPath(asset)}`,
    creditText: asset.owner,
    acquireLicensePage: `${siteConfig.url}/pricing`,
    keywords: asset.keywords.join(", "),
    width: asset.width,
    height: asset.height,
  };

  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
              <strong style={{ color: "var(--ink)" }}>Seller:</strong> {asset.owner}
            </div>
            <div>
              <strong style={{ color: "var(--ink)" }}>Type:</strong> {asset.type}
            </div>
            <div>
              <strong style={{ color: "var(--ink)" }}>Master size:</strong> {asset.width}×{asset.height}px HD
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
            {sub && (
              <Link
                href={`/browse?category=${sub.parentId}&subcategory=${sub.id}`}
                className={`chip active`}
              >
                {sub.name}
              </Link>
            )}
          </div>
          <div className="chip-row" style={{ marginTop: "0.7rem" }}>
            {asset.keywords.map((k) => (
              <Link key={k} href={`/browse?q=${encodeURIComponent(k)}`} className="chip">
                {k}
              </Link>
            ))}
          </div>
          <DownloadPicker imageUrl={asset.imageUrl} title={asset.title} />
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
