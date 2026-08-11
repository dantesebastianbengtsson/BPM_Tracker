-- BPM Tracker — full schema bootstrap for a fresh Supabase project.
--
-- Consolidates the design in
--   docs/superpowers/specs/2026-05-30-supabase-cloud-storage-design.md
-- with the columns added by 0001_song_metadata_and_goal_bpm.sql, so a new
-- project can be stood up with a single run. Idempotent — safe to re-run.
--
-- NOTE: this deliberately differs from Section 4 of the design doc in one place.
-- The doc declares `songs.goal_bpm int not null` (no default), but the frontend
-- moved goal_bpm to `parts` and createSong() never sends it — see db-types.ts
-- (SongRow has no goal_bpm) and api.service.ts. Keeping the doc's column would
-- make every song insert fail on a not-null violation. Source of truth is the code.

create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  folder_id  uuid references public.folders(id) on delete set null,
  title      text not null check (char_length(title) between 1 and 120),
  artist     text,
  album      text,
  key        text,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.parts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  song_id     uuid not null references public.songs(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  goal_bpm    int  not null default 80 check (goal_bpm between 20 and 260),
  working_bpm int  not null default 60 check (working_bpm between 20 and 260),
  total_bars  int  not null default 1  check (total_bars between 1 and 999),
  learnt_bars int  not null default 0  check (learnt_bars between 0 and 999),
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists songs_user_id_idx on public.songs(user_id);
create index if not exists parts_song_id_idx on public.parts(song_id);
create index if not exists folders_user_id_idx on public.folders(user_id);

-- Row-Level Security: the anon key is public by design, RLS is the boundary.
alter table public.folders enable row level security;
alter table public.songs   enable row level security;
alter table public.parts   enable row level security;

drop policy if exists "own rows" on public.folders;
create policy "own rows" on public.folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on public.songs;
create policy "own rows" on public.songs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on public.parts;
create policy "own rows" on public.parts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
