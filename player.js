import { resolveX, resolveY, wrap } from './tilemap.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export function createPlayer(x, y, cfg) {
  return {
    x, y,
    w: cfg.PLAYER_W, h: cfg.PLAYER_H,
    vx: 0, vy: 0,
    grounded: false,
    wallDir: 0,
    coyote: 0,
    buffer: 0,
    jumpHeldPrev: false,
    facing: 1,
    prevBottom: y + cfg.PLAYER_H,
    state: 'AIRBORNE',
  };
}

export function updatePlayer(p, intent, cfg, grid, dt) {
  // horizontal accel / decel
  if (intent.moveX !== 0) {
    p.vx = clamp(p.vx + intent.moveX * cfg.accel * dt, -cfg.vMax, cfg.vMax);
    p.facing = intent.moveX;
  } else {
    const drop = cfg.decel * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - sign(p.vx) * drop;
  }

  // gravity + fall cap
  p.vy = Math.min(p.vy + cfg.gravity * dt, cfg.vFallMax);

  // move + collide (separated axes)
  p.prevBottom = p.y + p.h;
  const rx = resolveX(grid, p.x, p.y, p.w, p.h, p.vx * dt, cfg.TILE);
  p.x = rx.x;
  if (rx.hit) p.vx = 0;
  const ry = resolveY(grid, p.x, p.y, p.w, p.h, p.vy * dt, cfg.TILE, intent.down, p.prevBottom);
  p.y = ry.y;
  p.grounded = ry.grounded;
  if (ry.hit) p.vy = 0;

  // toroidal wrap
  p.x = wrap(p.x, cfg.W);
  p.y = wrap(p.y, cfg.H);

  p.jumpHeldPrev = intent.jumpHeld;
  return p;
}
