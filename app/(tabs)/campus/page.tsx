import { createClient } from '@/lib/supabase/server';
import { fetchListingsPage } from '@/lib/listings';
import { CampusFeed } from '@/components/campus-feed';

// Campus feed home (PRD §6.2). The first page is fetched here on the server —
// no loading flash — and handed to the client component, which owns infinite
// scroll, search, and refresh from then on (PRD §3.5).
export default async function CampusPage() {
  const supabase = await createClient();
  const initialPage = await fetchListingsPage(supabase);

  return <CampusFeed initialPage={initialPage} />;
}
