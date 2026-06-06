import { describe, it, expect } from 'vitest';
import { wrap, cellAt, isSolidAt } from '../tilemap.js';

const grid = [
  [0, 1, 0],
  [2, 0, 1],
];

describe('wrap', () => {
  it('wraps positive overflow', () => expect(wrap(325, 320)).toBe(5));
  it('wraps negative into range', () => expect(wrap(-3, 320)).toBe(317));
  it('leaves in-range values', () => expect(wrap(100, 320)).toBe(100));
});

describe('cellAt (modulo indexing)', () => {
  it('reads in-bounds cells', () => expect(cellAt(grid, 1, 0)).toBe(1));
  it('wraps column index', () => expect(cellAt(grid, 3, 0)).toBe(0)); // col 3 → 0
  it('wraps negative row', () => expect(cellAt(grid, 0, -1)).toBe(2)); // row -1 → 1
});

describe('isSolidAt', () => {
  it('true for solid', () => expect(isSolidAt(grid, 1, 0)).toBe(true));
  it('false for empty/oneway', () => {
    expect(isSolidAt(grid, 0, 0)).toBe(false);
    expect(isSolidAt(grid, 0, 1)).toBe(false); // oneway is not "solid"
  });
});
