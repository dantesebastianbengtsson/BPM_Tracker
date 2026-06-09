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

  // ---- Songs ----
  listSongs(opts?: { folderId?: string | null; unfiled?: boolean }): Observable<Song[]> {
    return from(this.fetchSongs(opts));
  }
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

  createSong(body: SongUpsert): Observable<Song> { return from(this.insertSong(body)); }
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

  updateSong(id: string, body: SongUpsert): Observable<Song> { return from(this.patchSong(id, body)); }
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

  deleteSong(id: string): Observable<void> { return from(this.removeSong(id)); }
  private async removeSong(id: string): Promise<void> {
    const { error } = await this.sb.from('songs').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Parts ----
  listParts(songId: string): Observable<Part[]> { return from(this.fetchParts(songId)); }
  private async fetchParts(songId: string): Promise<Part[]> {
    const { data, error } = await this.sb
      .from('parts').select('*').eq('song_id', songId)
      .order('position').order('created_at');
    if (error) throw error;
    return ((data ?? []) as PartRow[]).map(toPart);
  }

  createPart(songId: string, body: PartUpsert): Observable<Part> { return from(this.insertPart(songId, body)); }
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

  updatePart(id: string, body: PartUpsert): Observable<Part> { return from(this.patchPart(id, body)); }
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

  deletePart(id: string): Observable<void> { return from(this.removePart(id)); }
  private async removePart(id: string): Promise<void> {
    const { error } = await this.sb.from('parts').delete().eq('id', id);
    if (error) throw error;
  }

  adjustBars(id: string, delta: number): Observable<Part> { return from(this.applyBars(id, delta)); }
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

  setLearntBars(id: string, bars: number): Observable<Part> { return from(this.applyLearntBars(id, bars)); }
  private async applyLearntBars(id: string, bars: number): Promise<Part> {
    const { data: current, error: readErr } = await this.sb
      .from('parts').select('total_bars').eq('id', id).single();
    if (readErr) throw readErr;
    const next = clampLearntBars(bars, (current as { total_bars: number }).total_bars);
    const { data, error } = await this.sb
      .from('parts').update({ learnt_bars: next }).eq('id', id).select().single();
    if (error) throw error;
    return toPart(data as PartRow);
  }
}
