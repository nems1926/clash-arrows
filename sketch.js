import { DEFAULT_CONFIG, W, H, SCALE } from './config.js';
import { ARENA_A, parseArena } from './arena.js';
import { createPlayer, updatePlayer } from './player.js';
import { readKeys, computeIntent } from './input.js';
import { drawWorld } from './render.js';
import { createDebug, drawDebug } from './debug.js';

if (!navigator.gpu) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:1rem">' +
    'WebGPU requis — ce navigateur est incompatible.</p>';
} else {
  await Canvas(W * SCALE, H * SCALE);
  world.gravity.y = 0;
  pixelDensity(1);
  noSmooth();

  const cfg = { ...DEFAULT_CONFIG };
  const { grid, spawns } = parseArena(ARENA_A);
  const sp = spawns[0];
  const player = createPlayer(sp.col * cfg.TILE, sp.row * cfg.TILE, cfg);
  const dbg = createDebug(cfg);

  let prevKeys = { left: false, right: false, up: false, down: false, jump: false };
  const FIXED = 1 / 60;
  let acc = 0;

  q5.update = function () {
    acc += Math.min(deltaTime / 1000, 0.1); // clamp to avoid spiral of death
    while (acc >= FIXED) {
      const keys = readKeys();
      const intent = computeIntent(keys, prevKeys);
      updatePlayer(player, intent, cfg, grid, FIXED);
      prevKeys = keys;
      acc -= FIXED;
    }
    drawWorld(grid, player);
    drawDebug(dbg, player);
  };

  // expose for the debug panel (next tasks)
  globalThis.__game = { cfg, player };
}
