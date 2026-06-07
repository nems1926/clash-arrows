import { DEFAULT_CONFIG, W, H, SCALE } from './config.js';
import { ARENA_A, parseArena } from './arena.js';
import { createPlayer, updatePlayer } from './player.js';
import { readKeys, readGamepad, getGamepad, connectedGamepadIndices, computeIntent } from './input.js';
import { drawWorld, drawArrows } from './render.js';
import { createDebug, drawDebug } from './debug.js';
import { createPool, acquire, spawnArrow, updateArrow } from './arrow.js';
import { canShoot, spendArrow, addArrow } from './quiver.js';
import { toroidalOverlap, canCatch, arrowLethal, isStomp } from './combat.js';
import { resolveSlots } from './lobby.js';

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
  const slots = resolveSlots({ gamepads: connectedGamepadIndices(), keyboard: true });
  const players = slots.map((slot, i) => {
    const sp = spawns[i % spawns.length];
    const p = createPlayer(sp.col * cfg.TILE, sp.row * cfg.TILE, cfg);
    p.index = i;
    p.source = slot;
    p.prevKeys = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false };
    return p;
  });
  const dbg = createDebug(cfg);

  const FIXED = 1 / 60;
  let acc = 0;
  const arrowPool = createPool(32);

  q5.update = function () {
    acc += Math.min(deltaTime / 1000, 0.1); // clamp to avoid spiral of death
    while (acc >= FIXED) {
      for (const p of players) {
        if (p.state === 'DEAD') continue;
        const keys = p.source.type === 'keyboard'
          ? readKeys()
          : readGamepad(getGamepad(p.source.index));
        const intent = computeIntent(keys, p.prevKeys);
        updatePlayer(p, intent, cfg, grid, FIXED);
        if (intent.shootPressed && canShoot(p)) {
          const a = acquire(arrowPool);
          if (a) {
            spendArrow(p);
            spawnArrow(a, p.x + p.w / 2, p.y + p.h / 2, p.aimDir.x, p.aimDir.y, p.index, cfg);
          }
        }
        p.prevKeys = keys;
      }
      for (const a of arrowPool) updateArrow(a, cfg, grid, FIXED);

      // arrow -> player resolution: pickup / catch / death
      for (const a of arrowPool) {
        if (!a.active) continue;
        for (const p of players) {
          if (!a.active) break; // arrow consumed — stop checking further players
          if (p.state === 'DEAD') continue;
          const pbox = { x: p.x, y: p.y, w: p.w, h: p.h };
          const abox = { x: a.x, y: a.y, w: a.w, h: a.h };
          if (!toroidalOverlap(pbox, abox, cfg.W, cfg.H)) continue;
          if (a.state === 'STUCK') {            // pickup
            addArrow(p); a.active = false;
          } else if (canCatch(p)) {             // catch during dodge invuln window
            addArrow(p); a.active = false;
          } else if (arrowLethal(a, p.index, cfg)) {
            p.state = 'DEAD'; p.vx = 0; p.vy = 0;
            a.active = false;
          }
        }
      }

      // player -> player stomp
      for (const s of players) {
        if (s.state === 'DEAD') continue;
        for (const v of players) {
          if (v === s || v.state === 'DEAD') continue;
          if (isStomp(s, v)) {
            v.state = 'DEAD'; v.vx = 0; v.vy = 0;
            s.vy = cfg.stompBounceVy;
          }
        }
      }

      acc -= FIXED;
    }
    drawWorld(grid, players);
    drawArrows(arrowPool);
    drawDebug(dbg, players[0]);
  };

  // expose for the debug panel (next tasks)
  globalThis.__game = { cfg, players };
}
