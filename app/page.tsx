import { redirect } from 'next/navigation';

// The root simply forwards into the app. The proxy (proxy.ts) redirects
// unauthenticated visitors to /login before this runs; signed-in users land on
// the Campus feed.
export default function Home() {
  redirect('/campus');
}
