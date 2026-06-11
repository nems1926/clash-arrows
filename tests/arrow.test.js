import { describe, it, expect } from 'vitest';
import { createArrow, spawnArrow, updateArrow, createPool, acquire, release, ARROW_TYPES, splitDirections } from '../arrow.js';
import { arrowBoxHitsTile, SOLID, ONEWAY, DESTRUCT } from '../tilemap.js';
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

  it('carries the arrow type from spawn (default normal)', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, c);            // no type → normal
    expect(a.type).toBe('normal');
    spawnArrow(a, 100, 50, 1, 0, 0, c, 'bomb');    // explicit type
    expect(a.type).toBe('bomb');
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

describe('bomb arrow impact', () => {
  it('exposes a color per type', () => {
    expect(ARROW_TYPES.normal.color).toBeTruthy();
    expect(ARROW_TYPES.bomb.color).toBeTruthy();
  });
  it('a bomb arrow goes to EXPLODE on terrain impact (normal goes STUCK)', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    grid[5][12] = 1; // solid
    const bomb = createArrow();
    spawnArrow(bomb, 110, 55, 1, 0, 0, c, 'bomb');
    for (let i = 0; i < 10 && bomb.state === 'IN_FLIGHT'; i++) updateArrow(bomb, c, grid, DT);
    expect(bomb.state).toBe('EXPLODE');
    const normal = createArrow();
    spawnArrow(normal, 110, 55, 1, 0, 0, c, 'normal');
    for (let i = 0; i < 10 && normal.state === 'IN_FLIGHT'; i++) updateArrow(normal, c, grid, DT);
    expect(normal.state).toBe('STUCK');
  });
});

describe('arrow type table & typed spawn (J3)', () => {
  it('exposes the new types with their flags', () => {
    expect(ARROW_TYPES.superbomb.explosive).toBe(true);
    expect(ARROW_TYPES.superbomb.radiusMult).toBe(2);
    expect(ARROW_TYPES.laser.bounces).toBe(3);
    expect(ARROW_TYPES.laser.flat).toBe(true);
    expect(ARROW_TYPES.bolt.splitCount).toBe(3);
    expect(ARROW_TYPES.drill.pierces).toBe(true);
  });
  it('spawn applies speedMult and inits bounces', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, c, 'laser');
    expect(a.vx).toBeCloseTo(c.arrowSpeed * 1.6, 5);
    expect(a.bounces).toBe(3);
    const n = createArrow();
    spawnArrow(n, 100, 50, 1, 0, 0, c, 'normal');
    expect(n.vx).toBeCloseTo(c.arrowSpeed, 5);
    expect(n.bounces).toBe(0);
  });
  it('flat arrows ignore gravity past the straight distance', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 0, 50, 1, 0, 0, c, 'laser'); // flat
    a.traveled = c.arrowStraightDist + 10;     // past gravity onset
    updateArrow(a, c, emptyGrid, DT);
    expect(a.vy).toBe(0);                       // still no gravity
  });
});

describe('drill arrow pierces thin tiles, stops on solid', () => {
  it('passes one-way and destructible, plants on the first solid', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    grid[5][12] = ONEWAY;   // x 120..130, drill passes
    grid[5][15] = DESTRUCT; // x 150..160, drill passes
    // Solid wall at col 18 (x 180..190): fill multiple rows so the
    // ballistic arc of the drill (which drifts downward) hits it regardless of row
    for (let row = 5; row <= 9; row++) grid[row][18] = SOLID;
    const drill = createArrow();
    spawnArrow(drill, 100, 55, 1, 0, 0, c, 'drill'); // row5
    for (let i = 0; i < 80 && drill.state === 'IN_FLIGHT'; i++) updateArrow(drill, c, grid, DT);
    expect(drill.state).toBe('STUCK');
    expect(drill.x).toBeGreaterThan(160); // got past the one-way and destructible
  });
});

describe('impale carry state', () => {
  it('une flèche neuve démarre sans corps porté', () => {
    const a = createArrow();
    expect(a.carryIds).toEqual([]);
  });
  it('spawnArrow réinitialise carryIds', () => {
    const a = createArrow();
    a.carryIds = [2, 3];
    spawnArrow(a, 0, 0, 1, 0, 0, DEFAULT_CONFIG, 'normal');
    expect(a.carryIds).toEqual([]);
  });
  it('release réinitialise carryIds', () => {
    const pool = createPool(1);
    pool[0].carryIds = [1];
    release(pool, pool[0]);
    expect(pool[0].carryIds).toEqual([]);
  });
});

describe('laser arrow bounces then plants', () => {
  it('reflects velocity on a wall and decrements bounces', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let r = 0; r < 18; r++) grid[r][20] = SOLID; // vertical wall at x 200
    const laser = createArrow();
    spawnArrow(laser, 100, 55, 1, 0, 0, c, 'laser');
    let bounced = false;
    for (let i = 0; i < 60 && !bounced; i++) {
      updateArrow(laser, c, grid, DT);
      if (laser.vx < 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(laser.bounces).toBe(2);
    expect(laser.state).toBe('IN_FLIGHT');
  });
  it('plants (STUCK) after exhausting its bounces', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let r = 0; r < 18; r++) { grid[r][10] = SOLID; grid[r][20] = SOLID; } // corridor
    const laser = createArrow();
    spawnArrow(laser, 150, 55, 1, 0, 0, c, 'laser');
    for (let i = 0; i < 600 && laser.state === 'IN_FLIGHT'; i++) updateArrow(laser, c, grid, DT);
    expect(laser.state).toBe('STUCK');
    expect(laser.bounces).toBe(0);
  });
});

describe('splitDirections (bolt fan)', () => {
  it('returns count unit vectors fanned around the base direction', () => {
    const dirs = splitDirections(1, 0, 3, Math.PI / 6);
    expect(dirs).toHaveLength(3);
    expect(dirs[1].x).toBeCloseTo(1, 5);
    expect(dirs[1].y).toBeCloseTo(0, 5);
    expect(dirs[0].y).toBeCloseTo(Math.sin(-Math.PI / 6), 5);
    expect(dirs[2].y).toBeCloseTo(Math.sin(Math.PI / 6), 5);
    for (const d of dirs) expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 5);
  });
  it('a single fragment points along the base direction', () => {
    const dirs = splitDirections(0, 1, 1, Math.PI / 6);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].x).toBeCloseTo(0, 5);
    expect(dirs[0].y).toBeCloseTo(1, 5);
  });
});

describe('bolt arrow splits on impact', () => {
  it('reaches SPLIT state on terrain impact', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let r = 0; r < 18; r++) grid[r][20] = SOLID;
    const bolt = createArrow();
    spawnArrow(bolt, 100, 55, 1, 0, 0, c, 'bolt');
    for (let i = 0; i < 40 && bolt.state === 'IN_FLIGHT'; i++) updateArrow(bolt, c, grid, DT);
    expect(bolt.state).toBe('SPLIT');
  });
});
