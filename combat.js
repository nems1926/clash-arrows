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

// stomper kills victim if descending and its previous bottom was at/above the
// victim's head, with horizontal overlap (vertical-from-above contact).
export function isStomp(stomper, victim) {
  if (stomper.vy <= 0) return false;
  const hOverlap = stomper.x < victim.x + victim.w && stomper.x + stomper.w > victim.x;
  if (!hOverlap) return false;
  return stomper.prevBottom <= victim.y + 1;
}
