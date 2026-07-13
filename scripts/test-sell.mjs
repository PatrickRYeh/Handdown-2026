// Phase 3 acceptance verification against the live project:
//  - storage upload to listing-images works and serves publicly
//  - a user can create a listing (with images) that appears in the feed
//  - partial update touches only the changed field
//  - ANOTHER user cannot update or delete it (RLS)
//  - soft delete hides it from the feed
// Cleans up after itself. Usage: node scripts/test-sell.mjs
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const jamie = createClient(URL_, KEY);
const sam = createClient(URL_, KEY);
await jamie.auth.signInWithPassword({ email: 'jamie.demo@berkeley.edu', password: 'handdown-demo-123' });
await sam.auth.signInWithPassword({ email: 'sam.demo@berkeley.edu', password: 'handdown-demo-123' });
const jamieUid = (await jamie.auth.getUser()).data.user.id;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const listingId = randomUUID();
// 1×1 transparent PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// 1) Storage upload as an authenticated user.
const path = `${listingId}/0.png`;
const { error: upErr } = await jamie.storage.from('listing-images').upload(path, png, { contentType: 'image/png' });
check('storage upload as signed-in user', !upErr, upErr?.message);
const publicUrl = jamie.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
const res = await fetch(publicUrl);
check('uploaded image publicly readable', res.ok, `HTTP ${res.status}`);

// 2) Create listing + image rows (what createListing does, as jamie).
const { error: insErr } = await jamie.from('listings').insert({
  id: listingId,
  offering_uid: jamieUid,
  title: 'TEST — coffee table',
  description: 'Verification listing, will be cleaned up.',
  price_cents: 2500,
  condition: 'good',
  category: 'furniture',
  region_id: 'Southside',
  thumbnail_url: publicUrl,
  status: 'active',
});
check('owner can create listing', !insErr, insErr?.message);
const { error: imgErr } = await jamie.from('listing_images').insert([
  { listing_id: listingId, image_url: publicUrl, position: 0 },
]);
check('owner can attach images', !imgErr, imgErr?.message);

// 3) Appears in the feed for another user.
const { data: feedRow } = await sam.from('listings').select('id').eq('id', listingId).eq('status', 'active').maybeSingle();
check('new listing visible in feed to other users', !!feedRow);

// 4) Partial update by owner changes only that field.
await jamie.from('listings').update({ price_cents: 2000 }).eq('id', listingId);
const { data: afterUpdate } = await jamie.from('listings').select('price_cents, title').eq('id', listingId).single();
check('owner partial update applied', afterUpdate?.price_cents === 2000 && afterUpdate?.title === 'TEST — coffee table');

// 5) RLS: sam cannot update jamie's listing.
const { data: samUpd } = await sam.from('listings').update({ title: 'HACKED' }).eq('id', listingId).select('id');
const { data: titleCheck } = await jamie.from('listings').select('title').eq('id', listingId).single();
check('RLS blocks other user updating listing', (samUpd ?? []).length === 0 && titleCheck?.title === 'TEST — coffee table');

// 6) RLS: sam cannot soft-delete it either.
const { data: samDel } = await sam.from('listings').update({ status: 'deleted' }).eq('id', listingId).select('id');
check('RLS blocks other user deleting listing', (samDel ?? []).length === 0);

// 7) Owner soft delete hides it from the feed.
await jamie.from('listings').update({ status: 'deleted' }).eq('id', listingId);
const { data: goneRow } = await sam.from('listings').select('id').eq('id', listingId).maybeSingle();
check('soft-deleted listing hidden from other users', !goneRow);
const { data: ownerStillSees } = await jamie.from('listings').select('status').eq('id', listingId).maybeSingle();
check('owner still sees own deleted listing', ownerStillSees?.status === 'deleted');

// Cleanup: remove test listing + storage object.
await jamie.from('listings').delete().eq('id', listingId);
await jamie.storage.from('listing-images').remove([path]);
console.log('\n(cleaned up test data)');

console.log(failures === 0 ? '🎉 Sell flow verified end to end.' : `⚠️ ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
