// POST /api/conversations — get-or-create a conversation from a listing
// (PRD §5.3). Idempotent: the unique index on (listing_id, buyer_uid,
// seller_uid) guarantees pressing Send twice reuses one conversation, even if
// two requests race.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  listing_id: z.string().uuid(),
  initial_message: z.string().trim().min(1, 'Message is empty.').max(2000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { listing_id, initial_message } = parsed.data;

  // The seller comes from the listing row, never from the client.
  const { data: listing } = await supabase
    .from('listings')
    .select('id, offering_uid')
    .eq('id', listing_id)
    .neq('status', 'deleted')
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  }
  const seller_uid = listing.offering_uid;
  if (seller_uid === user.id) {
    return NextResponse.json({ error: "You can't message yourself." }, { status: 400 });
  }

  // Get or create. On an insert race the unique index rejects the loser, and
  // we re-select the winner's row.
  const findExisting = () =>
    supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('buyer_uid', user.id)
      .eq('seller_uid', seller_uid)
      .maybeSingle();

  let conversationId = (await findExisting()).data?.id;
  if (!conversationId) {
    const { data: created, error: insertErr } = await supabase
      .from('conversations')
      .insert({ listing_id, buyer_uid: user.id, seller_uid })
      .select('id')
      .single();
    if (insertErr) {
      conversationId = (await findExisting()).data?.id;
      if (!conversationId) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    } else {
      conversationId = created.id;
    }
  }

  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_uid: user.id,
      content: initial_message,
    })
    .select('created_at')
    .single();
  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  await supabase
    .from('conversations')
    .update({
      last_message: initial_message.slice(0, 120),
      last_message_at: message.created_at,
    })
    .eq('id', conversationId);

  return NextResponse.json({ conversation_id: conversationId });
}
