import { W, H, SCALE } from './config.js';
import { PLAYER_COLORS } from './render.js';

// Per-player HUD: arrow count + rounds won, drawn in each player's color.
// Text is in scaled-canvas pixel coords (same pattern as drawDebug).
export function drawHud(players) {
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  textFont('monospace');
  textSize(14);
  textAlign(LEFT, TOP);
  players.forEach((p, i) => {
    fill(PLAYER_COLORS[i % PLAYER_COLORS.length]);
    const x = 6 + i * 80;
    text(`P${i + 1}`, x, 6);
    text(`arr:${p.quiver}`, x, 22);
    text(`win:${p.roundsWon}`, x, 38);
  });
  pop();
}
