'use client';

// Your Listings rows (PRD §6.6): thumbnail, title, price/date, condition, with
// edit and delete controls. Delete = confirm dialog → soft delete → local
// state update.
import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteListing } from '@/app/listings/actions';
import { formatCondition, formatPrice, formatRelativeTime } from '@/lib/format';
import type { Listing } from '@/lib/types';

export function YourListings({ initial }: { initial: Listing[] }) {
  const [listings, setListings] = useState(initial);
  const [confirming, setConfirming] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    const target = confirming;
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteListing(target.id);
      if (result.error) {
        setError(result.error);
      } else {
        setListings((prev) => prev.filter((l) => l.id !== target.id));
      }
      setConfirming(null);
    });
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted">You haven’t listed anything yet.</p>
        <Link
          href="/listings/new"
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-light"
        >
          Sell something
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="px-1 pb-2 text-sm text-muted">
        {listings.length} listing{listings.length === 1 ? '' : 's'}
      </p>
      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-gray-100">
        {listings.map((listing) => (
          <li key={listing.id} className="flex items-center gap-3 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {listing.thumbnail_url && (
                <Image
                  src={listing.thumbnail_url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{listing.title}</p>
              <p className="text-sm text-muted">
                {formatPrice(listing.price_cents)} ·{' '}
                {formatRelativeTime(listing.created_at)}
              </p>
              <p className="text-xs text-muted">
                {formatCondition(listing.condition)}
              </p>
            </div>
            <Link
              href={`/listings/${listing.id}/edit`}
              aria-label={`Edit ${listing.title}`}
              className="rounded-full p-2 text-muted hover:bg-gray-100 hover:text-foreground"
            >
              <PencilIcon className="h-4 w-4" />
            </Link>
            <button
              type="button"
              aria-label={`Delete ${listing.title}`}
              onClick={() => setConfirming(listing)}
              className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {/* Confirm dialog (PRD §6.6) */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => !pending && setConfirming(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-title" className="font-semibold">
              Delete listing?
            </h2>
            <p className="mt-1 text-sm text-muted">
              “{confirming.title}” will be removed from the feed. Chats about it
              are kept.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={pending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type IconProps = { className?: string };

function PencilIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
