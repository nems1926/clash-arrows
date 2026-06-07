import { DEFAULT_CONFIG, W, H, SCALE } from './config.js';
import { ARENA_A, parseArena } from './arena.js';
import { createPlayer, updatePlayer } from './player.js';
import { readKeys, computeIntent } from './input.js';
import { drawWorld, drawArrows } from './render.js';
import { createDebug, drawDebug } from './debug.js';
import { createPool, acquire, spawnArrow, updateArrow } from './arrow.js';
import { canShoot, spendArrow, addArrow } from './quiver.js';
import { toroidalOverlap } from './combat.js';

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

  let prevKeys = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false };
  const FIXED = 1 / 60;
  let acc = 0;
  const arrowPool = createPool(32);

  q5.update = function () {
    acc += Math.min(deltaTime / 1000, 0.1); // clamp to avoid spiral of death
    while (acc >= FIXED) {
      const keys = readKeys();
      const intent = computeIntent(keys, prevKeys);
      updatePlayer(player, intent, cfg, grid, FIXED);
      if (intent.shootPressed && canShoot(player)) {
        const a = acquire(arrowPool);
        if (a) {
          spendArrow(player);
          const cx = player.x + player.w / 2;
          const cy = player.y + player.h / 2;
          spawnArrow(a, cx, cy, player.aimDir.x, player.aimDir.y, 0, cfg);
        }
      }
      for (const a of arrowPool) updateArrow(a, cfg, grid, FIXED);
      // pickup: walking over a STUCK arrow refills the quiver
      const pbox = { x: player.x, y: player.y, w: player.w, h: player.h };
      for (const a of arrowPool) {
        if (a.active && a.state === 'STUCK' &&
            toroidalOverlap(pbox, { x: a.x, y: a.y, w: a.w, h: a.h }, cfg.W, cfg.H)) {
          addArrow(player);
          a.active = false; // back to pool
        }
      }
      prevKeys = keys;
      acc -= FIXED;
    }
    drawWorld(grid, player);
    drawArrows(arrowPool);
    drawDebug(dbg, player);
  };

  // expose for the debug panel (next tasks)
  globalThis.__game = { cfg, player };
}
