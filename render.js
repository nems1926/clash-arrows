import { SOLID, ONEWAY } from './tilemap.js';
import { W, H, SCALE, TILE } from './config.js';

const COL = {
  bg: '#0d1b2a',
  solid: '#6b7280',
  oneway: '#38bdf8',
  player: '#4ade80',
};

export function drawWorld(grid, player) {
  background(COL.bg);
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2); // logical (0,0) at top-left
  scale(SCALE);
  noStroke();

  // tiles
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell === SOLID) {
        fill(COL.solid);
        rect(c * TILE, r * TILE, TILE, TILE);
      } else if (cell === ONEWAY) {
        fill(COL.oneway);
        rect(c * TILE, r * TILE + 1, TILE, 3); // thin top lip
      }
    }
  }

  // player + ghosts (draw at -W/0/+W and -H/0/+H offsets)
  fill(COL.player);
  for (const dx of [-W, 0, W]) {
    for (const dy of [-H, 0, H]) {
      rect(player.x + dx, player.y + dy, player.w, player.h);
    }
  }

  pop();
}
