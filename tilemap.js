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

// Move an AABB along Y by dy. `dropThrough` and `prevBottom` are used by
// one-way platforms (added in the next task); ignored for solids here.
export function resolveY(grid, x, y, w, h, dy, TILE, dropThrough, prevBottom) {
  let ny = y + dy;
  const colStart = Math.floor(x / TILE);
  const colEnd = Math.floor((x + w - 0.001) / TILE);
  let hit = false;
  let grounded = false;
  if (dy > 0) {
    const row = Math.floor((ny + h - 0.001) / TILE);
    const tileTop = row * TILE;
    for (let c = colStart; c <= colEnd; c++) {
      const cell = cellAt(grid, c, row);
      const solid = cell === SOLID;
      // one-way: only when descending, not dropping, and we were above the top
      const oneWay = cell === ONEWAY && !dropThrough && prevBottom <= tileTop + 0.001;
      if (solid || oneWay) {
        ny = tileTop - h;
        hit = true;
        grounded = true;
        break;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor(ny / TILE);
    for (let c = colStart; c <= colEnd; c++) {
      if (cellAt(grid, c, row) === SOLID) {
        ny = (row + 1) * TILE;
        hit = true;
        break;
      }
    }
  }
  return { y: ny, hit, grounded };
}

// Returns -1 (solid on left), 1 (solid on right), or 0 (none).
export function wallContact(grid, x, y, w, h, TILE) {
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + h - 0.001) / TILE);
  const colR = Math.floor((x + w + 0.001) / TILE);
  const colL = Math.floor((x - 0.001) / TILE);
  let right = false;
  let left = false;
  for (let r = r0; r <= r1; r++) {
    if (isSolidAt(grid, colR, r)) right = true;
    if (isSolidAt(grid, colL, r)) left = true;
  }
  if (right) return 1;
  if (left) return -1;
  return 0;
}

// Arrows stick to any non-empty tile (solid OR one-way). Point-in-grid test,
// modulo lookup so it reads correctly across the toroidal seam.
export function arrowHitsTile(grid, x, y, TILE) {
  const cell = cellAt(grid, Math.floor(x / TILE), Math.floor(y / TILE));
  return cell === SOLID || cell === ONEWAY;
}
