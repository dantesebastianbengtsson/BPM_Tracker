import { learntStateOf, clampLearntBars, countLearntParts, nextPosition, avgWorkingBpm } from './derive';

describe('learntStateOf', () => {
  it('is UNLEARNT when no bars learnt', () => {
    expect(learntStateOf(0, 8)).toBe('UNLEARNT');
  });
  it('is UNLEARNT when totalBars is 0', () => {
    expect(learntStateOf(0, 0)).toBe('UNLEARNT');
  });
  it('is LEARNT when all bars learnt', () => {
    expect(learntStateOf(8, 8)).toBe('LEARNT');
  });
  it('is LEARNT when learnt exceeds total', () => {
    expect(learntStateOf(9, 8)).toBe('LEARNT');
  });
  it('is LEARNING when partially learnt', () => {
    expect(learntStateOf(3, 8)).toBe('LEARNING');
  });
});

describe('clampLearntBars', () => {
  it('clamps below zero up to zero', () => {
    expect(clampLearntBars(-2, 8)).toBe(0);
  });
  it('clamps above total down to total', () => {
    expect(clampLearntBars(12, 8)).toBe(8);
  });
  it('leaves in-range values untouched', () => {
    expect(clampLearntBars(5, 8)).toBe(5);
  });
});

describe('countLearntParts', () => {
  it('counts only fully-learnt parts', () => {
    const parts = [
      { totalBars: 8, learntBars: 8 },
      { totalBars: 8, learntBars: 3 },
      { totalBars: 4, learntBars: 4 },
      { totalBars: 4, learntBars: 0 },
    ];
    expect(countLearntParts(parts)).toBe(2);
  });
});

describe('nextPosition', () => {
  it('returns the count of existing siblings', () => {
    expect(nextPosition(3)).toBe(3);
    expect(nextPosition(0)).toBe(0);
  });
});

describe('avgWorkingBpm', () => {
  it('returns null when parts array is empty', () => {
    expect(avgWorkingBpm([])).toBeNull();
  });
  it('returns the single value when there is one part', () => {
    expect(avgWorkingBpm([{ workingBpm: 90 }])).toBe(90);
  });
  it('returns the rounded mean of multiple parts', () => {
    expect(avgWorkingBpm([{ workingBpm: 80 }, { workingBpm: 90 }, { workingBpm: 85 }])).toBe(85);
  });
  it('rounds 0.5 up', () => {
    expect(avgWorkingBpm([{ workingBpm: 80 }, { workingBpm: 81 }])).toBe(81);
  });
});
