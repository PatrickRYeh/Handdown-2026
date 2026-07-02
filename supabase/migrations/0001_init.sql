-- ============================================================================
-- Handdown — initial schema, RLS, triggers, and storage (PRD §4).
-- Run this ONCE in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run: it is written defensively where practical.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto; -- provides gen_random_uuid()

-- ── Enums (PRD §4.1) ────────────────────────────────────────────────────────
do $$ begin
  create type condition as enum ('new', 'like_new', 'good', 'fair', 'used');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category as enum ('furniture', 'apparel', 'electronics', 'books', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('active', 'sold', 'deleted');
exception when duplicate_object then null; end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

-- profiles: one row per user, keyed to Supabase Auth.
create table if not exists profiles (
  uid           uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  email         text not null default '',
  class_year    int,
  major         text,
  campus_region text,
  campus        text not null default 'ucberkeley',
  avatar_url    text,
  rating        numeric(2, 1) not null default 0,
  rating_count  int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- listings
create table if not exists listings (
  id            uuid primary key default gen_random_uuid(),
  offering_uid  uuid not null references profiles (uid) on delete cascade,
  title         text not null,
  description   text not null,
  price_cents   int not null check (price_cents >= 0),
  condition     condition not null,
  category      category not null,
  region_id     text,
  campus        text not null default 'ucberkeley',
  thumbnail_url text,
  status        listing_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keyset-pagination index for the feed: campus + status filter, then the
-- (created_at desc, id desc) cursor the infinite scroll pages through (PRD §5.1).
create index if not exists listings_feed_idx
  on listings (campus, status, created_at desc, id desc);
create index if not exists listings_owner_idx on listings (offering_uid);

-- listing_images
create table if not exists listing_images (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  image_url  text not null,
  position   int not null default 0
);
create index if not exists listing_images_listing_idx
  on listing_images (listing_id, position);

-- conversations
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references listings (id) on delete set null,
  buyer_uid       uuid not null references profiles (uid) on delete cascade,
  seller_uid      uuid not null references profiles (uid) on delete cascade,
  last_message    text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

-- Idempotent "message seller": one conversation per (listing, buyer, seller).
-- nulls not distinct so a null listing_id still dedupes (PRD §4.1).
create unique index if not exists conversations_unique_idx
  on conversations (listing_id, buyer_uid, seller_uid) nulls not distinct;
create index if not exists conversations_buyer_idx
  on conversations (buyer_uid, last_message_at desc);
create index if not exists conversations_seller_idx
  on conversations (seller_uid, last_message_at desc);

-- messages
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_uid      uuid not null references profiles (uid) on delete cascade,
  content         text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at);

-- saved_listings
create table if not exists saved_listings (
  uid        uuid not null references profiles (uid) on delete cascade,
  listing_id uuid not null references listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (uid, listing_id)
);

-- ── updated_at maintenance ──────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists listings_set_updated_at on listings;
create trigger listings_set_updated_at before update on listings
  for each row execute function set_updated_at();

-- ── Auto-create a profile on signup (PRD §5.2) ──────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (uid, full_name, email, campus)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'ucberkeley'
  )
  on conflict (uid) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security (PRD §4.2) ───────────────────────────────────────────
alter table profiles       enable row level security;
alter table listings       enable row level security;
alter table listing_images enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table saved_listings enable row level security;

-- profiles: anyone signed in can read; you may only write your own row.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles
  for insert to authenticated with check (uid = auth.uid());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

-- listings: read non-deleted (or your own); only the owner writes.
drop policy if exists listings_select on listings;
create policy listings_select on listings
  for select to authenticated
  using (status <> 'deleted' or offering_uid = auth.uid());
drop policy if exists listings_insert on listings;
create policy listings_insert on listings
  for insert to authenticated with check (offering_uid = auth.uid());
drop policy if exists listings_update on listings;
create policy listings_update on listings
  for update to authenticated
  using (offering_uid = auth.uid()) with check (offering_uid = auth.uid());
drop policy if exists listings_delete on listings;
create policy listings_delete on listings
  for delete to authenticated using (offering_uid = auth.uid());

-- listing_images: readable if the parent listing is; writable by its owner.
drop policy if exists listing_images_select on listing_images;
create policy listing_images_select on listing_images
  for select to authenticated using (
    exists (
      select 1 from listings l
      where l.id = listing_id
        and (l.status <> 'deleted' or l.offering_uid = auth.uid())
    )
  );
drop policy if exists listing_images_insert on listing_images;
create policy listing_images_insert on listing_images
  for insert to authenticated with check (
    exists (select 1 from listings l where l.id = listing_id and l.offering_uid = auth.uid())
  );
drop policy if exists listing_images_update on listing_images;
create policy listing_images_update on listing_images
  for update to authenticated using (
    exists (select 1 from listings l where l.id = listing_id and l.offering_uid = auth.uid())
  );
drop policy if exists listing_images_delete on listing_images;
create policy listing_images_delete on listing_images
  for delete to authenticated using (
    exists (select 1 from listings l where l.id = listing_id and l.offering_uid = auth.uid())
  );

-- conversations: only the two participants can see or touch them.
drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations
  for select to authenticated using (auth.uid() in (buyer_uid, seller_uid));
drop policy if exists conversations_insert on conversations;
create policy conversations_insert on conversations
  for insert to authenticated with check (buyer_uid = auth.uid());
drop policy if exists conversations_update on conversations;
create policy conversations_update on conversations
  for update to authenticated
  using (auth.uid() in (buyer_uid, seller_uid))
  with check (auth.uid() in (buyer_uid, seller_uid));

-- messages: participants read; a participant may send as themselves; only the
-- recipient may flip read_at.
drop policy if exists messages_select on messages;
create policy messages_select on messages
  for select to authenticated using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_uid, c.seller_uid)
    )
  );
drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert to authenticated with check (
    sender_uid = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_uid, c.seller_uid)
    )
  );
drop policy if exists messages_update on messages;
create policy messages_update on messages
  for update to authenticated using (
    sender_uid <> auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_uid, c.seller_uid)
    )
  );

-- saved_listings: fully private to the owner.
drop policy if exists saved_select on saved_listings;
create policy saved_select on saved_listings
  for select to authenticated using (uid = auth.uid());
drop policy if exists saved_insert on saved_listings;
create policy saved_insert on saved_listings
  for insert to authenticated with check (uid = auth.uid());
drop policy if exists saved_delete on saved_listings;
create policy saved_delete on saved_listings
  for delete to authenticated using (uid = auth.uid());

-- ── Realtime (PRD §7.3) ─────────────────────────────────────────────────────
-- Stream new messages and conversation updates to the client with no server.
do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table conversations;
exception when duplicate_object then null; end $$;

-- ── Storage buckets + policies (PRD §4.3) ───────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('listing-images', 'listing-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Public read; authenticated write. (Path-level ownership is enforced by the
-- app's path convention; v1 keeps storage policies simple.)
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select using (bucket_id in ('listing-images', 'avatars'));
drop policy if exists storage_auth_insert on storage.objects;
create policy storage_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id in ('listing-images', 'avatars'));
drop policy if exists storage_auth_update on storage.objects;
create policy storage_auth_update on storage.objects
  for update to authenticated using (bucket_id in ('listing-images', 'avatars'));
drop policy if exists storage_auth_delete on storage.objects;
create policy storage_auth_delete on storage.objects
  for delete to authenticated using (bucket_id in ('listing-images', 'avatars'));
