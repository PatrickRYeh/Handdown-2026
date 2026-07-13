'use client';

// Save toggle (PRD §6.3), backed by saved_listings. Optimistic: the heart
// flips immediately and reverts only if the server action fails.
import { useState, useTransition } from 'react';
import { toggleSave } from '@/app/listings/actions';

export function SaveButton({
  listingId,
  initialSaved,
}: {
  listingId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await toggleSave(listingId, next);
      if (result.error) setSaved(!next); // revert on failure
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save listing'}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        saved
          ? 'border-brand bg-purple-50 text-brand'
          : 'border-gray-300 text-foreground hover:bg-gray-50'
      }`}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
