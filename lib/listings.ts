// Shared listings feed query (PRD §5.1). Used by BOTH the server (first page,
// no loading flash) and the browser (infinite scroll) so the query shape has a
// single source of truth.
//
// Pagination is KEYSET, not offset: the cursor is the last row's
// (created_at, id). "Older than the cursor" is immune to the duplicate/skip
// bugs offset pagination hits when new listings arrive mid-scroll.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Listing } from '@/lib/types';

export const PAGE_SIZE = 20;

export interface ListingCursor {
  createdAt: string;
  id: string;
}

export interface ListingsPage {
  items: Listing[];
  nextCursor: ListingCursor | null;
}

export interface ListingsFilter {
  search?: string;
  category?: Category | null;
  /** Campus sub-region — used by the Nearby feed (Phase 6). */
  regionId?: string | null;
}

const CAMPUS = process.env.NEXT_PUBLIC_DEFAULT_CAMPUS ?? 'ucberkeley';

export async function fetchListingsPage(
  supabase: SupabaseClient,
  opts: ListingsFilter & { cursor?: ListingCursor | null; limit?: number } = {},
): Promise<ListingsPage> {
  const limit = opts.limit ?? PAGE_SIZE;

  let query = supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .eq('campus', CAMPUS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (opts.cursor) {
    const { createdAt, id } = opts.cursor;
    // Strictly older than the cursor row, with id as the tiebreaker for
    // listings created in the same microsecond.
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
    );
  }
  if (opts.search) {
    query = query.ilike('title', `%${opts.search}%`);
  }
  if (opts.category) {
    query = query.eq('category', opts.category);
  }
  if (opts.regionId) {
    query = query.eq('region_id', opts.regionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const items = (data ?? []) as Listing[];
  const last = items[items.length - 1];
  return {
    items,
    // A short page means we've reached the end.
    nextCursor:
      items.length === limit && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
  };
}
