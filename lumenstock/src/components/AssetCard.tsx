import Link from "next/link";
import { assetPath, type Asset } from "@/data/catalog";

export function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Link href={assetPath(asset)} className="asset-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.imageUrl} alt={asset.title} loading="lazy" />
      <div className="asset-meta">
        <h3>{asset.title}</h3>
        <p>
          {asset.type} · HD {asset.width}×{asset.height}
        </p>
      </div>
    </Link>
  );
}
