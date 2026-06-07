// A single arena pickup. `type` is 'bomb' (fills the quiver with bombs) or
// 'shield' (grants a one-hit shield). x,y are top-left logical coords.
export function createPickup() {
  return { active: false, type: 'shield', x: 0, y: 0, w: 8, h: 8 };
}

// Pick a spawn point from `points` using an injected rand() in [0,1). null if empty.
export function chooseSpawn(points, rand) {
  if (points.length === 0) return null;
  return points[Math.floor(rand() * points.length)];
}

export function randomType(rand) {
  return rand() < 0.5 ? 'bomb' : 'shield';
}
