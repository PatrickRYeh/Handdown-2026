// Phase 5 acceptance verification against the live project:
//  - one conversation per (listing, buyer, seller) — duplicate insert rejected
//  - participants can message; forging sender_uid is blocked (RLS)
//  - recipient can mark read; sender cannot mark their own read (RLS)
//  - REALTIME: a message inserted by one user reaches the other user's live
//    subscription without any refresh
// Cleans up via the admin client. Usage: node scripts/test-chats.mjs
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
const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

await jamie.auth.signInWithPassword({ email: 'jamie.demo@berkeley.edu', password: 'handdown-demo-123' });
await sam.auth.signInWithPassword({ email: 'sam.demo@berkeley.edu', password: 'handdown-demo-123' });
const jamieUid = (await jamie.auth.getUser()).data.user.id;
const samUid = (await sam.auth.getUser()).data.user.id;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// A listing of jamie's for sam to inquire about.
const { data: listing } = await sam
  .from('listings')
  .select('id')
  .eq('offering_uid', jamieUid)
  .eq('status', 'active')
  .limit(1)
  .single();

// 1) Create conversation (sam = buyer).
const { data: convo, error: convoErr } = await sam
  .from('conversations')
  .insert({ listing_id: listing.id, buyer_uid: samUid, seller_uid: jamieUid })
  .select('id')
  .single();
check('buyer can create conversation', !convoErr, convoErr?.message);
const convoId = convo.id;

// 2) Idempotency backstop: duplicate insert is rejected by the unique index.
const { error: dupErr } = await sam
  .from('conversations')
  .insert({ listing_id: listing.id, buyer_uid: samUid, seller_uid: jamieUid });
check('duplicate conversation rejected (unique index)', !!dupErr, dupErr ? 'unique violation as expected' : 'DUPLICATE CREATED');

// 3) Sam sends; jamie can read.
const { data: msg1, error: sendErr } = await sam
  .from('messages')
  .insert({ conversation_id: convoId, sender_uid: samUid, content: 'Still selling? I’m interested :)' })
  .select('*')
  .single();
check('participant can send message', !sendErr, sendErr?.message);
const { data: jamieSees } = await jamie.from('messages').select('id').eq('conversation_id', convoId);
check('other participant can read messages', (jamieSees ?? []).length === 1);

// 4) RLS: jamie cannot forge a message as sam.
const { error: forgeErr } = await jamie
  .from('messages')
  .insert({ conversation_id: convoId, sender_uid: samUid, content: 'forged' });
check('RLS blocks forging sender_uid', !!forgeErr);

// 5) Recipient (jamie) marks read; sender (sam) cannot mark own message read.
const { data: samSelfRead } = await sam
  .from('messages')
  .update({ read_at: new Date().toISOString() })
  .eq('id', msg1.id)
  .select('id');
check('sender cannot mark own message read', (samSelfRead ?? []).length === 0);
const { data: jamieRead, error: readErr } = await jamie
  .from('messages')
  .update({ read_at: new Date().toISOString() })
  .eq('conversation_id', convoId)
  .neq('sender_uid', jamieUid)
  .is('read_at', null)
  .select('id');
check('recipient can mark messages read', !readErr && (jamieRead ?? []).length === 1, readErr?.message);

// 6) Unread-count query shape used by the conversations list.
const { data: unread } = await jamie
  .from('messages')
  .select('conversation_id')
  .is('read_at', null)
  .neq('sender_uid', jamieUid);
check('unread-count query works (now zero)', (unread ?? []).filter((m) => m.conversation_id === convoId).length === 0);

// 7) REALTIME round-trip: jamie subscribes, sam sends, event must arrive.
// Same pattern as the app (lib/supabase/client.ts createRealtimeClient): the
// socket must carry the user JWT or RLS silently drops every event.
await jamie.realtime.setAuth((await jamie.auth.getSession()).data.session.access_token);
const received = new Promise((resolve) => {
  const channel = jamie
    .channel(`test-messages-${convoId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convoId}` },
      (payload) => resolve(payload.new),
    )
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await sam.from('messages').insert({
          conversation_id: convoId,
          sender_uid: samUid,
          content: 'realtime ping',
        });
      }
    });
  setTimeout(() => resolve(null), 15000);
});
const event = await received;
check(
  'REALTIME: message delivered live to the other participant',
  !!event && event.content === 'realtime ping',
  event ? 'received over websocket' : 'timed out after 15s',
);

// Cleanup (messages cascade with the conversation).
await admin.from('conversations').delete().eq('id', convoId);
await jamie.removeAllChannels();
console.log('\n(cleaned up test conversation)');

console.log(failures === 0 ? '🎉 Chats verified end to end, including Realtime.' : `⚠️ ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
