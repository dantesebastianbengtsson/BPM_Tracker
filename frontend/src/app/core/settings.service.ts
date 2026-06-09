import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type MetronomeSound = 'click' | 'wood' | 'beep';

const STORAGE_KEY = 'bpm-tracker-settings';

interface Persisted {
  theme: ThemeMode;
  sound: MetronomeSound;
  volume: number;       // 0..1
  beatsPerBar: number;  // 0 = no accent
}

const DEFAULTS: Persisted = { theme: 'light', sound: 'click', volume: 0.6, beatsPerBar: 0 };

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly theme = signal<ThemeMode>(DEFAULTS.theme);
  readonly sound = signal<MetronomeSound>(DEFAULTS.sound);
  readonly volume = signal(DEFAULTS.volume);
  readonly beatsPerBar = signal(DEFAULTS.beatsPerBar);

  private media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.load();
    effect(() => {
      this.persist();
      this.applyTheme();
    });
    this.media.addEventListener('change', () => {
      if (this.theme() === 'system') this.applyTheme();
    });
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = { ...DEFAULTS, ...JSON.parse(raw) } as Persisted;
      this.theme.set(s.theme);
      this.sound.set(s.sound);
      this.volume.set(Math.max(0, Math.min(1, s.volume)));
      this.beatsPerBar.set(s.beatsPerBar);
    } catch {
      // corrupt settings fall back to defaults
    }
  }

  private persist() {
    const s: Persisted = {
      theme: this.theme(),
      sound: this.sound(),
      volume: this.volume(),
      beatsPerBar: this.beatsPerBar(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
  }

  private applyTheme() {
    const mode = this.theme();
    const resolved = mode === 'system' ? (this.media.matches ? 'dark' : 'light') : mode;
    document.documentElement.setAttribute('data-theme', resolved);
  }
}
