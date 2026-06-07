export const TILE = 10;
export const W = 320;
export const H = 180;
export const COLS = W / TILE; // 32
export const ROWS = H / TILE; // 18
export const PLAYER_W = 8;
export const PLAYER_H = 12;
export const SCALE = 4;

// All feel values are tunable live via the debug panel.
// Starting values from PRD §5.1.
export const DEFAULT_CONFIG = {
  vMax: 90,            // px/s   run target speed
  accel: 540,          // px/s²  ~10 frames to reach vMax
  decel: 540,          // px/s²  ground deceleration on release
  vJump: -160,         // px/s   jump impulse (negative = up)
  gravity: 600,        // px/s²
  vFallMax: 240,       // px/s   fall speed cap
  vSlide: 60,          // px/s   wall-slide fall cap
  wallJumpX: 120,      // px/s   horizontal wall-jump impulse
  wallJumpY: -150,     // px/s   vertical wall-jump impulse
  coyoteFrames: 6,
  bufferFrames: 6,
  apexGravityMult: 0.5,
  apexVyThreshold: 40, // px/s   |vy| below this gets reduced gravity
  jumpCutMult: 0.5,    // ascent cut on jump release
  // mirror the geometry so updatePlayer needs only cfg
  TILE, W, H, PLAYER_W, PLAYER_H,
};
