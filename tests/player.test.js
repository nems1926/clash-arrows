import { describe, it, expect } from 'vitest';
import { createPlayer, updatePlayer } from '../player.js';
import { DEFAULT_CONFIG } from '../config.js';

const DT = 1 / 60;
const cfg = () => ({ ...DEFAULT_CONFIG });

// floor along bottom row of a 4×4 grid (10px tiles → 40×40 px)
const grid = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [1, 1, 1, 1],
];

describe('player core', () => {
  it('accelerates horizontally toward vMax', () => {
    const p = createPlayer(10, 0, cfg());
    updatePlayer(p, { moveX: 1, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vx).toBeLessThanOrEqual(DEFAULT_CONFIG.vMax);
  });

  it('gains downward velocity from gravity while airborne', () => {
    const p = createPlayer(10, 0, cfg());
    const before = p.vy;
    updatePlayer(p, { moveX: 0, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    expect(p.vy).toBeGreaterThan(before);
  });

  it('caps fall speed at vFallMax', () => {
    const p = createPlayer(10, 0, cfg());
    for (let i = 0; i < 600; i++) {
      updatePlayer(p, { moveX: 0, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    }
    expect(p.vy).toBeLessThanOrEqual(DEFAULT_CONFIG.vFallMax + 0.001);
  });

  it('lands on the floor and becomes grounded', () => {
    const p = createPlayer(10, 0, cfg()); // bottom row top is y=30; player h=12
    for (let i = 0; i < 120; i++) {
      updatePlayer(p, { moveX: 0, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    }
    expect(p.grounded).toBe(true);
    expect(p.y).toBeCloseTo(30 - DEFAULT_CONFIG.PLAYER_H, 5);
  });

  it('wraps horizontally past the right edge', () => {
    const c = cfg();
    const p = createPlayer(c.W - 2, 0, c);
    p.vx = c.vMax;
    updatePlayer(p, { moveX: 1, jumpHeld: false, jumpPressed: false, down: false }, c, grid, DT);
    expect(p.x).toBeLessThan(c.W);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });
});
