# Handdown — Product Requirements Document

> **Status:** Build-ready v1.0
> **Audience:** The builder (you) and an AI coding assistant (Claude Code) building the app progressively.
> **Last updated:** June 2026

---

## 0. How to Use This Document

This PRD is written to be handed to Claude Code one **phase** at a time (see [Section 11: Phased Build Roadmap](#11-phased-build-roadmap)). Do not paste the whole document and say "build it all." Build in order, verify each phase against its acceptance criteria, then move on. This is the single most important thing you can do to avoid errors as a first-time fullstack builder: small, verifiable steps.

**Conventions used throughout:**

- **Route** = a page in the app (a URL like `/listings/[id]`).
- **Server Component** = a React component that runs on the server and can read the database directly. This is the default in Next.js 16.
- **Client Component** = a component marked `'use client'` that runs in the browser (needed for interactivity: forms, buttons with state, infinite scroll).
- **Route Handler** = a backend API endpoint (file at `app/api/.../route.ts`).
- **Server Action** = a server-side function callable directly from a form/component without writing a separate API endpoint.
- **RLS** = Row Level Security, Postgres rules that decide who can read/write each row. This is our primary security layer.

When a section says "the builder decides," it means it is a real choice you should make before that phase; a sensible default is given.

---

## 1. Product Context & Objectives

**Product vision:** Handdown is a campus-focused marketplace that lets university students buy, sell, and transport second-hand goods safely within a trusted community. The launch campus is UC Berkeley (`campus = "ucberkeley"`).

**Primary goals**

- Surface recent listings in a mobile-first grid with infinite scroll to keep buyers browsing.
- Let verified students publish, edit, and delete listings (photos, metadata, pricing) through lightweight flows.
- Provide rich listing detail pages with seller profiles and quick communication (message, save, share).
- Offer complementary services (moving assistance) that support high-friction transactions like furniture.

**Target users**

- Students searching for deals near campus.
- Student sellers who want to offload items quickly.
- (Future) student movers / logistics partners, hinted at by the Moving tab.

**Non-goals for v1** (explicitly out of scope so the build stays focused)

- Payments / in-app checkout. Transactions happen in person; Handdown is discovery + messaging only.
- Multi-campus support. The schema supports it via a `campus` column, but v1 ships UC Berkeley only.
- Native iOS/Android app store builds. v1 is a responsive, installable web app (PWA). See [Section 3](#3-tech-stack--architecture).

---

## 2. Personas & User Journeys

### 2.1 Student Buyer ("Alex")

**Motivation:** Needs affordable furniture/electronics while staying local.

**Journey**

1. Lands on the Campus feed. Browses listings in a two-column responsive grid.
2. Scrolls; more results load automatically at the end (infinite scroll).
3. Taps a card → listing detail page with image carousel, description, seller info.
4. Uses quick actions: send a message (creates a conversation, routes to Chats), save, share.
5. Checks seller credibility via the profile snippet (rating, class year, major, campus region).
6. Opens Moving for delivery help or Profile to manage their own info.
7. Receives seller replies in Chats; negotiates price, arranges pickup, asks questions.

### 2.2 Student Seller ("Jamie")

**Motivation:** Wants to offload items before moving, with minimal friction.

**Journey**

1. From the Campus header, taps **Sell** to open Create Listing.
2. Uploads 1–10 photos; fills title, description, price, condition, category, and location.
3. Validation blocks submission until required fields are valid.
4. After publishing, manages listings via Profile → **Your Listings**.
5. Your Listings shows their listings with edit and delete controls.
6. Editing opens the Update Listing form, pre-filled with current values.
7. Saves changes (update) or removes the listing (soft delete).
8. Receives buyer inquiries in Chats; responds, negotiates, coordinates meetups.

### 2.3 Student Mover ("Sam")

**Motivation:** Offers labor/logistics services to other students.

**Journey (v1 = informational only)**

1. Opens the Moving page.
2. Reviews service tiers (Door-to-Door, Full Extraction, Heavy Duty).
3. (Future) submits a move request that gets routed to movers. v1 displays tiers and a "coming soon" CTA.

---

## 3. Tech Stack & Architecture

### 3.1 The decision

| Layer | Choice | Why this is the easiest, lowest-error option |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Turbopack) | One codebase for frontend **and** backend. No separate server to run or deploy. The most documented, AI-assistant-friendly stack available. |
| Styling | **Tailwind CSS** | Style directly in markup; no separate CSS files to wire up. Mobile-first by default. |
| UI components | **shadcn/ui** | Copy-paste accessible components (buttons, inputs, dialogs) you own and can edit. Saves you from hand-building form controls. |
| Database | **Supabase Postgres** | Managed SQL database. No DB server to install or maintain. Real SQL, not a proprietary store. |
| Auth | **Supabase Auth** (`@supabase/ssr`) | Email/password + magic links + Google sign-in without writing auth logic. Integrates with the database via RLS. |
| File storage (images) | **Supabase Storage** | Upload listing photos and avatars with a few lines; public URLs out of the box. |
| Realtime (chat) | **Supabase Realtime** | New messages stream to the client with no WebSocket server to build. This removes the hardest part of the Chats feature. |
| Hosting | **Vercel** (app) + **Supabase** (backend) | Both have generous free tiers. Push to GitHub → Vercel deploys automatically. |
| Optional later | **Capacitor** | Wraps the web app into iOS/Android store builds if you ever want them — no rewrite. |

### 3.2 Why not Expo / React Native (your original draft)

React Native + Expo is a fine choice for an *experienced* mobile developer, but for a first fullstack app it adds three large error surfaces you don't need: native build tooling and device/simulator setup, native permission flows for the camera/photo library, and a separate backend you'd still have to build and host. The Next.js + Supabase path gives you a phone-like, installable experience with **one** language (TypeScript), **one** deploy button, and managed auth/storage/realtime. If App Store distribution becomes a hard requirement later, Capacitor wraps the same code with no rewrite.

### 3.3 Versions (current as of June 2026 — let Claude Code install latest)

- Next.js **16.x** (App Router is the default; Turbopack is the default bundler; React **19.2**).
- Node.js **20+** (Next.js 16 minimum).
- `@supabase/supabase-js` + `@supabase/ssr` (the current package — the older `@supabase/auth-helpers` is deprecated; do **not** use it).
- Supabase API keys: use the new **publishable** (`sb_publishable_…`) and **secret** (`sb_secret_…`) keys. The legacy `anon` / `service_role` keys still work during the transition but prefer the new ones.

### 3.4 Repository structure (target)

```
handdown/
├── app/
│   ├── (tabs)/                  # main authenticated app, shared bottom tab bar
│   │   ├── campus/page.tsx      # Campus feed (home)
│   │   ├── nearby/page.tsx      # Neighborhood feed
│   │   ├── moving/page.tsx      # Moving tiers
│   │   └── chats/
│   │       ├── page.tsx         # conversations list
│   │       └── [conversationId]/page.tsx
│   ├── listings/
│   │   ├── [id]/page.tsx        # listing detail
│   │   ├── new/page.tsx         # create listing
│   │   └── [id]/edit/page.tsx   # update listing
│   ├── profile/
│   │   ├── page.tsx             # current user's profile
│   │   ├── listings/page.tsx    # "Your Listings"
│   │   └── [uid]/page.tsx       # public profile (seller)
│   ├── login/page.tsx
│   ├── api/                     # Route Handlers (only where needed — see §5)
│   ├── layout.tsx               # root layout
│   └── not-found.tsx
├── components/                  # shared UI (cards, tab bar, message bubble…)
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # browser client (createBrowserClient)
│   │   ├── server.ts            # server client (createServerClient)
│   │   └── middleware.ts        # session refresh helper
│   ├── types.ts                 # shared TypeScript types (see §4)
│   └── format.ts                # price/date/rating helpers
├── proxy.ts                     # (Next.js 16) session-refresh middleware
├── supabase/
│   └── migrations/              # SQL schema & RLS (source of truth for the DB)
├── .env.local                   # secrets (never commit)
└── package.json
```

### 3.5 Data-fetching rules (important for avoiding bugs)

- **Initial page data** → fetch in a **Server Component** directly from Supabase. No `useEffect`, no loading flash.
- **Data that changes after load** (infinite scroll, live chat, optimistic sends) → **Client Component** using the browser Supabase client, ideally via **TanStack Query** for caching/pagination.
- **Mutations** (create/update/delete listing, send message) → **Server Actions** or Route Handlers; never trust the client for authorization — RLS enforces it at the database.

---

## 4. Data Model & Database Schema

This is the source of truth. The schema lives in `supabase/migrations/` as SQL. v1 is **single-campus**: instead of a Postgres schema per campus (which is overkill and error-prone for a first build), every table carries a `campus` text column defaulting to `'ucberkeley'`.

### 4.1 Tables

**`profiles`** — one row per user, keyed to Supabase Auth.

| Column | Type | Notes |
|---|---|---|
| `uid` | `uuid` PK | references `auth.users(id)` |
| `full_name` | `text` | |
| `email` | `text` | |
| `class_year` | `int` | e.g. 2027 |
| `major` | `text` | |
| `campus_region` | `text` | e.g. "Southside", "Northside" |
| `campus` | `text` | default `'ucberkeley'` |
| `avatar_url` | `text` null | Supabase Storage URL |
| `rating` | `numeric(2,1)` | 0.0–5.0, default 0 |
| `rating_count` | `int` | default 0 |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | |

**`listings`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `offering_uid` | `uuid` FK → `profiles.uid` | the seller |
| `title` | `text` | required |
| `description` | `text` | required |
| `price_cents` | `int` | store cents, not floats, to avoid rounding bugs |
| `condition` | `text` (enum) | `new` \| `like_new` \| `good` \| `fair` \| `used` |
| `category` | `text` (enum) | `furniture` \| `apparel` \| `electronics` \| `books` \| `other` |
| `region_id` | `text` null | campus sub-region / neighborhood |
| `campus` | `text` | default `'ucberkeley'` |
| `thumbnail_url` | `text` null | denormalized first image for fast grid render |
| `status` | `text` (enum) | `active` \| `sold` \| `deleted` (default `active`) |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | |

**`listing_images`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `listing_id` | `uuid` FK → `listings.id` | `on delete cascade` |
| `image_url` | `text` | Supabase Storage URL |
| `position` | `int` | 0-based ordering for the carousel |

**`conversations`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `listing_id` | `uuid` FK → `listings.id` null | conversation may outlive a deleted listing |
| `buyer_uid` | `uuid` FK → `profiles.uid` | |
| `seller_uid` | `uuid` FK → `profiles.uid` | |
| `last_message` | `text` null | denormalized for the list view |
| `last_message_at` | `timestamptz` null | sort key for the list |
| `created_at` | `timestamptz` | default `now()` |

> **Uniqueness:** add a unique index on `(listing_id, buyer_uid, seller_uid)` so "message seller" is idempotent — pressing send twice reuses the same conversation instead of creating duplicates.

**`messages`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `conversation_id` | `uuid` FK → `conversations.id` | `on delete cascade` |
| `sender_uid` | `uuid` FK → `profiles.uid` | |
| `content` | `text` | |
| `read_at` | `timestamptz` null | null = unread |
| `created_at` | `timestamptz` | default `now()` |

**`saved_listings`** (for the Save action)

| Column | Type | Notes |
|---|---|---|
| `uid` | `uuid` FK → `profiles.uid` | composite PK with `listing_id` |
| `listing_id` | `uuid` FK → `listings.id` | |
| `created_at` | `timestamptz` | |

> **Bids / offers:** the listing detail mentions a "Bid" action. For v1, treat **Bid** as a pre-filled message ("Would you take $X?") rather than a separate system. A real offers table is a Future Opportunity (§13).

### 4.2 Row Level Security (RLS) — the security model

Enable RLS on **every** table. Policies (expressed plainly; Claude Code writes the SQL):

- **profiles:** any authenticated user can `select`. Only the owner (`uid = auth.uid()`) can `insert`/`update` their own row.
- **listings:** any authenticated user can `select` rows where `status != 'deleted'`. Only the owner (`offering_uid = auth.uid()`) can `insert`/`update`/`delete`.
- **listing_images:** readable if the parent listing is readable; writable only by the listing owner.
- **conversations:** `select`/`insert` only where `auth.uid()` is the `buyer_uid` or `seller_uid`.
- **messages:** `select` only if `auth.uid()` is a participant in the conversation. `insert` only if `sender_uid = auth.uid()` **and** the sender is a participant. Allow `update` of `read_at` only by the non-sender participant.
- **saved_listings:** `select`/`insert`/`delete` only where `uid = auth.uid()`.

### 4.3 Storage buckets

- `listing-images` — public read; authenticated write. Path convention: `listing-images/{listing_id}/{position}.jpg`.
- `avatars` — public read; authenticated write. Path convention: `avatars/{uid}.jpg`.

### 4.4 Shared TypeScript types (`lib/types.ts`)

These mirror the tables and are the contract the UI codes against.

```ts
export type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'used';
export type Category = 'furniture' | 'apparel' | 'electronics' | 'books' | 'other';
export type ListingStatus = 'active' | 'sold' | 'deleted';

export interface Profile {
  uid: string;
  full_name: string;
  email: string;
  class_year: number | null;
  major: string | null;
  campus_region: string | null;
  campus: string;
  avatar_url: string | null;
  rating: number;
  rating_count: number;
}

export interface ListingImage { id: string; listing_id: string; image_url: string; position: number; }

export interface Listing {
  id: string;
  offering_uid: string;
  title: string;
  description: string;
  price_cents: number;          // format with lib/format.ts → "$45"
  condition: Condition;
  category: Category;
  region_id: string | null;
  campus: string;
  thumbnail_url: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  listing_images?: ListingImage[];
  seller?: Profile;             // joined where needed
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_thumbnail_url: string | null;
  other_participant_uid: string;
  other_participant_name: string;
  other_participant_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_uid: string;
  content: string;
  read_at: string | null;
  created_at: string;
}
```

---

## 5. API / Server Contracts

With Supabase + RLS, most reads happen **directly** in Server Components and most writes happen in **Server Actions** — you do not need a REST endpoint for everything. Build a Route Handler only where the operation needs server-only logic or must be atomic. Below, each operation lists the recommended mechanism plus the contract.

### 5.1 Listings

| Operation | Mechanism | Contract |
|---|---|---|
| Browse feed | Server Component (initial) + Client query (scroll) | Query `listings` where `status='active'` and `campus='ucberkeley'`, ordered by `created_at desc`. **Keyset pagination:** pass the last item's `created_at` + `id` as the cursor, fetch the next 20. (Keyset avoids the duplicate/skip bugs that offset pagination causes during infinite scroll.) |
| Search / filter | same | Add `.ilike('title', '%q%')` and/or `.eq('category', …)` to the query. |
| Get one | Server Component | Select the listing + `listing_images` (ordered by `position`) + joined `seller` profile. |
| Create | Server Action `POST /api/listings` | Body: `{title, description, price_cents, condition, category, region_id}` + uploaded image URLs. Server sets `offering_uid = auth.uid()`, inserts listing, inserts `listing_images`, sets `thumbnail_url` to position-0 image. Returns the new `id`. |
| Update | Server Action | Body: only changed fields. Server verifies ownership (RLS also enforces). Updates `updated_at`. |
| Delete | Server Action | **Soft delete:** set `status='deleted'`. Do not hard-delete (preserves conversation context). |
| My listings | Server Component | `listings` where `offering_uid = auth.uid()` and `status != 'deleted'`. |

### 5.2 Profiles

| Operation | Mechanism | Contract |
|---|---|---|
| Get profile | Server Component | Select `profiles` by `uid`. Used by listing detail (seller card) and the public profile route. |
| Get own profile | Server Component | `profiles` where `uid = auth.uid()`. |
| Update own profile | Server Action | Editable: `full_name`, `class_year`, `major`, `campus_region`, `avatar_url`. |
| Auto-create on signup | DB trigger | A Postgres trigger inserts a `profiles` row when a new `auth.users` row is created, so a profile always exists. |

### 5.3 Chats / Messaging

| Operation | Mechanism | Contract |
|---|---|---|
| List conversations | Server Component (initial) | Return `Conversation[]` for the current user (as buyer or seller), sorted by `last_message_at desc`. `unread_count` = count of messages in the conversation where `sender_uid != auth.uid()` and `read_at is null`. The "other participant" fields are resolved from whichever side isn't the current user. |
| Get-or-create conversation | Route Handler `POST /api/conversations` | Body: `{listing_id, seller_uid, initial_message}`. Server sets `buyer_uid = auth.uid()`. **Idempotent:** if a conversation already exists for `(listing_id, buyer_uid, seller_uid)`, reuse it; otherwise create it. Insert the first message. Return `{conversation_id}`. This is the one operation that genuinely benefits from a single atomic endpoint. |
| List messages | Client query | Messages for `conversation_id`, ordered `created_at asc`. Paginate older messages with a `before` cursor (load 50 at a time). |
| Send message | Server Action `POST /api/conversations/[id]/messages` | Body: `{content}`. Server sets `sender_uid = auth.uid()`, inserts message, updates the conversation's `last_message` + `last_message_at`. Client adds it **optimistically** before the response. |
| Mark read | Server Action | On opening a conversation, set `read_at = now()` for messages where `sender_uid != auth.uid()` and `read_at is null`. Debounce to avoid spamming. |
| Live updates | Supabase Realtime (client) | Subscribe to `INSERT` on `messages` filtered by `conversation_id` for the open conversation, and to conversation updates for the list. No polling, no WebSocket server. |

---

## 6. Feature Requirements by Route

### 6.1 Root Layout & Tab Bar

- Bottom tab bar (mobile-first): **Campus**, **Nearby**, **Moving**, **Chats**.
- Active tab in primary purple, inactive in gray, flat background.
- The whole tab group is auth-gated: unauthenticated users are redirected to `/login`.
- A real `not-found.tsx` handles unknown routes with a "Go home" CTA. (Replaces the draft's "404 if anything goes wrong" — errors are handled per-route with `error.tsx` boundaries, not a blanket 404.)

### 6.2 Campus Feed (`/campus`, home)

- **Header:** a "Campus Circle" chip (toggles with a "Neighborhood" chip), a **Sell** button → `/listings/new`, a search icon → search mode, a profile icon → `/profile`.
- **Body:** two-column responsive grid. Each card shows price, title, and the first image (or a colored placeholder when none).
- **Infinite scroll:** load 20 at a time via keyset pagination; a loading guard prevents overlapping fetches.
- **Pull-to-refresh / refresh control** resets pagination to the top.
- **Card tap** → `/listings/[id]`.
- **Search:** filters by title text and optionally category.

### 6.3 Listing Detail (`/listings/[id]`)

- **Image carousel** with pagination dots; placeholder slide if no images.
- **Price / title / description** block.
- **Action bar:** a message composer pre-filled with `"Still selling? I'm interested :)"`, plus Save and Share actions. ("Bid" = a pre-filled offer message in v1.)
  - **Send** → calls get-or-create conversation (§5.3), then routes to `/chats/[conversationId]`.
  - **Share** → Web Share API where available, else copy-link fallback.
- **Seller card:** avatar, name, class year, major, rating stars, campus region. Tapping it → `/profile/[uid]`.
- **Header back button.**
- Data is fetched in the Server Component when the page loads. `lib/format.ts` provides rating-star and class-year display helpers.

### 6.4 Create Listing (`/listings/new`)

- **Fields:** Photos (1–10), Title, Description, Price, Condition (dropdown), Category (dropdown), Location/region.
- **Validation:** all fields required; at least one photo; price > 0; title and description non-empty. Show inline error labels.
- **Image handling (web):** a file input / drag-and-drop dropzone (`<input type="file" multiple accept="image/*">`). On the client: optionally compress, then upload each file to the `listing-images` bucket; collect the returned public URLs.
- **Submit:** build the payload, call Create (§5.1), then route to `/campus`.
- **UX:** hero dropzone for photos, a clear **Publish** CTA, disabled state while submitting.

### 6.5 Update Listing (`/listings/[id]/edit`)

- **Prefill:** load the listing (owner-only; RLS enforces) and populate the form.
- **Form parity:** identical fields and validation to Create.
- **Change tracking:** diff against the loaded `originalData`; submit only changed fields plus the `id`.
- **Submit:** call Update (§5.1); handle image add/remove/reorder.
- **Buttons:** Cancel and Update both route back to Your Listings.

### 6.6 Your Listings (`/profile/listings`)

- **Data:** the current user's listings where `status != 'deleted'`.
- **UI:** scrollable list; each row shows thumbnail, title, price/date, condition, plus edit (pencil) and delete (trash) actions.
- **Delete:** confirmation dialog → soft delete → update local state and count.
- **States:** "Loading your listings…" while fetching; a friendly empty state when there are none.

### 6.7 Profile (`/profile` and `/profile/[uid]`)

- `/profile` = the current user; `/profile/[uid]` = a public seller profile.
- **Header** with a back button.
- **Profile card:** avatar, name, "{class_year} · {major}", with loading/error fallbacks.
- **Rows:** Location (campus region), Ratings (stars; stub data acceptable in v1), and (own profile only) a Selling section linking to **Your Listings**.
- Own profile is editable (Server Action, §5.2).

### 6.8 Moving (`/moving`)

- **Static content:** three service tiers with descriptions and pricing — **Door-to-Door**, **Full Extraction**, **Heavy Duty**.
- **Actions:** tier buttons show a "Coming soon" state in v1; profile icon → `/profile`.
- **Future:** capture move requests; scheduling and mover matching.

### 6.9 Nearby / Neighborhood (`/nearby`)

- Replace any starter/template content. v1 = the same listing feed filtered to the user's `campus_region` (or a simple "nearby" sort). A map view is a Future Opportunity.

### 6.10 Chats — see [Section 7](#7-chats-feature-detailed-requirements).

---

## 7. Chats Feature Detailed Requirements

> This carries over your detailed draft, reframed for web routes and Supabase Realtime (no custom WebSocket server).

### 7.1 User Stories

**Buyer (Alex):** message a seller directly from a listing; see all conversations in one place; see unread counts; view history to reference prior agreements.

**Seller (Jamie):** receive buyer messages in Chats; see which listing each conversation is about; know when messages are read to gauge interest.

### 7.2 Conversations List (`/chats`)

1. **Data loading:** fetch conversations in the Server Component on load; show a spinner/skeleton during client refreshes; helpful empty state; pull-to-refresh.
2. **Row display:** other participant's avatar (or colored initials placeholder); participant full name; listing thumbnail (40×40) if tied to a listing; last-message preview (≤50 chars, ellipsis); relative timestamp ("2m ago", "1h ago", "Yesterday", or "Jan 15" if older); unread badge when `unread_count > 0`; subtle background tint on unread rows.
3. **Navigation:** tapping a row → `/chats/[conversationId]`.
4. **Sorting:** by `last_message_at` descending.
5. **Empty state:** "No conversations yet. Start messaging sellers from listing pages!"

### 7.3 Conversation Detail (`/chats/[conversationId]`)

1. **Header:** back button; participant name + avatar; optional listing-context card (thumbnail + title) linking to the listing.
2. **Message list:** chronological (oldest top, newest bottom); auto-scroll to bottom on load and on new message; infinite scroll upward for older messages (paginate via a `before` cursor, 50 at a time).
   - **Sent** (current user): right-aligned, primary-purple background, white text.
   - **Received:** left-aligned, light-gray background, dark text, with a 32×32 sender avatar.
   - Timestamp under each message (relative).
   - Optional "Read" indicator on sent messages when `read_at` is set.
3. **Input:** sticky text input above the keyboard; send button enabled only when there's content. On send: insert the message (Server Action), **optimistically** add it to local state, clear the input, and mark the conversation read for the current user. On error: show a toast and revert the optimistic message.
4. **Read status:** on open, mark unread received messages as read; update the unread count in the list.
5. **Realtime:** subscribe to new `messages` for this conversation so replies appear instantly.

### 7.4 Integration with Listing Detail

The composer's **Send** button:
1. Calls get-or-create conversation (§5.3) with `listing_id`, `seller_uid`, and the typed `initial_message`.
2. The server reuses an existing conversation or creates one, then inserts the message.
3. The client routes to `/chats/[conversationId]`.
4. Shows a loading state while sending; surfaces network/validation errors in plain language.

### 7.5 UI/UX, Accessibility, Performance

- **Color:** primary purple (`#6222B1` / `#8B5CF6`) for sent bubbles; light gray for received. Body 16px, timestamps 14px, metadata 12px.
- **Accessibility:** `aria-label`s on interactive elements; screen-reader-readable message content and timestamps; sensible focus order (input → send → back).
- **Performance:** paginate the conversation list (>50); paginate messages (50 at a time); debounce read-status updates; cache conversation metadata (TanStack Query) to avoid refetch storms.
- **Error handling:** network errors get a retry; clear empty states; skeleton loaders on initial load.

---

## 8. Auth & Security

- **Sign-in methods:** email/password and Google OAuth via Supabase Auth, plus magic links. `/login` handles sign-in and sign-up.
- **Session handling:** `@supabase/ssr` with the `proxy.ts` (Next.js 16) session-refresh step. Create the browser client with `createBrowserClient` and the server client with `createServerClient`; **always create the client inside the request handler**, never at module scope (prevents one user's session leaking into another's request).
- **Authorization:** enforced at the database with **RLS** (§4.2). The UI must never be the only thing stopping an action — assume the client is untrusted. Verify `auth.getUser()` server-side on protected routes; don't rely on middleware alone for auth.
- **Campus verification (v1):** require a `.edu` email at signup, or restrict to UC Berkeley domains. A full verification badge system is a Future Opportunity.
- **Secrets:** the secret/`service_role` key is server-only and must never reach the browser or the repo. Only the publishable/`anon` key is exposed client-side.
- **Input validation:** validate and sanitize all user input server-side (e.g. with Zod) in addition to client-side checks.

---

## 9. Non-Functional Requirements

- **Performance:** keyset pagination + a loading guard prevent duplicate/overlapping fetches. Compress images before upload. Denormalize `thumbnail_url` so the grid never has to join images. Use Next.js `<Image>` for automatic image optimization. Cache seller profiles (TanStack Query) to avoid refetching when moving between listing and profile.
- **Platform dependencies:** runs in any modern mobile or desktop browser; installable as a PWA ("Add to Home Screen"). No native dependencies in v1. Node 20+ for local dev. Vercel + Supabase free tiers cover early usage (Supabase Auth includes 50,000 monthly active users free).
- **Security / Auth:** see [Section 8](#8-auth--security). RLS on every table; secrets server-only; `.edu`-gated signup.
- **Accessibility:** label all interactive elements; correct focus order; sufficient color contrast for purple-on-white; alt text on images. Run an audit before launch.
- **Reliability:** wrap each route in an `error.tsx` boundary; show retryable errors rather than blank screens. Soft-delete (never hard-delete) listings to preserve conversation history.

---

## 10. Environment & Configuration

`.env.local` (never commit; add to `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx   # safe for the browser
SUPABASE_SECRET_KEY=sb_secret_xxx                          # SERVER ONLY — never expose
NEXT_PUBLIC_DEFAULT_CAMPUS=ucberkeley
```

- The old draft's `EXPO_PUBLIC_API_BASE_URL` is **removed** — there is no separate API server; the app talks to Supabase directly.
- For local development you can seed one or two **test profiles + listings** via a SQL seed file in `supabase/migrations/` so screens have data before auth is fully wired.
- Set the same variables in the Vercel project settings for production. Connecting Supabase to Vercel can auto-populate these.

---

## 11. Phased Build Roadmap

Hand Claude Code **one phase at a time**. Each phase is independently runnable and testable. Do not start a phase until the previous phase passes its acceptance criteria (§12).

| Phase | Goal | Key deliverables |
|---|---|---|
| **0 — Scaffold** | An empty app runs locally and deploys | `create-next-app` (TS, Tailwind, App Router); shadcn/ui init; Supabase project created; `.env.local` wired; deploy a "hello" build to Vercel. |
| **1 — Data & Auth** | DB exists; users can sign in | All tables + enums + RLS + the signup→profile trigger as a migration; Supabase clients (`client.ts`, `server.ts`, `proxy.ts`); `/login` with email + Google; auth-gated tab layout; seed data. |
| **2 — Browse** | Buyers can browse | Tab bar; Campus feed grid; keyset infinite scroll; listing card; pull-to-refresh; search/filter. |
| **3 — Sell** | Sellers can manage listings | Create Listing (with image upload to Storage); Your Listings; Update Listing; soft delete with confirm. |
| **4 — Detail & Profiles** | Rich listing + seller info | Listing detail (carousel, action bar, Save, Share); public profile; own profile view/edit; format helpers. |
| **5 — Chats** | Buyers and sellers message | Get-or-create conversation from listing; conversations list; conversation detail with optimistic send; mark-read; **Supabase Realtime** live updates. |
| **6 — Moving & Nearby** | Remaining tabs | Moving tiers (static, "coming soon"); Nearby feed (region-filtered). |
| **7 — Polish & Ship** | Production-ready | PWA manifest + icons; `error.tsx`/`not-found.tsx`; accessibility audit; loading skeletons; `.edu` gating; final Vercel deploy. |

**Suggested prompt pattern for each phase:**
> "We're on **Phase N** of the Handdown PRD. Here is the PRD [paste]. Build only Phase N. Use the stack and conventions in Sections 3–5. After you build it, list exactly how I verify it against the Phase N acceptance criteria, and stop."

---

## 12. Definition of Done / Acceptance Criteria

**Phase 0:** `npm run dev` serves a page at `localhost:3000`; a Supabase project exists; env vars load; a build is live on a Vercel URL.

**Phase 1:** running the migration creates all tables with RLS enabled; signing up creates an `auth.users` row **and** a matching `profiles` row automatically; an unauthenticated visit to a tab route redirects to `/login`; seed listings exist in the DB.

**Phase 2:** the Campus feed renders seeded listings in a 2-column grid; scrolling loads more without duplicates or gaps; pull-to-refresh resets to top; search narrows results; tapping a card navigates to a (placeholder is fine) detail route.

**Phase 3:** a logged-in user can publish a listing with 1–10 photos that appears in the feed and in Your Listings; validation blocks bad input; editing changes only modified fields; deleting hides the listing (status `deleted`) after a confirm dialog; a user cannot edit/delete someone else's listing (verify RLS by trying).

**Phase 4:** detail page shows the carousel, description, working Save and Share, and a seller card linking to the public profile; own profile is editable and persists.

**Phase 5:** pressing Send on a listing creates exactly one conversation (pressing twice does not duplicate it) and routes to it; messages send optimistically and persist; opening a conversation marks it read and clears its unread badge; a message sent from a second browser/account appears in the open conversation **without a manual refresh** (Realtime).

**Phase 6:** Moving shows three tiers; Nearby shows a region-filtered feed; no template/starter content remains.

**Phase 7:** the app is installable to a phone home screen; unknown routes show the not-found page; thrown errors show a retry boundary, not a white screen; signup requires a `.edu` email; production deploy is green.

---

## 13. Future Opportunities

- Analytics for listing impressions and conversions.
- Saved searches, push notifications, and verification badges.
- A mover marketplace backend with scheduling and matching in the Moving tab.
- A real offers/bids system (replacing the v1 "Bid = pre-filled message").
- In-conversation message search; image/file sharing in messages; typing indicators; message reactions.
- Map view for Nearby.
- Multi-campus rollout (the `campus` column already supports it).
- Native app-store builds via Capacitor (no rewrite required).
- Read receipts and ratings/reviews after completed transactions.
