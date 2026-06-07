import { describe, it, expect } from 'vitest';
import { parseArena, ARENA_A } from '../arena.js';
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

describe('ARENA_A', () => {
  it('is 18 rows of 32 columns', () => {
    expect(ARENA_A).toHaveLength(18);
    for (const row of ARENA_A) expect(row).toHaveLength(32);
  });
  it('has at least one spawn', () => {
    expect(parseArena(ARENA_A).spawns.length).toBeGreaterThan(0);
  });
});
