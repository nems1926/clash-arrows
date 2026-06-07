import { describe, it, expect } from 'vitest';
import { createPlayer, updatePlayer } from '../player.js';
import { DEFAULT_CONFIG } from '../config.js';
import { aimVector } from '../aim.js';

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

const press = (over = {}) => ({ moveX: 0, jumpHeld: true, jumpPressed: true, down: false, ...over });
const idle = (over = {}) => ({ moveX: 0, jumpHeld: false, jumpPressed: false, down: false, ...over });
const full = (over = {}) => ({ moveX: 0, up: false, down: false, jumpHeld: false, jumpPressed: false, shootPressed: false, dodgePressed: false, ...over });

// a left wall in column 0, no floor reachable quickly
const wallGridP = [
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
];

describe('player jump & states', () => {
  it('jumps when grounded', () => {
    const p = createPlayer(10, 0, cfg());
    for (let i = 0; i < 120; i++) updatePlayer(p, idle(), cfg(), grid, DT); // settle on floor
    expect(p.grounded).toBe(true);
    updatePlayer(p, press(), cfg(), grid, DT);
    expect(p.vy).toBeLessThan(0); // moving up
  });

  it('allows a coyote jump shortly after leaving the ground', () => {
    const c = cfg();
    const p = createPlayer(10, 0, c);
    for (let i = 0; i < 120; i++) updatePlayer(p, idle(), c, grid, DT);
    p.grounded = false;           // simulate just walked off an edge
    p.coyote = c.coyoteFrames;
    updatePlayer(p, press(), c, grid, DT);
    expect(p.vy).toBeLessThan(0);
  });

  it('cuts ascent when the jump button is released (variable height)', () => {
    const c = cfg();
    // start mid-air (y=15), not at the top edge: in this tiny 4-row grid y=0
    // wraps toroidally into the solid floor row, causing a spurious ceiling hit.
    const p = createPlayer(10, 15, c);
    p.vy = -150;
    p.jumpHeldPrev = true;
    updatePlayer(p, idle(), c, grid, DT); // released this frame, still ascending
    expect(p.vy).toBeGreaterThan(-150 * c.jumpCutMult - 50); // roughly halved (plus gravity)
    expect(p.vy).toBeLessThan(0);
  });

  it('wall-slides: caps fall speed when pushing into a wall', () => {
    const c = cfg();
    const p = createPlayer(10, 5, c); // x=10 → left edge flush to col 0 wall
    p.vy = c.vFallMax;
    updatePlayer(p, idle({ moveX: -1 }), c, wallGridP, DT);
    expect(p.vy).toBeLessThanOrEqual(c.vSlide + 0.001);
    expect(p.state).toBe('WALLSLIDE');
  });

  it('wall-jumps away from the wall', () => {
    const c = cfg();
    const p = createPlayer(10, 5, c);
    p.vy = 10;
    updatePlayer(p, press({ moveX: -1 }), c, wallGridP, DT);
    expect(p.vy).toBeLessThan(0);  // upward
    expect(p.vx).toBeGreaterThan(0); // pushed right, away from left wall
  });

  it('applies reduced gravity near the apex', () => {
    const c = cfg();
    const p = createPlayer(10, 0, c); p.vy = 0; // |vy| < apexVyThreshold
    updatePlayer(p, idle(), c, grid, DT);
    const gain = p.vy - 0;
    expect(gain).toBeLessThan(c.gravity * DT); // reduced, not full gravity
    expect(gain).toBeCloseTo(c.gravity * c.apexGravityMult * DT, 3); // exactly the reduced amount
  });

  it('reports GROUNDED state on the floor', () => {
    const p = createPlayer(10, 0, cfg());
    for (let i = 0; i < 120; i++) updatePlayer(p, idle(), cfg(), grid, DT);
    expect(p.state).toBe('GROUNDED');
  });
});

describe('dodge', () => {
  it('enters DODGING with invuln on dodgePressed', () => {
    const c = cfg();
    const p = createPlayer(15, 5, c);
    updatePlayer(p, full({ dodgePressed: true, moveX: 1 }), c, grid, DT);
    expect(p.state).toBe('DODGING');
    expect(p.invulnTime).toBeGreaterThan(0);
    expect(p.dodgeTime).toBeGreaterThan(0);
  });
  it('does not re-dodge during cooldown', () => {
    const c = cfg();
    const p = createPlayer(15, 5, c);
    updatePlayer(p, full({ dodgePressed: true }), c, grid, DT);
    for (let i = 0; i < c.dodgeDuration + 1; i++) updatePlayer(p, full(), c, grid, DT);
    p.dodgeCooldownTimer = c.dodgeCooldown; // still cooling
    updatePlayer(p, full({ dodgePressed: true }), c, grid, DT);
    expect(p.state).not.toBe('DODGING');
  });
  it('dash keeps its speed (not clamped by normal accel)', () => {
    const c = cfg();
    const p = createPlayer(15, 5, c);
    updatePlayer(p, full({ dodgePressed: true, moveX: 1 }), c, grid, DT);
    // dash speed (180) exceeds vMax (90); during the dodge vx must stay > vMax
    expect(Math.abs(p.vx)).toBeGreaterThan(c.vMax);
  });
});

describe('player aim & quiver', () => {
  it('starts with a full quiver and faces right', () => {
    const p = createPlayer(10, 0, cfg());
    expect(p.quiver).toHaveLength(DEFAULT_CONFIG.quiverStart);
    expect(p.quiver.every((t) => t === 'normal')).toBe(true);
    expect(p.shield).toBe(false);
    expect(p.facing).toBe(1);
  });
  it('updates aimDir from the held direction', () => {
    const c = cfg();
    const p = createPlayer(10, 0, c);
    updatePlayer(p, { moveX: 1, up: true, jumpHeld: false, jumpPressed: false, down: false }, c, grid, DT);
    const expected = aimVector({ moveX: 1, up: true, down: false }, p.facing);
    expect(p.aimDir.x).toBeCloseTo(expected.x, 5);
    expect(p.aimDir.y).toBeCloseTo(expected.y, 5);
  });
});
