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

import { resolveX, resolveY, SOLID, TILE as TILE_CONST } from '../tilemap.js';

// 4 cols × 3 rows; a solid wall in column 2.
const wallGrid = [
  [0, 0, 1, 0],
  [0, 0, 1, 0],
  [0, 0, 1, 0],
];
const TILE = 10;

describe('resolveX', () => {
  it('moves freely when nothing is hit', () => {
    const r = resolveX(wallGrid, 0, 0, 8, 8, 5, TILE);
    expect(r).toEqual({ x: 5, hit: false, wallDir: 0 });
  });
  it('snaps against a wall on the right', () => {
    // AABB w=8 moving right into column 2 (x from 12 → wants 18)
    const r = resolveX(wallGrid, 12, 0, 8, 8, 6, TILE);
    expect(r.x).toBe(20 - 8); // right edge flush to col 2 left edge (x=20)
    expect(r.hit).toBe(true);
    expect(r.wallDir).toBe(1);
  });
  it('snaps against a wall on the left', () => {
    // column 2 spans x[20,30]; AABB at x=30 moving left into it
    const r = resolveX(wallGrid, 30, 0, 8, 8, -6, TILE);
    expect(r.x).toBe(30); // left edge flush to col 2 right edge (x=30)
    expect(r.hit).toBe(true);
    expect(r.wallDir).toBe(-1);
  });
});

// 3 cols × 3 rows, floor along the bottom row.
const floorGrid = [
  [0, 0, 0],
  [0, 0, 0],
  [1, 1, 1],
];

describe('resolveY (solids)', () => {
  it('falls freely when nothing is hit', () => {
    const r = resolveY(floorGrid, 0, 0, 8, 8, 5, TILE, false, 8);
    expect(r).toEqual({ y: 5, hit: false, grounded: false });
  });
  it('lands on the floor and reports grounded', () => {
    // floor top is y=20; AABB h=8 falling from y=14 wants y=20
    const r = resolveY(floorGrid, 0, 14, 8, 8, 6, TILE, false, 22);
    expect(r.y).toBe(20 - 8); // bottom flush to floor top
    expect(r.hit).toBe(true);
    expect(r.grounded).toBe(true);
  });
  it('bonks head on a ceiling when moving up', () => {
    const ceil = [[1, 1, 1], [0, 0, 0], [0, 0, 0]];
    const r = resolveY(ceil, 0, 12, 8, 8, -6, TILE, false, 20);
    expect(r.y).toBe(10); // top flush to ceiling bottom (row 0 spans [0,10])
    expect(r.hit).toBe(true);
    expect(r.grounded).toBe(false);
  });
});
