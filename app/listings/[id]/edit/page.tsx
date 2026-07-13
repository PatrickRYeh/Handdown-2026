import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ListingForm } from '@/components/listing-form';
import type { Listing } from '@/lib/types';

// Update Listing (PRD §6.5): owner-only, form prefilled with current values.
// RLS blocks non-owner writes regardless; this check just keeps strangers from
// ever seeing the edit form.
export default async function EditListingPage({
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
    .select('*, listing_images(*)')
    .eq('id', id)
    .neq('status', 'deleted')
    .single();
  if (!data) notFound();

  const listing = data as Listing;
  if (listing.offering_uid !== user.id) redirect('/profile/listings');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-4">
      <header className="flex items-center gap-3 py-2">
        <Link
          href="/profile/listings"
          aria-label="Back to your listings"
          className="rounded-full p-2 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold">Edit Listing</h1>
      </header>

      <ListingForm listing={listing} />
    </main>
  );
}
