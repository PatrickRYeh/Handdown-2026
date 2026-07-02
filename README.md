# Handdown

A campus-focused marketplace for university students to buy, sell, and move
second-hand goods safely within a trusted community. Launch campus: UC Berkeley.

- **Product spec:** [`handdown-prd-v1.0.md`](./handdown-prd-v1.0.md)
- **Setup / account steps:** [`SETUP.md`](./SETUP.md)

## Stack

Next.js 16 (App Router, TypeScript, Turbopack) · Tailwind CSS · Supabase
(Postgres + Auth + Storage + Realtime) · TanStack Query · Zod · deployed on
Vercel.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Then follow [`SETUP.md`](./SETUP.md) to connect your Supabase project.

## Project layout

```
app/                 # routes (App Router)
components/          # shared UI
lib/
  supabase/         # browser + server clients, session-refresh helper
  types.ts          # shared types (mirror the DB)
  format.ts         # price/date/rating helpers
supabase/migrations # SQL schema & RLS — source of truth for the database
```

## Build roadmap

Built in phases (see PRD §11). Each phase is independently runnable and verified
against its acceptance criteria before the next begins.

| Phase | Status | Goal |
|---|---|---|
| 0 — Scaffold | ✅ code done | App runs locally; Supabase wiring ready |
| 1 — Data & Auth | ⬜ | DB migration, login, auth-gated shell, seed |
| 2 — Browse | ⬜ | Campus feed, infinite scroll, search |
| 3 — Sell | ⬜ | Create/edit/delete listings + image upload |
| 4 — Detail & Profiles | ⬜ | Listing detail, save/share, profiles |
| 5 — Chats | ⬜ | Conversations + realtime messaging |
| 6 — Moving & Nearby | ⬜ | Remaining tabs |
| 7 — Polish & Ship | ⬜ | PWA, a11y, .edu gating, deploy |
