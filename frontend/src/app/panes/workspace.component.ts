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

  protected editing = signal(false);
  protected editTitle = signal('');
  protected editTotal = signal(1);

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
    // Sync metronome BPM to active part.
    effect(() => {
      const p = this.part();
      if (p) this.metronome.setBpm(p.workingBpm);
      else this.metronome.stop();
    });
  }

  startCreatePart() {
    this.creatingPart.set(true);
    this.newPartTitle.set('');
    this.newPartBars.set(1);
    queueMicrotask(() => document.getElementById('new-part-title')?.focus());
  }
  cancelCreatePart() { this.creatingPart.set(false); }
  async commitCreatePart() {
    const song = this.song();
    if (!song) return;
    const title = this.newPartTitle().trim();
    if (!title) { this.cancelCreatePart(); return; }
    await this.store.createPart(song.id, {
      title,
      workingBpm: song.goalBpm,
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
  }
  cancelEditPart() { this.editing.set(false); }
  async commitEditPart() {
    const p = this.part();
    if (!p) return;
    const title = this.editTitle().trim();
    if (!title) { this.editing.set(false); return; }
    await this.store.updatePart(p.id, {
      title,
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
      workingBpm: next,
      totalBars: p.totalBars,
    });
  }

  async setBpmInput(v: number) {
    const p = this.part();
    if (!p) return;
    const next = Math.max(20, Math.min(260, Math.round(v)));
    if (next === p.workingBpm) return;
    await this.store.updatePart(p.id, {
      title: p.title,
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
