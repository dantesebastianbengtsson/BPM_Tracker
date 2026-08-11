-- Add song metadata (artist/album/key) and per-part goal BPM.
-- Matches the columns the frontend reads/writes in db-types.ts.
-- Idempotent so it is safe to re-run.

alter table public.songs add column if not exists artist text;
alter table public.songs add column if not exists album  text;
alter table public.songs add column if not exists key    text;

alter table public.parts add column if not exists goal_bpm integer not null default 80;
-- Backfill existing rows to their current working BPM so they look sensible.
update public.parts set goal_bpm = working_bpm where goal_bpm = 80;
