import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { Avatar } from '@/components/avatar';
import { BackButton } from '@/components/back-button';
import { RatingStars } from '@/components/rating-stars';
import { formatClassYearMajor } from '@/lib/format';
import type { Profile } from '@/lib/types';

// Own profile (PRD §6.7): profile card, Location + Ratings rows, Selling
// section → Your Listings, edit, sign out.
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', user.id)
    .single();
  const profile = data as Profile | null;
  const name = profile?.full_name || user.email || '';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-4">
      <header className="flex items-center gap-3 py-2">
        <BackButton />
        <h1 className="flex-1 text-lg font-semibold">Profile</h1>
        <Link
          href="/profile/edit"
          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          Edit
        </Link>
      </header>

      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gray-200 p-5">
        <Avatar name={name} url={profile?.avatar_url ?? null} size={56} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-sm text-muted">
            {formatClassYearMajor(
              profile?.class_year ?? null,
              profile?.major ?? null,
            ) || 'Add your class year and major'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 px-5">
        <div className="flex items-center justify-between py-4">
          <span className="text-sm font-medium">Location</span>
          <span className="text-sm text-muted">
            {profile?.campus_region ?? 'Not set'}
          </span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-sm font-medium">Ratings</span>
          <RatingStars
            rating={profile?.rating ?? 0}
            count={profile?.rating_count ?? 0}
          />
        </div>
      </div>

      <Link
        href="/profile/listings"
        className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 p-5 hover:bg-gray-50"
      >
        <div>
          <p className="font-medium">Your Listings</p>
          <p className="text-sm text-muted">Manage what you’re selling</p>
        </div>
        <span aria-hidden className="text-muted">→</span>
      </Link>

      <div className="mt-8">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
