import Link from "next/link";
import { assetPath, type Asset } from "@/data/catalog";

/** Stable placeholder download count from asset id — replace with real stats later */
function placeholderDownloads(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;

  // Mix plain counts and a few "k" values so cards don't all look alike
  const samples = [
    48, 67, 89, 100, 124, 156, 189, 210, 256, 312, 347, 401, 456, 512, 589, 640, 721, 803, 890, 945,
    1100, 1400, 1800, 2300, 2900, 3600, 4200, 5100, 6700, 8200,
  ];
  const n = samples[hash % samples.length];

  if (n >= 1000) {
    const k = n / 1000;
    const label = Number.isInteger(k) ? `${k}` : k.toFixed(1).replace(/\.0$/, "");
    return `${label}k downloaded`;
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
