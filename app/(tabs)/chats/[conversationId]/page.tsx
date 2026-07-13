import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatThread } from '@/components/chat-thread';
import type { Message } from '@/lib/types';

const PAGE = 50;

// Conversation detail (PRD §7.3). RLS means a non-participant simply gets no
// row → 404.
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: conversation } = await supabase
    .from('conversations')
    .select(
      `id, buyer_uid, seller_uid,
       listing:listings(id, title, thumbnail_url),
       buyer:profiles!buyer_uid(uid, full_name, avatar_url),
       seller:profiles!seller_uid(uid, full_name, avatar_url)`,
    )
    .eq('id', conversationId)
    .maybeSingle();
  if (!conversation) notFound();

  // supabase-js infers to-one joins as arrays without generated types; at
  // runtime these are single objects.
  const other = (
    conversation.buyer_uid === user.id ? conversation.seller : conversation.buyer
  ) as unknown as { uid: string; full_name: string; avatar_url: string | null };
  const listing = conversation.listing as unknown as {
    id: string;
    title: string;
    thumbnail_url: string | null;
  } | null;

  // Newest 50, reversed to chronological for the thread.
  const { data: recent } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE);
  const messages = ((recent ?? []) as Message[]).slice().reverse();

  return (
    <ChatThread
      conversationId={conversationId}
      currentUid={user.id}
      otherName={other.full_name}
      otherAvatarUrl={other.avatar_url}
      listing={listing}
      initialMessages={messages}
      initialHasMore={(recent ?? []).length === PAGE}
    />
  );
}
