import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/back-button';
import { ProfileEditForm } from '@/components/profile-edit-form';
import type { Profile } from '@/lib/types';

// Edit own profile (PRD §6.7).
export default async function EditProfilePage() {
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
  if (!data) redirect('/profile');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-4">
      <header className="flex items-center gap-3 py-2">
        <BackButton fallback="/profile" />
        <h1 className="text-lg font-semibold">Edit Profile</h1>
      </header>

      <ProfileEditForm profile={data as Profile} />
    </main>
  );
}
