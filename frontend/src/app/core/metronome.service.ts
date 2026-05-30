import { Injectable, signal } from '@angular/core';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

@Injectable({ providedIn: 'root' })
export class MetronomeService {
  readonly running = signal(false);
  readonly bpm = signal(60);
  readonly tickCount = signal(0);

  private audioCtx: AudioContext | null = null;
  private timer: number | null = null;
  private nextTickTime = 0;

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

  private schedule() {
    if (!this.audioCtx || !this.running()) return;
    const secondsPerBeat = 60 / this.bpm();
    while (this.nextTickTime < this.audioCtx.currentTime + SCHEDULE_AHEAD_S) {
      this.playClick(this.nextTickTime);
      this.scheduleVisualTick(this.nextTickTime);
      this.nextTickTime += secondsPerBeat;
    }
  }

  private playClick(time: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 950;
    gain.gain.value = 0.18;
    osc.connect(gain).connect(this.audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.04);
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
