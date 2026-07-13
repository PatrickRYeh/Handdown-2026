'use server';

// Chat mutations (PRD §5.3). RLS is the enforcement: only participants can
// insert (as themselves) or mark the other side's messages read.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Message } from '@/lib/types';

const uuid = z.string().uuid();

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<{ message?: Message; error?: string }> {
  if (!uuid.safeParse(conversationId).success) return { error: 'Invalid conversation.' };
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 2000) return { error: 'Message must be 1–2000 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_uid: user.id,
      content: trimmed,
    })
    .select('*')
    .single();
  if (error) return { error: error.message };

  // Denormalized list-view fields (PRD §4.1).
  await supabase
    .from('conversations')
    .update({
      last_message: trimmed.slice(0, 120),
      last_message_at: message.created_at,
    })
    .eq('id', conversationId);

  return { message: message as Message };
}

export async function markConversationRead(
  conversationId: string,
): Promise<{ error?: string }> {
  if (!uuid.safeParse(conversationId).success) return { error: 'Invalid conversation.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_uid', user.id)
    .is('read_at', null);
  return error ? { error: error.message } : {};
}
