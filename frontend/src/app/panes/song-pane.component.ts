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
})
export class SongPaneComponent {
  protected store = inject(Store);
  protected ALL_SONGS = ALL_SONGS;
  protected UNFILED = UNFILED;

  protected creating = signal(false);
  protected newTitle = signal('');
  protected newBpm = signal(82);

  protected editingId = signal<string | null>(null);
  protected editTitle = signal('');
  protected editBpm = signal(82);

  protected headerLabel = computed(() => {
    const fid = this.store.selectedFolderId();
    if (fid === ALL_SONGS) return 'All songs';
    if (fid === UNFILED) return 'Unfiled';
    const f = this.store.folders().find(x => x.id === fid);
    return f?.name ?? 'Songs';
  });

  protected canCreate = computed(() => this.store.selectedFolderId() !== ALL_SONGS);

  protected currentFolderId(): string | null {
    const fid = this.store.selectedFolderId();
    if (fid === ALL_SONGS || fid === UNFILED) return null;
    return fid;
  }

  startCreate() {
    this.creating.set(true);
    this.newTitle.set('');
    this.newBpm.set(82);
    queueMicrotask(() => document.getElementById('new-song-title')?.focus());
  }
  cancelCreate() { this.creating.set(false); }
  async commitCreate() {
    const title = this.newTitle().trim();
    if (!title) { this.cancelCreate(); return; }
    await this.store.createSong({
      title,
      goalBpm: this.newBpm() || 82,
      folderId: this.currentFolderId(),
    });
    this.cancelCreate();
  }

  startEdit(s: Song, ev: Event) {
    ev.stopPropagation();
    this.editingId.set(s.id);
    this.editTitle.set(s.title);
    this.editBpm.set(s.goalBpm);
  }
  cancelEdit() { this.editingId.set(null); }
  async commitEdit(s: Song) {
    const title = this.editTitle().trim();
    if (!title) { this.cancelEdit(); return; }
    await this.store.updateSong(s.id, {
      title,
      goalBpm: this.editBpm() || s.goalBpm,
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
