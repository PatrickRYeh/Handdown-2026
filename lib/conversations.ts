// Conversations list query (PRD §5.3). RLS already restricts rows to
// conversations the user participates in; this maps them to the Conversation
// view-model (other participant + listing context + unread count).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation } from '@/lib/types';

interface ParticipantRow {
  uid: string;
  full_name: string;
  avatar_url: string | null;
}

interface ConversationRow {
  id: string;
  listing_id: string | null;
  buyer_uid: string;
  seller_uid: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  listing: { id: string; title: string; thumbnail_url: string | null } | null;
  buyer: ParticipantRow;
  seller: ParticipantRow;
}

export async function fetchConversations(
  supabase: SupabaseClient,
  uid: string,
): Promise<Conversation[]> {
  const [{ data: rows, error }, { data: unreadRows }] = await Promise.all([
    supabase
      .from('conversations')
      .select(
        `id, listing_id, buyer_uid, seller_uid, last_message, last_message_at, created_at,
         listing:listings(id, title, thumbnail_url),
         buyer:profiles!buyer_uid(uid, full_name, avatar_url),
         seller:profiles!seller_uid(uid, full_name, avatar_url)`,
      )
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    // One query for all unread counts — RLS scopes it to my conversations.
    supabase
      .from('messages')
      .select('conversation_id')
      .is('read_at', null)
      .neq('sender_uid', uid),
  ]);
  if (error) throw new Error(error.message);

  const unreadByConversation = new Map<string, number>();
  for (const m of unreadRows ?? []) {
    unreadByConversation.set(
      m.conversation_id,
      (unreadByConversation.get(m.conversation_id) ?? 0) + 1,
    );
  }

  return ((rows ?? []) as unknown as ConversationRow[]).map((row) => {
    const other = row.buyer_uid === uid ? row.seller : row.buyer;
    return {
      id: row.id,
      listing_id: row.listing?.id ?? null,
      listing_title: row.listing?.title ?? null,
      listing_thumbnail_url: row.listing?.thumbnail_url ?? null,
      other_participant_uid: other.uid,
      other_participant_name: other.full_name,
      other_participant_avatar_url: other.avatar_url,
      last_message: row.last_message,
      last_message_at: row.last_message_at,
      unread_count: unreadByConversation.get(row.id) ?? 0,
      created_at: row.created_at,
    };
  });
}
