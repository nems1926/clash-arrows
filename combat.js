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
