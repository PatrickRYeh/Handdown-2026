import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/avatar';
import { BackButton } from '@/components/back-button';
import { RatingStars } from '@/components/rating-stars';
import { formatClassYearMajor } from '@/lib/format';
import type { Profile } from '@/lib/types';

// Public seller profile (PRD §6.7): profile card + Location + Ratings rows.
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (user.id === uid) redirect('/profile'); // your own page is /profile

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .maybeSingle();
  if (!data) notFound();
  const profile = data as Profile;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-4">
      <header className="flex items-center gap-3 py-2">
        <BackButton />
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>

      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gray-200 p-5">
        <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.full_name}</p>
          <p className="truncate text-sm text-muted">
            {formatClassYearMajor(profile.class_year, profile.major) ||
              'Berkeley student'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 px-5">
        <InfoRow label="Location">
          {profile.campus_region ?? 'Not set'}
        </InfoRow>
        <InfoRow label="Ratings">
          <RatingStars rating={profile.rating} count={profile.rating_count} />
        </InfoRow>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm text-muted">{children}</span>
    </div>
  );
}
