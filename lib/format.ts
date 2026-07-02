// Display helpers for prices, dates, ratings, and class years (PRD §6.3, §7.2).

/** Format an integer cent amount as a dollar string, e.g. 4500 → "$45". */
export function formatPrice(priceCents: number): string {
  const dollars = priceCents / 100;
  // Drop the ".00" for whole-dollar prices; keep cents otherwise.
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  used: 'Used',
};

export function formatCondition(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

/** "class_year · major" — either side may be missing. */
export function formatClassYearMajor(
  classYear: number | null,
  major: string | null,
): string {
  const parts = [classYear ? `Class of ${classYear}` : null, major].filter(
    Boolean,
  );
  return parts.join(' · ');
}

/**
 * Relative timestamp for chat rows and message bubbles (PRD §7.2):
 * "2m ago", "1h ago", "Yesterday", or "Jan 15" for older items.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Rating stars as filled/half/empty counts for a 0–5 numeric rating.
 * The UI turns these into star icons.
 */
export function formatRatingStars(rating: number): {
  full: number;
  half: number;
  empty: number;
} {
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return { full, half, empty };
}
