# Jalon 3 — Contenu (types de flèches + piques + arènes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 4 types de flèches enfichables (laser à rebond, foudre à scission, super-bombe, perceuse), une tuile danger (piques) létale, +3 arènes (total 6), et une distribution de flèches spéciales par pickups.

**Architecture:** Approche data-driven (A) — on enrichit la table `ARROW_TYPES` avec des champs déclaratifs et on branche les cas spéciaux dans `updateArrow`/le wiring `sketch.js`. La logique risquée (réflexion laser `tileHitAxis`, éventail `splitDirections`, prédicat d'arrêt `cellStopsArrow`, létalité `spikeOverlap`, distribution `addArrows`) part en **fonctions pures testées Vitest** ; le câblage q5play (spawn des fragments depuis le pool, explosion, overlaps, rendu) reste mince, vérifié par `node --check` + validation manuelle.

**Tech Stack:** JavaScript ES modules, q5play.js (CDN globals), Vitest, Vite.

**Référence spec :** `docs/superpowers/specs/2026-06-08-jalon3-content-design.md`

## Convention de commit
Chaque commit se termine par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omis ci-dessous pour la lisibilité — l'ajouter à chaque commit).

## Structure de fichiers

| Fichier | Statut | Responsabilité (changement J3) |
|---|---|---|
| `tilemap.js` | modifié | + `SPIKE`, `cellStopsArrow(cell,type)`, `arrowBoxStops(...)`, `tileHitAxis(...)` |
| `arrow.js` | modifié | `ARROW_TYPES` enrichie ; `spawnArrow` (speedMult/bounces) ; `updateArrow` (flat, rebond, split, pierce) ; `splitDirections` |
| `combat.js` | modifié | `spikeOverlap(grid,player,TILE)` |
| `quiver.js` | modifié | `addArrows(p,type,n,cap)` |
| `pickup.js` | modifié | `PICKUP_TYPES`, `randomType` tire dans le pool |
| `arena.js` | modifié | parse `^`→SPIKE ; arènes D/E/F ; `ARENAS` (6) |
| `config.js` | modifié | + `pickupArrowCount` |
| `render.js` | modifié | rendu des piques |
| `debug.js` | modifié | slider `pickupArrowCount` |
| `sketch.js` | modifié | explosion typée (radiusMult), split, mort sur piques, pickups étendus |

**Phases :** A Table+spawn typé · B Perceuse · C Laser · D Foudre · E Super-bombe · F Piques · G Pickups · H Arènes.

---

## PHASE A — Table `ARROW_TYPES` enrichie + spawn typé

### Task A1 : `ARROW_TYPES` + `spawnArrow` (speedMult, bounces) + `flat`

**Files:**
- Modify: `arrow.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

Dans `tests/arrow.test.js`, ajouter à la fin du fichier :

```js
describe('arrow type table & typed spawn (J3)', () => {
  it('exposes the new types with their flags', () => {
    expect(ARROW_TYPES.superbomb.explosive).toBe(true);
    expect(ARROW_TYPES.superbomb.radiusMult).toBe(2);
    expect(ARROW_TYPES.laser.bounces).toBe(3);
    expect(ARROW_TYPES.laser.flat).toBe(true);
    expect(ARROW_TYPES.bolt.splitCount).toBe(3);
    expect(ARROW_TYPES.drill.pierces).toBe(true);
  });
  it('spawn applies speedMult and inits bounces', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 100, 50, 1, 0, 0, c, 'laser');
    expect(a.vx).toBeCloseTo(c.arrowSpeed * 1.6, 5);
    expect(a.bounces).toBe(3);
    const n = createArrow();
    spawnArrow(n, 100, 50, 1, 0, 0, c, 'normal');
    expect(n.vx).toBeCloseTo(c.arrowSpeed, 5);
    expect(n.bounces).toBe(0);
  });
  it('flat arrows ignore gravity past the straight distance', () => {
    const c = cfg();
    const a = createArrow();
    spawnArrow(a, 0, 50, 1, 0, 0, c, 'laser'); // flat
    a.traveled = c.arrowStraightDist + 10;     // past gravity onset
    updateArrow(a, c, emptyGrid, DT);
    expect(a.vy).toBe(0);                       // still no gravity
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arrow`
Expected: FAIL (`ARROW_TYPES.superbomb` undefined ; `a.bounces` undefined).

- [ ] **Step 3 : Implémenter dans `arrow.js`**

Replace the `ARROW_TYPES` table (lines 3-8) with:

```js
// Pluggable arrow types. Declarative fields drive behavior:
//  explosive  → terrain impact yields EXPLODE
//  radiusMult → multiplies cfg.explosionRadius on explosion
//  speedMult  → multiplies cfg.arrowSpeed at spawn
//  flat       → no gravity (straight shot)
//  bounces    → reflections off solid/destruct before planting (laser)
//  splitCount → fragments spawned on impact (bolt)
//  pierces    → only SOLID stops it (passes one-way/destructibles)
export const ARROW_TYPES = {
  normal:    { color: '#fcd34d' },
  bomb:      { color: '#fb7185', explosive: true },
  superbomb: { color: '#f43f5e', explosive: true, radiusMult: 2 },
  laser:     { color: '#38bdf8', speedMult: 1.6, flat: true, bounces: 3 },
  bolt:      { color: '#c084fc', speedMult: 2.0, flat: true, splitCount: 3 },
  drill:     { color: '#fbbf24', speedMult: 1.2, pierces: true },
};
```

In `createArrow()` add the field after `traveled: 0,` (line 17):

```js
    bounces: 0,              // remaining laser reflections
```

Replace `spawnArrow` (lines 23-35) with:

```js
export function spawnArrow(a, x, y, dx, dy, owner, cfg, type = 'normal') {
  const def = ARROW_TYPES[type] || {};
  const speed = cfg.arrowSpeed * (def.speedMult || 1);
  a.active = true;
  a.state = 'IN_FLIGHT';
  a.x = x; a.y = y;
  a.dirX = dx; a.dirY = dy;
  a.vx = dx * speed;
  a.vy = dy * speed;
  a.owner = owner;
  a.ageFrames = 0;
  a.traveled = 0;
  a.type = type;
  a.bounces = def.bounces || 0;
  return a;
}
```

In `updateArrow`, replace the gravity block (lines 43-45) with a `flat` guard:

```js
  if (!ARROW_TYPES[a.type]?.flat && a.traveled >= cfg.arrowStraightDist) {
    a.vy += cfg.arrowGravity * dt;
  }
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arrow` then `npm test`
Expected: PASS (existing arrow tests unaffected — `speedMult`/`flat` absent on normal/bomb).

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j3): enrich ARROW_TYPES + typed spawn (speedMult, bounces, flat)"
```

---

## PHASE B — Perceuse (prédicat d'arrêt par type)

### Task B1 : `cellStopsArrow` + `arrowBoxStops` (purs, tilemap.js)

**Files:**
- Modify: `tilemap.js`
- Test: `tests/tilemap.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

In `tests/tilemap.test.js`, extend the import line to add the new symbols (keep existing imports):

```js
import { wrap, cellAt, isSolidAt, arrowBoxHitsTile, resolveX, resolveY, wallContact, SOLID, ONEWAY, DESTRUCT, EMPTY, SPIKE, cellStopsArrow, arrowBoxStops } from '../tilemap.js';
```

Add at the end:

```js
describe('per-type arrow stop predicate', () => {
  it('SPIKE is value 4 and stops nothing', () => {
    expect(SPIKE).toBe(4);
    expect(cellStopsArrow(SPIKE, 'normal')).toBe(false);
    expect(cellStopsArrow(EMPTY, 'normal')).toBe(false);
  });
  it('normal/bomb stop on solid, one-way and destruct', () => {
    expect(cellStopsArrow(SOLID, 'normal')).toBe(true);
    expect(cellStopsArrow(ONEWAY, 'normal')).toBe(true);
    expect(cellStopsArrow(DESTRUCT, 'bomb')).toBe(true);
  });
  it('drill stops only on solid', () => {
    expect(cellStopsArrow(SOLID, 'drill')).toBe(true);
    expect(cellStopsArrow(ONEWAY, 'drill')).toBe(false);
    expect(cellStopsArrow(DESTRUCT, 'drill')).toBe(false);
  });
  it('laser stops on solid and destruct, passes one-way', () => {
    expect(cellStopsArrow(SOLID, 'laser')).toBe(true);
    expect(cellStopsArrow(DESTRUCT, 'laser')).toBe(true);
    expect(cellStopsArrow(ONEWAY, 'laser')).toBe(false);
  });
  it('arrowBoxStops scans the AABB with the type predicate', () => {
    const grid = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]; // solid at col1,row1
    expect(arrowBoxStops(grid, 12, 12, 6, 2, 10, 'normal')).toBe(true);
    expect(arrowBoxStops(grid, 0, 0, 6, 2, 10, 'normal')).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- tilemap`
Expected: FAIL (`SPIKE`, `cellStopsArrow`, `arrowBoxStops` undefined).

- [ ] **Step 3 : Implémenter dans `tilemap.js`**

Add the constant after `export const DESTRUCT = 3;` (line 4):

```js
export const SPIKE = 4;
```

Add at the end of the file:

```js
// Which tile kinds stop/deflect an arrow of this type when its AABB overlaps one.
// SPIKE never stops arrows (they fly over it). drill: solid only.
// laser: solid|destruct (one-way is pass-through). others: solid|oneway|destruct.
export function cellStopsArrow(cell, type) {
  if (cell === EMPTY || cell === SPIKE) return false;
  if (type === 'drill') return cell === SOLID;
  if (type === 'laser') return cell === SOLID || cell === DESTRUCT;
  return cell === SOLID || cell === ONEWAY || cell === DESTRUCT;
}

// Does the arrow's AABB (top-left x,y, size w×h) overlap a stopping tile for `type`?
export function arrowBoxStops(grid, x, y, w, h, TILE, type) {
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + w - 0.001) / TILE);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (cellStopsArrow(cellAt(grid, c, r), type)) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- tilemap` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j3): SPIKE tile + per-type arrow stop predicate"
```

---

### Task B2 : Perceuse dans `updateArrow`

**Files:**
- Modify: `arrow.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

In `tests/arrow.test.js`, ensure the import line includes `ONEWAY`/`SOLID`/`DESTRUCT` from tilemap (extend the existing `import { arrowBoxHitsTile } from '../tilemap.js';`):

```js
import { arrowBoxHitsTile, SOLID, ONEWAY, DESTRUCT } from '../tilemap.js';
```

Add:

```js
describe('drill arrow pierces thin tiles, stops on solid', () => {
  it('passes one-way and destructible, plants on the first solid', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    grid[5][12] = ONEWAY;   // x 120..130, drill passes
    grid[5][15] = DESTRUCT; // x 150..160, drill passes
    grid[5][20] = SOLID;    // x 200.., drill stops
    const drill = createArrow();
    spawnArrow(drill, 100, 55, 1, 0, 0, c, 'drill'); // row5
    for (let i = 0; i < 80 && drill.state === 'IN_FLIGHT'; i++) updateArrow(drill, c, grid, DT);
    expect(drill.state).toBe('STUCK');
    expect(drill.x).toBeGreaterThan(160); // got past the one-way and destructible
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arrow`
Expected: FAIL (drill plants on the one-way at x≈114 because `updateArrow` still uses `arrowBoxHitsTile`).

- [ ] **Step 3 : Implémenter dans `arrow.js`**

Update the tilemap import (line 1) to use the new stop helper (`tileHitAxis` is added in Phase C):

```js
import { arrowBoxStops, wrap } from './tilemap.js';
```

In `updateArrow`, replace the impact branch (the `if (arrowBoxHitsTile(...))` block, lines 58-62) with the type-driven version. The laser **bounce** sub-branch is added in Task C2; for now pierce, explode, split and plant are handled:

```js
    if (arrowBoxStops(grid, nx, ny, a.w, a.h, cfg.TILE, a.type)) {
      const def = ARROW_TYPES[a.type] || {};
      a.state = def.explosive ? 'EXPLODE' : (def.splitCount ? 'SPLIT' : 'STUCK');
      a.vx = 0; a.vy = 0;
      return a; // rest at the last clear position (a.x, a.y)
    }
```

(`arrowBoxHitsTile` is no longer referenced in `arrow.js`; it stays exported from `tilemap.js` for the tilemap tests.)

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arrow` then `npm test`
Expected: PASS (drill pierces one-way/destruct, stops on solid; normal/bomb unchanged).

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j3): drill arrow pierces one-way/destructibles, stops on solid"
```

---

## PHASE C — Laser (réflexion)

### Task C1 : `tileHitAxis` (pur, tilemap.js)

**Files:**
- Modify: `tilemap.js`
- Test: `tests/tilemap.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

Extend the tilemap import to add `tileHitAxis`:

```js
import { wrap, cellAt, isSolidAt, arrowBoxHitsTile, resolveX, resolveY, wallContact, SOLID, ONEWAY, DESTRUCT, EMPTY, SPIKE, cellStopsArrow, arrowBoxStops, tileHitAxis } from '../tilemap.js';
```

Add:

```js
describe('tileHitAxis (laser reflection)', () => {
  const grid = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]; // solid at col1,row1 (10..20)
  it('pure horizontal hit reflects X only', () => {
    expect(tileHitAxis(grid, 2, 12, 8, 12, 8, 8, 10, 'normal')).toEqual({ x: true, y: false });
  });
  it('pure vertical hit reflects Y only', () => {
    expect(tileHitAxis(grid, 12, 2, 12, 8, 8, 8, 10, 'normal')).toEqual({ x: false, y: true });
  });
  it('diagonal corner reflects both', () => {
    expect(tileHitAxis(grid, 2, 2, 8, 8, 8, 8, 10, 'normal')).toEqual({ x: true, y: true });
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- tilemap`
Expected: FAIL (`tileHitAxis` undefined).

- [ ] **Step 3 : Implémenter dans `tilemap.js`**

Add at the end of the file:

```js
// Given a blocked move from (x,y) to (nx,ny) for an arrow of `type`, decide which
// axes are responsible so the caller can reflect velocity. Tests each axis in
// isolation; a corner where neither isolated axis blocks reflects both.
export function tileHitAxis(grid, x, y, nx, ny, w, h, TILE, type) {
  const xBlocked = arrowBoxStops(grid, nx, y, w, h, TILE, type);
  const yBlocked = arrowBoxStops(grid, x, ny, w, h, TILE, type);
  if (!xBlocked && !yBlocked) return { x: true, y: true };
  return { x: xBlocked, y: yBlocked };
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- tilemap` then `npm test`
Expected: PASS (this also satisfies the import in Task B2 — `npm test -- arrow` now green too).

- [ ] **Step 5 : Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j3): tileHitAxis helper for laser reflection"
```

---

### Task C2 : Branche de rebond laser dans `updateArrow`

**Files:**
- Modify: `arrow.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

Add to `tests/arrow.test.js`:

```js
describe('laser arrow bounces then plants', () => {
  it('reflects velocity on a wall and decrements bounces', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let r = 0; r < 18; r++) grid[r][20] = SOLID; // vertical wall at x 200
    const laser = createArrow();
    spawnArrow(laser, 100, 55, 1, 0, 0, c, 'laser');
    let bounced = false;
    for (let i = 0; i < 60 && !bounced; i++) {
      updateArrow(laser, c, grid, DT);
      if (laser.vx < 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(laser.bounces).toBe(2);
    expect(laser.state).toBe('IN_FLIGHT');
  });
  it('plants (STUCK) after exhausting its bounces', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let r = 0; r < 18; r++) { grid[r][10] = SOLID; grid[r][20] = SOLID; } // corridor
    const laser = createArrow();
    spawnArrow(laser, 150, 55, 1, 0, 0, c, 'laser');
    for (let i = 0; i < 600 && laser.state === 'IN_FLIGHT'; i++) updateArrow(laser, c, grid, DT);
    expect(laser.state).toBe('STUCK');
    expect(laser.bounces).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arrow`
Expected: FAIL (laser currently plants on the first wall — no reflection yet).

- [ ] **Step 3 : Ajouter le rebond dans `arrow.js`**

Update the tilemap import (line 1) to add `tileHitAxis` (now available from Task C1):

```js
import { arrowBoxStops, tileHitAxis, wrap } from './tilemap.js';
```

In `updateArrow`, expand the impact branch (from Task B2) to reflect when the type
has remaining bounces, before planting:

```js
    if (arrowBoxStops(grid, nx, ny, a.w, a.h, cfg.TILE, a.type)) {
      const def = ARROW_TYPES[a.type] || {};
      if (def.bounces && a.bounces > 0) {
        const axis = tileHitAxis(grid, a.x, a.y, nx, ny, a.w, a.h, cfg.TILE, a.type);
        if (axis.x) a.vx = -a.vx;
        if (axis.y) a.vy = -a.vy;
        a.bounces--;
        return a; // resume next frame with reflected velocity
      }
      a.state = def.explosive ? 'EXPLODE' : (def.splitCount ? 'SPLIT' : 'STUCK');
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
git commit -m "feat(j3): laser reflects off walls, plants after N bounces"
```

---

## PHASE D — Foudre (scission)

### Task D1 : `splitDirections` (pur, arrow.js)

**Files:**
- Modify: `arrow.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

Extend the arrow.js import in the test to include `splitDirections`:

```js
import { createArrow, spawnArrow, updateArrow, createPool, acquire, release, ARROW_TYPES, splitDirections } from '../arrow.js';
```

Add:

```js
describe('splitDirections (bolt fan)', () => {
  it('returns count unit vectors fanned around the base direction', () => {
    const dirs = splitDirections(1, 0, 3, Math.PI / 6);
    expect(dirs).toHaveLength(3);
    expect(dirs[1].x).toBeCloseTo(1, 5);
    expect(dirs[1].y).toBeCloseTo(0, 5);
    expect(dirs[0].y).toBeCloseTo(Math.sin(-Math.PI / 6), 5);
    expect(dirs[2].y).toBeCloseTo(Math.sin(Math.PI / 6), 5);
    for (const d of dirs) expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 5);
  });
  it('a single fragment points along the base direction', () => {
    const dirs = splitDirections(0, 1, 1, Math.PI / 6);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].x).toBeCloseTo(0, 5);
    expect(dirs[0].y).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arrow`
Expected: FAIL (`splitDirections` undefined).

- [ ] **Step 3 : Implémenter dans `arrow.js`**

Add after `spawnArrow` (before `updateArrow`):

```js
// `count` unit directions fanned within ±spread radians around (dirX,dirY).
// Used by the bolt arrow to scatter fragments on impact.
export function splitDirections(dirX, dirY, count, spread) {
  const base = Math.atan2(dirY, dirX);
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1..1
    const ang = base + t * spread;
    out.push({ x: Math.cos(ang), y: Math.sin(ang) });
  }
  return out;
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arrow`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(j3): splitDirections helper for bolt fan"
```

---

### Task D2 : Foudre → état `SPLIT` (test) + câblage spawn fragments

**Files:**
- Modify: `sketch.js`
- Test: `tests/arrow.test.js`

- [ ] **Step 1 : Écrire le test du passage à SPLIT (échec attendu si B2 incomplet)**

Add to `tests/arrow.test.js`:

```js
describe('bolt arrow splits on impact', () => {
  it('reaches SPLIT state on terrain impact', () => {
    const c = cfg();
    const grid = emptyGrid.map((r) => r.slice());
    for (let r = 0; r < 18; r++) grid[r][20] = SOLID;
    const bolt = createArrow();
    spawnArrow(bolt, 100, 55, 1, 0, 0, c, 'bolt');
    for (let i = 0; i < 40 && bolt.state === 'IN_FLIGHT'; i++) updateArrow(bolt, c, grid, DT);
    expect(bolt.state).toBe('SPLIT');
  });
});
```

- [ ] **Step 2 : Lancer**

Run: `npm test -- arrow`
Expected: PASS (the `def.splitCount ? 'SPLIT'` branch was added in B2). If FAIL, check `updateArrow`'s impact branch.

- [ ] **Step 3 : Câbler le spawn des fragments dans `sketch.js`**

Update the arrow import (line 8) to expose `ARROW_TYPES` and the split helper:

```js
import { createPool, acquire, spawnArrow, updateArrow, release, ARROW_TYPES, splitDirections } from './arrow.js';
```

In `stepPlaying`, replace the terrain-explosion loop (lines 163-166) with one that also handles `SPLIT`:

```js
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
```

(`explodeAt` gains a `type` parameter in Task E1 — until then it ignores the extra arg harmlessly, but do E1 in the same session to apply `radiusMult`.)

- [ ] **Step 4 : Vérifier**

Run: `npm test` (green), then `node --check sketch.js`.
DEFERRED (human): firing a bolt (pick one up in Phase G, or temporarily force `'bolt'` in the shoot spawn) bursts into 3 fragments on impact.

- [ ] **Step 5 : Commit**

```bash
git add sketch.js tests/arrow.test.js
git commit -m "feat(j3): bolt splits into normal-arrow fragments on impact"
```

---

## PHASE E — Super-bombe (rayon élargi)

### Task E1 : `explodeAt` lit `radiusMult`

**Files:**
- Modify: `sketch.js`
- (No new unit test — `explodeAt` is browser wiring; covered by `node --check` + manual. The `radiusMult` value itself is asserted in Task A1.)

- [ ] **Step 1 : Implémenter dans `sketch.js`**

Replace `explodeAt` (lines 59-67) with a type-aware radius:

```js
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
```

In the arrow→player resolution, replace the lethal branch (lines 179-183) so any explosive type explodes with its own radius:

```js
        else if (arrowLethal(a, p.index, cfg)) {
          if (ARROW_TYPES[a.type]?.explosive) explodeAt(a.x, a.y, a.type);
          else killOrShield(p);
          a.active = false;
        }
```

- [ ] **Step 2 : Vérifier**

Run: `npm test` (green — pure modules unaffected), then `node --check sketch.js`.
DEFERRED (human): a super-bomb explosion visibly covers a wider radius than a normal bomb and kills/destroys farther.

- [ ] **Step 3 : Commit**

```bash
git add sketch.js
git commit -m "feat(j3): explosions honor per-type radiusMult (super-bomb)"
```

---

## PHASE F — Piques (tuile danger létale)

### Task F1 : `spikeOverlap` (pur, combat.js)

**Files:**
- Modify: `combat.js`
- Test: `tests/combat.test.js`

- [ ] **Step 1 : Écrire les tests (échec)**

In `tests/combat.test.js`, extend the combat import to add `spikeOverlap`, and add a tilemap import for `SPIKE`:

```js
import { spikeOverlap } from '../combat.js';
import { SPIKE } from '../tilemap.js';
```

Add:

```js
describe('spikeOverlap', () => {
  const grid = [[0, 0, 0], [0, SPIKE, 0], [0, 0, 0]]; // spike at col1,row1 (10..20)
  it('true when the player AABB overlaps a spike cell', () => {
    expect(spikeOverlap(grid, { x: 11, y: 11, w: 6, h: 6 }, 10)).toBe(true);
  });
  it('false when clear of spikes', () => {
    expect(spikeOverlap(grid, { x: 0, y: 0, w: 6, h: 6 }, 10)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- combat`
Expected: FAIL (`spikeOverlap` undefined).

- [ ] **Step 3 : Implémenter dans `combat.js`**

Update the tilemap import (line 1) to add `SPIKE`:

```js
import { DESTRUCT, SPIKE, cellAt } from './tilemap.js';
```

Add at the end of `combat.js`:

```js
// True if the player's AABB overlaps any SPIKE cell (a lethal floor hazard).
export function spikeOverlap(grid, player, TILE) {
  const c0 = Math.floor(player.x / TILE);
  const c1 = Math.floor((player.x + player.w - 0.001) / TILE);
  const r0 = Math.floor(player.y / TILE);
  const r1 = Math.floor((player.y + player.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (cellAt(grid, c, r) === SPIKE) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- combat` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add combat.js tests/combat.test.js
git commit -m "feat(j3): spikeOverlap lethal-hazard helper"
```

---

### Task F2 : parse `^`→SPIKE + rendu + létalité (wiring)

**Files:**
- Modify: `arena.js`, `render.js`, `sketch.js`
- Test: `tests/arena.test.js`

- [ ] **Step 1 : Écrire le test parse (échec)**

In `tests/arena.test.js`, add a `SPIKE` import and a test:

```js
import { SPIKE } from '../tilemap.js';

describe('parseArena spikes', () => {
  it('maps ^ to SPIKE (non-blocking hazard)', () => {
    const { grid } = parseArena(['..^..']);
    expect(grid[0][2]).toBe(SPIKE);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arena`
Expected: FAIL (`^` parsed as EMPTY).

- [ ] **Step 3 : Implémenter le parse dans `arena.js`**

Update the import (line 1):

```js
import { SOLID, ONEWAY, EMPTY, DESTRUCT, SPIKE } from './tilemap.js';
```

In `parseArena`, add a branch before the `%` branch (after `else if (ch === '%') ...`):

```js
      else if (ch === '^') row.push(SPIKE);
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arena`
Expected: PASS.

- [ ] **Step 5 : Rendu des piques dans `render.js`**

Update the import (line 1):

```js
import { SOLID, ONEWAY, DESTRUCT, SPIKE } from './tilemap.js';
```

Add to `COL` (after `shield: '#e2e8f0',`):

```js
  spike: '#ef4444',
```

In `drawWorld`, replace the existing `DESTRUCT` branch (lines 34-37) — extend the
`else if` chain with a `SPIKE` branch so the braces stay balanced:

```js
      } else if (cell === DESTRUCT) {
        fill(COL.destruct);
        rect(c * TILE, r * TILE, TILE, TILE);
      } else if (cell === SPIKE) {
        fill(COL.spike);
        const n = 3, bw = TILE / n;
        for (let k = 0; k < n; k++) {
          const bx = c * TILE + k * bw;
          triangle(bx, r * TILE + TILE, bx + bw / 2, r * TILE, bx + bw, r * TILE + TILE);
        }
      }
```

- [ ] **Step 6 : Létalité dans `sketch.js`**

Update the combat import (line 12) to add `spikeOverlap`:

```js
import { toroidalOverlap, canCatch, arrowLethal, isStomp, isInvulnerable, killOrShield, playersInRadius, destructibleCellsInRadius, spikeOverlap } from './combat.js';
```

In `stepPlaying`, after the stomp resolution loop (after line 194, before `updatePickups();`), add:

```js
    // spikes kill on contact (shield absorbs, dodge-invuln survives)
    for (const p of players) {
      if (p.state === 'DEAD' || isInvulnerable(p)) continue;
      if (spikeOverlap(grid, p, cfg.TILE)) killOrShield(p);
    }
```

- [ ] **Step 7 : Vérifier + commit**

Run: `npm test` (green), then `node --check arena.js render.js sketch.js`.
DEFERRED (human): an arena with `^` shows red spikes; walking into them kills; a shielded player survives once; a dodging (invuln) player passes unharmed.

```bash
git add arena.js render.js sketch.js tests/arena.test.js
git commit -m "feat(j3): parse/render spikes + lethal-on-contact wiring"
```

---

## PHASE G — Pickups étendus (distribution des flèches spéciales)

### Task G1 : `addArrows` (pur, quiver.js)

**Files:**
- Modify: `quiver.js`
- Test: `tests/quiver.test.js`

- [ ] **Step 1 : Écrire le test (échec)**

In `tests/quiver.test.js`, extend the import to add `addArrows`, and add:

```js
  it('addArrows pushes n of a type up to capacity', () => {
    const p = { quiver: ['normal'] };
    addArrows(p, 'laser', 3, 6);
    expect(p.quiver).toEqual(['normal', 'laser', 'laser', 'laser']);
    addArrows(p, 'bomb', 5, 5); // already 4, cap 5 → only 1 fits
    expect(p.quiver).toEqual(['normal', 'laser', 'laser', 'laser', 'bomb']);
  });
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- quiver`
Expected: FAIL (`addArrows` undefined).

- [ ] **Step 3 : Implémenter dans `quiver.js`**

Add after `addArrow` (line 13):

```js
export function addArrows(p, type, n, cap) {
  for (let i = 0; i < n && p.quiver.length < cap; i++) p.quiver.push(type);
}
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- quiver` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add quiver.js tests/quiver.test.js
git commit -m "feat(j3): addArrows — push n arrows of a type up to cap"
```

---

### Task G2 : `PICKUP_TYPES` + `randomType` pool (pur, pickup.js)

**Files:**
- Modify: `pickup.js`
- Test: `tests/pickup.test.js`

- [ ] **Step 1 : Réécrire le test `randomType` (échec)**

In `tests/pickup.test.js`, update the import and replace the `randomType` test:

```js
import { createPickup, chooseSpawn, randomType, PICKUP_TYPES } from '../pickup.js';
```

Replace the existing `randomType` test with:

```js
  it('PICKUP_TYPES includes shield and the special arrows', () => {
    expect(PICKUP_TYPES).toEqual(['shield', 'bomb', 'superbomb', 'laser', 'bolt', 'drill']);
  });
  it('randomType indexes PICKUP_TYPES via the injected rand', () => {
    expect(randomType(() => 0)).toBe('shield');
    expect(randomType(() => 0.5)).toBe('laser');   // floor(0.5*6)=3
    expect(randomType(() => 0.99)).toBe('drill');  // floor(5.94)=5
  });
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- pickup`
Expected: FAIL (old `randomType` returns only bomb/shield; `PICKUP_TYPES` undefined).

- [ ] **Step 3 : Implémenter dans `pickup.js`**

Replace `randomType` (lines 13-15) with:

```js
// Pool of pickup payloads: 'shield' (one-hit shield) or a special arrow type.
export const PICKUP_TYPES = ['shield', 'bomb', 'superbomb', 'laser', 'bolt', 'drill'];

export function randomType(rand) {
  return PICKUP_TYPES[Math.floor(rand() * PICKUP_TYPES.length)];
}
```

Also update the file's top comment (lines 1-2) to reflect the new payloads:

```js
// A single arena pickup. `type` is 'shield' (one-hit shield) or a special arrow
// type from PICKUP_TYPES (adds a few of that arrow). x,y are top-left logical coords.
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- pickup` then `npm test`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add pickup.js tests/pickup.test.js
git commit -m "feat(j3): pickup type pool (shield + special arrows)"
```

---

### Task G3 : Câbler la collecte + config + debug

**Files:**
- Modify: `config.js`, `sketch.js`, `debug.js`
- (Browser-only wiring — `node --check` + manual.)

- [ ] **Step 1 : config.js — quantité**

In `config.js` `DEFAULT_CONFIG`, after `pickupRespawnFrames: 360, ...` (line 42) add:

```js
  pickupArrowCount: 3,    // flèches ajoutées au carquois par un pickup de type flèche
```

- [ ] **Step 2 : sketch.js — collecte typée**

Update the quiver import (line 10) — drop the now-unused `fillWith`, add `addArrows`:

```js
import { canShoot, shootType, addArrow, addArrows } from './quiver.js';
```

In `updatePickups`, replace the collect branch (lines 85-86):

```js
      if (pickup.type === 'shield') p.shield = true;
      else addArrows(p, pickup.type, cfg.pickupArrowCount, cfg.quiverCapacity);
```

- [ ] **Step 3 : debug.js — slider**

In `debug.js` `PARAMS`, in the combat block, after `['pickupRespawnFrames', 0, 1200], ['quiverCapacity', 1, 12],` add to the same array:

```js
  ['pickupArrowCount', 1, 6],
```

Add `'pickupArrowCount'` to the integer-step list in the `isInt` condition (the `.includes(key)` array).

- [ ] **Step 4 : Vérifier + commit**

Run: `npm test` (green), then `node --check config.js sketch.js debug.js`.
DEFERRED (human): collecting a laser/bolt/drill/super-bomb pickup adds 3 arrows of that type (HUD next-type color matches); a shield pickup still grants the aura.

```bash
git add config.js sketch.js debug.js
git commit -m "feat(j3): wire special-arrow pickups (addArrows + count param)"
```

**Gate Phases A–G :** les 4 types de flèches + piques sont opérationnels et distribués par pickups ; `npm test` vert.

---

## PHASE H — Arènes (+3)

### Task H1 : Arènes D/E/F + `ARENAS` (6)

**Files:**
- Modify: `arena.js`
- Test: `tests/arena.test.js`

- [ ] **Step 1 : Mettre à jour les tests d'ensemble (échec)**

In `tests/arena.test.js`, update the import to include `ARENAS, pickRandomArena` if not already, then replace the existing `arena set` describe block (the one asserting 3 arenas) with:

```js
describe('arena set', () => {
  it('exposes 6 arenas', () => {
    expect(ARENAS).toHaveLength(6);
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
    expect(pickRandomArena(() => 0.99)).toBe(ARENAS[5]);
  });
});
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npm test -- arena`
Expected: FAIL (`ARENAS` has 3 ; `ARENAS[5]` undefined).

- [ ] **Step 3 : Ajouter les arènes dans `arena.js`**

After `export const ARENA_C = [ ... ];` (line 65), add the three validated arenas (each exactly 32 chars × 18 rows — verified):

```js
export const ARENA_D = [
  '................................', // 0
  '...........P..P.................', // 1  pickups
  '................................', // 2
  '...S..................S.........', // 3  spawns (top)
  '..#####............#####........', // 4
  '................................', // 5
  '......======....======..........', // 6  one-way
  '................................', // 7
  '....%%%%............%%%%........', // 8  destructibles
  '................................', // 9
  '................................', // 10
  '...S..................S.........', // 11 spawns (mid) → 4 total
  '..#####............#####........', // 12
  '................................', // 13
  '................................', // 14
  '#####...^^^^^^...^^^^^...#####..', // 15 spike pit on the floor lip
  '################################', // 16 ground
  '################################', // 17 ground
];

export const ARENA_E = [
  '................................', // 0
  '..............P.................', // 1  pickup (top)
  '................................', // 2
  '..#########........#########....', // 3
  '..#.S...................S..#....', // 4  spawns (upper)
  '..#........................#....', // 5
  '..#....======..======......#....', // 6  one-way
  '..#........................#....', // 7
  '..######^^^^^^^^^^^^######..P...', // 8  spike bridge + pickup
  '................................', // 9
  '................................', // 10
  '......%%%%%%....%%%%%%..........', // 11 destructibles
  '....S..................S........', // 12 spawns (lower) → 4 total
  '...====..............====.......', // 13 one-way ledges
  '................................', // 14
  '................................', // 15
  '######......######......######..', // 16 ground (gaps → wrap play)
  '######......######......######..', // 17
];

export const ARENA_F = [
  '................................', // 0
  '................................', // 1
  '....S..................S........', // 2  spawns (top)
  '...####..............####.......', // 3
  '..............PP................', // 4  pickups
  '........................^^^^....', // 5  spikes (right ledge)
  '....^^^^........................', // 6  spikes (left ledge)
  '...======..........======.......', // 7  one-way
  '................................', // 8
  '.....%%%%........%%%%...........', // 9  destructibles
  '................................', // 10
  '..#########....#########........', // 11
  '....S..................S........', // 12 spawns (bottom) → 4 total
  '..^^^^..............^^^^........', // 13 spikes near spawns
  '................................', // 14
  '................................', // 15
  '####........########........####', // 16 ground with gaps
  '####........########........####', // 17
];
```

Then replace the `ARENAS` export (line 67):

```js
export const ARENAS = [ARENA_A, ARENA_B, ARENA_C, ARENA_D, ARENA_E, ARENA_F];
```

- [ ] **Step 4 : Lancer (succès)**

Run: `npm test -- arena` then `npm test`
Expected: PASS. If a row-length assertion fails, the offending row is not 32 chars — fix to 32.

- [ ] **Step 5 : Commit**

```bash
git add arena.js tests/arena.test.js
git commit -m "feat(j3): three more arenas with spikes (total 6)"
```

**Gate Phase H / Jalon 3 :** session Versus enrichie — 4 types de flèches, piques, 6 arènes alternées ; `npm test` vert ; validation manuelle navigateur OK.

---

## Auto-revue (couverture spec → tâches)

- Table `ARROW_TYPES` data-driven (color/explosive/radiusMult/speedMult/flat/bounces/splitCount/pierces) → A1. ✓
- Super-bombe (rayon ×2) → A1 (table) + E1 (explodeAt radiusMult). ✓
- Perceuse (s'arrête sur SOLID, traverse one-way/destruct) → B1 (`cellStopsArrow`/`arrowBoxStops`) + B2 (updateArrow). ✓
- Laser (rebond sur solid/destruct, traverse one-way, plante après N) → B1/B2 (impact branch) + C1 (`tileHitAxis`) + C2 (rebond). ✓
- Foudre (scission en flèches normales) → D1 (`splitDirections`) + D2 (état SPLIT + spawn fragments). ✓
- Tuile piques (non bloquante, létale, bouclier/invuln respectés) → B1 (SPIKE non-bloquant pour flèches) + F1 (`spikeOverlap`) + F2 (parse/rendu/létalité). ✓
- Distribution par pickups (ajoute n flèches ; pool shield+spéciales) → G1 (`addArrows`) + G2 (`PICKUP_TYPES`) + G3 (wiring + `pickupArrowCount`). ✓
- +3 arènes (total 6), 32×18, ≥4 spawns, ≥1 pickup, avec piques → H1. ✓
- Paramétrable (config + debug) → A1 (table), G3 (config/debug). ✓
- Logique risquée en fonctions pures testées → `cellStopsArrow`, `arrowBoxStops`, `tileHitAxis`, `splitDirections`, `spikeOverlap`, `addArrows`, `randomType`. ✓

**Risque assumé :** `updateArrow` change de prédicat d'impact (`arrowBoxHitsTile` → `arrowBoxStops`) ; pour `normal`/`bomb` le résultat est identique (solid/oneway/destruct), couvert par les tests J1/J2 inchangés + nouveaux tests B1/B2. Le câblage q5play (split depuis le pool, explosion typée, mort sur piques, rendu) est vérifié par `node --check` + validation manuelle navigateur, comme aux J1/J2.

**Note d'ordonnancement :** exécuter les tâches dans l'ordre A→H. B2 pose l'impact non-rebond (pas de dépendance sur `tileHitAxis`) ; C1 ajoute `tileHitAxis` ; C2 branche le rebond. D2 passe déjà `a.type` à `explodeAt` (l'argument est ignoré sans dommage jusqu'à E1, qui applique `radiusMult`) — enchaîner D2→E1 dans la même session pour que la super-bombe ait son rayon élargi.
