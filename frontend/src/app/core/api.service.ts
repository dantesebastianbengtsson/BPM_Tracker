import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Folder, FolderUpsert,
  Song, SongUpsert,
  Part, PartUpsert,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  // Folders
  listFolders(): Observable<Folder[]> { return this.http.get<Folder[]>(`${this.base}/folders`); }
  createFolder(body: FolderUpsert): Observable<Folder> { return this.http.post<Folder>(`${this.base}/folders`, body); }
  renameFolder(id: string, body: FolderUpsert): Observable<Folder> { return this.http.patch<Folder>(`${this.base}/folders/${id}`, body); }
  deleteFolder(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/folders/${id}`); }

  // Songs
  listSongs(opts?: { folderId?: string | null; unfiled?: boolean }): Observable<Song[]> {
    let url = `${this.base}/songs`;
    const params: string[] = [];
    if (opts?.unfiled) params.push('unfiled=true');
    else if (opts?.folderId) params.push(`folderId=${encodeURIComponent(opts.folderId)}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.get<Song[]>(url);
  }
  createSong(body: SongUpsert): Observable<Song> { return this.http.post<Song>(`${this.base}/songs`, body); }
  updateSong(id: string, body: SongUpsert): Observable<Song> { return this.http.patch<Song>(`${this.base}/songs/${id}`, body); }
  deleteSong(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/songs/${id}`); }

  // Parts
  listParts(songId: string): Observable<Part[]> { return this.http.get<Part[]>(`${this.base}/songs/${songId}/parts`); }
  createPart(songId: string, body: PartUpsert): Observable<Part> { return this.http.post<Part>(`${this.base}/songs/${songId}/parts`, body); }
  updatePart(id: string, body: PartUpsert): Observable<Part> { return this.http.patch<Part>(`${this.base}/parts/${id}`, body); }
  deletePart(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/parts/${id}`); }
  adjustBars(id: string, delta: number): Observable<Part> { return this.http.post<Part>(`${this.base}/parts/${id}/bars`, { delta }); }
}
