import { W, H, SCALE } from './config.js';
import { PLAYER_COLORS } from './render.js';
import { arrowCount, nextType } from './quiver.js';
import { ARROW_TYPES } from './arrow.js';

// Per-player HUD: arrow count + rounds won, drawn in each player's color.
// Text is in scaled-canvas pixel coords (same pattern as drawDebug).
// One quadrant per player: P1 top-left, P2 top-right, P3 bottom-left, P4 bottom-right.
const MARGIN = 6;
const BLOCK_W = 74;   // widest line ("P1 [O]") fits in this
const LINE = 16;      // vertical gap between the three lines
const BLOCK_H = LINE * 2 + 14; // P / arr / win

export function drawHud(players) {
  const canvasW = W * SCALE;
  const canvasH = H * SCALE;
  push();
  translate(-canvasW / 2, -canvasH / 2);
  textFont('monospace');
  textSize(14);
  textAlign(LEFT, TOP);
  players.forEach((p, i) => {
    const onLeft = i % 2 === 0;          // P1/P3 left, P2/P4 right
    const onTop = i < 2;                 // P1/P2 top, P3/P4 bottom
    const x = onLeft ? MARGIN : canvasW - MARGIN - BLOCK_W;
    const y = onTop ? MARGIN : canvasH - MARGIN - BLOCK_H;
    fill(PLAYER_COLORS[i % PLAYER_COLORS.length]);
    text(`P${i + 1}`, x, y);
    if (p.shield) text('[O]', x + 40, y);
    const nt = nextType(p);
    fill(nt ? ARROW_TYPES[nt].color : '#555');
    text(`arr:${arrowCount(p)}`, x, y + LINE);
    fill(PLAYER_COLORS[i % PLAYER_COLORS.length]);
    text(`win:${p.roundsWon}`, x, y + LINE * 2);
  });
  pop();
}
