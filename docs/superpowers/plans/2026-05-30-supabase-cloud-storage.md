# Supabase Cloud Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BPM Tracker's data to Supabase with email/password accounts and per-user private data, talking to Supabase directly from the Angular SPA and retiring the Spring Boot backend.

**Architecture:** Angular standalone app uses `@supabase/supabase-js` for auth and CRUD. Postgres Row-Level Security scopes every row to `auth.uid()`. All business logic (learnt-state, bar clamping, counts, positions) lives in pure, unit-tested TypeScript helpers; `ApiService` is thin glue that maps DB rows to the existing `Folder`/`Song`/`Part` models and is verified by manual E2E. `AuthService` (signals) gates the app.

**Tech Stack:** Angular 17 (standalone, signals), `@supabase/supabase-js` v2, Supabase (Auth + Postgres + RLS), Jasmine/Karma for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-30-supabase-cloud-storage-design.md`

**Conventions:**
- Frontend root is `frontend/`. Run npm/ng commands from there.
- Unit tests run with: `npx ng test --watch=false --browsers=ChromeHeadless` (from `frontend/`). If ChromeHeadless is unavailable in the environment, install Chromium or set `CHROME_BIN`; this is an environment setup step, not a code change.
- Keep `ApiService` method signatures byte-for-byte identical so `Store` and components stay untouched.

---

## Task 1: Provision Supabase project and schema (via Supabase MCP)

**Files:** none (infrastructure). Produces the project URL + anon key used in Task 2.

- [ ] **Step 1: Authenticate the Supabase MCP**

Use the `mcp__supabase__authenticate` tool, then `mcp__supabase__complete_authentication` as prompted. Confirm access by listing organizations/projects.

- [ ] **Step 2: Create (or select) a project**

Create a free project named `bpm-tracker` (any region near you). Record the **Project URL** (`https://<ref>.supabase.co`) and the **anon public key** from the project's API settings.

- [ ] **Step 3: Run the schema + RLS SQL**

Execute this SQL in the project's SQL editor (or via the MCP SQL tool):

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

create index songs_user_id_idx on songs(user_id);
create index parts_song_id_idx on parts(song_id);

alter table folders enable row level security;
alter table songs   enable row level security;
alter table parts   enable row level security;

create policy "own rows" on folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on songs   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on parts   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 4: Disable email confirmation**

In Authentication → Providers → Email, turn **off** "Confirm email" so signups log in immediately.

- [ ] **Step 5: Verify**

In the SQL editor run `select tablename from pg_tables where schemaname='public';` and confirm `folders`, `songs`, `parts`. No commit (no repo changes this task).

---

## Task 2: Install supabase-js, add config and client token

**Files:**
- Modify: `frontend/package.json` (via npm)
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/app/core/supabase.client.ts`

- [ ] **Step 1: Install the client library**

Run (from `frontend/`): `npm install @supabase/supabase-js`
Expected: `package.json` gains `@supabase/supabase-js` in dependencies.

- [ ] **Step 2: Create the environment file with your project values**

Create `frontend/src/environments/environment.ts` (paste the values recorded in Task 1):

```typescript
export const environment = {
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_PUBLIC_KEY',
};
```

(The anon key is public by design; RLS is the security boundary, so committing it is acceptable.)

- [ ] **Step 3: Create the Supabase client injection token**

Create `frontend/src/app/core/supabase.client.ts`:

```typescript
import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () => createClient(environment.supabaseUrl, environment.supabaseAnonKey),
});
```

- [ ] **Step 4: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (no usages yet; this only checks imports resolve).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/environments/environment.ts frontend/src/app/core/supabase.client.ts
git commit -m "feat: add supabase-js client and environment config"
```

---

## Task 3: Pure domain helpers (learnt-state, clamp, counts, position)

**Files:**
- Create: `frontend/src/app/core/derive.ts`
- Test: `frontend/src/app/core/derive.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/core/derive.spec.ts`:

```typescript
import { learntStateOf, clampLearntBars, countLearntParts, nextPosition } from './derive';

describe('learntStateOf', () => {
  it('is UNLEARNT when no bars learnt', () => {
    expect(learntStateOf(0, 8)).toBe('UNLEARNT');
  });
  it('is UNLEARNT when totalBars is 0', () => {
    expect(learntStateOf(0, 0)).toBe('UNLEARNT');
  });
  it('is LEARNT when all bars learnt', () => {
    expect(learntStateOf(8, 8)).toBe('LEARNT');
  });
  it('is LEARNT when learnt exceeds total', () => {
    expect(learntStateOf(9, 8)).toBe('LEARNT');
  });
  it('is LEARNING when partially learnt', () => {
    expect(learntStateOf(3, 8)).toBe('LEARNING');
  });
});

describe('clampLearntBars', () => {
  it('clamps below zero up to zero', () => {
    expect(clampLearntBars(-2, 8)).toBe(0);
  });
  it('clamps above total down to total', () => {
    expect(clampLearntBars(12, 8)).toBe(8);
  });
  it('leaves in-range values untouched', () => {
    expect(clampLearntBars(5, 8)).toBe(5);
  });
});

describe('countLearntParts', () => {
  it('counts only fully-learnt parts', () => {
    const parts = [
      { totalBars: 8, learntBars: 8 },
      { totalBars: 8, learntBars: 3 },
      { totalBars: 4, learntBars: 4 },
      { totalBars: 4, learntBars: 0 },
    ];
    expect(countLearntParts(parts)).toBe(2);
  });
});

describe('nextPosition', () => {
  it('returns the count of existing siblings', () => {
    expect(nextPosition(3)).toBe(3);
    expect(nextPosition(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `derive` module not found / functions undefined.

- [ ] **Step 3: Implement the helpers**

Create `frontend/src/app/core/derive.ts`:

```typescript
import { LearntState } from './models';

export function learntStateOf(learntBars: number, totalBars: number): LearntState {
  if (learntBars <= 0 || totalBars <= 0) return 'UNLEARNT';
  if (learntBars >= totalBars) return 'LEARNT';
  return 'LEARNING';
}

export function clampLearntBars(learntBars: number, totalBars: number): number {
  return Math.max(0, Math.min(totalBars, learntBars));
}

export function countLearntParts(parts: { totalBars: number; learntBars: number }[]): number {
  return parts.filter(p => learntStateOf(p.learntBars, p.totalBars) === 'LEARNT').length;
}

export function nextPosition(existingCount: number): number {
  return existingCount;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `frontend/`): `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/derive.ts frontend/src/app/core/derive.spec.ts
git commit -m "feat: add pure domain helpers for learnt-state, clamp, counts"
```

---

## Task 4: DB row types and row→model mappers

**Files:**
- Create: `frontend/src/app/core/db-types.ts`
- Create: `frontend/src/app/core/mappers.ts`
- Test: `frontend/src/app/core/mappers.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/core/mappers.spec.ts`:

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
  it('maps snake_case to camelCase and attaches counts', () => {
    const row: SongRow = {
      id: 's1', folder_id: 'f1', title: 'Song', goal_bpm: 120, position: 2, created_at: 't',
    };
    expect(toSong(row, 5, 3)).toEqual({
      id: 's1', title: 'Song', goalBpm: 120, folderId: 'f1', position: 2,
      partCount: 5, learntPartCount: 3,
    });
  });
});

describe('toPart', () => {
  it('maps row and derives learntState', () => {
    const row: PartRow = {
      id: 'p1', song_id: 's1', title: 'Intro', working_bpm: 90,
      total_bars: 8, learnt_bars: 8, position: 0, created_at: 't',
    };
    expect(toPart(row)).toEqual({
      id: 'p1', songId: 's1', title: 'Intro', workingBpm: 90,
      totalBars: 8, learntBars: 8, learntState: 'LEARNT', position: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `db-types`/`mappers` not found.

- [ ] **Step 3: Implement row types**

Create `frontend/src/app/core/db-types.ts`:

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
  goal_bpm: number;
  position: number;
  created_at: string;
}

export interface PartRow {
  id: string;
  song_id: string;
  title: string;
  working_bpm: number;
  total_bars: number;
  learnt_bars: number;
  position: number;
  created_at: string;
}
```

- [ ] **Step 4: Implement mappers**

Create `frontend/src/app/core/mappers.ts`:

```typescript
import { Folder, Song, Part } from './models';
import { FolderRow, SongRow, PartRow } from './db-types';
import { learntStateOf } from './derive';

export function toFolder(row: FolderRow, songCount: number): Folder {
  return { id: row.id, name: row.name, position: row.position, songCount };
}

export function toSong(row: SongRow, partCount: number, learntPartCount: number): Song {
  return {
    id: row.id,
    title: row.title,
    goalBpm: row.goal_bpm,
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
    workingBpm: row.working_bpm,
    totalBars: row.total_bars,
    learntBars: row.learnt_bars,
    learntState: learntStateOf(row.learnt_bars, row.total_bars),
    position: row.position,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `frontend/`): `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/db-types.ts frontend/src/app/core/mappers.ts frontend/src/app/core/mappers.spec.ts
git commit -m "feat: add DB row types and row-to-model mappers"
```

---

## Task 5: Rewrite ApiService — folders

**Files:**
- Modify: `frontend/src/app/core/api.service.ts` (full rewrite across Tasks 5–7)

> Note: Tasks 5–7 replace the HTTP implementation with Supabase calls while keeping every method signature identical. The methods are thin glue over the (already tested) helpers; correctness of CRUD is verified by manual E2E in Task 12. Build after each task to keep the file compiling.

- [ ] **Step 1: Replace the file header and folder methods**

Replace the entire contents of `frontend/src/app/core/api.service.ts` with the following (songs/parts added in Tasks 6–7; this version compiles on its own because the other methods are included as working folder-only-now... include all to avoid a broken intermediate). Write the COMPLETE file:

```typescript
import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  Folder, FolderUpsert,
  Song, SongUpsert,
  Part, PartUpsert,
} from './models';
import { FolderRow, SongRow, PartRow } from './db-types';
import { toFolder, toSong, toPart } from './mappers';
import { clampLearntBars, countLearntParts, nextPosition } from './derive';
import { SUPABASE } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private sb = inject(SUPABASE);

  // ---- Folders ----
  listFolders(): Observable<Folder[]> { return from(this.fetchFolders()); }
  private async fetchFolders(): Promise<Folder[]> {
    const { data: folders, error } = await this.sb
      .from('folders').select('*').order('position').order('created_at');
    if (error) throw error;
    const { data: songs, error: songErr } = await this.sb
      .from('songs').select('id, folder_id');
    if (songErr) throw songErr;
    const rows = (folders ?? []) as FolderRow[];
    const songRows = (songs ?? []) as { id: string; folder_id: string | null }[];
    return rows.map(f =>
      toFolder(f, songRows.filter(s => s.folder_id === f.id).length));
  }

  createFolder(body: FolderUpsert): Observable<Folder> { return from(this.insertFolder(body)); }
  private async insertFolder(body: FolderUpsert): Promise<Folder> {
    const { count } = await this.sb
      .from('folders').select('*', { count: 'exact', head: true });
    const { data, error } = await this.sb
      .from('folders')
      .insert({ name: body.name.trim(), position: nextPosition(count ?? 0) })
      .select().single();
    if (error) throw error;
    return toFolder(data as FolderRow, 0);
  }

  renameFolder(id: string, body: FolderUpsert): Observable<Folder> {
    return from(this.updateFolder(id, body));
  }
  private async updateFolder(id: string, body: FolderUpsert): Promise<Folder> {
    const { data, error } = await this.sb
      .from('folders').update({ name: body.name.trim() }).eq('id', id).select().single();
    if (error) throw error;
    const { count } = await this.sb
      .from('songs').select('*', { count: 'exact', head: true }).eq('folder_id', id);
    return toFolder(data as FolderRow, count ?? 0);
  }

  deleteFolder(id: string): Observable<void> { return from(this.removeFolder(id)); }
  private async removeFolder(id: string): Promise<void> {
    const { error } = await this.sb.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Songs (implemented in Task 6) ----
  listSongs(opts?: { folderId?: string | null; unfiled?: boolean }): Observable<Song[]> {
    return from(this.fetchSongs(opts));
  }
  private async fetchSongs(_opts?: { folderId?: string | null; unfiled?: boolean }): Promise<Song[]> {
    return [];
  }
  createSong(body: SongUpsert): Observable<Song> { return from(this.insertSong(body)); }
  private async insertSong(_body: SongUpsert): Promise<Song> { throw new Error('not implemented'); }
  updateSong(id: string, body: SongUpsert): Observable<Song> { return from(this.patchSong(id, body)); }
  private async patchSong(_id: string, _body: SongUpsert): Promise<Song> { throw new Error('not implemented'); }
  deleteSong(id: string): Observable<void> { return from(this.removeSong(id)); }
  private async removeSong(_id: string): Promise<void> { throw new Error('not implemented'); }

  // ---- Parts (implemented in Task 7) ----
  listParts(songId: string): Observable<Part[]> { return from(this.fetchParts(songId)); }
  private async fetchParts(_songId: string): Promise<Part[]> { return []; }
  createPart(songId: string, body: PartUpsert): Observable<Part> { return from(this.insertPart(songId, body)); }
  private async insertPart(_songId: string, _body: PartUpsert): Promise<Part> { throw new Error('not implemented'); }
  updatePart(id: string, body: PartUpsert): Observable<Part> { return from(this.patchPart(id, body)); }
  private async patchPart(_id: string, _body: PartUpsert): Promise<Part> { throw new Error('not implemented'); }
  deletePart(id: string): Observable<void> { return from(this.removePart(id)); }
  private async removePart(_id: string): Promise<void> { throw new Error('not implemented'); }
  adjustBars(id: string, delta: number): Observable<Part> { return from(this.applyBars(id, delta)); }
  private async applyBars(_id: string, _delta: number): Promise<Part> { throw new Error('not implemented'); }
}
```

- [ ] **Step 2: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (folder methods real; song/part stubs compile).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/core/api.service.ts
git commit -m "feat: rewrite ApiService folder methods on Supabase (song/part stubs)"
```

---

## Task 6: ApiService — songs

**Files:**
- Modify: `frontend/src/app/core/api.service.ts`

- [ ] **Step 1: Implement `fetchSongs`**

Replace the `fetchSongs` stub with:

```typescript
  private async fetchSongs(opts?: { folderId?: string | null; unfiled?: boolean }): Promise<Song[]> {
    let query = this.sb.from('songs').select('*').order('position').order('created_at');
    if (opts?.unfiled) query = query.is('folder_id', null);
    else if (opts?.folderId) query = query.eq('folder_id', opts.folderId);
    const { data: songs, error } = await query;
    if (error) throw error;
    const songRows = (songs ?? []) as SongRow[];

    const { data: parts, error: partErr } = await this.sb
      .from('parts').select('song_id, total_bars, learnt_bars');
    if (partErr) throw partErr;
    const partRows = (parts ?? []) as { song_id: string; total_bars: number; learnt_bars: number }[];

    return songRows.map(s => {
      const own = partRows
        .filter(p => p.song_id === s.id)
        .map(p => ({ totalBars: p.total_bars, learntBars: p.learnt_bars }));
      return toSong(s, own.length, countLearntParts(own));
    });
  }
```

- [ ] **Step 2: Implement `insertSong`**

Replace the `insertSong` stub with:

```typescript
  private async insertSong(body: SongUpsert): Promise<Song> {
    const { count } = await this.sb
      .from('songs').select('*', { count: 'exact', head: true });
    const { data, error } = await this.sb
      .from('songs')
      .insert({
        title: body.title.trim(),
        goal_bpm: body.goalBpm,
        folder_id: body.folderId,
        position: nextPosition(count ?? 0),
      })
      .select().single();
    if (error) throw error;
    return toSong(data as SongRow, 0, 0);
  }
```

- [ ] **Step 3: Implement `patchSong`**

Replace the `patchSong` stub with:

```typescript
  private async patchSong(id: string, body: SongUpsert): Promise<Song> {
    const { data, error } = await this.sb
      .from('songs')
      .update({ title: body.title.trim(), goal_bpm: body.goalBpm, folder_id: body.folderId })
      .eq('id', id).select().single();
    if (error) throw error;
    const { data: parts, error: partErr } = await this.sb
      .from('parts').select('total_bars, learnt_bars').eq('song_id', id);
    if (partErr) throw partErr;
    const own = ((parts ?? []) as { total_bars: number; learnt_bars: number }[])
      .map(p => ({ totalBars: p.total_bars, learntBars: p.learnt_bars }));
    return toSong(data as SongRow, own.length, countLearntParts(own));
  }
```

- [ ] **Step 4: Implement `removeSong`**

Replace the `removeSong` stub with:

```typescript
  private async removeSong(id: string): Promise<void> {
    const { error } = await this.sb.from('songs').delete().eq('id', id);
    if (error) throw error;
  }
```

- [ ] **Step 5: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/api.service.ts
git commit -m "feat: implement ApiService song methods on Supabase"
```

---

## Task 7: ApiService — parts and adjustBars

**Files:**
- Modify: `frontend/src/app/core/api.service.ts`

- [ ] **Step 1: Implement `fetchParts`**

Replace the `fetchParts` stub with:

```typescript
  private async fetchParts(songId: string): Promise<Part[]> {
    const { data, error } = await this.sb
      .from('parts').select('*').eq('song_id', songId)
      .order('position').order('created_at');
    if (error) throw error;
    return ((data ?? []) as PartRow[]).map(toPart);
  }
```

- [ ] **Step 2: Implement `insertPart`**

Replace the `insertPart` stub with:

```typescript
  private async insertPart(songId: string, body: PartUpsert): Promise<Part> {
    const { count } = await this.sb
      .from('parts').select('*', { count: 'exact', head: true }).eq('song_id', songId);
    const { data, error } = await this.sb
      .from('parts')
      .insert({
        song_id: songId,
        title: body.title.trim(),
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

- [ ] **Step 3: Implement `patchPart` (with clamp rule)**

Replace the `patchPart` stub with:

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
        working_bpm: body.workingBpm,
        total_bars: body.totalBars,
        learnt_bars: learnt,
      })
      .eq('id', id).select().single();
    if (error) throw error;
    return toPart(data as PartRow);
  }
```

- [ ] **Step 4: Implement `removePart` and `applyBars`**

Replace the `removePart` and `applyBars` stubs with:

```typescript
  private async removePart(id: string): Promise<void> {
    const { error } = await this.sb.from('parts').delete().eq('id', id);
    if (error) throw error;
  }

  private async applyBars(id: string, delta: number): Promise<Part> {
    const { data: current, error: readErr } = await this.sb
      .from('parts').select('learnt_bars, total_bars').eq('id', id).single();
    if (readErr) throw readErr;
    const row = current as { learnt_bars: number; total_bars: number };
    const next = clampLearntBars(row.learnt_bars + delta, row.total_bars);
    const { data, error } = await this.sb
      .from('parts').update({ learnt_bars: next }).eq('id', id).select().single();
    if (error) throw error;
    return toPart(data as PartRow);
  }
```

- [ ] **Step 5: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds, no `not implemented` left (grep to confirm):
Run: `grep -n "not implemented" frontend/src/app/core/api.service.ts || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/api.service.ts
git commit -m "feat: implement ApiService part methods + adjustBars on Supabase"
```

---

## Task 8: AuthService

**Files:**
- Create: `frontend/src/app/core/auth.service.ts`

- [ ] **Step 1: Implement AuthService**

Create `frontend/src/app/core/auth.service.ts`:

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SUPABASE } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SUPABASE);

  readonly session = signal<Session | null>(null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor() {
    this.sb.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.sb.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.sb.auth.signOut();
    if (error) throw error;
  }
}
```

- [ ] **Step 2: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/core/auth.service.ts
git commit -m "feat: add AuthService wrapping Supabase email/password auth"
```

---

## Task 9: Login / signup component

**Files:**
- Create: `frontend/src/app/auth/login.component.ts`
- Create: `frontend/src/app/auth/login.component.html`
- Create: `frontend/src/app/auth/login.component.scss`

- [ ] **Step 1: Implement the component class**

Create `frontend/src/app/auth/login.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);

  email = '';
  password = '';
  mode = signal<'signin' | 'signup'>('signin');
  error = signal<string | null>(null);
  busy = signal(false);

  toggle() {
    this.mode.update(m => (m === 'signin' ? 'signup' : 'signin'));
    this.error.set(null);
  }

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'signin') {
        await this.auth.signIn(this.email, this.password);
      } else {
        await this.auth.signUp(this.email, this.password);
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      this.busy.set(false);
    }
  }
}
```

- [ ] **Step 2: Implement the template**

Create `frontend/src/app/auth/login.component.html`:

```html
<div class="auth-wrap">
  <div class="auth-card">
    <h1>BPM Tracker</h1>
    <form (ngSubmit)="submit()">
      <input type="email" name="email" placeholder="Email" [(ngModel)]="email" required autocomplete="email" />
      <input type="password" name="password" placeholder="Password" [(ngModel)]="password" required autocomplete="current-password" />
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <button type="submit" [disabled]="busy()">
        {{ mode() === 'signin' ? 'Sign in' : 'Sign up' }}
      </button>
    </form>
    <button class="link" type="button" (click)="toggle()">
      {{ mode() === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Implement the styles**

Create `frontend/src/app/auth/login.component.scss`:

```scss
.auth-wrap {
  display: grid;
  place-items: center;
  min-height: 100vh;
}
.auth-card {
  width: 320px;
  padding: 2rem;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  h1 { margin: 0 0 0.5rem; font-size: 1.25rem; }
  form { display: flex; flex-direction: column; gap: 0.5rem; }
  input { padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #333; }
  button[type='submit'] { padding: 0.6rem; border-radius: 8px; cursor: pointer; }
  .error { color: #e5484d; font-size: 0.85rem; margin: 0; }
  .link { background: none; border: none; color: #6ea8fe; cursor: pointer; font-size: 0.85rem; }
}
```

- [ ] **Step 4: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/auth/
git commit -m "feat: add login/signup component"
```

---

## Task 10: Gate the app behind auth and load data on login

**Files:**
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/app.component.html`
- Modify: `frontend/src/app/app.component.scss`

- [ ] **Step 1: Update the root component class**

Replace `frontend/src/app/app.component.ts` with:

```typescript
import { Component, effect, inject } from '@angular/core';
import { FolderRailComponent } from './panes/folder-rail.component';
import { SongPaneComponent } from './panes/song-pane.component';
import { WorkspaceComponent } from './panes/workspace.component';
import { LoginComponent } from './auth/login.component';
import { Store } from './core/store.service';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FolderRailComponent, SongPaneComponent, WorkspaceComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected auth = inject(AuthService);
  private store = inject(Store);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.store.loadAll();
      }
    });
  }
}
```

- [ ] **Step 2: Update the root template**

Replace `frontend/src/app/app.component.html` with:

```html
@if (auth.isAuthenticated()) {
  <div class="shell">
    <app-folder-rail></app-folder-rail>
    <app-song-pane></app-song-pane>
    <app-workspace></app-workspace>
    <button class="logout" type="button" (click)="auth.signOut()">Log out</button>
  </div>
} @else {
  <app-login></app-login>
}
```

- [ ] **Step 3: Add the logout button style**

Append to `frontend/src/app/app.component.scss`:

```scss
.logout {
  position: fixed;
  top: 0.5rem;
  right: 0.75rem;
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  border: 1px solid #333;
  background: #1a1a1a;
  color: inherit;
  cursor: pointer;
  z-index: 10;
}
```

- [ ] **Step 4: Verify it builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/app.component.ts frontend/src/app/app.component.html frontend/src/app/app.component.scss
git commit -m "feat: gate app behind auth, load data on login, add logout"
```

---

## Task 11: Retire the Spring Boot backend and clean up

**Files:**
- Modify: `frontend/src/app/app.config.ts`
- Modify: `frontend/vercel.json`
- Delete: `frontend/proxy.conf.json`
- Modify: `frontend/angular.json` (remove proxyConfig reference if present)
- Modify: `DEPLOY.md`
- Delete: `build.sh`, `build.bat`, `render.yaml`, `backend/Dockerfile`
- Delete: `frontend/src/app/core/api.service.spec.ts` if it exists and references HttpTestingController

- [ ] **Step 1: Remove the unused HttpClient provider**

Replace `frontend/src/app/app.config.ts` with:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
  ],
};
```

- [ ] **Step 2: Remove the dev proxy and the API rewrite**

Delete `frontend/proxy.conf.json`:
```bash
rm frontend/proxy.conf.json
```

In `frontend/angular.json`, if the `serve` target has `"proxyConfig": "proxy.conf.json"`, remove that line. Run:
`grep -n "proxyConfig" frontend/angular.json || echo "no proxyConfig"`
If found, delete the `proxyConfig` property from the serve options.

Replace `frontend/vercel.json` with (SPA fallback only — no backend to proxy):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/frontend/browser",
  "rewrites": [
    { "source": "/:path*", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Remove obsolete backend-bundling artifacts**

```bash
rm -f build.sh build.bat render.yaml backend/Dockerfile
rm -rf backend/src/main/resources/static/*
```
(The `backend/` Java source stays in the repo for reference but is no longer built or run.)

- [ ] **Step 4: Update DEPLOY.md**

Replace `DEPLOY.md` with:

```markdown
# Deploying BPM Tracker

BPM Tracker is a static Angular SPA backed by **Supabase** (Auth + Postgres).
There is no server to run — the Java `backend/` is retired and kept only for
reference.

## Requirements
- Node 18+ and npm (to build the frontend)
- A Supabase project (see `docs/superpowers/specs/2026-05-30-supabase-cloud-storage-design.md`)

## Configure
Set your project URL + anon key in `frontend/src/environments/environment.ts`.

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
(enforced by Row-Level Security).
```

- [ ] **Step 5: Verify it builds and serves config-free**

Run (from `frontend/`): `npm run build`
Expected: build succeeds with no reference to a backend or proxy.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: retire Spring Boot backend, switch to static SPA + Supabase"
```

---

## Task 12: Manual end-to-end verification

**Files:** none (verification).

- [ ] **Step 1: Run the app**

Run (from `frontend/`): `npm start`
Open `http://localhost:4200`. Expected: the login screen (not the workspace).

- [ ] **Step 2: Sign up**

Create an account with a test email + password. Expected: immediate login (no confirmation email), workspace appears empty.

- [ ] **Step 3: CRUD + derived state**

- Create a folder → it appears in the rail.
- Create a song in it → song list shows it; folder song-count = 1.
- Add a part with total bars = 8 → part shows `UNLEARNT`.
- Increase learnt bars to 8 → part shows `LEARNT`; song's learnt-part count increments.
- Set learnt to partial → `LEARNING`.

- [ ] **Step 4: Persistence**

Reload the page. Expected: still logged in, all data present.

- [ ] **Step 5: Cascade rules**

- Delete the folder → its song becomes unfiled (appears under "Unfiled"/all), not deleted.
- Delete the song → its parts disappear.

- [ ] **Step 6: RLS isolation**

Log out. Sign up as a *second* user. Expected: empty workspace — none of the first user's data is visible. (Confirms RLS.)

- [ ] **Step 7: Record result**

If all steps pass, the feature is complete. If any step fails, use superpowers:systematic-debugging before patching.

---

## Self-review notes (for the implementer)

- **Spec coverage:** schema+RLS (Task 1), client+config (Task 2), ported business rules (Tasks 3–4,6–7), ApiService rewrite (Tasks 5–7), auth (Task 8–9), gating (Task 10), backend retirement + hosting docs (Task 11), testing (Tasks 3–4 unit + Task 12 E2E). No migration (descoped) — correct.
- **Signatures preserved:** every `ApiService` public method keeps its original signature and `Observable` return, so `Store`/components are untouched.
- **Derived fields:** `learntState`, `songCount`, `partCount`, `learntPartCount` are computed, never stored — matches spec.
