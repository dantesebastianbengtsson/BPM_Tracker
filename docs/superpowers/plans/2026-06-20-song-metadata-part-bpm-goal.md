# Song Metadata + Per-Part BPM Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move goalBpm from song to part level, add artist/album/key to songs, and show average working BPM on song cards.

**Architecture:** Data layer changes flow outward — types → mappers → API → store → UI. Each task leaves compilable code; the test suite passes by Task 5.

**Tech Stack:** Angular 17 (standalone components, signals), Supabase (PostgreSQL), TypeScript, Karma/Jasmine

---

## Files Modified

| File | Change |
|---|---|
| `frontend/src/app/core/db-types.ts` | SongRow: remove goal_bpm, add artist/album/key; PartRow: add goal_bpm |
| `frontend/src/app/core/models.ts` | Song: add artist/album/key/avgBpm, remove goalBpm; SongUpsert: same; Part/PartUpsert: add goalBpm |
| `frontend/src/app/core/derive.ts` | Add avgWorkingBpm helper |
| `frontend/src/app/core/derive.spec.ts` | Tests for avgWorkingBpm |
| `frontend/src/app/core/mappers.ts` | toSong: new sig + fields; toPart: add goalBpm |
| `frontend/src/app/core/mappers.spec.ts` | Update all mapper tests |
| `frontend/src/app/core/api.service.ts` | fetchSongs: fetch working_bpm, compute avgBpm; song insert/update: new fields; part insert/update: goal_bpm |
| `frontend/src/app/core/store.service.ts` | refreshSongCountsFor: also recompute avgBpm; replace bumpSongCounts with refreshSongCountsFor |
| `frontend/src/app/panes/song-pane.component.ts` | Replace goalBpm signals with artist/album/key signals |
| `frontend/src/app/panes/song-pane.component.html` | Card: show artist+key+avgBpm; forms: artist/album/key fields |
| `frontend/src/app/panes/song-pane.component.scss` | Add song-title-row, song-artist, song-key, song-fields styles |
| `frontend/src/app/panes/workspace.component.ts` | Add goalBpm signals; pass goalBpm in all PartUpsert calls |
| `frontend/src/app/panes/workspace.component.html` | Part create/edit: add Goal BPM field; bpm-foot: use p.goalBpm |

---

## Task 1: Supabase migration (manual)

**Files:** None (run in Supabase SQL editor)

- [ ] **Step 1: Run migration in Supabase dashboard**

Open your Supabase project → SQL Editor → New query. Paste and run:

```sql
-- Add metadata to songs, remove song-level goal
ALTER TABLE songs
  ADD COLUMN artist TEXT,
  ADD COLUMN album  TEXT,
  ADD COLUMN key    TEXT;

ALTER TABLE songs DROP COLUMN goal_bpm;

-- Add per-part goal
ALTER TABLE parts ADD COLUMN goal_bpm INTEGER NOT NULL DEFAULT 80;
```

- [ ] **Step 2: Verify in Table Editor**

Check that `songs` has `artist`, `album`, `key` columns and no `goal_bpm`.
Check that `parts` has `goal_bpm` column.

---

## Task 2: Add `avgWorkingBpm` helper (TDD)

**Files:**
- Modify: `frontend/src/app/core/derive.ts`
- Modify: `frontend/src/app/core/derive.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `derive.spec.ts` (below existing tests):

```typescript
import { learntStateOf, clampLearntBars, countLearntParts, nextPosition, avgWorkingBpm } from './derive';

// ... existing tests unchanged ...

describe('avgWorkingBpm', () => {
  it('returns null when parts array is empty', () => {
    expect(avgWorkingBpm([])).toBeNull();
  });
  it('returns the single value when there is one part', () => {
    expect(avgWorkingBpm([{ workingBpm: 90 }])).toBe(90);
  });
  it('returns the rounded mean of multiple parts', () => {
    expect(avgWorkingBpm([{ workingBpm: 80 }, { workingBpm: 90 }, { workingBpm: 85 }])).toBe(85);
  });
  it('rounds 0.5 up', () => {
    expect(avgWorkingBpm([{ workingBpm: 80 }, { workingBpm: 81 }])).toBe(81);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx ng test --include='**/derive.spec.ts' --watch=false
```

Expected: 4 new failures — `avgWorkingBpm is not a function`

- [ ] **Step 3: Implement avgWorkingBpm in derive.ts**

Append to `frontend/src/app/core/derive.ts`:

```typescript
export function avgWorkingBpm(parts: { workingBpm: number }[]): number | null {
  if (!parts.length) return null;
  return Math.round(parts.reduce((sum, p) => sum + p.workingBpm, 0) / parts.length);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd frontend && npx ng test --include='**/derive.spec.ts' --watch=false
```

Expected: all derive tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/derive.ts frontend/src/app/core/derive.spec.ts
git commit -m "feat: add avgWorkingBpm helper"
```

---

## Task 3: Update TypeScript types

**Files:**
- Modify: `frontend/src/app/core/db-types.ts`
- Modify: `frontend/src/app/core/models.ts`

> Note: these changes will temporarily break mapper tests (fixed in Task 4).

- [ ] **Step 1: Replace db-types.ts**

Replace the full content of `frontend/src/app/core/db-types.ts`:

```typescript
export interface FolderRow {
  id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface SongRow {
  id: string;
  folder_id: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  key: string | null;
  position: number;
  created_at: string;
}

export interface PartRow {
  id: string;
  song_id: string;
  title: string;
  goal_bpm: number;
  working_bpm: number;
  total_bars: number;
  learnt_bars: number;
  position: number;
  created_at: string;
}
```

- [ ] **Step 2: Replace models.ts**

Replace the full content of `frontend/src/app/core/models.ts`:

```typescript
export type LearntState = 'UNLEARNT' | 'LEARNING' | 'LEARNT';

export interface Folder {
  id: string;
  name: string;
  position: number;
  songCount: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  key: string | null;
  avgBpm: number | null;
  folderId: string | null;
  position: number;
  partCount: number;
  learntPartCount: number;
}

export interface Part {
  id: string;
  songId: string;
  title: string;
  goalBpm: number;
  workingBpm: number;
  totalBars: number;
  learntBars: number;
  learntState: LearntState;
  position: number;
}

export interface FolderUpsert {
  name: string;
}

export interface SongUpsert {
  title: string;
  artist: string | null;
  album: string | null;
  key: string | null;
  folderId: string | null;
}

export interface PartUpsert {
  title: string;
  goalBpm: number;
  workingBpm: number;
  totalBars: number;
}
```

---

## Task 4: Update mappers (TDD)

**Files:**
- Modify: `frontend/src/app/core/mappers.ts`
- Modify: `frontend/src/app/core/mappers.spec.ts`

- [ ] **Step 1: Replace mappers.spec.ts with updated tests**

Replace the full content of `frontend/src/app/core/mappers.spec.ts`:

```typescript
import { toFolder, toSong, toPart } from './mappers';
import { FolderRow, SongRow, PartRow } from './db-types';

describe('toFolder', () => {
  it('maps row and attaches songCount', () => {
    const row: FolderRow = { id: 'f1', name: 'Rock', position: 0, created_at: 't' };
    expect(toFolder(row, 4)).toEqual({ id: 'f1', name: 'Rock', position: 0, songCount: 4 });
  });
});

describe('toSong', () => {
  it('maps snake_case to camelCase, attaches counts and avgBpm', () => {
    const row: SongRow = {
      id: 's1', folder_id: 'f1', title: 'Song',
      artist: 'Bach', album: 'WTC', key: 'Cm',
      position: 2, created_at: 't',
    };
    expect(toSong(row, 5, 3, 95)).toEqual({
      id: 's1', title: 'Song', artist: 'Bach', album: 'WTC', key: 'Cm',
      avgBpm: 95, folderId: 'f1', position: 2,
      partCount: 5, learntPartCount: 3,
    });
  });

  it('accepts null metadata and null avgBpm', () => {
    const row: SongRow = {
      id: 's2', folder_id: null, title: 'Untitled',
      artist: null, album: null, key: null,
      position: 0, created_at: 't',
    };
    expect(toSong(row, 0, 0, null)).toMatchObject({
      artist: null, album: null, key: null, avgBpm: null,
    });
  });
});

describe('toPart', () => {
  it('maps row, includes goalBpm, and derives learntState', () => {
    const row: PartRow = {
      id: 'p1', song_id: 's1', title: 'Intro',
      goal_bpm: 100, working_bpm: 90,
      total_bars: 8, learnt_bars: 8, position: 0, created_at: 't',
    };
    expect(toPart(row)).toEqual({
      id: 'p1', songId: 's1', title: 'Intro',
      goalBpm: 100, workingBpm: 90,
      totalBars: 8, learntBars: 8, learntState: 'LEARNT', position: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx ng test --include='**/mappers.spec.ts' --watch=false
```

Expected: failures because mappers.ts still has old signatures

- [ ] **Step 3: Replace mappers.ts**

Replace the full content of `frontend/src/app/core/mappers.ts`:

```typescript
import { Folder, Song, Part } from './models';
import { FolderRow, SongRow, PartRow } from './db-types';
import { learntStateOf } from './derive';

export function toFolder(row: FolderRow, songCount: number): Folder {
  return { id: row.id, name: row.name, position: row.position, songCount };
}

export function toSong(
  row: SongRow,
  partCount: number,
  learntPartCount: number,
  avgBpm: number | null,
): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    key: row.key,
    avgBpm,
    folderId: row.folder_id,
    position: row.position,
    partCount,
    learntPartCount,
  };
}

export function toPart(row: PartRow): Part {
  return {
    id: row.id,
    songId: row.song_id,
    title: row.title,
    goalBpm: row.goal_bpm,
    workingBpm: row.working_bpm,
    totalBars: row.total_bars,
    learntBars: row.learnt_bars,
    learntState: learntStateOf(row.learnt_bars, row.total_bars),
    position: row.position,
  };
}
```

- [ ] **Step 4: Run all unit tests**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all tests PASS (derive + mappers)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/db-types.ts frontend/src/app/core/models.ts \
        frontend/src/app/core/mappers.ts frontend/src/app/core/mappers.spec.ts
git commit -m "feat: update types and mappers for song metadata + per-part goalBpm"
```

---

## Task 5: Update API service

**Files:**
- Modify: `frontend/src/app/core/api.service.ts`

- [ ] **Step 1: Update imports**

Replace the derive import line at the top of `api.service.ts`:

Old:
```typescript
import { clampLearntBars, countLearntParts, nextPosition } from './derive';
```

New:
```typescript
import { clampLearntBars, countLearntParts, nextPosition, avgWorkingBpm } from './derive';
```

- [ ] **Step 2: Replace fetchSongs**

Replace the `fetchSongs` private method:

```typescript
private async fetchSongs(opts?: { folderId?: string | null; unfiled?: boolean }): Promise<Song[]> {
  let query = this.sb.from('songs').select('*').order('position').order('created_at');
  if (opts?.unfiled) query = query.is('folder_id', null);
  else if (opts?.folderId) query = query.eq('folder_id', opts.folderId);
  const { data: songs, error } = await query;
  if (error) throw error;
  const songRows = (songs ?? []) as SongRow[];

  const { data: parts, error: partErr } = await this.sb
    .from('parts').select('song_id, total_bars, learnt_bars, working_bpm');
  if (partErr) throw partErr;
  const partRows = (parts ?? []) as {
    song_id: string; total_bars: number; learnt_bars: number; working_bpm: number;
  }[];

  return songRows.map(s => {
    const own = partRows.filter(p => p.song_id === s.id)
      .map(p => ({ totalBars: p.total_bars, learntBars: p.learnt_bars, workingBpm: p.working_bpm }));
    return toSong(s, own.length, countLearntParts(own), avgWorkingBpm(own));
  });
}
```

- [ ] **Step 3: Replace insertSong**

```typescript
private async insertSong(body: SongUpsert): Promise<Song> {
  const { count } = await this.sb
    .from('songs').select('*', { count: 'exact', head: true });
  const { data, error } = await this.sb
    .from('songs')
    .insert({
      title: body.title.trim(),
      artist: body.artist ?? null,
      album: body.album ?? null,
      key: body.key ?? null,
      folder_id: body.folderId,
      position: nextPosition(count ?? 0),
    })
    .select().single();
  if (error) throw error;
  return toSong(data as SongRow, 0, 0, null);
}
```

- [ ] **Step 4: Replace patchSong**

```typescript
private async patchSong(id: string, body: SongUpsert): Promise<Song> {
  const { data, error } = await this.sb
    .from('songs')
    .update({
      title: body.title.trim(),
      artist: body.artist ?? null,
      album: body.album ?? null,
      key: body.key ?? null,
      folder_id: body.folderId,
    })
    .eq('id', id).select().single();
  if (error) throw error;
  const { data: parts, error: partErr } = await this.sb
    .from('parts').select('total_bars, learnt_bars, working_bpm').eq('song_id', id);
  if (partErr) throw partErr;
  const own = ((parts ?? []) as { total_bars: number; learnt_bars: number; working_bpm: number }[])
    .map(p => ({ totalBars: p.total_bars, learntBars: p.learnt_bars, workingBpm: p.working_bpm }));
  return toSong(data as SongRow, own.length, countLearntParts(own), avgWorkingBpm(own));
}
```

- [ ] **Step 5: Replace insertPart**

```typescript
private async insertPart(songId: string, body: PartUpsert): Promise<Part> {
  const { count } = await this.sb
    .from('parts').select('*', { count: 'exact', head: true }).eq('song_id', songId);
  const { data, error } = await this.sb
    .from('parts')
    .insert({
      song_id: songId,
      title: body.title.trim(),
      goal_bpm: body.goalBpm,
      working_bpm: body.workingBpm,
      total_bars: body.totalBars,
      learnt_bars: 0,
      position: nextPosition(count ?? 0),
    })
    .select().single();
  if (error) throw error;
  return toPart(data as PartRow);
}
```

- [ ] **Step 6: Replace patchPart**

```typescript
private async patchPart(id: string, body: PartUpsert): Promise<Part> {
  const { data: current, error: readErr } = await this.sb
    .from('parts').select('learnt_bars').eq('id', id).single();
  if (readErr) throw readErr;
  const learnt = clampLearntBars((current as { learnt_bars: number }).learnt_bars, body.totalBars);
  const { data, error } = await this.sb
    .from('parts')
    .update({
      title: body.title.trim(),
      goal_bpm: body.goalBpm,
      working_bpm: body.workingBpm,
      total_bars: body.totalBars,
      learnt_bars: learnt,
    })
    .eq('id', id).select().single();
  if (error) throw error;
  return toPart(data as PartRow);
}
```

- [ ] **Step 7: Run all unit tests**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all tests PASS (TypeScript compile errors in components are acceptable at this stage — the test suite only covers derive + mappers)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/core/api.service.ts
git commit -m "feat: update API service for song metadata + per-part goalBpm"
```

---

## Task 6: Update store service

**Files:**
- Modify: `frontend/src/app/core/store.service.ts`

- [ ] **Step 1: Add derive import**

Add to the import block at the top of `store.service.ts`:

```typescript
import { avgWorkingBpm } from './derive';
```

- [ ] **Step 2: Replace refreshSongCountsFor and remove bumpSongCounts**

Replace the two private methods at the bottom of the class:

Old:
```typescript
private bumpSongCounts(songId: string) {
  this.songs.update(list => list.map(s => s.id === songId
    ? { ...s, partCount: s.partCount + 1 }
    : s));
}

private refreshSongCountsFor(songId: string) {
  const total = this.parts().filter(p => p.songId === songId).length;
  const learnt = this.parts().filter(p => p.songId === songId && p.learntState === 'LEARNT').length;
  this.songs.update(list => list.map(s => s.id === songId
    ? { ...s, partCount: total, learntPartCount: learnt }
    : s));
}
```

New (replace with single method):
```typescript
private refreshSongCountsFor(songId: string) {
  const songParts = this.parts().filter(p => p.songId === songId);
  const total = songParts.length;
  const learnt = songParts.filter(p => p.learntState === 'LEARNT').length;
  const avg = avgWorkingBpm(songParts);
  this.songs.update(list => list.map(s => s.id === songId
    ? { ...s, partCount: total, learntPartCount: learnt, avgBpm: avg }
    : s));
}
```

- [ ] **Step 3: Replace bumpSongCounts call in createPart**

Old in `createPart`:
```typescript
this.parts.update(list => [...list, p]);
this.bumpSongCounts(songId);
```

New:
```typescript
this.parts.update(list => [...list, p]);
this.refreshSongCountsFor(songId);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/store.service.ts
git commit -m "feat: keep avgBpm in sync on part create/update/delete"
```

---

## Task 7: Update song-pane component

**Files:**
- Modify: `frontend/src/app/panes/song-pane.component.ts`
- Modify: `frontend/src/app/panes/song-pane.component.html`
- Modify: `frontend/src/app/panes/song-pane.component.scss`

- [ ] **Step 1: Replace song-pane.component.ts**

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store, ALL_SONGS, UNFILED } from '../core/store.service';
import { IconComponent } from '../ui/icon.component';
import { Song } from '../core/models';

@Component({
  selector: 'app-song-pane',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './song-pane.component.html',
  styleUrl: './song-pane.component.scss',
  host: { '[class.collapsed]': 'collapsed()' },
})
export class SongPaneComponent {
  protected store = inject(Store);
  protected creating = signal(false);
  protected newTitle = signal('');
  protected newArtist = signal('');
  protected newAlbum = signal('');
  protected newKey = signal('');

  protected editingId = signal<string | null>(null);
  protected editTitle = signal('');
  protected editArtist = signal('');
  protected editAlbum = signal('');
  protected editKey = signal('');

  protected collapsed = computed(() => this.store.selectedSongId() !== null);

  protected headerLabel = computed(() => {
    const fid = this.store.selectedFolderId();
    if (fid === ALL_SONGS) return 'All songs';
    if (fid === UNFILED) return 'Unfiled';
    const f = this.store.folders().find(x => x.id === fid);
    return f?.name ?? 'Songs';
  });

  protected currentFolderId(): string | null {
    const fid = this.store.selectedFolderId();
    if (fid === ALL_SONGS || fid === UNFILED) return null;
    return fid;
  }

  startCreate() {
    this.creating.set(true);
    this.newTitle.set('');
    this.newArtist.set('');
    this.newAlbum.set('');
    this.newKey.set('');
    queueMicrotask(() => document.getElementById('new-song-title')?.focus());
  }
  cancelCreate() { this.creating.set(false); }
  async commitCreate() {
    const title = this.newTitle().trim();
    if (!title) { this.cancelCreate(); return; }
    await this.store.createSong({
      title,
      artist: this.newArtist().trim() || null,
      album: this.newAlbum().trim() || null,
      key: this.newKey().trim() || null,
      folderId: this.currentFolderId(),
    });
    this.cancelCreate();
  }

  startEdit(s: Song, ev: Event) {
    ev.stopPropagation();
    this.editingId.set(s.id);
    this.editTitle.set(s.title);
    this.editArtist.set(s.artist ?? '');
    this.editAlbum.set(s.album ?? '');
    this.editKey.set(s.key ?? '');
  }
  cancelEdit() { this.editingId.set(null); }
  async commitEdit(s: Song) {
    const title = this.editTitle().trim();
    if (!title) { this.cancelEdit(); return; }
    await this.store.updateSong(s.id, {
      title,
      artist: this.editArtist().trim() || null,
      album: this.editAlbum().trim() || null,
      key: this.editKey().trim() || null,
      folderId: s.folderId,
    });
    this.cancelEdit();
  }

  async remove(id: string, ev: Event) {
    ev.stopPropagation();
    if (!confirm('Delete this song and all its parts?')) return;
    await this.store.deleteSong(id);
  }

  progress(s: Song): number {
    if (!s.partCount) return 0;
    return s.learntPartCount / s.partCount;
  }
}
```

- [ ] **Step 2: Replace song-pane.component.html**

```html
<div class="strip" aria-hidden="true">
  <app-icon name="music" size="16" weight="1.8"></app-icon>
  <span class="strip-title">{{ store.selectedSong()?.title ?? headerLabel() }}</span>
  <app-icon name="chevron" size="13" weight="2"></app-icon>
</div>

<section class="pane">
  <header class="pane-head">
    <div class="pane-head-text">
      <p class="pane-eyebrow">Library</p>
      <h2 class="pane-title">{{ headerLabel() }}</h2>
    </div>
    <button class="action"
            type="button"
            (click)="startCreate()">
      <app-icon name="plus" size="14" weight="2"></app-icon>
      <span>New song</span>
    </button>
  </header>

  <div class="search-row">
    <input class="search-input"
           type="search"
           placeholder="Search songs"
           aria-label="Search songs"
           [ngModel]="store.songQuery()"
           (ngModelChange)="store.songQuery.set($event)" />
    @if (store.songQuery()) {
      <button class="search-clear" type="button" (click)="store.songQuery.set('')" aria-label="Clear search">×</button>
    }
  </div>

  <ul class="song-list">
    @if (creating()) {
      <li class="song-card creating">
        <input id="new-song-title"
               class="song-title-input"
               [ngModel]="newTitle()"
               (ngModelChange)="newTitle.set($event)"
               placeholder="Song title"
               (keydown.enter)="commitCreate()"
               (keydown.escape)="cancelCreate()" />
        <div class="song-fields">
          <div class="field-row">
            <label class="text-field">
              <span>Artist</span>
              <input type="text"
                     [ngModel]="newArtist()"
                     (ngModelChange)="newArtist.set($event)" />
            </label>
            <label class="text-field key-field">
              <span>Key</span>
              <input type="text" maxlength="8"
                     [ngModel]="newKey()"
                     (ngModelChange)="newKey.set($event)" />
            </label>
          </div>
          <label class="text-field">
            <span>Album</span>
            <input type="text"
                   [ngModel]="newAlbum()"
                   (ngModelChange)="newAlbum.set($event)" />
          </label>
          <div class="card-actions">
            <button class="ghost" type="button" (click)="cancelCreate()">Cancel</button>
            <button class="primary" type="button" (click)="commitCreate()">Add song</button>
          </div>
        </div>
      </li>
    }

    @for (s of store.visibleSongs(); track s.id) {
      <li class="song-card"
          [class.active]="store.selectedSongId() === s.id"
          (click)="store.selectSong(s.id)">

        @if (editingId() === s.id) {
          <div class="edit-block" (click)="$event.stopPropagation()">
            <input class="song-title-input"
                   [ngModel]="editTitle()"
                   (ngModelChange)="editTitle.set($event)"
                   (keydown.enter)="commitEdit(s)"
                   (keydown.escape)="cancelEdit()" />
            <div class="song-fields">
              <div class="field-row">
                <label class="text-field">
                  <span>Artist</span>
                  <input type="text"
                         [ngModel]="editArtist()"
                         (ngModelChange)="editArtist.set($event)" />
                </label>
                <label class="text-field key-field">
                  <span>Key</span>
                  <input type="text" maxlength="8"
                         [ngModel]="editKey()"
                         (ngModelChange)="editKey.set($event)" />
                </label>
              </div>
              <label class="text-field">
                <span>Album</span>
                <input type="text"
                       [ngModel]="editAlbum()"
                       (ngModelChange)="editAlbum.set($event)" />
              </label>
              <div class="card-actions">
                <button class="ghost" type="button" (click)="cancelEdit()">Cancel</button>
                <button class="primary" type="button" (click)="commitEdit(s)">Save</button>
              </div>
            </div>
          </div>
        } @else {
          <div class="song-head">
            <div class="song-info">
              <div class="song-title-row">
                <p class="song-title">{{ s.title }}</p>
                @if (s.artist) {
                  <span class="song-artist">{{ s.artist }}</span>
                }
              </div>
              @if (s.key) {
                <p class="song-key">{{ s.key }}</p>
              }
              <p class="song-sub">
                <span class="bpm-pill">{{ s.avgBpm !== null ? s.avgBpm + ' BPM' : '— BPM' }}</span>
                <span class="dot">·</span>
                <span>{{ s.learntPartCount }}/{{ s.partCount }} parts learnt</span>
              </p>
            </div>
            <div class="row-actions">
              <button class="row-action" type="button" (click)="startEdit(s, $event)" aria-label="Edit song">
                <app-icon name="edit" size="13"></app-icon>
              </button>
              <button class="row-action danger" type="button" (click)="remove(s.id, $event)" aria-label="Delete song">
                <app-icon name="trash" size="13"></app-icon>
              </button>
            </div>
          </div>

          <div class="song-progress" [class.empty]="s.partCount === 0">
            <span class="song-progress-bar" [style.--p]="progress(s)"></span>
          </div>
        }
      </li>
    }

    @if (!store.visibleSongs().length && !creating()) {
      <li class="empty-card">
        <app-icon name="music" size="22" weight="1.4"></app-icon>
        @if (store.songQuery()) {
          <p class="empty-title">No songs match</p>
          <p class="empty-sub">Try a different search, or clear it.</p>
        } @else {
          <p class="empty-title">No songs here yet</p>
          <p class="empty-sub">Use <strong>New song</strong> above to add one.</p>
        }
      </li>
    }
  </ul>
</section>
```

- [ ] **Step 3: Add new styles to song-pane.component.scss**

Append to the end of `frontend/src/app/panes/song-pane.component.scss`:

```scss
.song-info {
  min-width: 0;
  flex: 1;
}

.song-title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.song-artist {
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

.song-key {
  margin: 0 0 2px;
  font-size: var(--text-xs);
  color: var(--text-faint);
  font-weight: 500;
  letter-spacing: 0.03em;
}

.song-fields {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-row {
  display: flex;
  gap: var(--space-2);

  .text-field { flex: 1; }
  .key-field { flex: 0 0 72px; }
}

.text-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--text-sm);
  color: var(--text-muted);

  input {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius-xs);
    color: var(--text-strong);
    font-size: var(--text-sm);
    background: var(--bg-canvas);

    &:focus { outline: none; border-color: var(--accent); }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/panes/song-pane.component.ts \
        frontend/src/app/panes/song-pane.component.html \
        frontend/src/app/panes/song-pane.component.scss
git commit -m "feat: song pane — artist/key display, avg BPM, metadata edit form"
```

---

## Task 8: Update workspace component

**Files:**
- Modify: `frontend/src/app/panes/workspace.component.ts`
- Modify: `frontend/src/app/panes/workspace.component.html`

- [ ] **Step 1: Update workspace.component.ts**

Replace the full content of `frontend/src/app/panes/workspace.component.ts`:

```typescript
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '../core/store.service';
import { MetronomeService } from '../core/metronome.service';
import { IconComponent } from '../ui/icon.component';
import { Part } from '../core/models';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent {
  protected store = inject(Store);
  protected metronome = inject(MetronomeService);

  protected song = this.store.selectedSong;
  protected part = this.store.selectedPart;

  protected creatingPart = signal(false);
  protected newPartTitle = signal('');
  protected newPartBars = signal(1);
  protected newPartGoalBpm = signal(80);

  protected editing = signal(false);
  protected editTitle = signal('');
  protected editTotal = signal(1);
  protected editGoalBpm = signal(80);

  protected progress = computed(() => {
    const p = this.part();
    if (!p || p.totalBars === 0) return 0;
    return p.learntBars / p.totalBars;
  });

  protected stateLabel = computed(() => {
    const p = this.part();
    if (!p) return '';
    return p.learntState.charAt(0) + p.learntState.slice(1).toLowerCase();
  });

  constructor() {
    effect(() => {
      const p = this.part();
      if (p) this.metronome.setBpm(p.workingBpm);
      else this.metronome.stop();
    }, { allowSignalWrites: true });
  }

  startCreatePart() {
    this.creatingPart.set(true);
    this.newPartTitle.set('');
    this.newPartBars.set(1);
    this.newPartGoalBpm.set(80);
    queueMicrotask(() => document.getElementById('new-part-title')?.focus());
  }
  cancelCreatePart() { this.creatingPart.set(false); }
  async commitCreatePart() {
    const song = this.song();
    if (!song) return;
    const title = this.newPartTitle().trim();
    if (!title) { this.cancelCreatePart(); return; }
    const goalBpm = Math.max(20, Math.min(260, this.newPartGoalBpm() || 80));
    await this.store.createPart(song.id, {
      title,
      goalBpm,
      workingBpm: goalBpm,
      totalBars: Math.max(1, this.newPartBars() || 1),
    });
    this.cancelCreatePart();
  }

  startEditPart() {
    const p = this.part();
    if (!p) return;
    this.editing.set(true);
    this.editTitle.set(p.title);
    this.editTotal.set(p.totalBars);
    this.editGoalBpm.set(p.goalBpm);
  }
  cancelEditPart() { this.editing.set(false); }
  async commitEditPart() {
    const p = this.part();
    if (!p) return;
    const title = this.editTitle().trim();
    if (!title) { this.editing.set(false); return; }
    await this.store.updatePart(p.id, {
      title,
      goalBpm: Math.max(20, Math.min(260, this.editGoalBpm() || p.goalBpm)),
      workingBpm: p.workingBpm,
      totalBars: Math.max(1, this.editTotal() || 1),
    });
    this.editing.set(false);
  }

  async removePart() {
    const p = this.part();
    if (!p) return;
    if (!confirm('Delete this part?')) return;
    await this.store.deletePart(p.id);
  }

  selectPart(id: string) {
    this.store.selectPart(id);
  }

  async adjustBars(delta: number) {
    const p = this.part();
    if (!p) return;
    if (delta < 0 && p.learntBars <= 0) return;
    if (delta > 0 && p.learntBars >= p.totalBars) return;
    await this.store.adjustBars(p.id, delta);
  }

  async adjustBpm(delta: number) {
    const p = this.part();
    if (!p) return;
    const next = Math.max(20, Math.min(260, p.workingBpm + delta));
    await this.store.updatePart(p.id, {
      title: p.title,
      goalBpm: p.goalBpm,
      workingBpm: next,
      totalBars: p.totalBars,
    });
  }

  private tapTimes: number[] = [];
  protected tappedBpm = signal<number | null>(null);

  async tapTempo() {
    const now = performance.now();
    const last = this.tapTimes[this.tapTimes.length - 1];
    if (last !== undefined && now - last > 2000) this.tapTimes = [];
    this.tapTimes.push(now);
    if (this.tapTimes.length < 2) { this.tappedBpm.set(null); return; }
    const recent = this.tapTimes.slice(-6);
    const mean = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
    const bpm = Math.max(20, Math.min(260, Math.round(60000 / mean)));
    this.tappedBpm.set(bpm);
    await this.setBpmInput(bpm);
  }

  async markAllLearnt() {
    const p = this.part();
    if (!p) return;
    await this.store.setLearntBars(p.id, p.totalBars);
  }

  async resetLearnt() {
    const p = this.part();
    if (!p) return;
    await this.store.setLearntBars(p.id, 0);
  }

  async setBpmInput(v: number) {
    const p = this.part();
    if (!p) return;
    const next = Math.max(20, Math.min(260, Math.round(v)));
    if (next === p.workingBpm) return;
    await this.store.updatePart(p.id, {
      title: p.title,
      goalBpm: p.goalBpm,
      workingBpm: next,
      totalBars: p.totalBars,
    });
  }

  toggleMetronome() {
    this.metronome.toggle();
  }

  stateClass(p: Part) {
    return `state-${p.learntState.toLowerCase()}`;
  }
}
```

- [ ] **Step 2: Update workspace.component.html — part create form**

Find the creating part form block (the `@if (creatingPart())` block) and replace it:

Old:
```html
        @if (creatingPart()) {
          <div class="part-card creating">
            <input id="new-part-title"
                   class="part-title-input"
                   placeholder="Part title"
                   [ngModel]="newPartTitle()"
                   (ngModelChange)="newPartTitle.set($event)"
                   (keydown.enter)="commitCreatePart()"
                   (keydown.escape)="cancelCreatePart()" />
            <label class="inline-field">
              <span>Bars</span>
              <input type="number" min="1" max="999"
                     [ngModel]="newPartBars()"
                     (ngModelChange)="newPartBars.set($event)" />
            </label>
            <div class="card-actions">
              <button class="ghost" type="button" (click)="cancelCreatePart()">Cancel</button>
              <button class="primary" type="button" (click)="commitCreatePart()">Add</button>
            </div>
          </div>
        }
```

New:
```html
        @if (creatingPart()) {
          <div class="part-card creating">
            <input id="new-part-title"
                   class="part-title-input"
                   placeholder="Part title"
                   [ngModel]="newPartTitle()"
                   (ngModelChange)="newPartTitle.set($event)"
                   (keydown.enter)="commitCreatePart()"
                   (keydown.escape)="cancelCreatePart()" />
            <label class="inline-field">
              <span>Bars</span>
              <input type="number" min="1" max="999"
                     [ngModel]="newPartBars()"
                     (ngModelChange)="newPartBars.set($event)" />
            </label>
            <label class="inline-field">
              <span>Goal BPM</span>
              <input type="number" min="20" max="260"
                     [ngModel]="newPartGoalBpm()"
                     (ngModelChange)="newPartGoalBpm.set($event)" />
            </label>
            <div class="card-actions">
              <button class="ghost" type="button" (click)="cancelCreatePart()">Cancel</button>
              <button class="primary" type="button" (click)="commitCreatePart()">Add</button>
            </div>
          </div>
        }
```

- [ ] **Step 3: Update workspace.component.html — part edit form**

Find the `edit-grid` div and replace it:

Old:
```html
              <div class="edit-grid">
                <label class="stacked-field">
                  <span>Title</span>
                  <input [ngModel]="editTitle()" (ngModelChange)="editTitle.set($event)" />
                </label>
                <label class="stacked-field">
                  <span>Total bars</span>
                  <input type="number" min="1" max="999"
                         [ngModel]="editTotal()"
                         (ngModelChange)="editTotal.set($event)" />
                </label>
                <div class="card-actions">
                  <button class="ghost" type="button" (click)="cancelEditPart()">Cancel</button>
                  <button class="primary" type="button" (click)="commitEditPart()">Save</button>
                </div>
              </div>
```

New:
```html
              <div class="edit-grid">
                <label class="stacked-field">
                  <span>Title</span>
                  <input [ngModel]="editTitle()" (ngModelChange)="editTitle.set($event)" />
                </label>
                <label class="stacked-field">
                  <span>Total bars</span>
                  <input type="number" min="1" max="999"
                         [ngModel]="editTotal()"
                         (ngModelChange)="editTotal.set($event)" />
                </label>
                <label class="stacked-field">
                  <span>Goal BPM</span>
                  <input type="number" min="20" max="260"
                         [ngModel]="editGoalBpm()"
                         (ngModelChange)="editGoalBpm.set($event)" />
                </label>
                <div class="card-actions">
                  <button class="ghost" type="button" (click)="cancelEditPart()">Cancel</button>
                  <button class="primary" type="button" (click)="commitEditPart()">Save</button>
                </div>
              </div>
```

- [ ] **Step 4: Update workspace.component.html — bpm-foot line**

Find and replace the bpm-foot paragraph:

Old:
```html
            <p class="bpm-foot">Goal {{ song()!.goalBpm }} BPM
              · {{ p.workingBpm >= song()!.goalBpm ? 'At goal' : 'Below goal by ' + (song()!.goalBpm - p.workingBpm) + ' BPM' }}
            </p>
```

New:
```html
            <p class="bpm-foot">Goal {{ p.goalBpm }} BPM
              · {{ p.workingBpm >= p.goalBpm ? 'At goal' : 'Below goal by ' + (p.goalBpm - p.workingBpm) + ' BPM' }}
            </p>
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Build at: ... - Hash: ...` with no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/panes/workspace.component.ts \
        frontend/src/app/panes/workspace.component.html
git commit -m "feat: workspace — per-part goal BPM field and bpm-foot update"
```

---

## Task 9: Smoke test

- [ ] **Step 1: Run the full test suite**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all tests PASS

- [ ] **Step 2: Start the dev server**

```bash
cd frontend && npm start
```

Open http://localhost:4200 and verify:
- Song cards show artist (right of title) and key (below) for any songs that have them
- Song cards show "— BPM" for songs with no parts, and an avg once parts exist
- Creating a song: form shows Artist, Key, Album fields, no Goal BPM
- Creating a part: form shows Bars + Goal BPM
- Editing a part: Goal BPM field is populated and saves correctly
- BPM footer in workspace shows the part's own goal, not the song's
- Adjusting working BPM and confirming updates flow correctly
