import Image from 'next/image';
import Link from 'next/link';
import type { Listing } from '@/lib/types';
import { formatCondition, formatPrice } from '@/lib/format';

// Feed grid card (PRD §6.2): first image (or a colored placeholder), price,
// title. Reads only the denormalized thumbnail_url — never joins images.
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col gap-1.5"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
        {listing.thumbnail_url ? (
          <Image
            src={listing.thumbnail_url}
            alt={listing.title}
            fill
            sizes="(max-width: 448px) 50vw, 224px"
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center text-4xl font-bold"
            style={{
              backgroundColor: `hsl(${hueFromId(listing.id)} 70% 88%)`,
              color: `hsl(${hueFromId(listing.id)} 55% 40%)`,
            }}
          >
            {listing.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="px-0.5">
        <p className="font-semibold text-foreground">
          {formatPrice(listing.price_cents)}
        </p>
        <p className="line-clamp-2 text-sm leading-snug text-foreground">
          {listing.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {formatCondition(listing.condition)}
        </p>
      </div>
    </Link>
  );
}

/** Stable hue (0–359) derived from the listing id, for image-less cards. */
function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return hash;
}
