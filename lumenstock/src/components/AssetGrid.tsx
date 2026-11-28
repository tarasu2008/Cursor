import type { Asset } from "@/data/catalog";
import { AssetCard } from "./AssetCard";

export function AssetGrid({ assets }: { assets: Asset[] }) {
  if (!assets.length) {
    return <div className="empty">No images match those filters. Try another keyword or category.</div>;
  }
  return (
    <div className="asset-grid">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}
