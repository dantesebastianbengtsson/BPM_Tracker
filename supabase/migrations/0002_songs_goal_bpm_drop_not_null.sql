-- Fix: song creation fails with 23502 against the live database.
--
-- goal_bpm moved from songs to parts (see 0001), and createSong() in
-- api.service.ts no longer sends it — but songs.goal_bpm was left NOT NULL,
-- so every insert violates the constraint:
--
--   {code: 23502, message: null value in column "goal_bpm" of relation
--    "songs" violates not-null constraint}
--
-- Non-destructive on purpose: this only relaxes the constraint, so existing
-- per-song goal_bpm values are preserved. Nothing reads the column today
-- (SongRow in db-types.ts has no goal_bpm). Dropping it entirely is a
-- separate, irreversible decision — see the commented statement at the end.
--
-- Idempotent — safe to re-run.

alter table public.songs alter column goal_bpm drop not null;

-- Optional follow-up, once you're sure the historical per-song goals are not
-- wanted. Irreversible — data is gone. Left commented deliberately.
--
-- alter table public.songs drop column if exists goal_bpm;
