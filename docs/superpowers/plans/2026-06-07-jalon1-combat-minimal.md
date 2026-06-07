# Jalon 1 — Combat minimal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le combat sur le socle de mouvement du J0 jusqu'à une session Versus jouable à 2–4 humains (clavier + manettes) : tir balistique 8-dir, plantage/ramassage, esquive-attrape, mort par flèche/stomp, manches + score + match.

**Architecture:** Le mouvement et la collision terrain restent **cinématiques custom et purs** (J0 inchangé). q5play ne sert qu'aux **overlaps d'interaction de combat** (`Group.overlaps()`) et au rendu. Toute la logique de décision (balistique, prédicats attrape/armement/stomp, aim, carquois, score, lobby) vit dans des **fonctions pures testées par Vitest** ; le câblage q5play (Sprites/Groups, lecture manettes) est une couche fine vérifiée au runtime et validée manuellement.

**Tech Stack:** JavaScript ES modules, q5play.js (CDN, globals : `Canvas`, `world`, `kb`, `Sprite`, `Group`), Vitest pour les fonctions pures, Vite pour le dev.

**Référence spec :** `docs/superpowers/specs/2026-06-07-jalon1-combat-minimal-design.md`

---

## Convention de commit

Chaque commit se termine par :
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
(Omise dans les blocs ci-dessous pour la lisibilité — l'ajouter à chaque `git commit`.)

## Structure de fichiers

| Fichier | Statut | Responsabilité |
|---|---|---|
| `config.js` | modifié | + paramètres combat |
| `aim.js` | créé | résolution pure de la visée 8-dir depuis l'intent |
| `arrow.js` | créé | données flèche + intégration balistique + plantage + wrap + pool (pur) |
| `combat.js` | créé | prédicats purs (attrape/armement/stomp/distance toroïdale) + câblage overlaps q5play |
| `quiver.js` | créé | logique pure de carquois (tir/ramassage/attrape) |
| `score.js` | créé | logique pure manches/score/match |
| `lobby.js` | créé | logique pure d'assignation sources→joueurs + écran rejoindre |
| `coords.js` | créé | helper pur `logicalToWorld` (pont coords ↔ Sprites centrés) |
| `input.js` | modifié | intent par joueur (aim, shoot/dodge edges) + lecture manettes |
| `player.js` | modifié | états DODGING/DEAD, carquois, aim, tir, dodge, timers |
| `arrowsprites.js` | créé | proxies Sprite q5play + groupes + sync + ghosts capteurs (wiring) |
| `game.js` | créé | machine à états globale Lobby/Round/RoundEnd/MatchEnd |
| `hud.js` | créé | rendu flèches + manches par joueur |
| `render.js` | modifié | + flèches, indicateur visée, flashs |
| `debug.js` | modifié | + sliders params combat |
| `sketch.js` | modifié | boot → instancie game.js, boucle à pas fixe par état |

**Phases :**
- **A — Tir & flèches** (config, aim, balistique, pool, carquois, tir, rendu flèches) → incrément : l'archer solo tire des flèches qui se plantent et se ramassent.
- **B — Esquive, mort, stomp** (dodge, prédicats combat, overlaps q5play, ghosts capteurs) → incrément : duel 1v1 mortel avec attrape et stomp.
- **C — Multijoueur & lobby** (intent multi, manettes, lobby) → incrément : 2–4 joueurs rejoignent et s'affrontent.
- **D — Manches, score, match, HUD** (game.js, score, hud) → incrément : session Versus complète.

---

## PHASE A — Tir & flèches

### Task A1 : Paramètres de combat dans config.js

**Files:**
- Modify: `config.js`
- Test: `tests/smoke.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Ajouter dans `tests/smoke.test.js`, dans le `describe('config', …)` :

```js
it('exposes combat defaults', () => {
  expect(DEFAULT_CONFIG.arrowSpeed).toBe(220);
  expect(DEFAULT_CONFIG.arrowGravity).toBeLessThan(DEFAULT_CONFIG.gravity);
  expect(DEFAULT_CONFIG.quiverStart).toBe(3);
  expect(DEFAULT_CONFIG.roundsToWin).toBe(5);
  expect(DEFAULT_CONFIG.dodgeInvulnFrames).toBeLessThanOrEqual(DEFAULT_CONFIG.dodgeDuration);
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- smoke`
Expected: FAIL (`arrowSpeed` undefined).

- [ ] **Step 3 : Implémenter**

Dans `config.js`, ajouter ces clés dans l'objet `DEFAULT_CONFIG` (avant la ligne `TILE, W, H, …`) :

```js
  // --- Combat (J1), valeurs de départ PRD §5, calibrables au panneau debug ---
  arrowSpeed: 220,        // px/s   vitesse initiale de la flèche
  arrowGravity: 300,      // px/s²  arc balistique (< gravité joueur)
  quiverStart: 3,         // flèches de départ
  dodgeSpeed: 180,        // px/s   vitesse du dash d'esquive
  dodgeDuration: 12,      // frames durée totale du dash
  dodgeInvulnFrames: 8,   // frames fenêtre invuln + attrape (sous-ensemble)
  dodgeCooldown: 24,      // frames anti-spam
  selfArmFrames: 10,      // frames délai d'armement de l'auto-touche
  stompBounceVy: -120,    // px/s   rebond vertical du stompeur
  roundsToWin: 5,         // manches pour gagner le match
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- smoke`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add config.js tests/smoke.test.js
git commit -m "feat(j1): combat tuning params in config"
```

---

### Task A2 : Résolution de visée 8 directions (pur)

**Files:**
- Create: `aim.js`
- Test: `tests/aim.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/aim.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { aimVector } from '../aim.js';

const S = Math.SQRT1_2; // ≈0.707

describe('aimVector', () => {
  it('aims right when holding right', () => {
    expect(aimVector({ moveX: 1, up: false, down: false }, 1)).toEqual({ x: 1, y: 0 });
  });
  it('aims up when holding up', () => {
    expect(aimVector({ moveX: 0, up: true, down: false }, 1)).toEqual({ x: 0, y: -1 });
  });
  it('normalizes the up-left diagonal', () => {
    const v = aimVector({ moveX: -1, up: true, down: false }, 1);
    expect(v.x).toBeCloseTo(-S, 5);
    expect(v.y).toBeCloseTo(-S, 5);
  });
  it('defaults to facing when neutral', () => {
    expect(aimVector({ moveX: 0, up: false, down: false }, -1)).toEqual({ x: -1, y: 0 });
    expect(aimVector({ moveX: 0, up: false, down: false }, 1)).toEqual({ x: 1, y: 0 });
  });
  it('aims down when holding down only', () => {
    expect(aimVector({ moveX: 0, up: false, down: true }, 1)).toEqual({ x: 0, y: 1 });
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- aim`
Expected: FAIL (module `aim.js` introuvable).

- [ ] **Step 3 : Implémenter**

Créer `aim.js` :

```js
// Pure 8-direction aim. Returns a unit vector {x,y} (y down). Neutral input
// falls back to the facing direction (horizontal). Diagonals are normalized.
export function aimVector(intent, facing) {
  let x = intent.moveX;
  let y = (intent.down ? 1 : 0) - (intent.up ? 1 : 0);
  if (x === 0 && y === 0) return { x: facing, y: 0 };
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- aim`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add aim.js tests/aim.test.js
git commit -m "feat(j1): pure 8-direction aim resolution"
```

---

### Task A3 : Plantage flèche-vs-tuile (pur)

**Files:**
- Modify: `tilemap.js`
- Test: `tests/tilemap.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Ajouter à `tests/tilemap.test.js` (importer `arrowHitsTile` en tête : `import { arrowHitsTile, SOLID, ONEWAY } from '../tilemap.js';` — fusionner avec l'import existant) :

```js
describe('arrowHitsTile', () => {
  const grid = [
    [0, 0, 0],
    [0, 1, 2], // (col1=solid, col2=oneway)
    [0, 0, 0],
  ];
  it('detects a solid tile at the point', () => {
    expect(arrowHitsTile(grid, 15, 15, 10)).toBe(true); // col1,row1
  });
  it('detects a one-way tile at the point (arrows stick to anything)', () => {
    expect(arrowHitsTile(grid, 25, 15, 10)).toBe(true); // col2,row1
  });
  it('returns false in empty space', () => {
    expect(arrowHitsTile(grid, 5, 5, 10)).toBe(false);
  });
  it('reads through the toroidal seam (modulo lookup)', () => {
    expect(arrowHitsTile(grid, 15 + 30, 15, 10)).toBe(true); // wraps to col1
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- tilemap`
Expected: FAIL (`arrowHitsTile` non exporté).

- [ ] **Step 3 : Implémenter**

Ajouter à la fin de `tilemap.js` :

```js
// Arrows stick to any non-empty tile (solid OR one-way). Point-in-grid test,
// modulo lookup so it reads correctly across the toroidal seam.
export function arrowHitsTile(grid, x, y, TILE) {
  const cell = cellAt(grid, Math.floor(x / TILE), Math.floor(y / TILE));
  return cell === SOLID || cell === ONEWAY;
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- tilemap`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j1): arrow-vs-tile plant detection"
```

---

### Task A4 : Flèche — données, balistique, plantage, wrap (pur)

**Files:**
- Create: `arrow.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/arrow.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { createArrow, spawnArrow, updateArrow } from '../arrow.js';
import { DEFAULT_CONFIG } from '../config.js';

const DT = 1 / 60;
const cfg = () => ({ ...DEFAULT_CONFIG });
const emptyGrid = Array.from({ length: 18 }, () => Array(32).fill(0));

describe('arrow ballistics', () => {
  it('spawns in flight with velocity from the aim vector', () => {
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, cfg());
    expect(a.state).toBe('IN_FLIGHT');
    expect(a.active).toBe(true);
    expect(a.vx).toBeCloseTo(220, 5);
    expect(a.vy).toBeCloseTo(0, 5);
    expect(a.owner).toBe(0);
  });

  it('falls under arrow gravity and advances', () => {
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, cfg());
    updateArrow(a, cfg(), emptyGrid, DT);
    expect(a.x).toBeGreaterThan(100);
    expect(a.vy).toBeGreaterThan(0);
    expect(a.ageFrames).toBe(1);
  });

  it('plants (STUCK) when it reaches a solid tile', () => {
    const grid = emptyGrid.map((r) => r.slice());
    grid[5][12] = 1; // solid at col12,row5 → x∈[120,130], y∈[50,60]
    const a = createArrow();
    spawnArrow(a, 110, 55, 1, 0, 0, cfg()); // flying right into it
    for (let i = 0; i < 10 && a.state === 'IN_FLIGHT'; i++) updateArrow(a, cfg(), grid, DT);
    expect(a.state).toBe('STUCK');
  });

  it('wraps horizontally', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, c.W - 1, 50, 1, 0, 0, c);
    updateArrow(a, c, emptyGrid, DT);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThan(c.W);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- arrow`
Expected: FAIL (module `arrow.js` introuvable).

- [ ] **Step 3 : Implémenter**

Créer `arrow.js` :

```js
import { arrowHitsTile, wrap } from './tilemap.js';

export function createArrow() {
  return {
    active: false, state: 'STUCK',
    x: 0, y: 0, vx: 0, vy: 0,
    dirX: 1, dirY: 0,        // launch direction, kept for stuck orientation
    owner: -1, ageFrames: 0,
    w: 6, h: 2,
  };
}

// (Re)activate a pooled arrow flying from (x,y) along unit vector (dx,dy).
export function spawnArrow(a, x, y, dx, dy, owner, cfg) {
  a.active = true;
  a.state = 'IN_FLIGHT';
  a.x = x; a.y = y;
  a.dirX = dx; a.dirY = dy;
  a.vx = dx * cfg.arrowSpeed;
  a.vy = dy * cfg.arrowSpeed;
  a.owner = owner;
  a.ageFrames = 0;
  return a;
}

export function updateArrow(a, cfg, grid, dt) {
  if (!a.active || a.state !== 'IN_FLIGHT') return a;
  a.ageFrames++;
  a.vy += cfg.arrowGravity * dt;
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  a.x = wrap(a.x, cfg.W);
  a.y = wrap(a.y, cfg.H);
  if (arrowHitsTile(grid, a.x, a.y, cfg.TILE)) {
    a.state = 'STUCK';
    a.vx = 0; a.vy = 0;
  }
  return a;
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- arrow`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j1): arrow data + ballistic integration + plant + wrap"
```

---

### Task A5 : Pool de flèches (pur)

**Files:**
- Modify: `arrow.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Ajouter à `tests/arrow.test.js` (compléter l'import : `import { createArrow, spawnArrow, updateArrow, createPool, acquire, release } from '../arrow.js';`) :

```js
describe('arrow pool', () => {
  it('reuses released arrows instead of growing', () => {
    const pool = createPool(2);
    const a = acquire(pool);
    const b = acquire(pool);
    expect(acquire(pool)).toBe(null); // exhausted
    release(pool, a);
    expect(acquire(pool)).toBe(a);    // recycled
    expect(b.active).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- arrow`
Expected: FAIL (`createPool` non exporté).

- [ ] **Step 3 : Implémenter**

Ajouter à `arrow.js` :

```js
export function createPool(n) {
  return Array.from({ length: n }, () => createArrow());
}

// Returns an inactive arrow marked active, or null if the pool is exhausted.
export function acquire(pool) {
  for (const a of pool) {
    if (!a.active) { a.active = true; return a; }
  }
  return null;
}

export function release(pool, a) {
  a.active = false;
  a.state = 'STUCK';
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- arrow`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j1): arrow object pool"
```

---

### Task A6 : Logique de carquois (pur)

**Files:**
- Create: `quiver.js`
- Test: `tests/quiver.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/quiver.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { canShoot, spendArrow, addArrow } from '../quiver.js';

describe('quiver', () => {
  it('can shoot when arrows remain', () => {
    expect(canShoot({ quiver: 1 })).toBe(true);
    expect(canShoot({ quiver: 0 })).toBe(false);
  });
  it('spending decrements but never below zero', () => {
    const p = { quiver: 1 };
    spendArrow(p);
    expect(p.quiver).toBe(0);
    spendArrow(p);
    expect(p.quiver).toBe(0);
  });
  it('adding increments', () => {
    const p = { quiver: 0 };
    addArrow(p);
    expect(p.quiver).toBe(1);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- quiver`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

Créer `quiver.js` :

```js
export const canShoot = (p) => p.quiver > 0;
export function spendArrow(p) { if (p.quiver > 0) p.quiver--; }
export function addArrow(p) { p.quiver++; }
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- quiver`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add quiver.js tests/quiver.test.js
git commit -m "feat(j1): pure quiver logic"
```

---

### Task A7 : Archer — visée, facing, intent de tir, carquois

**Files:**
- Modify: `player.js`
- Modify: `input.js`
- Test: `tests/player.test.js`, `tests/input.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

Dans `tests/input.test.js`, ajouter (l'intent doit désormais porter `up`, `shootPressed`, `dodgePressed`) :

```js
it('exposes up and shoot/dodge edges', () => {
  const prev = { up: false, shoot: false, dodge: false };
  const now = computeIntent({ ...none, up: true, shoot: true, dodge: true }, { ...prev });
  expect(now.up).toBe(true);
  expect(now.shootPressed).toBe(true);
  expect(now.dodgePressed).toBe(true);
});
it('does not re-fire shoot while held', () => {
  const now = computeIntent({ ...none, shoot: true }, { shoot: true });
  expect(now.shootPressed).toBe(false);
});
```

Dans `tests/player.test.js`, ajouter :

```js
import { aimVector } from '../aim.js';

describe('player aim & quiver', () => {
  it('starts with a full quiver and faces right', () => {
    const p = createPlayer(10, 0, cfg());
    expect(p.quiver).toBe(DEFAULT_CONFIG.quiverStart);
    expect(p.facing).toBe(1);
  });
  it('updates aimDir from the held direction', () => {
    const c = cfg();
    const p = createPlayer(10, 0, c);
    updatePlayer(p, { moveX: 1, up: true, jumpHeld: false, jumpPressed: false, down: false }, c, grid, DT);
    const expected = aimVector({ moveX: 1, up: true, down: false }, p.facing);
    expect(p.aimDir.x).toBeCloseTo(expected.x, 5);
    expect(p.aimDir.y).toBeCloseTo(expected.y, 5);
  });
});
```

- [ ] **Step 2 : Lancer les tests (doivent échouer)**

Run: `npm test -- input player`
Expected: FAIL (`up`/`shootPressed` absents ; `p.quiver` undefined).

- [ ] **Step 3 : Implémenter**

Dans `input.js`, étendre `readKeys` et `computeIntent` :

```js
export function readKeys() {
  return {
    left: kb.pressing('left') || kb.pressing('a') || kb.pressing('q'),
    right: kb.pressing('right') || kb.pressing('d'),
    up: kb.pressing('up'),
    down: kb.pressing('down') || kb.pressing('s'),
    jump: kb.pressing('space') || kb.pressing('w'),
    shoot: kb.pressing('e'),
    dodge: kb.pressing('shift'),
  };
}

export function computeIntent(keys, prev) {
  const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return {
    moveX,
    up: !!keys.up,
    down: !!keys.down,
    jumpHeld: !!keys.jump,
    jumpPressed: keys.jump && !prev.jump && !prev.jumpHeld,
    shootPressed: keys.shoot && !prev.shoot,
    dodgePressed: keys.dodge && !prev.dodge,
  };
}
```

Dans `player.js`, importer l'aim en tête : `import { aimVector } from './aim.js';`. Dans `createPlayer`, ajouter aux champs retournés :

```js
    quiver: cfg.quiverStart,
    aimDir: { x: 1, y: 0 },
    index: 0,
    roundsWon: 0,
```

Dans `updatePlayer`, juste avant le `return p;` final, ajouter :

```js
  // aim follows the held direction (default = facing)
  p.aimDir = aimVector({ moveX: intent.moveX, up: intent.up, down: intent.down }, p.facing);
```

- [ ] **Step 4 : Lancer les tests (doivent passer)**

Run: `npm test -- input player`
Expected: PASS. Puis `npm test` (toute la suite reste verte).

- [ ] **Step 5 : Commit**

```bash
git add player.js input.js tests/player.test.js tests/input.test.js
git commit -m "feat(j1): player aim + quiver, input shoot/dodge edges"
```

---

### Task A8 : Helper de conversion coords→Sprite (pur)

**Files:**
- Create: `coords.js`
- Test: `tests/coords.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/coords.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { logicalToWorld } from '../coords.js';

describe('logicalToWorld', () => {
  // Logical top-left (lx,ly) of an AABB w×h → q5play centered-origin sprite center.
  it('maps the arena center AABB to world origin-ish', () => {
    // W=320,H=180; an 8×12 box centered at logical (160-4,90-6)=(156,84)
    const c = logicalToWorld(156, 84, 8, 12, 320, 180);
    expect(c.x).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
  });
  it('maps logical top-left corner to negative world quadrant', () => {
    const c = logicalToWorld(0, 0, 8, 12, 320, 180);
    expect(c.x).toBeCloseTo(-320 / 2 + 4, 5);
    expect(c.y).toBeCloseTo(-180 / 2 + 6, 5);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- coords`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

Créer `coords.js` :

```js
// Bridge: logical top-left coords (origin top-left, +Y down) of an AABB w×h
// → q5play sprite CENTER in centered-origin world coords (+Y down).
export function logicalToWorld(lx, ly, w, h, W, H) {
  return { x: lx + w / 2 - W / 2, y: ly + h / 2 - H / 2 };
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- coords`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add coords.js tests/coords.test.js
git commit -m "feat(j1): pure logical->world coordinate bridge"
```

---

### Task A9 : Rendu des flèches + indicateur de visée (wiring, manuel)

**Files:**
- Modify: `render.js`
- Modify: `sketch.js`

- [ ] **Step 1 : Étendre `render.js`**

Ajouter une couleur flèche dans `COL` :

```js
  arrow: '#fcd34d',
  aim: '#f87171',
```

Ajouter une fonction `drawArrows` exportée (dessine sous le même `push/translate/scale` que `drawWorld`, en ghosts comme le joueur) :

```js
export function drawArrows(arrows) {
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  scale(SCALE);
  noStroke();
  fill(COL.arrow);
  for (const a of arrows) {
    if (!a.active) continue;
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        rect(a.x + dx, a.y + dy, a.w, a.h);
      }
    }
  }
  pop();
}
```

Ajouter un petit indicateur de visée dans `drawWorld` (après le dessin du joueur, avant `pop()`) :

```js
  // aim indicator: a short line from the player center along aimDir
  if (player.aimDir) {
    stroke(COL.aim); strokeWeight(1);
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    line(cx, cy, cx + player.aimDir.x * 8, cy + player.aimDir.y * 8);
    noStroke();
  }
```

- [ ] **Step 2 : Câbler le tir dans `sketch.js`**

Importer en tête :

```js
import { drawArrows } from './render.js';
import { aimVector } from './aim.js';
import { createPool, acquire, spawnArrow, updateArrow } from './arrow.js';
import { canShoot, spendArrow } from './quiver.js';
```

Avant `q5.update`, créer le pool :

```js
  const arrowPool = createPool(32);
```

Dans la boucle fixe (dans le `while`), après `updatePlayer(...)`, ajouter le tir et l'update des flèches :

```js
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
```

(Remarque : `computeIntent(keys, prevKeys)` reçoit déjà `prevKeys` ; vérifier que `prevKeys` initial contient `shoot:false, dodge:false, up:false` — mettre à jour la valeur initiale de `prevKeys` en conséquence.)

Mettre à jour l'init de `prevKeys` :

```js
  let prevKeys = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false };
```

Après `drawWorld(grid, player);` ajouter `drawArrows(arrowPool);`.

- [ ] **Step 3 : Vérifier l'API clavier au runtime**

Run: `npm run dev`, ouvrir la page. Vérifier dans la console qu'aucune erreur `kb.pressing` n'apparaît pour `'e'` / `'shift'`. Si les identifiants diffèrent (ex. `'Shift'`), ajuster `readKeys` dans `input.js` (même type d'ajustement que prévu au J0).

- [ ] **Step 4 : Validation manuelle (game feel)**

Vérifier : appuyer sur **E** tire une flèche dans la direction visée (←/→/↑/↓ + diagonales), elle décrit un arc, se plante dans murs/sol/one-way, et le compteur interne de carquois descend (vérifiable via `__game.player.quiver` en console). La flèche réapparaît de l'autre côté au passage d'un bord (ghost).

- [ ] **Step 5 : Commit**

```bash
git add render.js sketch.js input.js
git commit -m "feat(j1): wire shooting + arrow rendering (single player)"
```

---

### Task A10 : Ramassage des flèches au sol (pur + wiring)

**Files:**
- Modify: `combat.js` (créé ici) ou un helper — on met le test de proximité en pur
- Create: `combat.js`
- Test: `tests/combat.test.js`
- Modify: `sketch.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/combat.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { aabbOverlap, toroidalOverlap } from '../combat.js';

describe('aabb overlap', () => {
  const A = { x: 10, y: 10, w: 8, h: 12 };
  it('overlaps when boxes intersect', () => {
    expect(aabbOverlap(A, { x: 12, y: 12, w: 6, h: 2 })).toBe(true);
  });
  it('does not overlap when apart', () => {
    expect(aabbOverlap(A, { x: 100, y: 100, w: 6, h: 2 })).toBe(false);
  });
  it('toroidal overlap sees across the seam', () => {
    const near = { x: 0, y: 10, w: 8, h: 12 };
    const far = { x: 318, y: 10, w: 6, h: 2 }; // wraps to near 0 on a 320-wide arena
    expect(aabbOverlap(near, far)).toBe(false);
    expect(toroidalOverlap(near, far, 320, 180)).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- combat`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

Créer `combat.js` :

```js
// AABBs are top-left {x,y,w,h} in logical coords.
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Shortest wrapped distance between two interval starts on a torus axis.
function wrappedNear(ax, bx, size) {
  let d = bx - ax;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return ax + d; // b's start expressed nearest to a
}

// Overlap that also fires across the toroidal seam (safety net for fast arrows).
export function toroidalOverlap(a, b, W, H) {
  const bx = wrappedNear(a.x, b.x, W);
  const by = wrappedNear(a.y, b.y, H);
  return aabbOverlap(a, { ...b, x: bx, y: by });
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- combat`
Expected: PASS.

- [ ] **Step 5 : Câbler le ramassage dans `sketch.js`**

Importer : `import { toroidalOverlap } from './combat.js';` et `import { addArrow } from './quiver.js';`.

Après l'update des flèches dans la boucle fixe, ajouter :

```js
      // pickup: walking over a STUCK arrow refills the quiver
      const pbox = { x: player.x, y: player.y, w: player.w, h: player.h };
      for (const a of arrowPool) {
        if (a.active && a.state === 'STUCK' &&
            toroidalOverlap(pbox, { x: a.x, y: a.y, w: a.w, h: a.h }, cfg.W, cfg.H)) {
          addArrow(player);
          a.active = false; // back to pool
        }
      }
```

- [ ] **Step 6 : Validation manuelle**

Tirer une flèche, marcher dessus → `__game.player.quiver` remonte, la flèche disparaît. Commit :

```bash
git add combat.js tests/combat.test.js sketch.js
git commit -m "feat(j1): aabb/toroidal overlap + arrow pickup"
```

---

**Gate Phase A :** l'archer solo tire en 8 directions, les flèches décrivent un arc, se plantent, se ramassent ; carquois géré ; `npm test` vert.

---

## PHASE B — Esquive, mort, stomp

### Task B1 : Esquive — timers et état DODGING (pur)

**Files:**
- Modify: `player.js`
- Test: `tests/player.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Ajouter à `tests/player.test.js` :

```js
const full = (over = {}) => ({ moveX: 0, up: false, down: false, jumpHeld: false, jumpPressed: false, shootPressed: false, dodgePressed: false, ...over });

describe('dodge', () => {
  it('enters DODGING with invuln on dodgePressed', () => {
    const c = cfg();
    const p = createPlayer(15, 5, c);
    updatePlayer(p, full({ dodgePressed: true, moveX: 1 }), c, grid, DT);
    expect(p.state).toBe('DODGING');
    expect(p.invulnTime).toBeGreaterThan(0);
    expect(p.dodgeTime).toBeGreaterThan(0);
  });
  it('does not re-dodge during cooldown', () => {
    const c = cfg();
    const p = createPlayer(15, 5, c);
    updatePlayer(p, full({ dodgePressed: true }), c, grid, DT);
    // run out the dodge
    for (let i = 0; i < c.dodgeDuration + 1; i++) updatePlayer(p, full(), c, grid, DT);
    p.dodgeCooldownTimer = c.dodgeCooldown; // still cooling
    updatePlayer(p, full({ dodgePressed: true }), c, grid, DT);
    expect(p.state).not.toBe('DODGING');
  });
  it('catch window is a subset of the dodge', () => {
    expect(DEFAULT_CONFIG.dodgeInvulnFrames).toBeLessThanOrEqual(DEFAULT_CONFIG.dodgeDuration);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- player`
Expected: FAIL (`invulnTime`/DODGING absents).

- [ ] **Step 3 : Implémenter**

Dans `createPlayer`, ajouter aux champs :

```js
    dodgeTime: 0, invulnTime: 0, dodgeCooldownTimer: 0,
```

Dans `updatePlayer`, au tout début (après le bloc 1 des timers coyote/buffer), ajouter la gestion de l'esquive :

```js
  // dodge timers
  p.dodgeTime = Math.max(0, p.dodgeTime - 1);
  p.invulnTime = Math.max(0, p.invulnTime - 1);
  p.dodgeCooldownTimer = Math.max(0, p.dodgeCooldownTimer - 1);

  // start a dodge: directional dash + invuln window, if off cooldown
  if (intent.dodgePressed && p.dodgeCooldownTimer === 0 && p.dodgeTime === 0) {
    p.dodgeTime = cfg.dodgeDuration;
    p.invulnTime = cfg.dodgeInvulnFrames;
    p.dodgeCooldownTimer = cfg.dodgeCooldown;
    const dir = aimVector({ moveX: intent.moveX, up: intent.up, down: intent.down }, p.facing);
    p.vx = dir.x * cfg.dodgeSpeed;
    p.vy = dir.y * cfg.dodgeSpeed;
  }
```

À l'étape FSM (bloc 10), avant les autres conditions d'état, prioriser DODGING :

```js
  if (p.state === 'DEAD') { /* stays dead */ }
  else if (p.dodgeTime > 0) p.state = 'DODGING';
  else if (p.grounded) p.state = 'GROUNDED';
  else if (!p.grounded && wc !== 0 && intent.moveX === wc && p.vy > 0) p.state = 'WALLSLIDE';
  else p.state = 'AIRBORNE';
```

(Remplacer le bloc FSM existant par celui-ci.)

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- player`
Expected: PASS. Puis `npm test` (suite verte).

- [ ] **Step 5 : Commit**

```bash
git add player.js tests/player.test.js
git commit -m "feat(j1): directional dodge with invuln window + cooldown"
```

---

### Task B2 : Prédicats de combat — attrape, armement, létalité (pur)

**Files:**
- Modify: `combat.js`
- Test: `tests/combat.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Ajouter à `tests/combat.test.js` (compléter l'import : `import { aabbOverlap, toroidalOverlap, canCatch, isArmed, arrowLethal } from '../combat.js';`) :

```js
import { DEFAULT_CONFIG } from '../config.js';
const cfg = () => ({ ...DEFAULT_CONFIG });

describe('combat predicates', () => {
  it('canCatch only during the invuln window of a dodge', () => {
    expect(canCatch({ state: 'DODGING', invulnTime: 3 })).toBe(true);
    expect(canCatch({ state: 'DODGING', invulnTime: 0 })).toBe(false);
    expect(canCatch({ state: 'AIRBORNE', invulnTime: 3 })).toBe(false);
  });
  it('isArmed after the self-arm delay', () => {
    expect(isArmed({ ageFrames: DEFAULT_CONFIG.selfArmFrames }, cfg())).toBe(true);
    expect(isArmed({ ageFrames: 0 }, cfg())).toBe(false);
  });
  it("an opponent's arrow is always lethal", () => {
    expect(arrowLethal({ owner: 1, ageFrames: 0 }, 0, cfg())).toBe(true);
  });
  it('your own arrow is lethal only after arming', () => {
    expect(arrowLethal({ owner: 0, ageFrames: 0 }, 0, cfg())).toBe(false);
    expect(arrowLethal({ owner: 0, ageFrames: 99 }, 0, cfg())).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- combat`
Expected: FAIL (`canCatch` etc. non exportés).

- [ ] **Step 3 : Implémenter**

Ajouter à `combat.js` :

```js
// A dodging player in the invuln window catches arrows instead of dying.
export const canCatch = (player) =>
  player.state === 'DODGING' && player.invulnTime > 0;

// Your own arrow only becomes dangerous after an arming delay.
export const isArmed = (arrow, cfg) => arrow.ageFrames >= cfg.selfArmFrames;

// Is this arrow lethal to player index `target`?
export function arrowLethal(arrow, target, cfg) {
  if (arrow.owner === target) return isArmed(arrow, cfg);
  return true; // opponents' arrows always kill (free-for-all)
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- combat`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add combat.js tests/combat.test.js
git commit -m "feat(j1): combat predicates (catch, arming, lethality)"
```

---

### Task B3 : Prédicat de stomp (pur)

**Files:**
- Modify: `combat.js`
- Test: `tests/combat.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Ajouter à `tests/combat.test.js` (compléter l'import avec `isStomp`) :

```js
describe('stomp', () => {
  // victim AABB at (50,50,8,12) → top edge y=50
  const victim = { x: 50, y: 50, w: 8, h: 12, vy: 0 };
  it('is a stomp when falling onto the head from above with overlap', () => {
    const stomper = { x: 51, y: 40, w: 8, h: 12, vy: 80, prevBottom: 49 };
    expect(isStomp(stomper, victim)).toBe(true);
  });
  it('is not a stomp when moving up', () => {
    const stomper = { x: 51, y: 40, w: 8, h: 12, vy: -80, prevBottom: 49 };
    expect(isStomp(stomper, victim)).toBe(false);
  });
  it('is not a stomp on a side hit (no vertical-from-above)', () => {
    const stomper = { x: 51, y: 50, w: 8, h: 12, vy: 80, prevBottom: 62 };
    expect(isStomp(stomper, victim)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- combat`
Expected: FAIL (`isStomp` non exporté).

- [ ] **Step 3 : Implémenter**

Ajouter à `combat.js` :

```js
// stomper kills victim if descending and its previous bottom was at/above the
// victim's head, with horizontal overlap (vertical-from-above contact).
export function isStomp(stomper, victim) {
  if (stomper.vy <= 0) return false;
  const hOverlap = stomper.x < victim.x + victim.w && stomper.x + stomper.w > victim.x;
  if (!hOverlap) return false;
  return stomper.prevBottom <= victim.y + 1;
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- combat`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add combat.js tests/combat.test.js
git commit -m "feat(j1): stomp predicate (from-above + descending)"
```

---

### Task B4 : Sprites proxy q5play + groupes + ghosts capteurs (wiring) — **SAUTÉE (décision 2026-06-07)**

> **Décision d'exécution :** la résolution de combat (B5/B6) utilise les **prédicats purs toroïdaux** (`toroidalOverlap`, `canCatch`, `arrowLethal`, `isStomp`), déjà testés et corrects sur la couture du wrap. Le scaffold Sprites/Groups q5play serait du code mort (B5/B6 ne s'en servent pas) et sa seule valeur — vérifier `overlaps()` à travers la couture — n'est pas testable en headless. Cette tâche est donc **sautée** ; `coords.js` (créé en A8 pour le pont Sprite) devient inutilisé et sera retiré au nettoyage final si aucun besoin n'apparaît. Les Sprites q5play pourront être réintroduits plus tard pour un vrai besoin (rendu spritesheet, débris physiques).

Contenu original conservé pour mémoire :

**Files:**
- Create: `arrowsprites.js`
- Modify: `sketch.js`

> Cette tâche introduit les Sprites/Groups q5play. Elle ne peut pas être testée par Vitest (runtime navigateur) → vérification API au runtime + validation manuelle. La logique de décision reste dans `combat.js` (déjà testée).

- [ ] **Step 1 : Créer `arrowsprites.js`**

```js
import { logicalToWorld } from './coords.js';
import { toroidalOverlap } from './combat.js';

// Thin q5play layer: maintains invisible KINEMATIC sprite proxies whose
// positions mirror logical entities, so we can use Group.overlaps() for
// interaction detection. Movement & terrain collision stay custom (J0).
// Ghost proxies handle the toroidal seam.
export function createGroups() {
  // Group is a q5play global. Sprites are sensors (no physical response).
  const players = new Group();
  const arrows = new Group();
  const pickups = new Group();
  for (const g of [players, arrows, pickups]) {
    g.collider = 'kinematic';
    g.visible = false;
  }
  return { players, arrows, pickups };
}

// Create one proxy sprite for a logical entity; returns the sprite.
export function makeProxy(group, w, h) {
  const s = new group.Sprite(0, 0, w, h);
  s.collider = 'kinematic';
  s.visible = false;
  return s;
}

// Sync a proxy (and up to 8 ghosts) to a logical AABB. We use a single sprite
// plus toroidal overlap math in the event step rather than 9 sprites, to keep
// the wiring simple; the ghost sprites are only needed if Group.overlaps()
// cannot see across the seam (validated at runtime — see Step 3).
export function syncProxy(sprite, lx, ly, w, h, W, H) {
  const c = logicalToWorld(lx, ly, w, h, W, H);
  sprite.x = c.x;
  sprite.y = c.y;
}
```

- [ ] **Step 2 : Vérifier l'API q5play au runtime**

Run: `npm run dev`. Dans la console, exécuter :

```js
const g = new Group(); g.collider = 'kinematic';
const s = new g.Sprite(0,0,8,12); console.log(typeof s.overlaps, typeof g.overlaps);
```

Confirmer que `new Group()`, `new group.Sprite(...)`, `s.collider='kinematic'`, et `group.overlaps(otherGroup, cb)` existent. **Si les noms diffèrent**, ajuster `arrowsprites.js` et noter l'API réelle dans un commentaire en tête du fichier. Tester aussi si `overlaps` voit à travers la couture (placer deux sprites de part et d'autre du bord) → décide si les ghosts capteurs sont nécessaires (sinon on s'appuie sur `toroidalOverlap`).

- [ ] **Step 3 : Décision wrap & commit**

Selon le résultat du Step 2 : si `overlaps()` ne voit pas la couture (cas attendu), la détection de combat se fera via `toroidalOverlap` pur (déjà câblé en Phase A pour le pickup) plutôt que via `group.overlaps()` pour les cas traversant le bord. Documenter la décision en tête de `arrowsprites.js`.

```bash
git add arrowsprites.js sketch.js
git commit -m "feat(j1): q5play sprite-proxy + groups scaffolding"
```

> **Note de conception :** la spec privilégie `Group.overlaps()`. Si la vérification runtime montre que les overlaps q5play ne franchissent pas la couture toroïdale proprement, on utilise les prédicats purs `toroidalOverlap`/`arrowLethal`/`canCatch`/`isStomp` (déjà testés) comme moteur de décision et les Sprites uniquement pour le rendu/le futur. Cette bascule est légitime (le J0 a déjà préféré le custom au moteur quand le feel l'exigeait) — la signaler dans le commit.

---

### Task B5 : Mort par flèche + attrape (intégration solo→duel)

**Files:**
- Modify: `sketch.js`

> On passe à **deux** archers (P2 codé en dur, contrôlé au même clavier zone 2) pour valider mort/attrape avant le vrai multijoueur (Phase C).

- [ ] **Step 1 : Ajouter un 2e joueur de test dans `sketch.js`**

Remplacer la création du joueur unique par un tableau de joueurs aux deux spawns :

```js
  const players = spawns.slice(0, 2).map((sp, i) => {
    const p = createPlayer(sp.col * cfg.TILE, sp.row * cfg.TILE, cfg);
    p.index = i;
    return p;
  });
```

Ajouter une 2e zone clavier provisoire dans `input.js` pour tester le duel (remplacée par l'entrée par-source en C3) :

```js
// Temporary P2 keyboard zone for Phase B testing (replaced in C3).
export function readKeys2() {
  return {
    left: kb.pressing('left'),
    right: kb.pressing('right'),
    up: kb.pressing('up'),
    down: kb.pressing('down'),
    jump: kb.pressing('up'),       // up doubles as jump for the test zone
    shoot: kb.pressing('enter'),
    dodge: kb.pressing('/'),
  };
}
```

Dans la boucle fixe, lire un intent par joueur : `readKeys()` pour `players[0]`, `readKeys2()` pour `players[1]`, chacun avec son propre `prevKeys` (stocker `prevKeys` sur chaque joueur, `p.prevKeys`). Ajuster les identifiants de touches au runtime si besoin.

- [ ] **Step 2 : Résolution flèche↔joueur dans la boucle fixe**

Après l'update des flèches, remplacer le bloc pickup par la résolution complète :

```js
      for (const a of arrowPool) {
        if (!a.active) continue;
        for (const p of players) {
          if (p.state === 'DEAD') continue;
          const pbox = { x: p.x, y: p.y, w: p.w, h: p.h };
          const abox = { x: a.x, y: a.y, w: a.w, h: a.h };
          if (!toroidalOverlap(pbox, abox, cfg.W, cfg.H)) continue;

          if (a.state === 'STUCK') {           // pickup
            addArrow(p); a.active = false;
          } else if (canCatch(p)) {            // catch during dodge
            addArrow(p); a.active = false;
          } else if (arrowLethal(a, p.index, cfg)) {
            p.state = 'DEAD'; p.vx = 0; p.vy = 0;
            a.active = false;
          }
        }
      }
```

Importer `canCatch`, `arrowLethal` depuis `combat.js`.

- [ ] **Step 3 : Validation manuelle**

Deux archers : P1 tire sur P2 immobile → P2 meurt (devient DEAD, immobile). P2 esquive au bon moment (dash + fenêtre) → attrape la flèche (`quiver +1`, pas de mort). Une flèche plantée se ramasse. Vérifier l'auto-touche : tirer ↑ et se laisser retomber dessus après le délai d'armement → mort.

- [ ] **Step 4 : Commit**

```bash
git add sketch.js input.js
git commit -m "feat(j1): arrow death + catch resolution (2 test players)"
```

---

### Task B6 : Stomp (intégration)

**Files:**
- Modify: `sketch.js`

- [ ] **Step 1 : Résolution joueur↔joueur dans la boucle fixe**

Après la résolution flèche↔joueur, ajouter :

```js
      for (const s of players) {
        if (s.state === 'DEAD') continue;
        for (const v of players) {
          if (v === s || v.state === 'DEAD') continue;
          if (isStomp(s, v)) {
            v.state = 'DEAD'; v.vx = 0; v.vy = 0;
            s.vy = cfg.stompBounceVy; // bounce up
          }
        }
      }
```

Importer `isStomp` depuis `combat.js`. (Chaque joueur a déjà `prevBottom` mis à jour dans `updatePlayer`.)

- [ ] **Step 2 : Validation manuelle**

P1 saute et retombe sur la tête de P2 → P2 meurt, P1 rebondit. Un contact latéral ne tue pas.

- [ ] **Step 3 : Commit**

```bash
git add sketch.js
git commit -m "feat(j1): stomp resolution"
```

---

**Gate Phase B :** duel 1v1 (2 joueurs clavier) mortel : tir/mort, esquive/attrape, stomp, ramassage, le tout à travers le wrap ; `npm test` vert.

---

## PHASE C — Multijoueur & lobby

### Task C1 : Assignation des sources d'entrée (pur)

**Files:**
- Create: `lobby.js`
- Test: `tests/lobby.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/lobby.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { resolveSlots } from '../lobby.js';

describe('resolveSlots', () => {
  it('assigns one slot per joined gamepad', () => {
    const s = resolveSlots({ gamepads: [0, 1], keyboard: false });
    expect(s).toEqual([{ type: 'gamepad', index: 0 }, { type: 'gamepad', index: 1 }]);
  });
  it('adds keyboard only when < 4 gamepads and keyboard joined', () => {
    const s = resolveSlots({ gamepads: [0, 1], keyboard: true });
    expect(s).toContainEqual({ type: 'keyboard', index: 0 });
    expect(s.length).toBe(3);
  });
  it('drops keyboard when 4 gamepads are present', () => {
    const s = resolveSlots({ gamepads: [0, 1, 2, 3], keyboard: true });
    expect(s.length).toBe(4);
    expect(s.every((x) => x.type === 'gamepad')).toBe(true);
  });
  it('caps at 4 players', () => {
    const s = resolveSlots({ gamepads: [0, 1, 2, 3, 4], keyboard: true });
    expect(s.length).toBe(4);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- lobby`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

Créer `lobby.js` :

```js
const MAX_PLAYERS = 4;

// joins: { gamepads: number[] (joined gamepad indices), keyboard: boolean }
// Rule: keyboard takes a slot only if a slot is free AND < 4 gamepads.
export function resolveSlots(joins) {
  const slots = joins.gamepads.slice(0, MAX_PLAYERS)
    .map((index) => ({ type: 'gamepad', index }));
  if (joins.keyboard && slots.length < MAX_PLAYERS && joins.gamepads.length < MAX_PLAYERS) {
    slots.push({ type: 'keyboard', index: 0 });
  }
  return slots.slice(0, MAX_PLAYERS);
}

// At least 2 players are required to start a match.
export const canStart = (slots) => slots.length >= 2;
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- lobby`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lobby.js tests/lobby.test.js
git commit -m "feat(j1): pure lobby slot assignment"
```

---

### Task C2 : Lecture des manettes & intent par source (wiring)

**Files:**
- Modify: `input.js`

> Câblage Gamepad API via q5play → vérification runtime. La fonction `computeIntent` (pure, déjà testée) est réutilisée telle quelle pour toutes les sources.

- [ ] **Step 1 : Ajouter la lecture brute des manettes**

Ajouter à `input.js` :

```js
// Raw read for a gamepad slot, normalized to the same shape as readKeys().
// q5play exposes controllers; the exact accessor is confirmed at runtime
// (see Step 2). Deadzone applied to the left stick / d-pad.
export function readGamepad(pad) {
  if (!pad) return { left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false };
  const DZ = 0.4;
  const ax = pad.leftStick ? pad.leftStick.x : 0;
  const ay = pad.leftStick ? pad.leftStick.y : 0;
  return {
    left: ax < -DZ || pad.left,
    right: ax > DZ || pad.right,
    up: ay < -DZ || pad.up,
    down: ay > DZ || pad.down,
    jump: pad.a,        // bottom face button
    shoot: pad.x,       // left face button
    dodge: pad.rightTrigger || pad.rb,
  };
}
```

- [ ] **Step 2 : Vérifier l'API manette au runtime**

Run: `npm run dev`, brancher une manette, appuyer sur un bouton, puis en console inspecter l'objet manette exposé par q5play (par ex. `contros`, `contro`, ou `gamepads` — tester `console.log(window.contros, window.gamepads)`). Ajuster les accès (`pad.a`, `pad.leftStick.x`, etc.) aux vrais noms et **documenter l'API réelle en commentaire** en tête d'`input.js`.

- [ ] **Step 3 : Commit**

```bash
git add input.js
git commit -m "feat(j1): gamepad raw read (runtime-verified accessors)"
```

---

### Task C3 : Joueurs pilotés par source assignée (wiring)

**Files:**
- Modify: `sketch.js`

- [ ] **Step 1 : Mapper chaque joueur à sa source**

Dans `sketch.js`, après la résolution des slots (provisoirement : `const slots = resolveSlots({ gamepads: connectedGamepadIndices(), keyboard: true });`), créer un joueur par slot et conserver sa source + son `prevKeys` :

```js
  const players = slots.map((slot, i) => {
    const sp = spawns[i % spawns.length];
    const p = createPlayer(sp.col * cfg.TILE, sp.row * cfg.TILE, cfg);
    p.index = i;
    p.source = slot;
    p.prevKeys = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false };
    return p;
  });
```

Dans la boucle fixe, lire l'intent par joueur selon sa source :

```js
      for (const p of players) {
        if (p.state === 'DEAD') continue;
        const keys = p.source.type === 'keyboard'
          ? readKeys()
          : readGamepad(getGamepad(p.source.index));
        const intent = computeIntent(keys, p.prevKeys);
        updatePlayer(p, intent, cfg, grid, FIXED);
        // shooting (same block as Task A9, using `p` and `p.aimDir`)
        if (intent.shootPressed && canShoot(p)) {
          const a = acquire(arrowPool);
          if (a) { spendArrow(p); spawnArrow(a, p.x + p.w / 2, p.y + p.h / 2, p.aimDir.x, p.aimDir.y, p.index, cfg); }
        }
        p.prevKeys = keys;
      }
```

Ajouter un helper `getGamepad(index)` et `connectedGamepadIndices()` dans `input.js` (s'appuyant sur l'API confirmée en C2).

- [ ] **Step 2 : Rendre tous les joueurs**

Modifier `drawWorld` pour accepter un tableau de joueurs (boucle), ou appeler le rendu joueur par joueur, avec la couleur de chacun (voir Task D3 pour les couleurs). Provisoirement, dessiner chaque joueur en boucle.

- [ ] **Step 3 : Validation manuelle**

Avec 1 clavier + 1 manette (si dispo) : les deux archers répondent à leur source respective. Sans manette : au moins le clavier joue.

- [ ] **Step 4 : Commit**

```bash
git add sketch.js input.js
git commit -m "feat(j1): per-player input sources (keyboard + gamepad)"
```

---

### Task C4 : Écran de lobby « rejoindre » (wiring)

**Files:**
- Create: section lobby dans `game.js` (créé en Phase D) — provisoirement un module léger
- Modify: `sketch.js`

> Pour éviter une dépendance circulaire avec `game.js` (Phase D), implémenter d'abord un lobby minimal piloté par état dans `sketch.js`, puis l'intégrer à `game.js` en D1.

- [ ] **Step 1 : État lobby provisoire**

Dans `sketch.js`, avant de créer les joueurs, ajouter une phase d'attente :
- `joins = { gamepads: [], keyboard: false }`.
- Chaque frame de lobby : si une touche clavier de « rejoindre » est pressée → `joins.keyboard = true` ; pour chaque manette dont le bouton Start est pressé → ajouter son index à `joins.gamepads` (dédupliqué).
- Afficher le texte « Appuyez pour rejoindre — P1, P2… ; Entrée pour lancer » et le nombre de slots via `resolveSlots(joins)`.
- Quand une touche « démarrer » est pressée et `canStart(resolveSlots(joins))` → figer `slots` et passer en jeu.

- [ ] **Step 2 : Validation manuelle**

Lancer, faire rejoindre clavier (+ manettes si dispo), démarrer → la partie commence avec le bon nombre d'archers. La règle « si 4 manettes, pas de clavier » est respectée (testée en C1, vérifiée ici si 4 manettes dispo).

- [ ] **Step 3 : Commit**

```bash
git add sketch.js
git commit -m "feat(j1): minimal join lobby"
```

---

**Gate Phase C :** 2–4 humains rejoignent (clavier + manettes, règle d'assignation respectée) et s'affrontent ; `npm test` vert.

---

## PHASE D — Manches, score, match, HUD

### Task D1 : Logique de score & fin de manche/match (pur)

**Files:**
- Create: `score.js`
- Test: `tests/score.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

Créer `tests/score.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { aliveCount, lastAlive, roundOver, matchWinner } from '../score.js';

const alive = (i) => ({ index: i, state: 'AIRBORNE' });
const dead = (i) => ({ index: i, state: 'DEAD' });

describe('score logic', () => {
  it('counts living players', () => {
    expect(aliveCount([alive(0), dead(1), alive(2)])).toBe(2);
  });
  it('round is over when <= 1 alive', () => {
    expect(roundOver([alive(0), dead(1)])).toBe(true);
    expect(roundOver([alive(0), alive(1)])).toBe(false);
  });
  it('lastAlive returns the survivor index, or null on a draw', () => {
    expect(lastAlive([dead(0), alive(1)])).toBe(1);
    expect(lastAlive([dead(0), dead(1)])).toBe(null);
  });
  it('matchWinner returns the index reaching roundsToWin', () => {
    expect(matchWinner([{ index: 0, roundsWon: 5 }, { index: 1, roundsWon: 2 }], 5)).toBe(0);
    expect(matchWinner([{ index: 0, roundsWon: 4 }], 5)).toBe(null);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npm test -- score`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

Créer `score.js` :

```js
export const aliveCount = (players) =>
  players.filter((p) => p.state !== 'DEAD').length;

export const roundOver = (players) => aliveCount(players) <= 1;

export function lastAlive(players) {
  const survivors = players.filter((p) => p.state !== 'DEAD');
  return survivors.length === 1 ? survivors[0].index : null;
}

export function matchWinner(players, roundsToWin) {
  const w = players.find((p) => p.roundsWon >= roundsToWin);
  return w ? w.index : null;
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npm test -- score`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add score.js tests/score.test.js
git commit -m "feat(j1): pure score / round / match logic"
```

---

### Task D2 : Machine à états globale (wiring)

**Files:**
- Create: `game.js`
- Modify: `sketch.js`

> `game.js` orchestre `LOBBY → PLAYING → ROUND_END → MATCH_END → LOBBY`. La logique de transition s'appuie sur `score.js` (pur, testé) ; le câblage est validé manuellement.

- [ ] **Step 1 : Créer `game.js`**

```js
import { roundOver, lastAlive, matchWinner } from './score.js';

export function createGame() {
  return { state: 'LOBBY', winner: null, roundEndTimer: 0 };
}

// Called once per fixed step while PLAYING. `players` already updated this step.
// Returns the (possibly changed) state. Side effect: awards a won round.
export function advance(game, players, cfg) {
  if (game.state === 'PLAYING') {
    if (roundOver(players)) {
      const w = lastAlive(players);
      if (w !== null) players.find((p) => p.index === w).roundsWon++;
      const mw = matchWinner(players, cfg.roundsToWin);
      if (mw !== null) { game.state = 'MATCH_END'; game.winner = mw; }
      else { game.state = 'ROUND_END'; game.roundEndTimer = 45; } // ~0.75s
    }
  } else if (game.state === 'ROUND_END') {
    game.roundEndTimer--;
    if (game.roundEndTimer <= 0) game.state = 'RESPAWN'; // sketch re-spawns then sets PLAYING
  }
  return game.state;
}
```

Ajouter un test léger pour `advance` (transition PLAYING→ROUND_END et award) dans `tests/score.test.js` ou `tests/game.test.js` :

```js
import { createGame, advance } from '../game.js';
it('advances PLAYING -> ROUND_END and awards the survivor', () => {
  const game = createGame(); game.state = 'PLAYING';
  const players = [{ index: 0, state: 'AIRBORNE', roundsWon: 0 }, { index: 1, state: 'DEAD', roundsWon: 0 }];
  advance(game, players, { roundsToWin: 5 });
  expect(players[0].roundsWon).toBe(1);
  expect(game.state).toBe('ROUND_END');
});
```

- [ ] **Step 2 : Câbler dans `sketch.js`**

Remplacer le pilotage direct par la machine à états :
- `LOBBY` : la logique de Task C4.
- `PLAYING` : boucle fixe (intents → updates → flèches → résolutions combat) puis `advance(game, players, cfg)`.
- `ROUND_END` : continuer à dessiner, décrémenter le timer (via `advance`), afficher « K.O. ! ».
- `RESPAWN` : re-spawn tous les joueurs (reset position au spawn, `quiver = quiverStart`, `state` réinitialisé), relâcher toutes les flèches du pool, repasser `game.state = 'PLAYING'`.
- `MATCH_END` : afficher le vainqueur + « Entrée pour rejouer » → retour `LOBBY` (reset des `roundsWon`).

- [ ] **Step 3 : Lancer les tests + validation manuelle**

Run: `npm test`
Expected: PASS (dont le nouveau test `advance`).
Manuel : un duel se termine quand il ne reste qu'un vivant → annonce K.O. → respawn instantané → après N manches, écran vainqueur → rejouer relance un lobby.

- [ ] **Step 4 : Commit**

```bash
git add game.js sketch.js tests/score.test.js
git commit -m "feat(j1): global state machine (lobby/round/match)"
```

---

### Task D3 : Couleurs joueurs + HUD (wiring)

**Files:**
- Create: `hud.js`
- Modify: `render.js`, `sketch.js`

- [ ] **Step 1 : Couleurs par joueur**

Dans `render.js`, ajouter une palette et l'utiliser pour dessiner chaque joueur :

```js
export const PLAYER_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24']; // P1..P4
```

Dans la création des joueurs (`sketch.js`), `p.color = PLAYER_COLORS[i]`. Adapter le rendu joueur pour utiliser `p.color` (remplacer le `fill(COL.player)` fixe par la couleur du joueur, en bouclant sur les joueurs vivants + ghosts).

- [ ] **Step 2 : Créer `hud.js`**

```js
import { W, H, SCALE } from './config.js';
import { PLAYER_COLORS } from './render.js';

// Per-player HUD: arrow count + rounds won, in player colors.
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
```

- [ ] **Step 3 : Appeler le HUD**

Dans `sketch.js`, après les dessins du monde/flèches, appeler `drawHud(players)` pendant `PLAYING`/`ROUND_END`. Importer `drawHud`.

- [ ] **Step 4 : Validation manuelle**

À 2–4 joueurs : chaque HUD affiche les flèches restantes et les manches gagnées dans la couleur du joueur ; l'action reste lisible (PRD §11).

- [ ] **Step 5 : Commit**

```bash
git add hud.js render.js sketch.js
git commit -m "feat(j1): player colors + arrows/score HUD"
```

---

### Task D4 : Sliders combat dans le panneau debug (wiring)

**Files:**
- Modify: `debug.js`

- [ ] **Step 1 : Ajouter les paramètres combat aux sliders**

Dans `debug.js`, étendre le tableau `PARAMS` avec les bornes des nouveaux paramètres :

```js
  ['arrowSpeed', 0, 500], ['arrowGravity', 0, 600], ['quiverStart', 0, 10],
  ['dodgeSpeed', 0, 400], ['dodgeDuration', 0, 40], ['dodgeInvulnFrames', 0, 40],
  ['dodgeCooldown', 0, 60], ['selfArmFrames', 0, 60], ['stompBounceVy', -300, 0],
  ['roundsToWin', 1, 15],
```

(Les clés entières — `quiverStart`, `dodgeDuration`, `dodgeInvulnFrames`, `dodgeCooldown`, `selfArmFrames`, `roundsToWin` — doivent avoir un pas de 1 ; étendre la condition de `slider.step` existante : `key.endsWith('Frames') || ['quiverStart','dodgeDuration','dodgeCooldown','roundsToWin'].includes(key)`.)

- [ ] **Step 2 : Étendre l'overlay (optionnel)**

Dans `drawDebug`, ajouter pour le joueur observé : `état/quiver/invuln`. (Adapter selon que l'overlay suit un seul joueur ou le premier.)

- [ ] **Step 3 : Validation manuelle**

Run: `npm run dev`. Les nouveaux sliders apparaissent (Tab), ajustent le feel en live (vitesse de flèche, fenêtre d'esquive…), R reset, C copie.

- [ ] **Step 4 : Commit**

```bash
git add debug.js
git commit -m "feat(j1): combat params in live debug panel"
```

---

### Task D5 : Calibrage final & gate

**Files:** (aucun code nouveau — réglage de valeurs)

- [ ] **Step 1 : Session de calibrage**

Run: `npm run dev`. Avec le panneau debug, calibrer : vitesse/gravité de flèche (arc lisible), fenêtre d'esquive (attrape gratifiante mais pas triviale), cooldown (anti-spam), vitesse de dash, rebond de stomp, `roundsToWin`.

- [ ] **Step 2 : Figer les valeurs**

Bouton **C** → coller le bloc calibré dans `DEFAULT_CONFIG` (`config.js`).

- [ ] **Step 3 : Vérifier la checklist d'acceptation J1 (spec §Critères)**

Parcourir les 10 critères : lobby/assignation, visée 8-dir, plantage/ramassage, esquive-attrape, mort flèche/stomp, manche→score→match, HUD lisible, wrap correct sur les interactions, tests verts, gate subjectif « se sent bien ».

- [ ] **Step 4 : Suite complète + commit**

Run: `npm test`
Expected: PASS (toute la suite).

```bash
git add config.js
git commit -m "feat(j1): calibrated combat values — milestone complete"
```

---

**Gate Phase D / Jalon 1 :** session Versus 2–4 joueurs complète (lobby, manches, score, match, HUD), combat qui « se sent bien », `npm test` vert.

---

## Auto-revue (couverture spec → tâches)

- Joueurs 2–4 clavier+manettes, règle clavier<4 manettes → C1 (pur), C2/C3/C4 (wiring). ✓
- Visée 8-dir = direction tenue, défaut facing, 1 bouton tir → A2, A7, A9. ✓
- Flèche balistique + plantage + ramassage + pool → A3, A4, A5, A10. ✓
- Carquois (départ 3) → A6, A7. ✓
- Dodge directionnel + fenêtre invuln/attrape + cooldown → B1 ; attrape → B2, B5. ✓
- Mort par flèche (adverse toujours / sienne après armement) → B2, B5 ; stomp → B3, B6. ✓
- Wrap toroïdal sur les interactions → A10 (`toroidalOverlap`), B4 (décision ghosts/runtime). ✓
- Machine à états globale + manche/score/match → D1, D2. ✓
- HUD flèches + manches → D3. ✓
- Pont coords ↔ Sprites → A8 ; Sprites/Groups q5play → B4. ✓
- Paramètres calibrables au panneau debug → A1, D4, D5. ✓
- Arène A réutilisée → aucune tâche (inchangé). ✓
- Tests Vitest sur fonctions pures → A2,A3,A4,A5,A6,A8,A10,B1,B2,B3,C1,D1,D2. ✓

**Risque assumé documenté :** le pari « Group.overlaps() q5play » est vérifié au runtime en B4 ; si la couture du wrap n'est pas franchie proprement par le moteur, on bascule sur les prédicats purs `toroidalOverlap` (déjà câblés et testés), Sprites conservés pour le rendu/futur. Cette bascule est explicitement autorisée par la note de conception de B4.
