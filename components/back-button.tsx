'use client';

import { useRouter } from 'next/navigation';

// Header back button (PRD §6.3, §6.7). Uses history when there is one so the
// user returns to wherever they came from (feed, Your Listings, a profile).
export function BackButton({ fallback = '/campus' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="rounded-full p-2 text-foreground hover:bg-gray-100"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
    </button>
  );
}
