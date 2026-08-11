# Song Metadata + Per-Part BPM Goal

**Date:** 2026-06-20

## Summary

Move `goalBpm` from the song level down to each individual part. Add `artist`, `album`, and `key` metadata fields to songs. Show average working BPM (across parts) on the song card as the song-level BPM summary.

---

## Data Layer

### Supabase migrations required (run manually)

```sql
-- 1. Add metadata columns to songs
ALTER TABLE songs
  ADD COLUMN artist TEXT,
  ADD COLUMN album  TEXT,
  ADD COLUMN key    TEXT;

-- 2. Move goal_bpm from songs to parts
ALTER TABLE parts ADD COLUMN goal_bpm INTEGER NOT NULL DEFAULT 80;
ALTER TABLE songs DROP COLUMN goal_bpm;
```

### TypeScript models

**`SongRow` (db-types.ts)**
- Remove `goal_bpm`
- Add `artist: string | null`, `album: string | null`, `key: string | null`

**`Song` (models.ts)**
- Remove `goalBpm`
- Add `artist: string | null`, `album: string | null`, `key: string | null`
- Add `avgBpm: number | null` — computed at fetch time as mean of parts' `working_bpm`; null when song has no parts

**`SongUpsert` (models.ts)**
- Remove `goalBpm`
- Add `artist: string | null`, `album: string | null`, `key: string | null`

**`PartRow` (db-types.ts)**
- Add `goal_bpm: number`

**`Part` (models.ts)**
- Add `goalBpm: number`

**`PartUpsert` (models.ts)**
- Add `goalBpm: number`

---

## API Service

- `fetchSongs`: expand the parts sub-query to include `working_bpm`; compute `avgBpm` as `Math.round(sum / count)` or `null`
- `insertSong` / `patchSong`: pass `artist`, `album`, `key`; remove `goal_bpm`
- `insertPart` / `patchPart`: pass `goal_bpm`; on create, default `workingBpm` to `goalBpm`

---

## Song Pane (Library)

### Song card (view mode)

```
[song-title]              [artist]    [edit] [trash]
[key]
[avg X BPM] · [N/M parts learnt]
[progress bar]
```

- `artist` is displayed to the right of the title, muted style
- `key` is displayed under the title, smaller/muted
- `album` is stored but not shown in the card (appears in edit form only)
- avg BPM shows "— BPM" when no parts exist yet

### Create / Edit form

New fields added below the title input:
- Artist (text, optional)
- Album (text, optional)
- Key (text, optional, e.g. "Am", "G")

Goal BPM field removed entirely.

---

## Workspace

### Part card (sidebar list)

No change to display — already shows `working_bpm`.

### Part create form

Add **Goal BPM** number field (default 80). The part is created with `workingBpm` set to `goalBpm`.

### Part edit form (hero section)

Add **Goal BPM** number field alongside Title and Total bars.

### BPM footer line

Change from song-level:
```
Goal {{ song().goalBpm }} BPM · At/Below goal
```
To part-level:
```
Goal {{ p.goalBpm }} BPM · At goal / Below goal by N BPM
```

---

## Mapper (`mappers.ts`)

`toSong` signature gains `avgBpm: number | null` parameter.
`toPart` maps `row.goal_bpm → part.goalBpm`.

---

## Out of scope

- No sorting or filtering by key/artist/album
- No autocomplete for key values
- Album not shown in song card view (edit form only)
