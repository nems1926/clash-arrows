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
  wallJumpY: -180,     // px/s   vertical wall-jump impulse
  coyoteFrames: 6,
  bufferFrames: 6,
  apexGravityMult: 0.5,
  apexVyThreshold: 40, // px/s   |vy| below this gets reduced gravity
  jumpCutMult: 0.5,    // ascent cut on jump release
  // --- Combat (J1), valeurs de départ PRD §5, calibrables au panneau debug ---
  arrowSpeed: 190,        // px/s   vitesse initiale de la flèche
  arrowGravity: 450,      // px/s²  arc balistique (< gravité joueur)
  arrowStraightDist: 50, // px  vol tendu (sans gravité) avant que la gravité s'applique (~1/3 d'écran)
  quiverStart: 3,         // flèches de départ
  quiverCapacity: 6,      // max flèches au ramassage
  dodgeSpeed: 180,        // px/s   vitesse du dash d'esquive
  dodgeDuration: 3,      // frames durée totale du dash
  dodgeInvulnFrames: 3,   // frames fenêtre invuln + attrape (sous-ensemble)
  dodgeCooldown: 24,      // frames anti-spam
  selfArmFrames: 10,      // frames délai d'armement de l'auto-touche
  stompBounceVy: -120,    // px/s   rebond vertical du stompeur
  explosionRadius: 24,    // px     rayon de l'explosion de bombe
  roundsToWin: 5,         // manches pour gagner le match
  // mirror the geometry so updatePlayer needs only cfg
  TILE, W, H, PLAYER_W, PLAYER_H,
};