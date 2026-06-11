import { resolveX, resolveY, wallContact, wrap } from './tilemap.js';
import { aimVector } from './aim.js';

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
    quiver: Array(cfg.quiverStart).fill('normal'),
    shield: false,
    impaled: false,
    aimDir: { x: 1, y: 0 },
    index: 0,
    roundsWon: 0,
    dodgeTime: 0, invulnTime: 0, dodgeCooldownTimer: 0,
  };
}

export function updatePlayer(p, intent, cfg, grid, dt) {
  // 1. timers (one fixed step == one frame)
  p.coyote = p.grounded ? cfg.coyoteFrames : Math.max(0, p.coyote - 1);
  p.buffer = intent.jumpPressed ? cfg.bufferFrames : Math.max(0, p.buffer - 1);

  // 1b. dodge timers + start (directional dash with invuln window)
  p.dodgeTime = Math.max(0, p.dodgeTime - 1);
  p.invulnTime = Math.max(0, p.invulnTime - 1);
  p.dodgeCooldownTimer = Math.max(0, p.dodgeCooldownTimer - 1);
  if (intent.dodgePressed && p.dodgeCooldownTimer === 0 && p.dodgeTime === 0) {
    const dir = aimVector({ moveX: intent.moveX, up: intent.up, down: intent.down }, p.facing);
    p.invulnTime = cfg.dodgeInvulnFrames;
    p.dodgeCooldownTimer = cfg.dodgeCooldown;
    if (dir.y > 0) {
      // downward input (down or down-diagonal) is a roll: a longer, full-speed
      // horizontal dash that hugs the ground — not a downward dive.
      const rollDir = intent.moveX !== 0 ? intent.moveX : p.facing;
      p.dodgeTime = cfg.rollDuration;
      p.vx = rollDir * cfg.dodgeSpeed;
      p.vy = 0;
      p.facing = rollDir;
    } else {
      p.dodgeTime = cfg.dodgeDuration;
      p.vx = dir.x * cfg.dodgeSpeed;
      p.vy = dir.y * cfg.dodgeSpeed;
    }
  }
  const dodging = p.dodgeTime > 0;

  // 2. horizontal accel / decel
  if (!dodging) {
  if (intent.moveX !== 0) {
    p.facing = intent.moveX;
    // preserve dash momentum: if already faster than vMax in the held
    // direction, bleed off with decel instead of snapping to vMax — so
    // holding the stick no longer cuts the dash short.
    if (sign(p.vx) === intent.moveX && Math.abs(p.vx) > cfg.vMax) {
      const drop = cfg.decel * dt;
      p.vx = Math.max(cfg.vMax, Math.abs(p.vx) - drop) * intent.moveX;
    } else {
      p.vx = clamp(p.vx + intent.moveX * cfg.accel * dt, -cfg.vMax, cfg.vMax);
    }
  } else {
    const drop = cfg.decel * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - sign(p.vx) * drop;
  }
  }

  // 3. wall contact (pre-move probe)
  const wc = wallContact(grid, p.x, p.y, p.w, p.h, cfg.TILE);

  // 4. jump (ground / coyote) or wall-jump
  if (!dodging && p.buffer > 0) {
    if (p.grounded || p.coyote > 0) {
      p.vy = cfg.vJump;
      p.buffer = 0;
      p.coyote = 0;
      p.grounded = false;
    } else if (wc !== 0) {
      p.vy = cfg.wallJumpY;
      p.vx = -wc * cfg.wallJumpX;
      p.buffer = 0;
    }
  }

  // 5. variable jump height: cut ascent on release
  if (!dodging && p.jumpHeldPrev && !intent.jumpHeld && p.vy < 0) {
    p.vy *= cfg.jumpCutMult;
  }

  // 6. gravity with apex hang
  if (!dodging) {
    let g = cfg.gravity;
    if (Math.abs(p.vy) < cfg.apexVyThreshold) g *= cfg.apexGravityMult;
    p.vy = Math.min(p.vy + g * dt, cfg.vFallMax);
  }

  // 7. wall slide: cap fall when pushing into a wall while airborne
  if (!dodging && !p.grounded && wc !== 0 && intent.moveX === wc && p.vy > 0) {
    p.vy = Math.min(p.vy, cfg.vSlide);
  }

  // 8. move + collide (separated axes)
  p.prevBottom = p.y + p.h;
  const rx = resolveX(grid, p.x, p.y, p.w, p.h, p.vx * dt, cfg.TILE);
  p.x = rx.x;
  if (rx.hit) p.vx = 0;
  const ry = resolveY(grid, p.x, p.y, p.w, p.h, p.vy * dt, cfg.TILE, intent.down, p.prevBottom);
  p.y = ry.y;
  p.grounded = ry.grounded;
  if (ry.hit) p.vy = 0;

  // 9. toroidal wrap
  p.x = wrap(p.x, cfg.W);
  p.y = wrap(p.y, cfg.H);

  // 10. FSM state + remembered inputs
  if (p.state === 'DEAD') { /* stays dead */ }
  else if (p.dodgeTime > 0) p.state = 'DODGING';
  else if (p.grounded) p.state = 'GROUNDED';
  else if (!p.grounded && wc !== 0 && intent.moveX === wc && p.vy > 0) p.state = 'WALLSLIDE';
  else p.state = 'AIRBORNE';
  p.wallDir = wc;
  p.jumpHeldPrev = intent.jumpHeld;

  // aim follows the held direction (default = facing)
  p.aimDir = aimVector({ moveX: intent.moveX, up: intent.up, down: intent.down }, p.facing);
  return p;
}
