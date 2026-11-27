export function ScoreRing({
  score,
  label,
  detail,
}: {
  score: number | null;
  label: string;
  detail?: string;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const amount = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const tone = score == null ? "idle" : score >= 90 ? "good" : score >= 50 ? "mid" : "poor";

  return (
    <figure className="ring">
      <div className="ring-figure">
        <svg viewBox="0 0 88 88" aria-hidden="true">
          <circle className="ring-track" cx="44" cy="44" r={radius} />
          <circle
            className={`ring-value-arc tone-${tone}`}
            cx="44"
            cy="44"
            r={radius}
            strokeDasharray={`${circumference * amount} ${circumference}`}
          />
        </svg>
        <div className={`ring-number tone-${tone}`}>{score == null ? "—" : score}</div>
      </div>
      <figcaption>
        <span className="ring-label">{label}</span>
        {detail ? <span className="ring-detail">{detail}</span> : null}
      </figcaption>
    </figure>
  );
}
