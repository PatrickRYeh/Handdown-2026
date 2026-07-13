'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  fetchListingsPage,
  type ListingCursor,
  type ListingsPage,
} from '@/lib/listings';
import type { Category } from '@/lib/types';
import { ListingCard } from '@/components/listing-card';

const CATEGORIES: { value: Category | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'books', label: 'Books' },
  { value: 'other', label: 'Other' },
];

// Campus feed (PRD §6.2): header with chips/Sell/search/profile, 2-column
// grid, keyset infinite scroll, pull-to-refresh, title + category filtering.
// The server passes the first page so there's no loading flash; every page
// after that is fetched in the browser.
export function CampusFeed({ initialPage }: { initialPage: ListingsPage }) {
  const queryClient = useQueryClient();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [category, setCategory] = useState<Category | null>(null);

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isDefaultView = search === '' && category === null;
  const queryKey = ['listings', { search, category }] as const;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchListingsPage(createClient(), { cursor: pageParam, search, category }),
    initialPageParam: null as ListingCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    // Server-rendered first page seeds the default (unfiltered) view only.
    ...(isDefaultView
      ? { initialData: { pages: [initialPage], pageParams: [null] } }
      : {}),
  });

  const listings = data?.pages.flatMap((p) => p.items) ?? [];

  // ── Infinite scroll: observe a sentinel below the grid (PRD §6.2). The
  // isFetchingNextPage guard prevents overlapping fetches.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '400px' }, // start loading before the user hits the end
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Pull-to-refresh: drag down from the top to reset pagination (PRD §6.2).
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  async function refresh() {
    setRefreshing(true);
    // Reset to a single page, then refetch it — pagination returns to the top.
    queryClient.setQueryData<{
      pages: ListingsPage[];
      pageParams: (ListingCursor | null)[];
    }>(queryKey, (old) =>
      old
        ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) }
        : old,
    );
    await refetch();
    setRefreshing(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <div
      onTouchStart={(e) => {
        if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
      }}
      onTouchMove={(e) => {
        if (touchStartY.current === null || window.scrollY > 0) return;
        const dy = e.touches[0].clientY - touchStartY.current;
        if (dy > 0) setPull(Math.min(dy * 0.5, 70));
      }}
      onTouchEnd={() => {
        if (pull > 50 && !refreshing) void refresh();
        setPull(0);
        touchStartY.current = null;
      }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        aria-hidden={pull === 0 && !refreshing}
        className="flex items-center justify-center overflow-hidden transition-[height]"
        style={{ height: refreshing ? 44 : pull }}
      >
        <Spinner
          className={`h-5 w-5 text-brand ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { rotate: `${pull * 4}deg` }}
        />
      </div>

      {/* Header (PRD §6.2) */}
      <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search listings…"
              aria-label="Search listings by title"
              className="input"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchInput('');
              }}
              className="shrink-0 text-sm font-medium text-brand"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white">
              Campus Circle
            </span>
            <Link
              href="/nearby"
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-muted"
            >
              Neighborhood
            </Link>
            <div className="flex-1" />
            <Link
              href="/listings/new"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-light"
            >
              Sell
            </Link>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="rounded-full p-2 text-foreground hover:bg-gray-100"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            <Link
              href="/profile"
              aria-label="Your profile"
              className="rounded-full p-2 text-foreground hover:bg-gray-100"
            >
              <UserIcon className="h-5 w-5" />
            </Link>
          </div>
        )}

        {/* Category chips */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setCategory(c.value)}
                aria-pressed={active}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-muted hover:bg-gray-200'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Grid */}
      <div className="px-4 py-4">
        {isError ? (
          <FeedMessage>
            Couldn’t load listings.{' '}
            <button
              type="button"
              onClick={() => refetch()}
              className="font-medium text-brand underline"
            >
              Retry
            </button>
          </FeedMessage>
        ) : isPending ? (
          <SkeletonGrid />
        ) : listings.length === 0 ? (
          <FeedMessage>
            {search || category
              ? 'No listings match your search.'
              : 'No listings yet — be the first to sell something!'}
          </FeedMessage>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Infinite-scroll sentinel + footer state */}
        <div ref={sentinelRef} />
        {isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 animate-spin text-brand" />
          </div>
        )}
        {!hasNextPage && listings.length > 0 && (
          <p className="py-6 text-center text-xs text-muted">
            You’re all caught up
          </p>
        )}
      </div>
    </div>
  );
}

function FeedMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-16 text-center text-sm text-muted">{children}</p>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse flex-col gap-2">
          <div className="aspect-square rounded-xl bg-gray-100" />
          <div className="h-4 w-1/3 rounded bg-gray-100" />
          <div className="h-3 w-3/4 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

type IconProps = { className?: string; style?: React.CSSProperties };

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UserIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function Spinner({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}
