import { Injectable, inject, signal } from '@angular/core';
import { MetronomeSound, SettingsService } from './settings.service';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

// Per-preset synthesis: soft envelope bursts, nothing square or harsh.
const PRESETS: Record<MetronomeSound, {
  wave: OscillatorType; freq: number; accentFreq: number; decay: number; peak: number;
}> = {
  click: { wave: 'sine',     freq: 1300, accentFreq: 1800, decay: 0.06, peak: 0.5 },
  wood:  { wave: 'triangle', freq: 640,  accentFreq: 900,  decay: 0.08, peak: 0.7 },
  beep:  { wave: 'sine',     freq: 880,  accentFreq: 1100, decay: 0.09, peak: 0.4 },
};

@Injectable({ providedIn: 'root' })
export class MetronomeService {
  private settings = inject(SettingsService);

  readonly running = signal(false);
  readonly bpm = signal(60);
  readonly tickCount = signal(0);

  private audioCtx: AudioContext | null = null;
  private timer: number | null = null;
  private nextTickTime = 0;
  private beatIndex = 0;

  setBpm(bpm: number) {
    this.bpm.set(Math.max(20, Math.min(260, Math.round(bpm))));
    if (this.running() && this.audioCtx) {
      this.nextTickTime = this.audioCtx.currentTime + 0.05;
    }
  }

  toggle() {
    this.running() ? this.stop() : this.start();
  }

  start() {
    this.ensureCtx();
    if (!this.audioCtx) return;
    this.running.set(true);
    this.beatIndex = 0;
    this.nextTickTime = this.audioCtx.currentTime + 0.05;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop() {
    this.running.set(false);
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Play one click now — used by the options panel when trying sounds/volume. */
  preview() {
    this.ensureCtx();
    if (!this.audioCtx) return;
    this.playClick(this.audioCtx.currentTime, false);
  }

  private schedule() {
    if (!this.audioCtx || !this.running()) return;
    const secondsPerBeat = 60 / this.bpm();
    while (this.nextTickTime < this.audioCtx.currentTime + SCHEDULE_AHEAD_S) {
      const bpb = this.settings.beatsPerBar();
      const accent = bpb > 0 && this.beatIndex % bpb === 0;
      this.playClick(this.nextTickTime, accent);
      this.scheduleVisualTick(this.nextTickTime);
      this.nextTickTime += secondsPerBeat;
      this.beatIndex++;
    }
  }

  private playClick(time: number, accent: boolean) {
    if (!this.audioCtx) return;
    const p = PRESETS[this.settings.sound()];
    const peak = Math.max(0.0001, p.peak * this.settings.volume() * (accent ? 1.4 : 1));
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = p.wave;
    osc.frequency.value = accent ? p.accentFreq : p.freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + p.decay);
    osc.connect(gain).connect(this.audioCtx.destination);
    osc.start(time);
    osc.stop(time + p.decay + 0.02);
  }

  private scheduleVisualTick(time: number) {
    if (!this.audioCtx) return;
    const delay = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    window.setTimeout(() => this.tickCount.update(n => n + 1), delay);
  }

  private ensureCtx() {
    if (!this.audioCtx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
      this.audioCtx = new Ctor();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }
}
