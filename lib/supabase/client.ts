// Browser (client-component) Supabase client.
// Safe to use in 'use client' components — only the publishable key is exposed.
// Create it inside the component/hook, never at module scope, so a session is
// never shared across users (PRD §8).
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

/**
 * Client whose Realtime socket is authenticated as the current user.
 *
 * Realtime RLS quirk: supabase-js only pushes the user JWT to the websocket on
 * SIGNED_IN/TOKEN_REFRESHED events. A channel subscribed on page load (cookie
 * session, no fresh sign-in event yet) joins as anonymous and RLS silently
 * drops every postgres_changes event. Always use this for subscriptions.
 */
export async function createRealtimeClient() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) await supabase.realtime.setAuth(session.access_token);
  return supabase;
}
