import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { formatClassYearMajor } from '@/lib/format';
import type { Profile } from '@/lib/types';

// Current user's profile. Phase 2 version: view + sign out. Editing, ratings,
// and the Selling section arrive in Phase 4.
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
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>

      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gray-200 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
          {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold">{profile?.full_name || user.email}</p>
          <p className="text-sm text-muted">
            {formatClassYearMajor(
              profile?.class_year ?? null,
              profile?.major ?? null,
            ) || 'Add your class year and major (Phase 4)'}
          </p>
          {profile?.campus_region && (
            <p className="text-sm text-muted">{profile.campus_region}</p>
          )}
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
