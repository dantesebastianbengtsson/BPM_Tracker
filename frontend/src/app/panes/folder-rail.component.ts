import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store, ALL_SONGS, UNFILED } from '../core/store.service';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-folder-rail',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './folder-rail.component.html',
  styleUrl: './folder-rail.component.scss',
})
export class FolderRailComponent {
  protected store = inject(Store);
  protected ALL_SONGS = ALL_SONGS;
  protected UNFILED = UNFILED;

  protected creating = signal(false);
  protected newName = signal('');
  protected editingId = signal<string | null>(null);
  protected editName = signal('');

  protected unfiledCount = computed(() =>
    this.store.songs().filter(s => s.folderId === null).length
  );

  protected totalCount = computed(() => this.store.songs().length);

  startCreate() {
    this.creating.set(true);
    this.newName.set('');
    queueMicrotask(() => {
      (document.getElementById('new-folder-input') as HTMLInputElement | null)?.focus();
    });
  }

  cancelCreate() {
    this.creating.set(false);
    this.newName.set('');
  }

  async commitCreate() {
    const name = this.newName().trim();
    if (!name) { this.cancelCreate(); return; }
    await this.store.createFolder(name);
    this.cancelCreate();
  }

  startEdit(id: string, currentName: string, ev: Event) {
    ev.stopPropagation();
    this.editingId.set(id);
    this.editName.set(currentName);
    queueMicrotask(() => {
      const el = document.getElementById(`edit-folder-${id}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }

  async commitEdit(id: string) {
    const name = this.editName().trim();
    if (!name) { this.editingId.set(null); return; }
    await this.store.renameFolder(id, { name });
    this.editingId.set(null);
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  async remove(id: string, ev: Event) {
    ev.stopPropagation();
    if (!confirm('Delete this folder? Songs inside will move to Unfiled.')) return;
    await this.store.deleteFolder(id);
  }
}
