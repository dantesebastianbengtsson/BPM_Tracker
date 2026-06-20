import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Folder, Part, Song, SongUpsert, FolderUpsert, PartUpsert } from './models';
import { avgWorkingBpm } from './derive';

// Special folder ids used by the UI sidebar.
export const ALL_SONGS = '__all__';
export const UNFILED = '__unfiled__';

@Injectable({ providedIn: 'root' })
export class Store {
  private api = inject(ApiService);

  readonly folders = signal<Folder[]>([]);
  readonly songs = signal<Song[]>([]);
  readonly parts = signal<Part[]>([]);

  readonly selectedFolderId = signal<string>(ALL_SONGS);
  readonly selectedSongId = signal<string | null>(null);
  readonly selectedPartId = signal<string | null>(null);
  readonly songQuery = signal('');

  readonly visibleSongs = computed(() => {
    const fid = this.selectedFolderId();
    let list = this.songs();
    if (fid === UNFILED) list = list.filter(s => s.folderId === null);
    else if (fid !== ALL_SONGS) list = list.filter(s => s.folderId === fid);
    const q = this.songQuery().trim().toLowerCase();
    if (q) list = list.filter(s => s.title.toLowerCase().includes(q));
    return list;
  });

  readonly selectedSong = computed(() =>
    this.songs().find(s => s.id === this.selectedSongId()) ?? null
  );

  readonly selectedPart = computed(() =>
    this.parts().find(p => p.id === this.selectedPartId()) ?? null
  );

  async loadAll() {
    const [folders, songs] = await Promise.all([
      firstValueFrom(this.api.listFolders()),
      firstValueFrom(this.api.listSongs()),
    ]);
    this.folders.set(folders);
    this.songs.set(songs);
    if (!this.selectedSongId() && songs.length) {
      this.selectSong(songs[0].id);
    }
  }

  selectFolder(id: string) {
    this.selectedFolderId.set(id);
  }

  async selectSong(songId: string | null) {
    this.selectedSongId.set(songId);
    if (songId) {
      const parts = await firstValueFrom(this.api.listParts(songId));
      this.parts.set(parts);
      this.selectedPartId.set(parts[0]?.id ?? null);
    } else {
      this.parts.set([]);
      this.selectedPartId.set(null);
    }
  }

  selectPart(partId: string | null) {
    this.selectedPartId.set(partId);
  }

  // Folder ops
  async createFolder(name: string) {
    const f = await firstValueFrom(this.api.createFolder({ name }));
    this.folders.update(list => [...list, f]);
    this.selectFolder(f.id);
  }
  async renameFolder(id: string, body: FolderUpsert) {
    const updated = await firstValueFrom(this.api.renameFolder(id, body));
    this.folders.update(list => list.map(f => f.id === id ? updated : f));
  }
  async deleteFolder(id: string) {
    await firstValueFrom(this.api.deleteFolder(id));
    this.folders.update(list => list.filter(f => f.id !== id));
    this.songs.update(list => list.map(s => s.folderId === id ? { ...s, folderId: null } : s));
    if (this.selectedFolderId() === id) this.selectFolder(ALL_SONGS);
  }

  // Song ops
  async createSong(body: SongUpsert) {
    const s = await firstValueFrom(this.api.createSong(body));
    this.songs.update(list => [...list, s]);
    await this.selectSong(s.id);
  }
  async updateSong(id: string, body: SongUpsert) {
    const s = await firstValueFrom(this.api.updateSong(id, body));
    this.songs.update(list => list.map(x => x.id === id ? s : x));
  }
  async deleteSong(id: string) {
    await firstValueFrom(this.api.deleteSong(id));
    this.songs.update(list => list.filter(s => s.id !== id));
    if (this.selectedSongId() === id) {
      const next = this.visibleSongs()[0]?.id ?? null;
      await this.selectSong(next);
    }
  }

  // Part ops
  async createPart(songId: string, body: PartUpsert) {
    const p = await firstValueFrom(this.api.createPart(songId, body));
    this.parts.update(list => [...list, p]);
    this.refreshSongCountsFor(songId);
    this.selectPart(p.id);
  }
  async updatePart(id: string, body: PartUpsert) {
    const p = await firstValueFrom(this.api.updatePart(id, body));
    this.parts.update(list => list.map(x => x.id === id ? p : x));
    this.refreshSongCountsFor(p.songId);
  }
  async deletePart(id: string) {
    const removed = this.parts().find(p => p.id === id);
    await firstValueFrom(this.api.deletePart(id));
    this.parts.update(list => list.filter(p => p.id !== id));
    if (this.selectedPartId() === id) {
      this.selectedPartId.set(this.parts()[0]?.id ?? null);
    }
    if (removed) this.refreshSongCountsFor(removed.songId);
  }
  async adjustBars(id: string, delta: number) {
    const p = await firstValueFrom(this.api.adjustBars(id, delta));
    this.parts.update(list => list.map(x => x.id === id ? p : x));
    this.refreshSongCountsFor(p.songId);
  }
  async setLearntBars(id: string, bars: number) {
    const p = await firstValueFrom(this.api.setLearntBars(id, bars));
    this.parts.update(list => list.map(x => x.id === id ? p : x));
    this.refreshSongCountsFor(p.songId);
  }

  private refreshSongCountsFor(songId: string) {
    const songParts = this.parts().filter(p => p.songId === songId);
    const total = songParts.length;
    const learnt = songParts.filter(p => p.learntState === 'LEARNT').length;
    const avg = avgWorkingBpm(songParts);
    this.songs.update(list => list.map(s => s.id === songId
      ? { ...s, partCount: total, learntPartCount: learnt, avgBpm: avg }
      : s));
  }
}
