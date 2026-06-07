// Pure 8-direction aim. Returns a unit vector {x,y} (y down). Neutral input
// falls back to the facing direction (horizontal). Diagonals are normalized.
export function aimVector(intent, facing) {
  let x = intent.moveX;
  let y = (intent.down ? 1 : 0) - (intent.up ? 1 : 0);
  if (x === 0 && y === 0) return { x: facing, y: 0 };
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}
