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
