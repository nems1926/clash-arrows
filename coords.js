// Bridge: logical top-left coords (origin top-left, +Y down) of an AABB w×h
// → q5play sprite CENTER in centered-origin world coords (+Y down).
export function logicalToWorld(lx, ly, w, h, W, H) {
  return { x: lx + w / 2 - W / 2, y: ly + h / 2 - H / 2 };
}
