// Quick health check: reads .env.local and confirms the DB migration ran.
// Usage: node scripts/db-check.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;

if (!url || url.includes('placeholder') || !secret) {
  console.error('❌ .env.local is missing real Supabase values.');
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false },
});

const tables = [
  'profiles',
  'listings',
  'listing_images',
  'conversations',
  'messages',
  'saved_listings',
];

let ok = true;
for (const t of tables) {
  const { error } = await admin.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    ok = false;
    console.log(`❌ ${t}: ${error.message}`);
  } else {
    console.log(`✅ ${t}`);
  }
}

console.log(
  ok
    ? '\n🎉 Migration looks good — all tables present.'
    : '\n⚠️  Some tables are missing. Run supabase/migrations/0001_init.sql in the Supabase SQL editor.',
);
process.exit(ok ? 0 : 1);
