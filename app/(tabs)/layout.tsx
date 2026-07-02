import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TabBar } from '@/components/tab-bar';

// Auth gate for the whole tab group. The proxy already redirects unauthenticated
// requests, but we verify server-side here too — never rely on middleware alone
// for auth (PRD §8).
export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Bottom tab bar is fixed; pad content so it isn't hidden behind it. */}
      <div className="flex-1 pb-20">{children}</div>
      <TabBar />
    </div>
  );
}
