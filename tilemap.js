export const EMPTY = 0;
export const SOLID = 1;
export const ONEWAY = 2;

export function wrap(value, max) {
  return ((value % max) + max) % max;
}

export function cellAt(grid, col, row) {
  const rows = grid.length;
  const cols = grid[0].length;
  const r = ((row % rows) + rows) % rows;
  const c = ((col % cols) + cols) % cols;
  return grid[r][c];
}

export function isSolidAt(grid, col, row) {
  return cellAt(grid, col, row) === SOLID;
}

// Move an AABB (top-left x,y, size w,h) along X by dx, snapping to solids.
export function resolveX(grid, x, y, w, h, dx, TILE) {
  let nx = x + dx;
  const rowStart = Math.floor(y / TILE);
  const rowEnd = Math.floor((y + h - 0.001) / TILE);
  let hit = false;
  let wallDir = 0;
  if (dx > 0) {
    const col = Math.floor((nx + w - 0.001) / TILE);
    for (let r = rowStart; r <= rowEnd; r++) {
      if (isSolidAt(grid, col, r)) {
        nx = col * TILE - w;
        hit = true;
        wallDir = 1;
        break;
      }
    }
  } else if (dx < 0) {
    const col = Math.floor(nx / TILE);
    for (let r = rowStart; r <= rowEnd; r++) {
      if (isSolidAt(grid, col, r)) {
        nx = (col + 1) * TILE;
        hit = true;
        wallDir = -1;
        break;
      }
    }
  }
  return { x: nx, hit, wallDir };
}
