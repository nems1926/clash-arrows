import { describe, it, expect } from 'vitest';
import { createArrow, spawnArrow, updateArrow, createPool, acquire, release } from '../arrow.js';
import { arrowBoxHitsTile } from '../tilemap.js';
import { DEFAULT_CONFIG } from '../config.js';

const DT = 1 / 60;
const cfg = () => ({ ...DEFAULT_CONFIG });
const emptyGrid = Array.from({ length: 18 }, () => Array(32).fill(0));

describe('arrow ballistics', () => {
  it('spawns in flight with velocity from the aim vector', () => {
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, cfg());
    expect(a.state).toBe('IN_FLIGHT');
    expect(a.active).toBe(true);
    expect(a.vx).toBeCloseTo(DEFAULT_CONFIG.arrowSpeed, 5);
    expect(a.vy).toBeCloseTo(0, 5);
    expect(a.owner).toBe(0);
  });

  it('flies straight (no gravity) for the first ~third of the screen', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 0, 50, 1, 0, 0, c); // fired right from the left edge
    updateArrow(a, c, emptyGrid, DT);
    expect(a.x).toBeGreaterThan(0);   // advances
    expect(a.vy).toBe(0);             // straight phase: no gravity yet
    expect(a.ageFrames).toBe(1);
  });

  it('starts falling once it has travelled past arrowStraightDist', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 0, 50, 1, 0, 0, c);
    // fly until just past the straight distance
    for (let i = 0; i < 500 && a.traveled < c.arrowStraightDist; i++) {
      updateArrow(a, c, emptyGrid, DT);
    }
    expect(a.vy).toBe(0);             // still straight right at the threshold
    updateArrow(a, c, emptyGrid, DT); // one more step → gravity engages
    expect(a.vy).toBeGreaterThan(0);
  });

  it('plants (STUCK) when it reaches a solid tile', () => {
    const grid = emptyGrid.map((r) => r.slice());
    grid[5][12] = 1; // solid at col12,row5 → x∈[120,130], y∈[50,60]
    const a = createArrow();
    spawnArrow(a, 110, 55, 1, 0, 0, cfg()); // flying right into it
    for (let i = 0; i < 10 && a.state === 'IN_FLIGHT'; i++) updateArrow(a, cfg(), grid, DT);
    expect(a.state).toBe('STUCK');
  });

  it('wraps horizontally', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, c.W - 1, 50, 1, 0, 0, c);
    updateArrow(a, c, emptyGrid, DT);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThan(c.W);
  });

  it('rests against the floor without burying (pickup-able)', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let col = 0; col < 32; col++) grid[10][col] = 1; // floor top at y=100
    const a = createArrow();
    spawnArrow(a, 100, 95, 0, 1, 0, c); // fired straight down at the floor
    for (let i = 0; i < 60 && a.state === 'IN_FLIGHT'; i++) updateArrow(a, c, grid, DT);
    expect(a.state).toBe('STUCK');
    // not buried: the resting AABB overlaps no solid tile
    expect(arrowBoxHitsTile(grid, a.x, a.y, a.w, a.h, c.TILE)).toBe(false);
    // and it rests flush on the floor surface (bottom ≈ y=100), not sunk in
    expect(a.y + a.h).toBeLessThanOrEqual(100.001);
    expect(a.y + a.h).toBeGreaterThan(98);
  });
});

describe('arrow pool', () => {
  it('reuses released arrows instead of growing', () => {
    const pool = createPool(2);
    const a = acquire(pool);
    const b = acquire(pool);
    expect(acquire(pool)).toBe(null); // exhausted
    release(pool, a);
    expect(acquire(pool)).toBe(a);    // recycled
    expect(b.active).toBe(true);
  });
});
