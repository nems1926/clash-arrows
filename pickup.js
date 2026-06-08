// A single arena pickup. `type` is 'shield' (one-hit shield) or a special arrow
// type from PICKUP_TYPES (adds a few of that arrow). x,y are top-left logical coords.
export function createPickup() {
  return { active: false, type: 'shield', x: 0, y: 0, w: 8, h: 8 };
}

// Pick a spawn point from `points` using an injected rand() in [0,1). null if empty.
export function chooseSpawn(points, rand) {
  if (points.length === 0) return null;
  return points[Math.floor(rand() * points.length)];
}

// Pool of pickup payloads: 'shield' (one-hit shield) or a special arrow type.
export const PICKUP_TYPES = ['shield', 'bomb', 'superbomb', 'laser', 'bolt', 'drill'];

export function randomType(rand) {
  return PICKUP_TYPES[Math.floor(rand() * PICKUP_TYPES.length)];
}
