// Verifies keyset pagination against the live DB (Phase 2 acceptance):
// pages join with no duplicates and no gaps, and search/category filters work.
// Mirrors the exact query shape in lib/listings.ts.
// Usage: node scripts/test-pagination.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const { error: authErr } = await sb.auth.signInWithPassword({
  email: 'jamie.demo@berkeley.edu',
  password: 'handdown-demo-123',
});
if (authErr) { console.error('auth failed:', authErr.message); process.exit(1); }

const PAGE = 20;
let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function fetchPage(cursor, filters = {}) {
  let q = sb
    .from('listings')
    .select('id, title, category, created_at')
    .eq('status', 'active')
    .eq('campus', 'ucberkeley')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE);
  if (cursor) {
    q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }
  if (filters.search) q = q.ilike('title', `%${filters.search}%`);
  if (filters.category) q = q.eq('category', filters.category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const last = data[data.length - 1];
  return {
    items: data,
    nextCursor: data.length === PAGE && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

// Total active listings (ground truth).
const { count } = await sb
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'active')
  .eq('campus', 'ucberkeley');
console.log(`Active listings in DB: ${count}\n`);

// Walk all pages.
const seen = new Set();
let cursor = null;
let pages = 0;
let dupes = 0;
do {
  const page = await fetchPage(cursor);
  pages++;
  for (const item of page.items) {
    if (seen.has(item.id)) dupes++;
    seen.add(item.id);
  }
  cursor = page.nextCursor;
} while (cursor && pages < 20);

check('multiple pages traversed', pages >= 2, `${pages} pages`);
check('no duplicate rows across pages', dupes === 0, `${dupes} dupes`);
check('no gaps — every active listing reached', seen.size === count, `${seen.size}/${count}`);

// Search filter.
const searchPage = await fetchPage(null, { search: 'desk' });
check(
  'search "desk" returns only matching titles',
  searchPage.items.length > 0 && searchPage.items.every((i) => i.title.toLowerCase().includes('desk')),
  `${searchPage.items.length} results`,
);

// Category filter.
const catPage = await fetchPage(null, { category: 'books' });
check(
  'category filter returns only books',
  catPage.items.length > 0 && catPage.items.every((i) => i.category === 'books'),
  `${catPage.items.length} results`,
);

console.log(failures === 0 ? '\n🎉 Pagination + filters verified.' : `\n⚠️ ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
