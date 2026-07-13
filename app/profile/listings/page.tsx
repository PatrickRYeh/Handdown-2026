import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { YourListings } from '@/components/your-listings';
import type { Listing } from '@/lib/types';

// Your Listings (PRD §6.6): the current user's non-deleted listings with edit
// and delete controls.
export default async function YourListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('offering_uid', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-4">
      <header className="flex items-center gap-3 py-2">
        <Link
          href="/profile"
          aria-label="Back to profile"
          className="rounded-full p-2 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Your Listings</h1>
        <Link
          href="/listings/new"
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-light"
        >
          Sell
        </Link>
      </header>

      <YourListings initial={(data ?? []) as Listing[]} />
    </main>
  );
}
