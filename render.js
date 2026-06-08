import { SOLID, ONEWAY, DESTRUCT, SPIKE } from './tilemap.js';
import { W, H, SCALE, TILE } from './config.js';
import { ARROW_TYPES } from './arrow.js';

const COL = {
  bg: '#0d1b2a',
  solid: '#6b7280',
  oneway: '#38bdf8',
  destruct: '#a16207',
  arrow: '#fcd34d',
  aim: '#f87171',
  shield: '#e2e8f0',
  spike: '#ef4444',
};

export const PLAYER_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24']; // P1..P4

export function drawWorld(grid, players) {
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
      } else if (cell === DESTRUCT) {
        fill(COL.destruct);
        rect(c * TILE, r * TILE, TILE, TILE);
      } else if (cell === SPIKE) {
        fill(COL.spike);
        const n = 3, bw = TILE / n;
        for (let k = 0; k < n; k++) {
          const bx = c * TILE + k * bw;
          triangle(bx, r * TILE + TILE, bx + bw / 2, r * TILE, bx + bw, r * TILE + TILE);
        }
      }
    }
  }

  // players + ghosts (skip the dead)
  for (const player of players) {
    if (player.state === 'DEAD') continue;
    fill(PLAYER_COLORS[player.index % PLAYER_COLORS.length]);
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        rect(player.x + dx, player.y + dy, player.w, player.h);
      }
    }
    if (player.shield) {
      stroke(COL.shield); strokeWeight(1); noFill();
      rect(player.x - 1, player.y - 1, player.w + 2, player.h + 2);
      noStroke();
    }
    if (player.aimDir) {
      stroke(COL.aim); strokeWeight(1);
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      line(cx, cy, cx + player.aimDir.x * 8, cy + player.aimDir.y * 8);
      noStroke();
    }
  }

  pop();
}

export function drawArrows(arrows) {
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  scale(SCALE);
  noStroke();
  for (const a of arrows) {
    if (!a.active) continue;
    fill(ARROW_TYPES[a.type]?.color || COL.arrow);
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        rect(a.x + dx, a.y + dy, a.w, a.h);
      }
    }
  }
  pop();
}

export function drawExplosions(explosions) {
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  scale(SCALE);
  noStroke();
  for (const e of explosions) {
    const a = Math.max(0, e.life / 12);
    fill(255, 200, 80, 200 * a);
    circle(e.x, e.y, e.r * 2);
  }
  pop();
}

export function drawPickup(pickup) {
  if (!pickup.active) return;
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  scale(SCALE);
  noStroke();
  fill(pickup.type === 'shield' ? COL.shield : (ARROW_TYPES[pickup.type]?.color || COL.shield));
  rect(pickup.x, pickup.y, pickup.w, pickup.h);
  pop();
}
