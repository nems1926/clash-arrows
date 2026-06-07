import { DEFAULT_CONFIG, W, H, SCALE } from './config.js';
import { ARENA_A, parseArena } from './arena.js';
import { createPlayer, updatePlayer } from './player.js';
import { readKeys, readGamepad, getGamepad, connectedGamepadIndices, computeIntent } from './input.js';
import { drawWorld, drawArrows } from './render.js';
import { drawHud } from './hud.js';
import { createDebug, drawDebug } from './debug.js';
import { createPool, acquire, spawnArrow, updateArrow, release } from './arrow.js';
import { canShoot, shootType, addArrow } from './quiver.js';
import { toroidalOverlap, canCatch, arrowLethal, isStomp } from './combat.js';
import { resolveSlots, canStart } from './lobby.js';
import { createGame, advance } from './game.js';

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
  const dbg = createDebug(cfg);

  const FIXED = 1 / 60;
  let acc = 0;
  const arrowPool = createPool(32);
  const game = createGame();                       // starts in 'LOBBY'
  const joins = { gamepads: new Set(), keyboard: false };
  let players = [];

  const spawnFor = (i) => {
    const sp = spawns[i % spawns.length];
    return { x: sp.col * cfg.TILE, y: sp.row * cfg.TILE };
  };

  const freshKeys = () =>
    ({ left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false });

  function makePlayers(slots) {
    return slots.map((slot, i) => {
      const { x, y } = spawnFor(i);
      const p = createPlayer(x, y, cfg);
      p.index = i;
      p.source = slot;
      p.prevKeys = freshKeys();
      return p;
    });
  }

  // Reset all players to their spawn for a new round; recycle every arrow.
  function respawnAll() {
    for (const a of arrowPool) release(arrowPool, a);
    for (const p of players) {
      const { x, y } = spawnFor(p.index);
      p.x = x; p.y = y;
      p.vx = 0; p.vy = 0;
      p.state = 'AIRBORNE';
      p.grounded = false;
      p.quiver = Array(cfg.quiverStart).fill('normal');
      p.shield = false;
      p.dodgeTime = 0; p.invulnTime = 0; p.dodgeCooldownTimer = 0;
      p.prevBottom = y + p.h;
    }
  }

  const readSource = (p) =>
    p.source.type === 'keyboard' ? readKeys() : readGamepad(getGamepad(p.source.index));

  function drawCenter(lines) {
    background('#0d1b2a');
    fill('#cbd5e1');
    textFont('monospace');
    textSize(16);
    textAlign(CENTER, CENTER);
    lines.forEach((l, i) => text(l, 0, (i - (lines.length - 1) / 2) * 24));
  }

  function updateLobby() {
    if (kb.pressing('space')) joins.keyboard = true;
    for (const i of connectedGamepadIndices()) {
      const pad = getGamepad(i);
      if (pad && (pad.pressing('start') || pad.pressing('a'))) joins.gamepads.add(i);
    }
    const slots = resolveSlots({ gamepads: [...joins.gamepads], keyboard: joins.keyboard });
    if (kb.pressing('enter') && canStart(slots)) {
      players = makePlayers(slots);
      respawnAll();
      game.state = 'PLAYING';
    }
    return slots;
  }

  function stepPlaying() {
    for (const p of players) {
      if (p.state === 'DEAD') continue;
      const keys = readSource(p);
      const intent = computeIntent(keys, p.prevKeys);
      updatePlayer(p, intent, cfg, grid, FIXED);
      if (intent.shootPressed && canShoot(p)) {
        const a = acquire(arrowPool);
        if (a) {
          const t = shootType(p);
          spawnArrow(a, p.x + p.w / 2, p.y + p.h / 2, p.aimDir.x, p.aimDir.y, p.index, cfg, t);
        }
      }
      p.prevKeys = keys;
    }
    for (const a of arrowPool) updateArrow(a, cfg, grid, FIXED);

    // arrow -> player resolution: pickup / catch / death
    for (const a of arrowPool) {
      if (!a.active) continue;
      for (const p of players) {
        if (!a.active) break;
        if (p.state === 'DEAD') continue;
        const pbox = { x: p.x, y: p.y, w: p.w, h: p.h };
        const abox = { x: a.x, y: a.y, w: a.w, h: a.h };
        if (!toroidalOverlap(pbox, abox, cfg.W, cfg.H)) continue;
        if (a.state === 'STUCK') { addArrow(p, a.type, cfg.quiverCapacity); a.active = false; }
        else if (canCatch(p)) { addArrow(p, a.type, cfg.quiverCapacity); a.active = false; }
        else if (arrowLethal(a, p.index, cfg)) { p.state = 'DEAD'; p.vx = 0; p.vy = 0; a.active = false; }
      }
    }

    // player -> player stomp
    for (const s of players) {
      if (s.state === 'DEAD') continue;
      for (const v of players) {
        if (v === s || v.state === 'DEAD') continue;
        if (isStomp(s, v)) { v.state = 'DEAD'; v.vx = 0; v.vy = 0; s.vy = cfg.stompBounceVy; }
      }
    }
  }

  q5.update = function () {
    if (game.state === 'LOBBY') {
      const slots = updateLobby();
      drawCenter([
        'TOWERFALL-LIKE — LOBBY',
        'ESPACE : le clavier rejoint',
        'A / START : une manette rejoint',
        `joueurs prets : ${slots.length}`,
        canStart(slots) ? 'ENTREE : demarrer' : 'minimum 2 joueurs',
      ]);
      return;
    }

    if (game.state === 'MATCH_END') {
      drawCenter([
        `JOUEUR ${game.winner + 1} GAGNE LE MATCH !`,
        'ENTREE : rejouer',
      ]);
      if (kb.pressing('enter')) {
        for (const p of players) p.roundsWon = 0;
        joins.gamepads.clear();
        joins.keyboard = false;
        game.state = 'LOBBY';
      }
      return;
    }

    // PLAYING / ROUND_END / RESPAWN
    acc += Math.min(deltaTime / 1000, 0.1); // clamp to avoid spiral of death
    while (acc >= FIXED) {
      if (game.state === 'PLAYING') {
        stepPlaying();
        advance(game, players, cfg);
      } else if (game.state === 'ROUND_END') {
        advance(game, players, cfg);
        if (game.state === 'RESPAWN') { respawnAll(); game.state = 'PLAYING'; }
      }
      acc -= FIXED;
    }

    drawWorld(grid, players);
    drawArrows(arrowPool);
    drawHud(players);
    if (game.state === 'ROUND_END') {
      fill('#fcd34d');
      textFont('monospace');
      textSize(20);
      textAlign(CENTER, CENTER);
      text('K.O. !', 0, 0);
    }
    if (players[0]) drawDebug(dbg, players[0]);
  };

  globalThis.__game = { cfg, game, getPlayers: () => players };
}
