'use client';

// Conversation detail (PRD §7.3): chronological bubbles, optimistic send,
// mark-read on open, infinite scroll upward, Supabase Realtime for incoming
// messages and read receipts. Renders full-screen over the tab bar.
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createClient, createRealtimeClient } from '@/lib/supabase/client';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { markConversationRead, sendMessage } from '@/app/(tabs)/chats/actions';
import { Avatar } from '@/components/avatar';
import { BackButton } from '@/components/back-button';
import { formatRelativeTime } from '@/lib/format';
import type { Message } from '@/lib/types';

const PAGE = 50;

// Optimistic messages carry a temp id + pending flag until the server row
// replaces them.
type ThreadMessage = Message & { pending?: boolean };

export function ChatThread({
  conversationId,
  currentUid,
  otherName,
  otherAvatarUrl,
  listing,
  initialMessages,
  initialHasMore,
}: {
  conversationId: string;
  currentUid: string;
  otherName: string;
  otherAvatarUrl: string | null;
  listing: { id: string; title: string; thumbnail_url: string | null } | null;
  initialMessages: Message[]; // oldest → newest
  initialHasMore: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prependingRef = useRef<{ prevHeight: number } | null>(null);
  const stickToBottomRef = useRef(true);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mark received messages read, debounced (PRD §7.3.4).
  const scheduleMarkRead = useCallback(() => {
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(() => {
      void markConversationRead(conversationId);
    }, 600);
  }, [conversationId]);

  useEffect(() => {
    scheduleMarkRead();
    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, [scheduleMarkRead]);

  // ── Realtime: new messages appear instantly; UPDATE events flip read
  // receipts on my sent bubbles (PRD §7.3.5).
  useEffect(() => {
    let cancelled = false;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      // Must authenticate the socket before subscribing — see createRealtimeClient.
      const client = await createRealtimeClient();
      if (cancelled) return;
      supabase = client;
      channel = client
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
          if (incoming.sender_uid !== currentUid) scheduleMarkRead();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .subscribe();
    })();

    return () => {
      cancelled = true;
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [conversationId, currentUid, scheduleMarkRead]);

  // ── Auto-scroll to bottom on load and when new messages arrive, unless the
  // user has scrolled up to read history (PRD §7.3.2).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prependingRef.current) {
      // Older messages were prepended — keep the viewport anchored.
      el.scrollTop += el.scrollHeight - prependingRef.current.prevHeight;
      prependingRef.current = null;
      return;
    }
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // ── Infinite scroll upward for older messages (PRD §7.3.2).
  const loadOlder = useCallback(async () => {
    const el = scrollRef.current;
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .or(
          `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`,
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE);
      const older = ((data ?? []) as Message[]).reverse();
      if (el) prependingRef.current = { prevHeight: el.scrollHeight };
      setHasMore((data ?? []).length === PAGE);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, messages, loadingOlder]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadOlder();
      },
      { root: scrollRef.current, rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadOlder]);

  // ── Optimistic send (PRD §7.3.3).
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const temp: ThreadMessage = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conversationId,
      sender_uid: currentUid,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    stickToBottomRef.current = true;
    setMessages((prev) => [...prev, temp]);
    setInput('');
    setSendError(null);

    const result = await sendMessage(conversationId, content);
    if (result.error || !result.message) {
      // Revert the optimistic bubble and restore the draft (PRD §7.3.3).
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setInput(content);
      setSendError(result.error ?? 'Message failed to send. Try again.');
      return;
    }
    const real = result.message;
    setMessages((prev) =>
      prev.some((m) => m.id === real.id) // realtime may have beaten us to it
        ? prev.filter((m) => m.id !== temp.id)
        : prev.map((m) => (m.id === temp.id ? real : m)),
    );
  }

  const lastReadSentId = [...messages]
    .reverse()
    .find((m) => m.sender_uid === currentUid && m.read_at)?.id;

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-dvh w-full max-w-md flex-col bg-white">
      {/* Header (PRD §7.3.1) */}
      <header className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <BackButton fallback="/chats" />
        <Avatar name={otherName} url={otherAvatarUrl} size={36} />
        <span className="min-w-0 flex-1 truncate font-semibold">{otherName}</span>
      </header>

      {listing && (
        <Link
          href={`/listings/${listing.id}`}
          className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2 hover:bg-gray-100"
        >
          {listing.thumbnail_url && (
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-gray-200">
              <Image src={listing.thumbnail_url} alt="" fill sizes="32px" className="object-cover" />
            </span>
          )}
          <span className="truncate text-xs text-muted">
            About: <span className="font-medium text-foreground">{listing.title}</span>
          </span>
        </Link>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        <div ref={topSentinelRef} />
        {loadingOlder && (
          <p className="py-2 text-center text-xs text-muted">Loading earlier messages…</p>
        )}
        <ul className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.sender_uid === currentUid;
            return (
              <li key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                {!mine && <Avatar name={otherName} url={otherAvatarUrl} size={32} />}
                <div className={`max-w-[75%] ${mine ? 'items-end text-right' : ''}`}>
                  <div
                    className={`inline-block rounded-2xl px-3.5 py-2 text-left text-base leading-snug ${
                      mine
                        ? `rounded-br-sm bg-brand text-white ${m.pending ? 'opacity-60' : ''}`
                        : 'rounded-bl-sm bg-gray-100 text-foreground'
                    }`}
                  >
                    {m.content}
                  </div>
                  <p className="mt-0.5 px-1 text-[11px] text-muted">
                    {m.pending ? 'Sending…' : formatRelativeTime(m.created_at)}
                    {m.id === lastReadSentId && ' · Read'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {sendError && (
        <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          {sendError}
        </p>
      )}

      {/* Sticky input (PRD §7.3.3) */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-gray-100 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          maxLength={2000}
          autoComplete="off"
          className="input flex-1 rounded-full"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-light disabled:opacity-40"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </form>
    </div>
  );
}
