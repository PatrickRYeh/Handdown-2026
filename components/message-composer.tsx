'use client';

// Listing-detail message composer (PRD §6.3): pre-filled greeting, a Bid
// shortcut that swaps in a pre-filled offer ("Bid" = message in v1), and Send.
// Send wires up to get-or-create conversation in Phase 5 — until then it
// explains itself instead of failing silently.
import { useState } from 'react';
import { formatPrice } from '@/lib/format';

export function MessageComposer({
  priceCents,
}: {
  listingId: string;
  sellerUid: string;
  priceCents: number;
}) {
  const [message, setMessage] = useState("Still selling? I'm interested :)");
  const [note, setNote] = useState<string | null>(null);
  const [sending] = useState(false);

  // v1 "Bid": pre-fill an offer at ~90% of asking, rounded to the dollar.
  const bidCents = Math.max(100, Math.round((priceCents * 0.9) / 100) * 100);

  function handleSend() {
    // Phase 5 replaces this with: POST get-or-create conversation → route to
    // /chats/[conversationId].
    setNote('Messaging is coming in the next update — hang tight!');
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
          setNote(null);
        }}
        rows={2}
        maxLength={500}
        className="input resize-none border-0 p-1 shadow-none focus:shadow-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMessage(`Would you take ${formatPrice(bidCents)}?`)}
          className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
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
          Send
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
