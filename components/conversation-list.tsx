'use client';

// Conversations list rows (PRD §7.2): avatar, name, listing thumbnail, last
// message preview, relative time, unread badge + tint. Realtime: any change to
// my conversations re-renders the server list.
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createRealtimeClient } from '@/lib/supabase/client';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Avatar } from '@/components/avatar';
import { formatRelativeTime } from '@/lib/format';
import type { Conversation } from '@/lib/types';

export function ConversationList({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      supabase = await createRealtimeClient();
      if (cancelled) return;
      channel = supabase
        .channel('conversations-list')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations' },
          () => router.refresh(), // RLS scopes events to my conversations
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [router]);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
        <span className="text-4xl" aria-hidden>💬</span>
        <p className="text-sm text-muted">
          No conversations yet. Start messaging sellers from listing pages!
        </p>
        <Link
          href="/campus"
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-light"
        >
          Browse listings
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {conversations.map((c) => {
        const unread = c.unread_count > 0;
        return (
          <li key={c.id}>
            <Link
              href={`/chats/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
                unread ? 'bg-purple-50/60' : ''
              }`}
            >
              <Avatar
                name={c.other_participant_name}
                url={c.other_participant_avatar_url}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-sm ${unread ? 'font-semibold' : 'font-medium'}`}>
                    {c.other_participant_name}
                  </p>
                  {c.last_message_at && (
                    <span className="shrink-0 text-xs text-muted">
                      {formatRelativeTime(c.last_message_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${unread ? 'text-foreground' : 'text-muted'}`}>
                    {truncatePreview(c.last_message)}
                  </p>
                  {unread && (
                    <span
                      aria-label={`${c.unread_count} unread`}
                      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white"
                    >
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
              {c.listing_thumbnail_url && (
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    src={c.listing_thumbnail_url}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ≤50 chars with ellipsis (PRD §7.2).
function truncatePreview(text: string | null): string {
  if (!text) return 'No messages yet';
  return text.length > 50 ? `${text.slice(0, 50)}…` : text;
}
