import Link from "next/link";
import { assetPath, type Asset } from "@/data/catalog";

/** Stable placeholder download count from asset id — replace with real stats later */
function placeholderDownloads(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const n = 120 + (hash % 9800); // 120 – ~9.9k
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k downloaded`;
  }
  return `${n} downloaded`;
}

export function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Link href={assetPath(asset)} className="asset-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.imageUrl} alt={asset.title} loading="lazy" />
      <div className="asset-meta">
        <h3>{asset.title}</h3>
        <p>
          HD {asset.width}×{asset.height} · {placeholderDownloads(asset.id)}
        </p>
      </div>
    </Link>
  );
}
