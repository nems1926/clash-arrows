import { describe, it, expect } from 'vitest';
import { createArrow, spawnArrow, updateArrow } from '../arrow.js';
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
    expect(a.vx).toBeCloseTo(220, 5);
    expect(a.vy).toBeCloseTo(0, 5);
    expect(a.owner).toBe(0);
  });

  it('falls under arrow gravity and advances', () => {
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, cfg());
    updateArrow(a, cfg(), emptyGrid, DT);
    expect(a.x).toBeGreaterThan(100);
    expect(a.vy).toBeGreaterThan(0);
    expect(a.ageFrames).toBe(1);
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
});
