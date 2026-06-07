import { describe, it, expect } from 'vitest';
import { parseArena, ARENA_A, ARENAS, pickRandomArena } from '../arena.js';
import { SOLID, ONEWAY, EMPTY, DESTRUCT } from '../tilemap.js';

describe('parseArena', () => {
  it('maps characters to cell codes and collects spawns', () => {
    const { grid, spawns } = parseArena(['#=.', '..S']);
    expect(grid[0]).toEqual([SOLID, ONEWAY, EMPTY]);
    expect(grid[1]).toEqual([EMPTY, EMPTY, EMPTY]); // S is walkable space
    expect(spawns).toEqual([{ col: 2, row: 1 }]);
  });
});

describe('parseArena destructibles', () => {
  it('maps % to DESTRUCT', () => {
    const { grid } = parseArena(['..%..']);
    expect(grid[0][2]).toBe(DESTRUCT);
  });
});

describe('parseArena pickup spawns', () => {
  it('collects P cells into pickupSpawns (as empty tiles)', () => {
    const { grid, pickupSpawns } = parseArena(['..P..']);
    expect(pickupSpawns).toContainEqual({ col: 2, row: 0 });
    expect(grid[0][2]).toBe(0); // EMPTY, walkable
  });
});

describe('ARENA_A', () => {
  it('is 18 rows of 32 columns', () => {
    expect(ARENA_A).toHaveLength(18);
    for (const row of ARENA_A) expect(row).toHaveLength(32);
  });
  it('has at least one spawn', () => {
    expect(parseArena(ARENA_A).spawns.length).toBeGreaterThan(0);
  });
});

describe('arena set', () => {
  it('exposes 3 arenas', () => {
    expect(ARENAS).toHaveLength(3);
  });
  it('every arena is 32x18, has >=4 player spawns and >=1 pickup spawn', () => {
    for (const ascii of ARENAS) {
      expect(ascii).toHaveLength(18);
      for (const row of ascii) expect(row).toHaveLength(32);
      const { spawns, pickupSpawns } = parseArena(ascii);
      expect(spawns.length).toBeGreaterThanOrEqual(4);
      expect(pickupSpawns.length).toBeGreaterThanOrEqual(1);
    }
  });
  it('pickRandomArena returns one of the arenas via injected rand', () => {
    expect(pickRandomArena(() => 0)).toBe(ARENAS[0]);
    expect(pickRandomArena(() => 0.99)).toBe(ARENAS[2]);
  });
});
