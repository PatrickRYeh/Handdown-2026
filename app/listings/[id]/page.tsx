import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatCondition, formatPrice } from '@/lib/format';
import type { Listing } from '@/lib/types';

// Phase 2 placeholder detail page — proves card navigation works. The full
// version (carousel, action bar, seller card) lands in Phase 4.
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();
  if (!data) notFound();
  const listing = data as Listing;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link
          href="/campus"
          aria-label="Back to feed"
          className="rounded-full p-2 hover:bg-gray-100"
        >
          ←
        </Link>
        <span className="text-sm text-muted">Listing</span>
      </header>

      <div className="relative aspect-square w-full bg-gray-100">
        {listing.thumbnail_url && (
          <Image
            src={listing.thumbnail_url}
            alt={listing.title}
            fill
            sizes="448px"
            className="object-cover"
            priority
          />
        )}
      </div>

      <div className="flex flex-col gap-2 px-5 py-5">
        <p className="text-2xl font-bold">{formatPrice(listing.price_cents)}</p>
        <h1 className="text-lg font-semibold">{listing.title}</h1>
        <p className="text-sm text-muted">
          {formatCondition(listing.condition)} · {listing.category}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{listing.description}</p>

        <p className="mt-6 rounded-xl bg-gray-50 p-4 text-xs text-muted">
          Image carousel, message composer, Save/Share, and the seller card
          arrive in Phase 4.
        </p>
      </div>
    </main>
  );
}
