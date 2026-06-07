import { arrowBoxHitsTile, wrap } from './tilemap.js';

export function createArrow() {
  return {
    active: false, state: 'STUCK',
    x: 0, y: 0, vx: 0, vy: 0,
    dirX: 1, dirY: 0,        // launch direction, kept for stuck orientation
    owner: -1, ageFrames: 0,
    type: 'normal',
    traveled: 0,             // path distance flown so far (gates gravity onset)
    w: 6, h: 2,
  };
}

// (Re)activate a pooled arrow flying from (x,y) along unit vector (dx,dy).
export function spawnArrow(a, x, y, dx, dy, owner, cfg, type = 'normal') {
  a.active = true;
  a.state = 'IN_FLIGHT';
  a.x = x; a.y = y;
  a.dirX = dx; a.dirY = dy;
  a.vx = dx * cfg.arrowSpeed;
  a.vy = dy * cfg.arrowSpeed;
  a.owner = owner;
  a.ageFrames = 0;
  a.traveled = 0;
  a.type = type;
  return a;
}

export function updateArrow(a, cfg, grid, dt) {
  if (!a.active || a.state !== 'IN_FLIGHT') return a;
  a.ageFrames++;
  // Straight flight first: gravity only kicks in after the arrow has flown
  // ~a third of the screen (cfg.arrowStraightDist), giving a flat shot that
  // then arcs down.
  if (a.traveled >= cfg.arrowStraightDist) {
    a.vy += cfg.arrowGravity * dt;
  }
  // Sub-step the move (~1px increments) so a fast arrow plants flush against the
  // surface it hits instead of overshooting and burying its AABB inside the tile
  // (which left it unpickable). On contact, rest at the last clear position.
  const dx = a.vx * dt;
  const dy = a.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  const sx = dx / steps;
  const sy = dy / steps;
  const stepDist = Math.hypot(sx, sy);
  for (let i = 0; i < steps; i++) {
    const nx = wrap(a.x + sx, cfg.W);
    const ny = wrap(a.y + sy, cfg.H);
    if (arrowBoxHitsTile(grid, nx, ny, a.w, a.h, cfg.TILE)) {
      a.state = 'STUCK';
      a.vx = 0; a.vy = 0;
      return a; // rest at the last clear position (a.x, a.y)
    }
    a.x = nx;
    a.y = ny;
    a.traveled += stepDist;
  }
  return a;
}

export function createPool(n) {
  return Array.from({ length: n }, () => createArrow());
}

// Returns an inactive arrow marked active, or null if the pool is exhausted.
export function acquire(pool) {
  for (const a of pool) {
    if (!a.active) { a.active = true; return a; }
  }
  return null;
}

export function release(pool, a) {
  a.active = false;
  a.state = 'STUCK';
}
