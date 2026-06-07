# Jalon 2 — Contenu MVP (bombe, bouclier, arènes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la variété MVP au Versus : carquois typé, flèche-bombe avec explosion à rayon + tuiles destructibles, power-up bouclier, pickups d'arène temporisés, et 3 arènes tirées au hasard par manche.

**Architecture:** Comme au J1 — toute la **logique de décision** (carquois, prédicats d'explosion, parsing d'arène, choix de pickup) en **fonctions pures testées Vitest** ; le **câblage q5play** (rendu, overlaps, spawner) en couche fine vérifiée par `node --check` + validation manuelle. Le mouvement et la collision terrain restent cinématiques custom.

**Tech Stack:** JavaScript ES modules, q5play.js (CDN globals), Vitest, Vite.

**Référence spec :** `docs/superpowers/specs/2026-06-07-jalon2-content-mvp-design.md`

## Convention de commit
Chaque commit se termine par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omis ci-dessous pour la lisibilité — l'ajouter à chaque commit).

## Structure de fichiers

| Fichier | Statut | Responsabilité (changement J2) |
|---|---|---|
| `config.js` | modifié | + `quiverCapacity` (6), `explosionRadius`, `pickupRespawnFrames` |
| `quiver.js` | réécrit | pile typée de flèches |
| `arrow.js` | modifié | champ `type`, `ARROW_TYPES`, impact bombe → `EXPLODE` |
| `tilemap.js` | modifié | `DESTRUCT` + `isBlocking` dans resolve/wallContact/arrowBoxHitsTile |
| `arena.js` | modifié | parse `%`/`P`, renvoie `pickupSpawns`, 3 arènes + `ARENAS` |
| `combat.js` | modifié | `isInvulnerable`, `killOrShield`, `playersInRadius`, `destructibleCellsInRadius`, `toroidalDist` |
| `pickup.js` | créé | `createPickup`, `chooseSpawn`, `randomType` (purs) |
| `player.js` | modifié | `quiver` (array), `shield` |
| `render.js` | modifié | tuiles destructibles, pickups, flèche bombe, flash explosion, aura bouclier |
| `hud.js` | modifié | carquois typé (compte + type) + bouclier |
| `debug.js` | modifié | sliders explosionRadius/pickupRespawnFrames/quiverCapacity |
| `sketch.js` | modifié | carquois typé, explosion, pickups, bouclier, arène par manche |

**Phases :** A Carquois typé · B Tuiles destructibles · C Bombe & explosion · D Pickups & bouclier · E Arènes.

---

## PHASE A — Carquois typé

### Task A1 : quiver.js → pile typée (pur)

**Files:** Modify `quiver.js`, rewrite `tests/quiver.test.js`.

- [ ] **Step 1 : Réécrire `tests/quiver.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { canShoot, shootType, addArrow, fillWith, nextType, arrowCount } from '../quiver.js';

describe('typed quiver (stack)', () => {
  it('canShoot reflects the stack', () => {
    expect(canShoot({ quiver: ['normal'] })).toBe(true);
    expect(canShoot({ quiver: [] })).toBe(false);
  });
  it('shootType pops the top type, null when empty', () => {
    const p = { quiver: ['normal', 'bomb'] };
    expect(shootType(p)).toBe('bomb');
    expect(p.quiver).toEqual(['normal']);
    expect(shootType({ quiver: [] })).toBe(null);
  });
  it('addArrow pushes the type up to capacity', () => {
    const p = { quiver: ['normal', 'normal'] };
    addArrow(p, 'bomb', 3);
    expect(p.quiver).toEqual(['normal', 'normal', 'bomb']);
    addArrow(p, 'normal', 3);           // already at cap
    expect(p.quiver).toEqual(['normal', 'normal', 'bomb']);
  });
  it('fillWith fills to capacity with one type', () => {
    const p = { quiver: ['normal'] };
    fillWith(p, 'bomb', 6);
    expect(p.quiver).toEqual(Array(6).fill('bomb'));
  });
  it('nextType / arrowCount report the top and length', () => {
    expect(nextType({ quiver: ['normal', 'bomb'] })).toBe('bomb');
    expect(nextType({ quiver: [] })).toBe(null);
    expect(arrowCount({ quiver: ['a', 'b'] })).toBe(2);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- quiver`
Expected: FAIL (old number-based API).

- [ ] **Step 3 : Réécrire `quiver.js`**

```js
// The quiver is a stack (array) of arrow type strings; the top is the last
// element (the next arrow that will be fired).
export const canShoot = (p) => p.quiver.length > 0;
export const arrowCount = (p) => p.quiver.length;
export const nextType = (p) => (p.quiver.length ? p.quiver[p.quiver.length - 1] : null);

export function shootType(p) {
  return p.quiver.length ? p.quiver.pop() : null;
}

export function addArrow(p, type, cap) {
  if (p.quiver.length < cap) p.quiver.push(type);
}

export function fillWith(p, type, cap) {
  p.quiver = Array(cap).fill(type);
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- quiver`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add quiver.js tests/quiver.test.js
git commit -m "feat(j2): typed quiver stack"
```

---

### Task A2 : arrow.js → champ `type` + `spawnArrow` typé (pur)

**Files:** Modify `arrow.js`, `tests/arrow.test.js`.

- [ ] **Step 1 : Ajouter le test (échec)**

Dans `tests/arrow.test.js`, ajouter dans `describe('arrow ballistics', …)` :

```js
  it('carries the arrow type from spawn (default normal)', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, c);            // no type → normal
    expect(a.type).toBe('normal');
    spawnArrow(a, 100, 50, 1, 0, 0, c, 'bomb');    // explicit type
    expect(a.type).toBe('bomb');
  });
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arrow`
Expected: FAIL (`a.type` undefined).

- [ ] **Step 3 : Implémenter dans `arrow.js`**

In `createArrow()` add the field (next to `owner`):
```js
    type: 'normal',
```
Change `spawnArrow` signature and body to accept an optional `type`:
```js
export function spawnArrow(a, x, y, dx, dy, owner, cfg, type = 'normal') {
  a.active = true;
  a.state = 'IN_FLIGHT';
  a.x = x; a.y = y;
  a.dirX = dx; a.dirY = dy;
  a.vx = dx * cfg.arrowSpeed;
  a.vy = dy * cfg.arrowSpeed;
  a.owner = owner;
  a.ageFrames = 0;
  a.traveled = 0;
  a.type = type;
  return a;
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arrow`
Expected: PASS (existing arrow tests still pass — `type` defaults to 'normal').

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j2): arrow type field + typed spawn"
```

---

### Task A3 : player.js → carquois array + champ `shield` (pur)

**Files:** Modify `player.js`, `tests/player.test.js`.

- [ ] **Step 1 : Mettre à jour le test (échec)**

In `tests/player.test.js`, find the `player aim & quiver` describe block and replace the quiver assertion:
```js
  it('starts with a full quiver and faces right', () => {
    const p = createPlayer(10, 0, cfg());
    expect(p.quiver).toHaveLength(DEFAULT_CONFIG.quiverStart);
    expect(p.quiver.every((t) => t === 'normal')).toBe(true);
    expect(p.shield).toBe(false);
    expect(p.facing).toBe(1);
  });
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- player`
Expected: FAIL (`p.quiver` is the number 3, not an array; `p.shield` undefined).

- [ ] **Step 3 : Implémenter dans `player.js`**

In `createPlayer`, replace `quiver: cfg.quiverStart,` with:
```js
    quiver: Array(cfg.quiverStart).fill('normal'),
    shield: false,
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- player`
Expected: PASS. Then `npm test` — NOTE: `sketch.js`, `hud.js`, `debug.js` are not unit-tested, so the suite stays green even though they still reference the old quiver API; they are fixed in A4. Confirm green.

- [ ] **Step 5 : Commit**

```bash
git add player.js tests/player.test.js
git commit -m "feat(j2): player quiver as typed array + shield field"
```

---

### Task A4 : Câbler le carquois typé (wiring : sketch.js, hud.js, debug.js)

**Files:** Modify `sketch.js`, `hud.js`, `debug.js`. (Browser-only — `node --check` + manual.)

- [ ] **Step 1 : config.js — capacité**

In `config.js` `DEFAULT_CONFIG`, after `quiverStart: 3,` add:
```js
  quiverCapacity: 6,      // max flèches au ramassage
```

- [ ] **Step 2 : sketch.js — utiliser l'API typée**

Update the quiver import:
```js
import { canShoot, shootType, addArrow } from './quiver.js';
```
In `respawnAll`, replace `p.quiver = cfg.quiverStart;` with:
```js
      p.quiver = Array(cfg.quiverStart).fill('normal');
      p.shield = false;
```
In `stepPlaying`, the shooting block becomes:
```js
      if (intent.shootPressed && canShoot(p)) {
        const a = acquire(arrowPool);
        if (a) {
          const t = shootType(p);
          spawnArrow(a, p.x + p.w / 2, p.y + p.h / 2, p.aimDir.x, p.aimDir.y, p.index, cfg, t);
        }
      }
```
In the arrow→player resolution, the pickup and catch branches must re-stack the arrow's type:
```js
        if (a.state === 'STUCK') { addArrow(p, a.type, cfg.quiverCapacity); a.active = false; }
        else if (canCatch(p)) { addArrow(p, a.type, cfg.quiverCapacity); a.active = false; }
        else if (arrowLethal(a, p.index, cfg)) { p.state = 'DEAD'; p.vx = 0; p.vy = 0; a.active = false; }
```
(`spendArrow` is removed — `shootType` already pops.)

- [ ] **Step 3 : hud.js — carquois typé (compte)**

`p.quiver` is now an array, so `arr:${p.quiver}` would print the joined array. Import `arrowCount` and use it:
```js
import { W, H, SCALE } from './config.js';
import { PLAYER_COLORS } from './render.js';
import { arrowCount } from './quiver.js';
```
In the per-player loop, replace the arrows line with:
```js
    text(`arr:${arrowCount(p)}`, x, 22);
```
(The next-arrow type COLOR is added to the HUD in Task D3, once `ARROW_TYPES` exists — keep the count in the player color here.)

- [ ] **Step 4 : debug.js — overlay**

In `drawDebug`, the line `carquois:${player.quiver} …` must use the length now:
```js
    `carquois:${player.quiver.length} invuln:${Math.max(0, player.invulnTime)}`,
```

- [ ] **Step 5 : Vérifier**

Run: `npm test` (whole suite green — pure modules unaffected). Then `node --check sketch.js hud.js debug.js`.
DEFERRED (human): in browser, firing decrements the quiver, walking over a planted arrow re-adds it, HUD shows count + next-type color.

- [ ] **Step 6 : Commit**

```bash
git add config.js sketch.js hud.js debug.js
git commit -m "feat(j2): wire typed quiver into shooting/pickup/HUD"
```

**Gate Phase A :** carquois typé bout-en-bout ; `npm test` vert.

---

## PHASE B — Tuiles destructibles

### Task B1 : tilemap.js → `DESTRUCT` + `isBlocking` (pur)

**Files:** Modify `tilemap.js`, `tests/tilemap.test.js`.

- [ ] **Step 1 : Ajouter les tests (échec)**

In `tests/tilemap.test.js`, extend the import to add `DESTRUCT`:
```js
import { wrap, cellAt, isSolidAt, arrowBoxHitsTile, resolveX, resolveY, wallContact, SOLID, ONEWAY, DESTRUCT } from '../tilemap.js';
```
Add:
```js
describe('destructible tiles block like solids', () => {
  // a single destructible tile at col1,row1 of a 3x3 grid (10px tiles)
  const grid = [
    [0, 0, 0],
    [0, 3, 0],
    [0, 0, 0],
  ];
  it('DESTRUCT is the value 3', () => {
    expect(DESTRUCT).toBe(3);
  });
  it('blocks rightward movement (resolveX stops at it)', () => {
    // 8x8 box at (2,12) moving right into col1 (x 10..20) on row1
    const r = resolveX(grid, 2, 12, 8, 8, 20, 10);
    expect(r.hit).toBe(true);
    expect(r.x).toBeLessThanOrEqual(10 - 8 + 0.001); // snapped left of the tile
  });
  it('blocks downward movement (resolveY lands on it)', () => {
    const r = resolveY(grid, 11, 0, 8, 8, 20, 10, false, 8);
    expect(r.grounded).toBe(true);
  });
  it('wallContact detects it', () => {
    expect(wallContact(grid, 10, 12, 8, 8, 10)).not.toBe(0);
  });
  it('arrows stick to it', () => {
    expect(arrowBoxHitsTile(grid, 12, 12, 6, 2, 10)).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- tilemap`
Expected: FAIL (`DESTRUCT` undefined; resolveX/Y treat 3 as empty).

- [ ] **Step 3 : Implémenter dans `tilemap.js`**

Add the constant near the others:
```js
export const DESTRUCT = 3;
```
Add a blocking helper (after `isSolidAt`):
```js
// Solid and destructible tiles both block movement; destructibles differ only
// in that explosions can remove them.
export function isBlocking(grid, col, row) {
  const cell = cellAt(grid, col, row);
  return cell === SOLID || cell === DESTRUCT;
}
```
In `resolveX`, replace both `isSolidAt(grid, col, r)` calls with `isBlocking(grid, col, r)`.
In `resolveY`:
- the downward branch computes `const solid = cell === SOLID;` → change to `const solid = cell === SOLID || cell === DESTRUCT;`
- the upward (ceiling) branch `if (cellAt(grid, c, row) === SOLID)` → `if (isBlocking(grid, c, row))`.
In `wallContact`, replace both `isSolidAt(...)` calls with `isBlocking(grid, colR, r)` / `isBlocking(grid, colL, r)`.
In `arrowBoxHitsTile`, change the condition to also stick to destructibles:
```js
      if (cell === SOLID || cell === ONEWAY || cell === DESTRUCT) return true;
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- tilemap` then `npm test`
Expected: PASS (existing movement/one-way tests unaffected — they use SOLID/ONEWAY which still behave identically).

- [ ] **Step 5 : Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j2): destructible tiles block movement like solids"
```

---

### Task B2 : arena.js parse `%` + rendu destructible (pur + wiring)

**Files:** Modify `arena.js`, `tests/arena.test.js`, `render.js`.

- [ ] **Step 1 : Ajouter le test (échec)**

In `tests/arena.test.js` add:
```js
import { DESTRUCT } from '../tilemap.js';

describe('parseArena destructibles', () => {
  it('maps % to DESTRUCT', () => {
    const { grid } = parseArena(['..%..']);
    expect(grid[0][2]).toBe(DESTRUCT);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arena`
Expected: FAIL (`%` parsed as EMPTY).

- [ ] **Step 3 : Implémenter dans `arena.js`**

Import `DESTRUCT`:
```js
import { SOLID, ONEWAY, EMPTY, DESTRUCT } from './tilemap.js';
```
In `parseArena`, in the per-char branch, add before the EMPTY fallback:
```js
      else if (ch === '%') row.push(DESTRUCT);
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arena`
Expected: PASS.

- [ ] **Step 5 : render.js — couleur destructible**

In `render.js` add to `COL`:
```js
  destruct: '#a16207',
```
In `drawWorld`, in the tile loop, add a branch alongside SOLID/ONEWAY (import `DESTRUCT` from tilemap):
```js
      } else if (cell === DESTRUCT) {
        fill(COL.destruct);
        rect(c * TILE, r * TILE, TILE, TILE);
      }
```
(Update the `import { SOLID, ONEWAY } from './tilemap.js';` line to include `DESTRUCT`.)

- [ ] **Step 6 : Vérifier + commit**

Run: `npm test`, `node --check arena.js render.js`.
```bash
git add arena.js tests/arena.test.js render.js
git commit -m "feat(j2): parse and render destructible tiles"
```

**Gate Phase B :** destructibles bloquent + s'affichent (distincts) ; `npm test` vert.

---

## PHASE C — Flèche-bombe & explosion

### Task C1 : arrow.js → `ARROW_TYPES` + impact bombe `EXPLODE` (pur)

**Files:** Modify `arrow.js`, `tests/arrow.test.js`.

- [ ] **Step 1 : Ajouter les tests (échec)**

In `tests/arrow.test.js` add:
```js
import { ARROW_TYPES } from '../arrow.js';

describe('bomb arrow impact', () => {
  it('exposes a color per type', () => {
    expect(ARROW_TYPES.normal.color).toBeTruthy();
    expect(ARROW_TYPES.bomb.color).toBeTruthy();
  });
  it('a bomb arrow goes to EXPLODE on terrain impact (normal goes STUCK)', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    grid[5][12] = 1; // solid
    const bomb = createArrow();
    spawnArrow(bomb, 110, 55, 1, 0, 0, c, 'bomb');
    for (let i = 0; i < 10 && bomb.state === 'IN_FLIGHT'; i++) updateArrow(bomb, c, grid, DT);
    expect(bomb.state).toBe('EXPLODE');
    const normal = createArrow();
    spawnArrow(normal, 110, 55, 1, 0, 0, c, 'normal');
    for (let i = 0; i < 10 && normal.state === 'IN_FLIGHT'; i++) updateArrow(normal, c, grid, DT);
    expect(normal.state).toBe('STUCK');
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arrow`
Expected: FAIL (`ARROW_TYPES` undefined; bomb goes STUCK).

- [ ] **Step 3 : Implémenter dans `arrow.js`**

Add the type table near the top (after imports):
```js
// Pluggable arrow types. `color` drives rendering; `explosive` decides the
// terrain-impact state. New types (laser, bolt…) slot in here later.
export const ARROW_TYPES = {
  normal: { color: '#fcd34d', explosive: false },
  bomb: { color: '#fb7185', explosive: true },
};
```
In `updateArrow`, change the impact branch (inside the sub-step loop) from the fixed `a.state = 'STUCK'` to type-driven:
```js
    if (arrowBoxHitsTile(grid, nx, ny, a.w, a.h, cfg.TILE)) {
      a.state = ARROW_TYPES[a.type]?.explosive ? 'EXPLODE' : 'STUCK';
      a.vx = 0; a.vy = 0;
      return a; // rest at the last clear position (a.x, a.y)
    }
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arrow` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j2): arrow types table + bomb explodes on impact"
```

---

### Task C2 : combat.js → explosion & bouclier (pur)

**Files:** Modify `combat.js`, `tests/combat.test.js`.

- [ ] **Step 1 : Ajouter les tests (échec)**

In `tests/combat.test.js` extend the import:
```js
import { aabbOverlap, toroidalOverlap, canCatch, isArmed, arrowLethal, isStomp, isInvulnerable, killOrShield, playersInRadius, destructibleCellsInRadius } from '../combat.js';
```
Add:
```js
describe('explosion & shield helpers', () => {
  it('isInvulnerable during the dodge window', () => {
    expect(isInvulnerable({ invulnTime: 2 })).toBe(true);
    expect(isInvulnerable({ invulnTime: 0 })).toBe(false);
  });
  it('killOrShield consumes a shield, then kills', () => {
    const p = { state: 'AIRBORNE', shield: true, vx: 5, vy: 5 };
    expect(killOrShield(p)).toBe(false);   // absorbed
    expect(p.shield).toBe(false);
    expect(p.state).toBe('AIRBORNE');
    expect(killOrShield(p)).toBe(true);    // now lethal
    expect(p.state).toBe('DEAD');
  });
  it('playersInRadius returns players within the (toroidal) radius', () => {
    const a = { x: 48, y: 48, w: 8, h: 12 };  // center ~ (52,54)
    const far = { x: 200, y: 100, w: 8, h: 12 };
    const got = playersInRadius([a, far], 52, 54, 20, 320, 180);
    expect(got).toContain(a);
    expect(got).not.toContain(far);
  });
  it('playersInRadius sees across the seam', () => {
    const edge = { x: 314, y: 50, w: 8, h: 12 }; // center ~318
    const got = playersInRadius([edge], 2, 56, 20, 320, 180); // x=2 is ~4px from 318 across seam
    expect(got).toContain(edge);
  });
  it('destructibleCellsInRadius returns only DESTRUCT cells in range', () => {
    const grid = [
      [0, 0, 0],
      [0, 3, 1], // (1,1)=destruct, (2,1)=solid
      [0, 0, 0],
    ];
    const cells = destructibleCellsInRadius(grid, 15, 15, 8, 10, 30, 30); // near col1,row1 center (15,15)
    expect(cells).toEqual([{ r: 1, c: 1 }]);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- combat`
Expected: FAIL (helpers undefined).

- [ ] **Step 3 : Implémenter dans `combat.js`**

Add at the end. (`SOLID`/`DESTRUCT` etc. are tilemap concerns — import `DESTRUCT` and `cellAt`.)
```js
import { DESTRUCT, cellAt } from './tilemap.js';

// shortest wrapped delta between two coords on a torus axis
function toroidalDelta(a, b, size) {
  let d = b - a;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
}

export function toroidalDist(ax, ay, bx, by, W, H) {
  return Math.hypot(toroidalDelta(ax, bx, W), toroidalDelta(ay, by, H));
}

export const isInvulnerable = (p) => p.invulnTime > 0;

// Returns false if a shield absorbed the hit (player survives), true if killed.
export function killOrShield(p) {
  if (p.shield) { p.shield = false; return false; }
  p.state = 'DEAD'; p.vx = 0; p.vy = 0;
  return true;
}

// Players whose center lies within `radius` of (cx,cy), toroidally.
export function playersInRadius(players, cx, cy, radius, W, H) {
  return players.filter((p) =>
    toroidalDist(cx, cy, p.x + p.w / 2, p.y + p.h / 2, W, H) <= radius);
}

// Grid cells holding a DESTRUCT tile whose center is within `radius` of (cx,cy).
export function destructibleCellsInRadius(grid, cx, cy, radius, TILE, W, H) {
  const out = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (cellAt(grid, c, r) !== DESTRUCT) continue;
      const tx = c * TILE + TILE / 2;
      const ty = r * TILE + TILE / 2;
      if (toroidalDist(cx, cy, tx, ty, W, H) <= radius) out.push({ r, c });
    }
  }
  return out;
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- combat` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add combat.js tests/combat.test.js
git commit -m "feat(j2): explosion radius + shield combat helpers"
```

---

### Task C3 : Câbler bombe/explosion (wiring : config.js, sketch.js, render.js)

**Files:** Modify `config.js`, `sketch.js`, `render.js`. (Browser-only.)

- [ ] **Step 1 : config.js — rayon**

Add to `DEFAULT_CONFIG`:
```js
  explosionRadius: 24,    // px  rayon de l'explosion de bombe
```

- [ ] **Step 2 : sketch.js — explosion + morts via killOrShield**

Update imports:
```js
import { toroidalOverlap, canCatch, arrowLethal, isStomp, isInvulnerable, killOrShield, playersInRadius, destructibleCellsInRadius } from './combat.js';
import { EMPTY } from './tilemap.js';
import { drawWorld, drawArrows, drawExplosions } from './render.js';
```
Add an explosion-FX list near the other state (after `const arrowPool = …`):
```js
  const explosions = []; // transient visual flashes: { x, y, r, life }
```
Add an `explodeAt` helper (next to `respawnAll`):
```js
  function explodeAt(x, y) {
    for (const p of playersInRadius(players, x, y, cfg.explosionRadius, cfg.W, cfg.H)) {
      if (p.state !== 'DEAD' && !isInvulnerable(p)) killOrShield(p);
    }
    for (const { r, c } of destructibleCellsInRadius(grid, x, y, cfg.explosionRadius, cfg.TILE, cfg.W, cfg.H)) {
      grid[r][c] = EMPTY;
    }
    explosions.push({ x, y, r: cfg.explosionRadius, life: 12 });
  }
```
In `stepPlaying`, after the `for (const a of arrowPool) updateArrow(...)` line, handle terrain-triggered explosions:
```js
      for (const a of arrowPool) {
        if (a.active && a.state === 'EXPLODE') { explodeAt(a.x, a.y); a.active = false; }
      }
```
In the arrow→player resolution, replace the lethal branch so bombs explode and all deaths go through `killOrShield`:
```js
        if (a.state === 'STUCK') { addArrow(p, a.type, cfg.quiverCapacity); a.active = false; }
        else if (canCatch(p)) { addArrow(p, a.type, cfg.quiverCapacity); a.active = false; }
        else if (arrowLethal(a, p.index, cfg)) {
          if (a.type === 'bomb') explodeAt(a.x, a.y);
          else killOrShield(p);
          a.active = false;
        }
```
In the stomp resolution, route the kill through `killOrShield`:
```js
          if (isStomp(s, v)) { killOrShield(v); s.vy = cfg.stompBounceVy; }
```
Decay explosions once per frame (in `q5.update`, just before `drawWorld(...)`):
```js
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (--explosions[i].life <= 0) explosions.splice(i, 1);
    }
```
And draw them after `drawArrows(arrowPool);`:
```js
    drawExplosions(explosions);
```

- [ ] **Step 3 : render.js — flèche bombe colorée + flash d'explosion**

`drawArrows` must color each arrow by its type. Import the table:
```js
import { ARROW_TYPES } from './arrow.js';
```
In `drawArrows`, set the fill inside the loop per arrow (replace the single `fill(COL.arrow)` before the loop):
```js
  for (const a of arrows) {
    if (!a.active) continue;
    fill(ARROW_TYPES[a.type]?.color || COL.arrow);
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        rect(a.x + dx, a.y + dy, a.w, a.h);
      }
    }
  }
```
Add `drawExplosions`:
```js
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
```

- [ ] **Step 4 : Vérifier + commit**

Run: `npm test` (green), `node --check sketch.js render.js config.js`.
DEFERRED (human): firing a bomb (after picking one up in Phase D, or temporarily forcing `'bomb'` in the spawn for testing) explodes on walls/players, kills in radius, destroys `%` tiles; dodge-invuln and (later) shield survive.
```bash
git add config.js sketch.js render.js
git commit -m "feat(j2): wire bomb explosion (radius kill + tile destruction + fx)"
```

**Gate Phase C :** la bombe explose, tue dans le rayon, détruit les destructibles ; `npm test` vert.

---

## PHASE D — Pickups & bouclier

### Task D1 : arena.js parse `P` → pickupSpawns (pur)

**Files:** Modify `arena.js`, `tests/arena.test.js`.

- [ ] **Step 1 : Ajouter le test (échec)**

In `tests/arena.test.js` add:
```js
describe('parseArena pickup spawns', () => {
  it('collects P cells into pickupSpawns (as empty tiles)', () => {
    const { grid, pickupSpawns } = parseArena(['..P..']);
    expect(pickupSpawns).toContainEqual({ col: 2, row: 0 });
    expect(grid[0][2]).toBe(0); // EMPTY, walkable
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arena`
Expected: FAIL (`pickupSpawns` undefined).

- [ ] **Step 3 : Implémenter dans `arena.js`**

In `parseArena`, add a `pickupSpawns` array and a branch. Change the function to:
```js
export function parseArena(ascii) {
  const grid = [];
  const spawns = [];
  const pickupSpawns = [];
  for (let r = 0; r < ascii.length; r++) {
    const row = [];
    for (let c = 0; c < ascii[r].length; c++) {
      const ch = ascii[r][c];
      if (ch === '#') row.push(SOLID);
      else if (ch === '=') row.push(ONEWAY);
      else if (ch === '%') row.push(DESTRUCT);
      else {
        row.push(EMPTY);
        if (ch === 'S') spawns.push({ col: c, row: r });
        else if (ch === 'P') pickupSpawns.push({ col: c, row: r });
      }
    }
    grid.push(row);
  }
  return { grid, spawns, pickupSpawns };
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arena` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add arena.js tests/arena.test.js
git commit -m "feat(j2): parse pickup-spawn points from arena data"
```

---

### Task D2 : pickup.js (pur)

**Files:** Create `pickup.js`, `tests/pickup.test.js`.

- [ ] **Step 1 : Créer `tests/pickup.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createPickup, chooseSpawn, randomType } from '../pickup.js';

describe('pickup helpers', () => {
  it('createPickup is inactive by default', () => {
    const pk = createPickup();
    expect(pk.active).toBe(false);
  });
  it('chooseSpawn picks a point using the injected rand', () => {
    const pts = [{ col: 1, row: 1 }, { col: 5, row: 2 }, { col: 9, row: 3 }];
    expect(chooseSpawn(pts, () => 0)).toEqual({ col: 1, row: 1 });
    expect(chooseSpawn(pts, () => 0.99)).toEqual({ col: 9, row: 3 });
    expect(chooseSpawn([], () => 0)).toBe(null);
  });
  it('randomType returns bomb or shield from the injected rand', () => {
    expect(randomType(() => 0.2)).toBe('bomb');
    expect(randomType(() => 0.8)).toBe('shield');
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- pickup`
Expected: FAIL (module not found).

- [ ] **Step 3 : Créer `pickup.js`**

```js
// A single arena pickup. `type` is 'bomb' (fills the quiver with bombs) or
// 'shield' (grants a one-hit shield). x,y are top-left logical coords.
export function createPickup() {
  return { active: false, type: 'shield', x: 0, y: 0, w: 8, h: 8 };
}

// Pick a spawn point from `points` using an injected rand() in [0,1). null if empty.
export function chooseSpawn(points, rand) {
  if (points.length === 0) return null;
  return points[Math.floor(rand() * points.length)];
}

export function randomType(rand) {
  return rand() < 0.5 ? 'bomb' : 'shield';
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- pickup` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add pickup.js tests/pickup.test.js
git commit -m "feat(j2): pure pickup helpers (spawn choice + type)"
```

---

### Task D3 : Câbler pickups + bouclier (wiring : config.js, sketch.js, render.js, hud.js)

**Files:** Modify `config.js`, `sketch.js`, `render.js`, `hud.js`. (Browser-only.)

- [ ] **Step 1 : config.js — cadence**

Add to `DEFAULT_CONFIG`:
```js
  pickupRespawnFrames: 360, // ~6s avant réapparition d'un pickup
```

- [ ] **Step 2 : sketch.js — spawner + ramassage**

Update parse + imports:
```js
  const { grid, spawns, pickupSpawns } = parseArena(ARENA_A);
```
```js
import { fillWith } from './quiver.js';
import { createPickup, chooseSpawn, randomType } from './pickup.js';
import { drawWorld, drawArrows, drawExplosions, drawPickup } from './render.js';
```
Add spawner state (after `const explosions = []`):
```js
  const pickup = createPickup();
  let pickupTimer = cfg.pickupRespawnFrames;
```
Add an update helper (near `explodeAt`):
```js
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
      if (pickup.type === 'bomb') fillWith(p, 'bomb', cfg.quiverCapacity);
      else p.shield = true;
      pickup.active = false;
      pickupTimer = cfg.pickupRespawnFrames;
      break;
    }
  }
```
Call it in `stepPlaying` (after the stomp resolution): `updatePickups();`
Reset on respawn — in `respawnAll`, at the end add:
```js
    pickup.active = false;
    pickupTimer = cfg.pickupRespawnFrames;
```
Draw it — after `drawExplosions(explosions);` add:
```js
    drawPickup(pickup);
```

- [ ] **Step 3 : render.js — pickup + aura bouclier**

Add to `COL`:
```js
  shield: '#e2e8f0',
```
Add `drawPickup` (bomb uses the bomb arrow color, shield uses COL.shield):
```js
import { ARROW_TYPES } from './arrow.js';

export function drawPickup(pickup) {
  if (!pickup.active) return;
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  scale(SCALE);
  noStroke();
  fill(pickup.type === 'bomb' ? ARROW_TYPES.bomb.color : COL.shield);
  rect(pickup.x, pickup.y, pickup.w, pickup.h);
  pop();
}
```
In `drawWorld`, inside the players loop, draw a shield aura around shielded players (before/after the body rect):
```js
    if (player.shield) {
      stroke(COL.shield); strokeWeight(1); noFill();
      rect(player.x - 1, player.y - 1, player.w + 2, player.h + 2);
      noStroke();
    }
```
(Re-set `fill(PLAYER_COLORS[...])` before drawing the body if the aura code precedes it.)

- [ ] **Step 4 : hud.js — couleur du prochain tir + indicateur bouclier**

Now that `ARROW_TYPES` exists (C1), color the arrow count by the next type, and add a shield marker. Add imports:
```js
import { arrowCount, nextType } from './quiver.js';
import { ARROW_TYPES } from './arrow.js';
```
Replace the `text(\`arr:${arrowCount(p)}\`, x, 22);` line with a type-colored version, then restore the player color, and add the shield marker:
```js
    const nt = nextType(p);
    fill(nt ? ARROW_TYPES[nt].color : '#555');
    text(`arr:${arrowCount(p)}`, x, 22);
    fill(PLAYER_COLORS[i % PLAYER_COLORS.length]);
    if (p.shield) text('[O]', x + 40, 6);
```

- [ ] **Step 5 : debug.js — sliders**

Add to the combat PARAMS block:
```js
  ['explosionRadius', 0, 80], ['pickupRespawnFrames', 0, 1200], ['quiverCapacity', 1, 12],
```
Add `quiverCapacity` and `pickupRespawnFrames` to the integer-step list in the `isInt` condition.

- [ ] **Step 6 : Vérifier + commit**

Run: `npm test` (green), `node --check sketch.js render.js hud.js debug.js`.
DEFERRED (human): a pickup appears at a P point; collecting bomb fills the quiver with bombs (HUD next-type = bomb color), collecting shield shows an aura that absorbs one hit; pickup reappears after the delay.
```bash
git add config.js sketch.js render.js hud.js debug.js
git commit -m "feat(j2): pickups (bomb/shield) spawner, collection, shield aura"
```

**Gate Phase D :** pickups apparaissent/se ramassent ; bombe et bouclier opérationnels ; `npm test` vert.

---

## PHASE E — Arènes

### Task E1 : arena.js → 3 arènes + tirage (pur)

**Files:** Modify `arena.js`, `tests/arena.test.js`.

- [ ] **Step 1 : Ajouter les tests (échec)**

In `tests/arena.test.js` add:
```js
import { ARENAS, pickRandomArena } from '../arena.js';

describe('arena set', () => {
  it('exposes 3 arenas', () => {
    expect(ARENAS).toHaveLength(3);
  });
  it('every arena is 32x18, has >=4 player spawns and >=1 pickup spawn', () => {
    for (const ascii of ARENAS) {
      expect(ascii).toHaveLength(18);
      for (const row of ascii) expect(row).toHaveLength(32);
      const { spawns, pickupSpawns } = parseArena(ascii);
      expect(spawns.length).toBeGreaterThanOrEqual(4);
      expect(pickupSpawns.length).toBeGreaterThanOrEqual(1);
    }
  });
  it('pickRandomArena returns one of the arenas via injected rand', () => {
    expect(pickRandomArena(() => 0)).toBe(ARENAS[0]);
    expect(pickRandomArena(() => 0.99)).toBe(ARENAS[2]);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arena`
Expected: FAIL (`ARENAS`/`pickRandomArena` undefined; A may lack 4 spawns/pickups).

- [ ] **Step 3 : Implémenter dans `arena.js`**

Enrich `ARENA_A` so it has ≥4 `S`, ≥1 `P`, and some `%`. Replace its rows with (32 cols × 18 rows):
```js
export const ARENA_A = [
  '................................', // 0
  '................................', // 1
  '..............PP................', // 2  pickup spawns (center top)
  '................................', // 3
  '............========............', // 4  one-way
  '................................', // 5
  '...S......................S......', // 6  spawns (upper)
  '...########..........########...', // 7
  '............%%%%%%%%............', // 8  destructible bridge
  '................................', // 9
  '................................', // 10
  '......========....========......', // 11 one-way
  '................................', // 12
  '...#........................#...', // 13 walls
  '...#..S..................S..#...', // 14 walls + spawns (lower) → 4 spawns total
  '...#........................#...', // 15
  '############........############', // 16 ground (central hole)
  '############........############', // 17 ground
];
```
Add two more arenas (each 32×18, ≥4 `S`, ≥1 `P`, some `%`):
```js
export const ARENA_B = [
  '................................', // 0
  '...####################.........', // 1
  '...#..................#.........', // 2
  '...#..S............S..#....P.....', // 3  spawns + pickup
  '...#..................#.........', // 4
  '...#......======......#.........', // 5  one-way
  '...####%%%%....%%%%####.........', // 6  destructibles flanking
  '................................', // 7
  '..............PP................', // 8  pickups
  '......======..........======....', // 9
  '................................', // 10
  '...#........................#...', // 11
  '...#..S..................S..#...', // 12  spawns
  '...#........................#...', // 13
  '...#....================....#...', // 14
  '................................', // 15
  '################################', // 16 solid floor
  '################################', // 17
];

export const ARENA_C = [
  '................................', // 0
  '................................', // 1
  '....S....................S......', // 2  spawns (top)
  '...####................####.....', // 3
  '.......%%%%........%%%%.........', // 4  destructibles
  '................................', // 5
  '............P..P................', // 6  pickups
  '.....========......========.....', // 7  one-way
  '................................', // 8
  '................................', // 9
  '..#########........#########....', // 10
  '................................', // 11
  '....S....................S......', // 12 spawns (bottom)
  '...===...................===....', // 13 one-way ledges
  '................................', // 14
  '................................', // 15
  '######........####........######', // 16 ground with gaps (wrap play)
  '######........####........######', // 17
];

export const ARENAS = [ARENA_A, ARENA_B, ARENA_C];

// Pick an arena (ASCII rows) using an injected rand() in [0,1).
export function pickRandomArena(rand) {
  return ARENAS[Math.floor(rand() * ARENAS.length)];
}
```
IMPORTANT: each string above MUST be exactly 32 characters and there MUST be exactly 18 rows — the test enforces this. Count carefully; pad with `.` if needed.

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arena` then `npm test`
Expected: PASS. If a row length assertion fails, fix the offending row to 32 chars.

- [ ] **Step 5 : Commit**

```bash
git add arena.js tests/arena.test.js
git commit -m "feat(j2): three arenas + random picker"
```

---

### Task E2 : Câbler arène par manche (wiring : sketch.js)

**Files:** Modify `sketch.js`. (Browser-only.)

- [ ] **Step 1 : Grille mutable + rebuild par manche**

Update the import:
```js
import { ARENA_A, ARENAS, parseArena, pickRandomArena } from './arena.js';
```
Replace the one-shot parse with mutable bindings:
```js
  let { grid, spawns, pickupSpawns } = parseArena(ARENA_A);
```
Add a helper to load a fresh random arena (near `respawnAll`):
```js
  function loadRandomArena() {
    const ascii = pickRandomArena(Math.random);
    const parsed = parseArena(ascii); // fresh grid (destructibles regenerate)
    grid = parsed.grid;
    spawns = parsed.spawns;
    pickupSpawns = parsed.pickupSpawns;
  }
```
In `respawnAll`, call `loadRandomArena()` at the very top (before repositioning players) so each round uses a fresh random arena and fresh destructibles:
```js
  function respawnAll() {
    loadRandomArena();
    for (const a of arrowPool) release(arrowPool, a);
    ...
```
(`spawnFor` already reads `spawns`, so repositioning uses the new arena's spawns. The pickup reset lines added in D3 stay.)

NOTE: `grid`, `spawns`, `pickupSpawns` are referenced by closures (`stepPlaying`, `updatePickups`, draw). Reassigning the `let` bindings is fine because those closures read the variables at call time.

- [ ] **Step 2 : Vérifier + commit**

Run: `npm test` (green), `node --check sketch.js`.
DEFERRED (human): each new round loads a different (random) arena; destroyed tiles are back next round; players spawn at the new arena's points; 3–4 players each get a distinct spawn.
```bash
git add sketch.js
git commit -m "feat(j2): random arena per round with fresh destructibles"
```

**Gate Phase E / Jalon 2 :** session Versus variée — bombe, bouclier, 3 arènes alternées ; `npm test` vert.

---

## Auto-revue (couverture spec → tâches)

- Carquois typé (start 3 / cap 6) → A1, A3, A4 (config cap). ✓
- Type de flèche enfichable + bombe → A2, C1. ✓
- Explosion (rayon, tue, bouclier/invuln, détruit destructibles) → C2 (purs), C3 (wiring). ✓
- Tuiles destructibles (bloquantes, supprimables) → B1, B2, C3 (suppression). ✓
- Reset d'arène / destructibles régénérés → E2 (grille re-parse par manche). ✓
- Pickups (spawn temporisé, un seul, type aléatoire, ramassage) → D1, D2, D3. ✓
- Bouclier (absorbe un coup, toute source) → C2 `killOrShield` (utilisé partout en C3/D3), D3 (acquisition + aura). ✓
- 3 arènes + tirage aléatoire par manche + ≥4 spawns + pickupSpawns → D1, E1, E2. ✓
- Paramètres au panneau debug → A4, C3, D3 (sliders). ✓
- Tests purs → A1,A2,A3,B1,B2,C1,C2,D1,D2,E1. ✓

**Risque assumé :** les changements de `tilemap.js` (isBlocking) touchent le mouvement J0 ; couverts par les tests J0 existants (inchangés) + nouveaux tests `DESTRUCT` (B1). Le wiring q5play (rendu/explosion/pickups/arène) est vérifié par `node --check` + validation manuelle navigateur, comme au J1.
