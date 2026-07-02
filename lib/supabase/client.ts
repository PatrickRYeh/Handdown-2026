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
