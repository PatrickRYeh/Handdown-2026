# Handdown — Setup Guide

This walks you through the parts only you can do (creating accounts). The app
code is already written. Follow these in order.

---

## Run the app locally (works right now)

```bash
npm run dev
```

Open http://localhost:3000. You'll see the Handdown status page. The third
checkmark is gray until you connect Supabase below.

---

## Phase 0 — Connect Supabase (do this once)

### 1. Create the project

1. Go to https://supabase.com and sign up (free tier is plenty).
2. Click **New project**.
   - **Name:** `handdown`
   - **Database password:** generate a strong one and save it in your password
     manager. You won't need it day-to-day, but don't lose it.
   - **Region:** pick the one closest to you (e.g. *West US*).
3. Wait ~2 minutes for it to provision.

### 2. Create the database

1. In the left sidebar, open **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this project, copy the whole
   file, paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned." Open **Table Editor** and confirm
   you see `profiles`, `listings`, `messages`, etc.

### 3. Copy your keys into the app

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. Copy these three values into `.env.local` (replace the placeholders):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`, or the `anon` key if that's what
     you see) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_…`, or the `service_role` key) →
     `SUPABASE_SECRET_KEY`
3. Save `.env.local`, stop the dev server (Ctrl+C), and run `npm run dev` again.
   Env vars are only read at startup, so a restart is required.

The status page's third checkmark should now be green.

### 4. Turn on email login

1. Supabase → **Authentication** → **Sign In / Providers**.
2. Make sure **Email** is enabled.
3. For easy local testing, go to **Authentication → Providers → Email** and turn
   **Confirm email** OFF for now (so you can sign up without clicking a
   confirmation link). Turn it back on before launch.

> Google sign-in and `.edu`-only signup come later (Phases 1 and 7). Email is
> all we need to start.

---

## What to tell Claude Code next

Once the third checkmark is green, say **"Supabase is connected, build Phase 1"**
and we'll wire up login, the auth-gated app shell, and seed data.

---

## Later: deploy to the internet (end of Phase 0 / Phase 7)

1. Push this project to a new GitHub repo.
2. Go to https://vercel.com, sign in with GitHub, **Add New → Project**, import
   the repo.
3. In Vercel's project settings, add the same four variables from `.env.local`.
4. Deploy. Every future `git push` redeploys automatically.
