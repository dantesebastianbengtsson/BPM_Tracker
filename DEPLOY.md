# Deploying BPM Tracker

BPM Tracker is a static Angular SPA backed by **Supabase** (Auth + Postgres).
There is no server to run — the Java `backend/` is retired and kept only for
reference.

## Requirements
- Node 18+ and npm (to build the frontend)
- A Supabase project (schema/RLS in
  `docs/superpowers/specs/2026-05-30-supabase-cloud-storage-design.md`)

## Configure
Set your project URL + anon key in `frontend/src/environments/environment.ts`.
The anon key is public by design — Row-Level Security is the security boundary.

## Build
```bash
cd frontend
npm install
npm run build      # output in frontend/dist/frontend/browser
```

## Run locally
```bash
cd frontend
npm start          # http://localhost:4200
```

## Host
Deploy `frontend/dist/frontend/browser` to any static host (Vercel, Netlify,
Cloudflare Pages, GitHub Pages, or Supabase hosting). `frontend/vercel.json`
already configures the SPA fallback for Vercel.

Data lives in Supabase; each user sees only their own folders/songs/parts
(enforced by Row-Level Security). Email confirmation is disabled, so signups log
in immediately.
