import { formatRatingStars } from '@/lib/format';

// Star row for a 0–5 rating (PRD §6.3, §6.7).
export function RatingStars({
  rating,
  count,
}: {
  rating: number;
  count?: number;
}) {
  const { full, half } = formatRatingStars(rating);

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of 5${count != null ? ` from ${count} ratings` : ''}`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const fill =
          i < full ? 'full' : i === full && half ? 'half' : 'empty';
        return <Star key={i} fill={fill} />;
      })}
      {count != null && (
        <span className="ml-1 text-xs text-muted" aria-hidden>
          {rating > 0 ? `${rating.toFixed(1)} (${count})` : 'No ratings yet'}
        </span>
      )}
    </span>
  );
}

function Star({ fill }: { fill: 'full' | 'half' | 'empty' }) {
  const id = fill === 'half' ? `half-${Math.random().toString(36).slice(2, 8)}` : undefined;
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden>
      {fill === 'half' && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
        fill={fill === 'full' ? '#f59e0b' : fill === 'half' ? `url(#${id})` : '#e5e7eb'}
      />
    </svg>
  );
}
