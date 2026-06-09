import { DEFAULT_CONFIG, W, H, SCALE } from './config.js';
import { ARENA_A, parseArena, pickRandomArena } from './arena.js';
import { createPlayer, updatePlayer } from './player.js';
import { readKeys, readGamepad, getGamepad, connectedGamepadIndices, computeIntent } from './input.js';
import { drawWorld, drawArrows, drawExplosions, drawPickup } from './render.js';
import { drawHud } from './hud.js';
import { createDebug, drawDebug } from './debug.js';
import { createPool, acquire, spawnArrow, updateArrow, release, ARROW_TYPES, splitDirections } from './arrow.js';
import { EMPTY } from './tilemap.js';
import { canShoot, shootType, addArrow, addArrows } from './quiver.js';
import { createPickup, chooseSpawn, randomType } from './pickup.js';
import { toroidalOverlap, canCatch, arrowLethal, isStomp, isInvulnerable, killOrShield, playersInRadius, destructibleCellsInRadius, spikeOverlap } from './combat.js';
import { resolveSlots, canStart } from './lobby.js';
import { createGame, advance } from './game.js';
import { toggleFullscreen } from './fullscreen.js';

if (!navigator.gpu) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:1rem">' +
    'WebGPU requis — ce navigateur est incompatible.</p>';
} else {
  await Canvas(W * SCALE, H * SCALE);
  world.gravity.y = 0;
  pixelDensity(1);
  noSmooth();
  displayMode(MAXED, PIXELATED); // remplit le parent, letterbox, pixels nets

  const cfg = { ...DEFAULT_CONFIG };
  let { grid, spawns, pickupSpawns } = parseArena(ARENA_A);
  const dbg = createDebug(cfg);

  const FIXED = 1 / 60;
  let acc = 0;
  const arrowPool = createPool(32);
  const explosions = []; // transient visual flashes: { x, y, r, life }
  const pickup = createPickup();
  let pickupTimer = cfg.pickupRespawnFrames;
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

  function explodeAt(x, y, type = 'bomb') {
    const radius = cfg.explosionRadius * (ARROW_TYPES[type]?.radiusMult || 1);
    for (const p of playersInRadius(players, x, y, radius, cfg.W, cfg.H)) {
      if (p.state !== 'DEAD' && !isInvulnerable(p)) killOrShield(p);
    }
    for (const { r, c } of destructibleCellsInRadius(grid, x, y, radius, cfg.TILE, cfg.W, cfg.H)) {
      grid[r][c] = EMPTY;
    }
    explosions.push({ x, y, r: radius, life: 12 });
  }

  function updatePickups() {
    if (!pickup.active) {
      if (--pickupTimer <= 0) {
        const pt = chooseSpawn(pickupSpawns, Math.random);
        if (pt) {
          pickup.active = true;
          pickup.type = randomType(Math.random);
          pickup.x = pt.col * cfg.TILE + (cfg.TILE - pickup.w) / 2;
          pickup.y = pt.row * cfg.TILE + (cfg.TILE - pickup.h) / 2;
        }
      }
      return;
    }
    for (const p of players) {
      if (p.state === 'DEAD') continue;
      if (!toroidalOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, pickup, cfg.W, cfg.H)) continue;
      if (pickup.type === 'shield') p.shield = true;
      else addArrows(p, pickup.type, cfg.pickupArrowCount, cfg.quiverCapacity);
      pickup.active = false;
      pickupTimer = cfg.pickupRespawnFrames;
      break;
    }
  }

  function loadRandomArena() {
    const parsed = parseArena(pickRandomArena(Math.random)); // fresh grid → destructibles regenerate
    grid = parsed.grid;
    spawns = parsed.spawns;
    pickupSpawns = parsed.pickupSpawns;
  }

  // Reset all players to their spawn for a new round; recycle every arrow.
  function respawnAll() {
    loadRandomArena();
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
    pickup.active = false;
    pickupTimer = cfg.pickupRespawnFrames;
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

    // terrain-triggered effects: bomb/superbomb explode, bolt splits into fragments
    for (const a of arrowPool) {
      if (!a.active) continue;
      if (a.state === 'EXPLODE') { explodeAt(a.x, a.y, a.type); a.active = false; }
      else if (a.state === 'SPLIT') {
        const dirs = splitDirections(a.dirX, a.dirY, ARROW_TYPES[a.type].splitCount, Math.PI / 6);
        for (const d of dirs) {
          const frag = acquire(arrowPool);
          if (frag) spawnArrow(frag, a.x, a.y, d.x, d.y, a.owner, cfg, 'normal');
        }
        a.active = false;
      }
    }

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
        else if (arrowLethal(a, p.index, cfg)) {
          if (ARROW_TYPES[a.type]?.explosive) explodeAt(a.x, a.y, a.type);
          else killOrShield(p);
          a.active = false;
        }
      }
    }

    // player -> player stomp
    for (const s of players) {
      if (s.state === 'DEAD') continue;
      for (const v of players) {
        if (v === s || v.state === 'DEAD') continue;
        if (isStomp(s, v)) { killOrShield(v); s.vy = cfg.stompBounceVy; }
      }
    }

    // spikes kill on contact (shield absorbs, dodge-invuln survives)
    for (const p of players) {
      if (p.state === 'DEAD' || isInvulnerable(p)) continue;
      if (spikeOverlap(grid, p, cfg.TILE)) killOrShield(p);
    }

    updatePickups();
  }

  // Plein écran : F ou double-clic. Échap sort (natif navigateur).
  // Les hooks q5 s'exécutent dans la pile d'un vrai événement DOM, condition
  // requise par l'API Fullscreen (impossible depuis q5.update / rAF).
  q5.keyPressed = () => { if (key === 'f' || key === 'F') toggleFullscreen(q5); };
  q5.doubleClicked = () => toggleFullscreen(q5);

  q5.update = function () {
    if (game.state === 'LOBBY') {
      const slots = updateLobby();
      drawCenter([
        'TOWERFALL-LIKE — LOBBY',
        'ESPACE : le clavier rejoint',
        'A / START : une manette rejoint',
        `joueurs prets : ${slots.length}`,
        canStart(slots) ? 'ENTREE : demarrer' : 'minimum 2 joueurs',
        'F ou double-clic : plein ecran',
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

    for (let i = explosions.length - 1; i >= 0; i--) {
      if (--explosions[i].life <= 0) explosions.splice(i, 1);
    }
    drawWorld(grid, players);
    drawArrows(arrowPool);
    drawExplosions(explosions);
    drawPickup(pickup);
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
