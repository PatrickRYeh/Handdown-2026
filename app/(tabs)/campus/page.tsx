import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

// Phase 1 placeholder. The real Campus feed (grid + infinite scroll) lands in
// Phase 2. For now it confirms auth works and shows who's signed in.
export default async function CampusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('uid', user!.id)
    .single();

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">Campus</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-muted hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="rounded-2xl border border-gray-200 p-6 text-sm">
        <p className="font-medium text-foreground">
          Signed in as {profile?.full_name || profile?.email || user?.email}
        </p>
        <p className="mt-2 text-muted">
          Auth is working. The Campus feed (2-column grid with infinite scroll)
          arrives in Phase 2.
        </p>
      </div>
    </div>
  );
}
