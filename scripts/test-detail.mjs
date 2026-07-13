// Phase 4 acceptance verification against the live project:
//  - listing + images + seller profile join (the detail-page query) works
//  - save/unsave round-trips, and saves are private to their owner (RLS)
//  - profile update persists and is publicly readable
//  - avatar upload to the avatars bucket serves publicly
// Usage: node scripts/test-detail.mjs
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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const jamie = createClient(URL_, KEY);
const sam = createClient(URL_, KEY);
await jamie.auth.signInWithPassword({ email: 'jamie.demo@berkeley.edu', password: 'handdown-demo-123' });
await sam.auth.signInWithPassword({ email: 'sam.demo@berkeley.edu', password: 'handdown-demo-123' });
const samUid = (await sam.auth.getUser()).data.user.id;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// 1) Detail-page join: listing + ordered images + seller profile.
const { data: jamieListing } = await sam
  .from('listings')
  .select('id, offering_uid')
  .eq('status', 'active')
  .neq('offering_uid', samUid)
  .limit(1)
  .single();
const { data: detail, error: joinErr } = await sam
  .from('listings')
  .select('*, listing_images(*), seller:profiles!offering_uid(*)')
  .eq('id', jamieListing.id)
  .single();
check('detail join query (images + seller) works', !joinErr && !!detail?.seller?.full_name && Array.isArray(detail?.listing_images), joinErr?.message);
check('joined seller has rating fields', typeof detail?.seller?.rating !== 'undefined');

// 2) Save toggle round-trip as sam.
await sam.from('saved_listings').delete().eq('uid', samUid).eq('listing_id', jamieListing.id);
const { error: saveErr } = await sam.from('saved_listings').upsert(
  { uid: samUid, listing_id: jamieListing.id },
  { onConflict: 'uid,listing_id', ignoreDuplicates: true },
);
check('save listing works', !saveErr, saveErr?.message);
const { data: savedRow } = await sam.from('saved_listings').select('listing_id').eq('uid', samUid).eq('listing_id', jamieListing.id).maybeSingle();
check('saved state readable by owner', !!savedRow);

// 3) RLS: jamie cannot see or forge sam's saves.
const { data: jamieSpy } = await jamie.from('saved_listings').select('*').eq('uid', samUid);
check('RLS hides other users’ saves', (jamieSpy ?? []).length === 0);
const { error: forgeErr } = await jamie.from('saved_listings').insert({ uid: samUid, listing_id: jamieListing.id });
check('RLS blocks saving as someone else', !!forgeErr);

// unsave
await sam.from('saved_listings').delete().eq('uid', samUid).eq('listing_id', jamieListing.id);
const { data: afterUnsave } = await sam.from('saved_listings').select('listing_id').eq('uid', samUid).eq('listing_id', jamieListing.id).maybeSingle();
check('unsave works', !afterUnsave);

// 4) Profile update persists (what updateProfile does), visible to others.
const newMajor = `Economics ${Date.now() % 1000}`;
const { error: profErr } = await sam.from('profiles').update({ major: newMajor }).eq('uid', samUid);
check('own profile update succeeds', !profErr, profErr?.message);
const { data: seenByJamie } = await jamie.from('profiles').select('major').eq('uid', samUid).single();
check('profile change visible to other users', seenByJamie?.major === newMajor);
await sam.from('profiles').update({ major: 'Economics' }).eq('uid', samUid); // restore

// 5) Avatar upload (avatars bucket, {uid}.jpg, upsert).
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const { error: avErr } = await sam.storage.from('avatars').upload(`${samUid}.jpg`, png, { contentType: 'image/png', upsert: true });
check('avatar upload (upsert) works', !avErr, avErr?.message);
const avUrl = sam.storage.from('avatars').getPublicUrl(`${samUid}.jpg`).data.publicUrl;
const avRes = await fetch(avUrl);
check('avatar publicly readable', avRes.ok, `HTTP ${avRes.status}`);
await sam.storage.from('avatars').remove([`${samUid}.jpg`]); // cleanup

console.log(failures === 0 ? '\n🎉 Detail & profiles verified.' : `\n⚠️ ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
