import { LearntState } from './models';

export function learntStateOf(learntBars: number, totalBars: number): LearntState {
  if (learntBars <= 0 || totalBars <= 0) return 'UNLEARNT';
  if (learntBars >= totalBars) return 'LEARNT';
  return 'LEARNING';
}

export function clampLearntBars(learntBars: number, totalBars: number): number {
  return Math.max(0, Math.min(totalBars, learntBars));
}

export function countLearntParts(parts: { totalBars: number; learntBars: number }[]): number {
  return parts.filter(p => learntStateOf(p.learntBars, p.totalBars) === 'LEARNT').length;
}

export function nextPosition(existingCount: number): number {
  return existingCount;
}

export function avgWorkingBpm(parts: { workingBpm: number }[]): number | null {
  if (!parts.length) return null;
  return Math.round(parts.reduce((sum, p) => sum + p.workingBpm, 0) / parts.length);
}
