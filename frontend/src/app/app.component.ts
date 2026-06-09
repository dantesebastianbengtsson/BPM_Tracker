import { Component, effect, inject, signal } from '@angular/core';
import { FolderRailComponent } from './panes/folder-rail.component';
import { SongPaneComponent } from './panes/song-pane.component';
import { WorkspaceComponent } from './panes/workspace.component';
import { LoginComponent } from './auth/login.component';
import { IconComponent } from './ui/icon.component';
import { Store } from './core/store.service';
import { AuthService } from './core/auth.service';
import { MetronomeSound, SettingsService, ThemeMode } from './core/settings.service';
import { MetronomeService } from './core/metronome.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FolderRailComponent, SongPaneComponent, WorkspaceComponent, LoginComponent, IconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected auth = inject(AuthService);
  protected settings = inject(SettingsService);
  private metronome = inject(MetronomeService);
  private store = inject(Store);

  protected settingsOpen = signal(false);

  protected themes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  protected sounds: { value: MetronomeSound; label: string }[] = [
    { value: 'click', label: 'Click' },
    { value: 'wood', label: 'Wood' },
    { value: 'beep', label: 'Beep' },
  ];
  protected accents = [
    { value: 0, label: 'Off' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 6, label: '6' },
  ];

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.store.loadAll();
      }
    }, { allowSignalWrites: true });
  }

  setSound(s: MetronomeSound) {
    this.settings.sound.set(s);
    this.metronome.preview();
  }

  setVolume(value: string) {
    this.settings.volume.set(Number(value) / 100);
  }

  previewVolume() {
    this.metronome.preview();
  }
}
