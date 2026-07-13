import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/avatar';
import { BackButton } from '@/components/back-button';
import { ImageCarousel } from '@/components/image-carousel';
import { MessageComposer } from '@/components/message-composer';
import { RatingStars } from '@/components/rating-stars';
import { SaveButton } from '@/components/save-button';
import { ShareButton } from '@/components/share-button';
import {
  formatClassYearMajor,
  formatCondition,
  formatPrice,
  formatRelativeTime,
} from '@/lib/format';
import type { Listing } from '@/lib/types';

// Listing detail (PRD §6.3): carousel, price/title/description, action bar
// (message composer, Save, Share), seller card → public profile.
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(*), seller:profiles!offering_uid(*)')
    .eq('id', id)
    .neq('status', 'deleted')
    .single();
  if (!data) notFound();

  const listing = data as Listing;
  const seller = listing.seller!;
  const images = (listing.listing_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => img.image_url);
  const isOwner = user.id === listing.offering_uid;

  let initialSaved = false;
  if (!isOwner) {
    const { data: savedRow } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('uid', user.id)
      .eq('listing_id', id)
      .maybeSingle();
    initialSaved = !!savedRow;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md pb-8">
      <header className="flex items-center gap-3 px-4 py-3">
        <BackButton />
        <span className="text-sm text-muted">Listing</span>
        {listing.status === 'sold' && (
          <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-white">
            Sold
          </span>
        )}
      </header>

      <ImageCarousel images={images} title={listing.title} />

      <div className="flex flex-col gap-4 px-5 py-5">
        {/* Price / title / description (PRD §6.3) */}
        <div>
          <p className="text-2xl font-bold">{formatPrice(listing.price_cents)}</p>
          <h1 className="mt-1 text-lg font-semibold leading-snug">
            {listing.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatCondition(listing.condition)} · {listing.category}
            {listing.region_id ? ` · ${listing.region_id}` : ''} ·{' '}
            {formatRelativeTime(listing.created_at)}
          </p>
        </div>

        <p className="text-sm leading-relaxed">{listing.description}</p>

        {/* Action bar */}
        {isOwner ? (
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
            <p className="text-sm text-muted">This is your listing.</p>
            <Link
              href={`/listings/${listing.id}/edit`}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-light"
            >
              Edit
            </Link>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <SaveButton listingId={listing.id} initialSaved={initialSaved} />
              <ShareButton title={listing.title} />
            </div>
            <MessageComposer
              listingId={listing.id}
              sellerUid={listing.offering_uid}
              priceCents={listing.price_cents}
            />
          </>
        )}

        {/* Seller card (PRD §6.3) */}
        <Link
          href={`/profile/${seller.uid}`}
          className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 hover:bg-gray-50"
        >
          <Avatar name={seller.full_name} url={seller.avatar_url} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{seller.full_name}</p>
            <p className="truncate text-sm text-muted">
              {formatClassYearMajor(seller.class_year, seller.major)}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <RatingStars rating={seller.rating} count={seller.rating_count} />
            </div>
            {seller.campus_region && (
              <p className="text-xs text-muted">{seller.campus_region}</p>
            )}
          </div>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      </div>
    </main>
  );
}
