import { arrowBoxStops, tileHitAxis, wrap } from './tilemap.js';

// Pluggable arrow types. Declarative fields drive behavior:
//  explosive  → terrain impact yields EXPLODE
//  radiusMult → multiplies cfg.explosionRadius on explosion
//  speedMult  → multiplies cfg.arrowSpeed at spawn
//  flat       → no gravity (straight shot)
//  bounces    → reflections off solid/destruct before planting (laser)
//  splitCount → fragments spawned on impact (bolt)
//  pierces    → only SOLID stops it (passes one-way/destructibles)
export const ARROW_TYPES = {
  normal:    { color: '#fcd34d' },
  bomb:      { color: '#fb7185', explosive: true },
  superbomb: { color: '#f43f5e', explosive: true, radiusMult: 2 },
  laser:     { color: '#38bdf8', speedMult: 1.6, flat: true, bounces: 3 },
  bolt:      { color: '#c084fc', speedMult: 2.0, flat: true, splitCount: 3 },
  drill:     { color: '#fbbf24', speedMult: 1.2, pierces: true },
};

export function createArrow() {
  return {
    active: false, state: 'STUCK',
    x: 0, y: 0, vx: 0, vy: 0,
    dirX: 1, dirY: 0,        // launch direction, kept for stuck orientation
    owner: -1, ageFrames: 0,
    type: 'normal',
    traveled: 0,             // path distance flown so far (gates gravity onset)
    bounces: 0,              // remaining laser reflections
    w: 6, h: 2,
  };
}

// (Re)activate a pooled arrow flying from (x,y) along unit vector (dx,dy).
export function spawnArrow(a, x, y, dx, dy, owner, cfg, type = 'normal') {
  const def = ARROW_TYPES[type] || {};
  const speed = cfg.arrowSpeed * (def.speedMult || 1);
  a.active = true;
  a.state = 'IN_FLIGHT';
  a.x = x; a.y = y;
  a.dirX = dx; a.dirY = dy;
  a.vx = dx * speed;
  a.vy = dy * speed;
  a.owner = owner;
  a.ageFrames = 0;
  a.traveled = 0;
  a.type = type;
  a.bounces = def.bounces || 0;
  return a;
}

export function updateArrow(a, cfg, grid, dt) {
  if (!a.active || a.state !== 'IN_FLIGHT') return a;
  a.ageFrames++;
  // Straight flight first: gravity only kicks in after the arrow has flown
  // ~a third of the screen (cfg.arrowStraightDist), giving a flat shot that
  // then arcs down.
  if (!ARROW_TYPES[a.type]?.flat && a.traveled >= cfg.arrowStraightDist) {
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
    if (arrowBoxStops(grid, nx, ny, a.w, a.h, cfg.TILE, a.type)) {
      const def = ARROW_TYPES[a.type] || {};
      if (def.bounces && a.bounces > 0) {
        const axis = tileHitAxis(grid, a.x, a.y, nx, ny, a.w, a.h, cfg.TILE, a.type);
        if (axis.x) a.vx = -a.vx;
        if (axis.y) a.vy = -a.vy;
        a.bounces--;
        return a; // resume next frame with reflected velocity
      }
      a.state = def.explosive ? 'EXPLODE' : (def.splitCount ? 'SPLIT' : 'STUCK');
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
