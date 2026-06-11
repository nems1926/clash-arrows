import { DESTRUCT, SPIKE, cellAt } from './tilemap.js';

// AABBs are top-left {x,y,w,h} in logical coords.
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Shortest wrapped distance between two interval starts on a torus axis.
function wrappedNear(ax, bx, size) {
  let d = bx - ax;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return ax + d; // b's start expressed nearest to a
}

// Overlap that also fires across the toroidal seam (safety net for fast arrows).
export function toroidalOverlap(a, b, W, H) {
  const bx = wrappedNear(a.x, b.x, W);
  const by = wrappedNear(a.y, b.y, H);
  return aabbOverlap(a, { ...b, x: bx, y: by });
}

// A dodging player in the invuln window catches arrows instead of dying.
export const canCatch = (player) =>
  player.state === 'DODGING' && player.invulnTime > 0;

// Your own arrow only becomes dangerous after an arming delay.
export const isArmed = (arrow, cfg) => arrow.ageFrames >= cfg.selfArmFrames;

// Is this arrow lethal to player index `target`?
export function arrowLethal(arrow, target, cfg) {
  if (arrow.owner === target) return isArmed(arrow, cfg);
  return true; // opponents' arrows always kill (free-for-all)
}

// shortest wrapped delta between two coords on a torus axis
function toroidalDelta(a, b, size) {
  let d = b - a;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
}

export function toroidalDist(ax, ay, bx, by, W, H) {
  return Math.hypot(toroidalDelta(ax, bx, W), toroidalDelta(ay, by, H));
}

export const isInvulnerable = (p) => p.invulnTime > 0;

// Returns false if a shield absorbed the hit (player survives), true if killed.
export function killOrShield(p) {
  if (p.shield) { p.shield = false; return false; }
  p.state = 'DEAD'; p.vx = 0; p.vy = 0;
  return true;
}

// Players whose center lies within `radius` of (cx,cy), toroidally.
export function playersInRadius(players, cx, cy, radius, W, H) {
  return players.filter((p) =>
    toroidalDist(cx, cy, p.x + p.w / 2, p.y + p.h / 2, W, H) <= radius);
}

// Grid cells holding a DESTRUCT tile whose center is within `radius` of (cx,cy).
export function destructibleCellsInRadius(grid, cx, cy, radius, TILE, W, H) {
  const out = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (cellAt(grid, c, r) !== DESTRUCT) continue;
      const tx = c * TILE + TILE / 2;
      const ty = r * TILE + TILE / 2;
      if (toroidalDist(cx, cy, tx, ty, W, H) <= radius) out.push({ r, c });
    }
  }
  return out;
}

// True if the player's AABB overlaps any SPIKE cell (a lethal floor hazard).
export function spikeOverlap(grid, player, TILE) {
  const c0 = Math.floor(player.x / TILE);
  const c1 = Math.floor((player.x + player.w - 0.001) / TILE);
  const r0 = Math.floor(player.y / TILE);
  const r1 = Math.floor((player.y + player.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (cellAt(grid, c, r) === SPIKE) return true;
    }
  }
  return false;
}

// Embrochage : tue le joueur, le marque comme corps porté par la flèche, l'ajoute
// à la liste des corps embrochés et accélère la flèche (composé à chaque kill).
// À n'appeler QUE quand le kill n'est pas absorbé par un bouclier.
export function impale(arrow, player, cfg) {
  player.state = 'DEAD';
  player.vx = 0; player.vy = 0;
  player.impaled = true;
  arrow.carryIds.push(player.index);
  arrow.vx *= cfg.impaleSpeedMult;
  arrow.vy *= cfg.impaleSpeedMult;
}

// Recentre chaque corps embroché sur la position courante de la flèche (empilés).
export function carryFollow(arrow, players) {
  const cx = arrow.x + arrow.w / 2;
  const cy = arrow.y + arrow.h / 2;
  for (const id of arrow.carryIds) {
    const p = players.find((q) => q.index === id);
    if (!p) continue;
    p.x = cx - p.w / 2;
    p.y = cy - p.h / 2;
  }
}

// stomper kills victim on a vertical-from-above contact: descending, horizontally
// overlapping, its bottom was above the victim's head last frame (wasAboveHead)
// AND has actually reached the head this frame (reachedHead). The reachedHead
// check is what prevents a far-above descending player from triggering a stomp.
export function isStomp(stomper, victim) {
  if (stomper.vy <= 0) return false;
  const hOverlap = stomper.x < victim.x + victim.w && stomper.x + stomper.w > victim.x;
  if (!hOverlap) return false;
  const sBottom = stomper.y + stomper.h;
  const wasAboveHead = stomper.prevBottom <= victim.y + 1;
  const reachedHead = sBottom >= victim.y;
  return wasAboveHead && reachedHead;
}
