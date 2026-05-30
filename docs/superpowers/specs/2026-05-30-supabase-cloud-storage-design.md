# BPM Tracker — Cloud Storage on Supabase (with Accounts)

**Date:** 2026-05-30
**Status:** Approved design, ready for implementation planning

## 1. Goal

Move BPM Tracker's data from a local, single-machine H2 database to the cloud so
that the app supports **user accounts with private per-user data**, accessible
from any device. Sharing between users is explicitly a *future* feature.

## 2. Approved decisions

- **Architecture:** Angular SPA talks **directly to Supabase**. The Spring Boot
  backend is **retired** (left in the repo for reference, removed from the
  build/run path).
- **Auth:** Supabase Auth, **email + password**, with **email confirmation
  disabled** (instant login for this learning app).
- **Privacy:** Postgres **Row-Level Security** scopes every row to its owner.
- **Supabase setup:** provisioned and configured via the **Supabase MCP**.
- **Migration:** none — **start with an empty database**. (The previous local H2
  data is not carried over.)
- **Hosting:** the app becomes a pure static site, deployable to any static host
  later. Hosting choice is out of scope for this spec.

## 3. Architecture overview

```
┌──────────────┐     supabase-js      ┌─────────────────────────────┐
│ Angular SPA  │  ───────────────────▶│ Supabase                    │
│              │   auth + CRUD        │  • Auth (email/password)    │
│  AuthService │◀──── session ────────│  • Postgres + RLS           │
│  ApiService  │                      │  • auto REST via PostgREST  │
│  Store       │                      └─────────────────────────────┘
│  components  │
└──────────────┘
```

- No server code to write or host.
- `supabase-js` client is created once with the project URL + anon key.

## 4. Database schema

UUID primary keys (default `gen_random_uuid()`), `user_id` defaults to
`auth.uid()`, timestamps for ordering.

```sql
create table folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table songs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  folder_id  uuid references folders(id) on delete set null,
  title      text not null check (char_length(title) between 1 and 120),
  goal_bpm   int  not null check (goal_bpm between 20 and 260),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table parts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  song_id     uuid not null references songs(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  working_bpm int  not null default 60 check (working_bpm between 20 and 260),
  total_bars  int  not null default 1  check (total_bars between 1 and 999),
  learnt_bars int  not null default 0  check (learnt_bars between 0 and 999),
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index on songs(user_id);
create index on parts(song_id);
```

**Cascade behaviour (matches today):**
- Delete folder → its songs' `folder_id` becomes `null` (songs are "unfiled").
- Delete song → its parts are deleted.
- Delete user → all their rows are deleted.

**Not stored (derived in client, same as today):**
- `learntState` of a part.
- `songCount` per folder, `partCount` / `learntPartCount` per song.

### Row-Level Security

```sql
alter table folders enable row level security;
alter table songs   enable row level security;
alter table parts   enable row level security;

-- One policy per table; identical shape:
create policy "own rows" on folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on songs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on parts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

The anon key shipped in the client is public by design; RLS is the security
boundary.

## 5. Preserved business rules (ported to the client)

These currently live in the Java backend and must be reproduced exactly:

- **`learntStateOf(part)`**
  - `learnt_bars <= 0 || total_bars <= 0` → `UNLEARNT`
  - `learnt_bars >= total_bars` → `LEARNT`
  - otherwise → `LEARNING`
- **`adjustBars(part, delta)`**: `learnt_bars = clamp(learnt_bars + delta, 0, total_bars)`.
- **Update part**: after changing `total_bars`, if `learnt_bars > total_bars`,
  clamp `learnt_bars = total_bars`.
- **Create part**: `learnt_bars = 0`, `position = <count of existing parts in song>`.
- **Create folder/song**: `position = <count of existing siblings>`.
- **Ordering**: parts ordered by `position asc, created_at asc`. Same for
  folders/songs lists.
- **Trim** `title`/`name` on create/update.
- **Validation ranges** (enforced both client-side and by DB CHECK constraints):
  working_bpm 20–260, total_bars 1–999, learnt_bars 0–999, goal_bpm 20–260,
  titles/names 1–120 chars.

## 6. Client design

### 6.1 `ApiService` rewrite (the only data-layer change)

Keep the **exact same public method signatures** so `Store` and all components
are untouched. Replace each `HttpClient` call with a `supabase-js` call and map
DB rows → the existing `Folder`/`Song`/`Part` models (computing derived fields).

| Method | Supabase implementation |
|---|---|
| `listFolders()` | `from('folders').select().order('position').order('created_at')`; attach `songCount` from a songs count |
| `createFolder(body)` | insert `{ name }` (position computed), return mapped row |
| `renameFolder(id, body)` | `update({ name }).eq('id', id)` |
| `deleteFolder(id)` | `delete().eq('id', id)` (DB sets child songs' folder_id null) |
| `listSongs({folderId,unfiled})` | `select()` with `.is('folder_id', null)` (unfiled) or `.eq('folder_id', id)` or all; compute `partCount`/`learntPartCount` |
| `createSong(body)` | insert `{ title, goal_bpm, folder_id }` (position computed) |
| `updateSong(id, body)` | `update(...).eq('id', id)` |
| `deleteSong(id)` | `delete().eq('id', id)` (parts cascade) |
| `listParts(songId)` | `select().eq('song_id', songId).order('position').order('created_at')` |
| `createPart(songId, body)` | insert with computed position, `learnt_bars=0` |
| `updatePart(id, body)` | fetch/update with the clamp rule |
| `deletePart(id)` | `delete().eq('id', id)` |
| `adjustBars(id, delta)` | read current bars, apply clamp, update |

Counts: computed with lightweight queries or by deriving from already-loaded
arrays in `Store` (which already does `refreshSongCountsFor`). Implementation
plan will pick the simplest that avoids N+1 (e.g. one `select` of all songs/parts
on load).

`learntState` is computed in the row-mapping helper, not stored.

### 6.2 `AuthService` (new)

- Wraps the supabase client's auth: `signUp`, `signInWithPassword`, `signOut`,
  and a signal `session`/`user` reflecting current auth state
  (`onAuthStateChange`).
- Exposes `isAuthenticated` signal for gating.

### 6.3 App gating + login UI (new)

- A **login/signup component** (single form: email, password, toggle
  sign-in/sign-up). Shows Supabase auth errors inline.
- The existing workspace renders only when `isAuthenticated()` is true; otherwise
  the login component shows. (Implemented via a top-level conditional and/or a
  route guard — plan decides.)
- A **logout** control in the existing UI shell.
- Session persists across reloads (supabase-js default local storage).

### 6.4 Configuration

- `environment.ts` / `environment.development.ts` gain `supabaseUrl` and
  `supabaseAnonKey`.
- A single `supabaseClient` provider creates the client.

## 7. Retiring the Spring Boot backend

- Remove the dev proxy (`frontend/proxy.conf.json`) usage and the `/api` rewrite
  in `frontend/vercel.json` (no backend to proxy to).
- The Angular app no longer needs `HttpClient` for data (kept only if used
  elsewhere).
- Leave `backend/` source in the repo but drop it from build/run docs; update
  `DEPLOY.md` to describe the static-SPA + Supabase model.
- `build.sh`/`build.bat` and the bundled `static/` approach become obsolete for
  the cloud model; plan will update or remove them.

## 8. Error handling

- supabase-js returns `{ data, error }`. `ApiService` checks `error` and throws,
  so the existing `Store` async flows surface failures (unchanged pattern).
- Auth failures (bad credentials, duplicate email) shown inline on the login
  form.
- A minimal global error surface (toast or inline banner) for unexpected
  data/network errors. Detailed UX is plan-level.

## 9. Testing strategy

- **Unit tests (pure functions, no network):** `learntStateOf`, `adjustBars`
  clamping, total/learnt count derivation, position computation.
- **Manual E2E against the Supabase project:**
  1. Sign up → land in empty workspace.
  2. Create folder, song, part; adjust bars; verify `learntState` transitions.
  3. Reload → data persists.
  4. Sign out / sign up as a second user → sees an empty workspace (RLS verified:
     user A's data is invisible to user B).
  5. Delete folder → songs become unfiled; delete song → parts gone.

## 10. Prerequisites / setup tasks

- Authenticate the **Supabase MCP**; create a project.
- Run the schema + RLS SQL (Section 4).
- Disable email confirmation in Auth settings.
- Put the project URL + anon key into Angular environment files.

## 11. Out of scope (future)

- Selective sharing of folders/songs between users (the `user_id` + RLS model
  makes this a clean later addition: add a `shares` table + extended policies).
- Drag-and-drop reordering.
- Password reset / email flows.
- Choosing and configuring a static host for deployment.
