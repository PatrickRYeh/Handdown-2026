import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ListingForm } from '@/components/listing-form';

// Create Listing (PRD §6.4). The proxy gates this route, but verify auth
// server-side too — never rely on middleware alone (PRD §8).
export default async function NewListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-4">
      <header className="flex items-center gap-3 py-2">
        <Link
          href="/campus"
          aria-label="Back to feed"
          className="rounded-full p-2 hover:bg-gray-100"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold">Create Listing</h1>
      </header>

      <ListingForm />
    </main>
  );
}
