'use client';

// Listing-detail message composer (PRD §6.3, §7.4): pre-filled greeting, Bid
// shortcut ("Bid" = pre-filled offer message in v1), and Send → get-or-create
// conversation → route to the chat. Idempotent server-side: sending twice
// reuses the same conversation.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPrice } from '@/lib/format';

export function MessageComposer({
  listingId,
  priceCents,
}: {
  listingId: string;
  sellerUid: string;
  priceCents: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("Still selling? I'm interested :)");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // v1 "Bid": pre-fill an offer at ~90% of asking, rounded to the dollar.
  const bidCents = Math.max(100, Math.round((priceCents * 0.9) / 100) * 100);

  async function handleSend() {
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, initial_message: content }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not send your message. Try again.');
        setSending(false);
        return;
      }
      router.push(`/chats/${json.conversation_id}`);
    } catch {
      setError('Network problem — check your connection and try again.');
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-3">
      <label htmlFor="composer" className="sr-only">
        Message the seller
      </label>
      <textarea
        id="composer"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setError(null);
        }}
        rows={2}
        maxLength={500}
        className="input resize-none border-0 p-1 shadow-none focus:shadow-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMessage(`Would you take ${formatPrice(bidCents)}?`)}
          disabled={sending}
          className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Bid {formatPrice(bidCents)}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="rounded-full bg-brand px-5 py-1.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
