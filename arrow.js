import { arrowHitsTile, wrap } from './tilemap.js';

export function createArrow() {
  return {
    active: false, state: 'STUCK',
    x: 0, y: 0, vx: 0, vy: 0,
    dirX: 1, dirY: 0,        // launch direction, kept for stuck orientation
    owner: -1, ageFrames: 0,
    w: 6, h: 2,
  };
}

// (Re)activate a pooled arrow flying from (x,y) along unit vector (dx,dy).
export function spawnArrow(a, x, y, dx, dy, owner, cfg) {
  a.active = true;
  a.state = 'IN_FLIGHT';
  a.x = x; a.y = y;
  a.dirX = dx; a.dirY = dy;
  a.vx = dx * cfg.arrowSpeed;
  a.vy = dy * cfg.arrowSpeed;
  a.owner = owner;
  a.ageFrames = 0;
  return a;
}

export function updateArrow(a, cfg, grid, dt) {
  if (!a.active || a.state !== 'IN_FLIGHT') return a;
  a.ageFrames++;
  a.vy += cfg.arrowGravity * dt;
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  a.x = wrap(a.x, cfg.W);
  a.y = wrap(a.y, cfg.H);
  if (arrowHitsTile(grid, a.x, a.y, cfg.TILE)) {
    a.state = 'STUCK';
    a.vx = 0; a.vy = 0;
  }
  return a;
}
