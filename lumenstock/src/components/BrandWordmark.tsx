/** Crisp HTML wordmark — avoids SVG <text> blur when scaled. */
export function BrandWordmark({
  className = "brand-word",
  accent = false,
}: {
  className?: string;
  accent?: boolean;
}) {
  return (
    <span className={`${className}${accent ? " brand-word-accent" : ""}`}>
      Lumen<span>stock</span>
    </span>
  );
}
