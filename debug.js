import { W, H, SCALE } from './config.js';

export function createDebug() {
  return { visible: true };
}

export function drawDebug(dbg, player) {
  if (!dbg.visible) return;
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  fill('#4ade80');
  textFont('monospace');
  textSize(14);
  textAlign(LEFT, TOP);
  const lines = [
    `état: ${player.state}`,
    `v: (${player.vx.toFixed(0)}, ${player.vy.toFixed(0)})`,
    `sol:${player.grounded ? '✔' : '✘'} mur:${player.wallDir}`,
    `coyote:${Math.max(0, player.coyote)} buf:${Math.max(0, player.buffer)}`,
  ];
  lines.forEach((l, i) => text(l, 6, 6 + i * 16));
  pop();
}
