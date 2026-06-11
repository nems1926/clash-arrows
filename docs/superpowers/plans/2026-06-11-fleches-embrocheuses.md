# Flèches embrocheuses (impale & carry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une flèche non-explosive qui tue un joueur l'embroche, accélère ×1.5, poursuit sa trajectoire (chaînant d'autres kills), et se plante au terrain en emportant les cadavres ; la fin de round est différée tant qu'une flèche porte un corps.

**Architecture:** Logique pure dans `combat.js` (`impale`, `carryFollow`), `arrow.js` (champ `carryIds`, court-circuit bounce/split), `game.js` (`advance` avec `holdRound`), chacune testée sous vitesse sans booter q5play. `sketch.js` orchestre (branche la mort vers `impale`, appelle `carryFollow`, calcule `anyCarrying`, diffère `advance`). `render.js` dessine les cadavres embrochés. `config.js` expose `impaleSpeedMult`.

**Tech Stack:** JavaScript (ES modules), q5play.js (non touché par la logique pure), vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-fleches-embrocheuses-design.md`

---

## File Structure

- `config.js` — ajoute `impaleSpeedMult: 1.5`.
- `arrow.js` — champ `carryIds` (init/reset) ; `updateArrow` court-circuite bounce/split quand `carryIds.length > 0`.
- `combat.js` — `impale(arrow, player, cfg)`, `carryFollow(arrow, players)`.
- `game.js` — `advance(game, players, cfg, holdRound = false)`.
- `player.js` — flag `impaled: false` dans `createPlayer`.
- `sketch.js` — branchement impale + carryFollow + différé de round + reset `impaled` au respawn.
- `render.js` — dessine `DEAD && impaled`.
- `tests/combat.test.js`, `tests/arrow.test.js`, `tests/game.test.js` — nouveaux tests.

Convention : constantes `UPPER_CASE`, fonctions `lowercase`, factories `createX`, pas de classes. Commentaires bilingues. Tests vitest important le module pur directement.

---

## Task 1: Constante `impaleSpeedMult` dans la config

**Files:**
- Modify: `config.js:28` (à la suite de `arrowSpeed`)

- [ ] **Step 1: Ajouter la constante**

Dans `config.js`, juste après la ligne `arrowSpeed: 220, ...`, ajouter :

```js
  impaleSpeedMult: 1.5,   //        accélération composée de la flèche par kill embroché
```

- [ ] **Step 2: Vérifier que rien n'est cassé**

Run: `npm test`
Expected: PASS (aucun test ne dépend encore de la constante ; la suite reste verte).

- [ ] **Step 3: Commit**

```bash
git add config.js
git commit -m "feat(arrow): ajoute impaleSpeedMult dans la config"
```

---

## Task 2: Champ `carryIds` sur la flèche

**Files:**
- Modify: `arrow.js:20-31` (`createArrow`), `arrow.js:34-49` (`spawnArrow`), `arrow.js:117-120` (`release`)
- Test: `tests/arrow.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/arrow.test.js` (le fichier importe déjà depuis `../arrow.js` et `../config.js` ; réutiliser ces imports) :

```js
describe('impale carry state', () => {
  it('une flèche neuve démarre sans corps porté', () => {
    const a = createArrow();
    expect(a.carryIds).toEqual([]);
  });
  it('spawnArrow réinitialise carryIds', () => {
    const a = createArrow();
    a.carryIds = [2, 3];
    spawnArrow(a, 0, 0, 1, 0, 0, DEFAULT_CONFIG, 'normal');
    expect(a.carryIds).toEqual([]);
  });
  it('release réinitialise carryIds', () => {
    const pool = createPool(1);
    pool[0].carryIds = [1];
    release(pool, pool[0]);
    expect(pool[0].carryIds).toEqual([]);
  });
});
```

Si `createArrow`, `spawnArrow`, `createPool`, `release`, `DEFAULT_CONFIG` ne sont pas déjà importés en haut du fichier, compléter l'import existant pour les inclure.

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/arrow.test.js -t "impale carry state"`
Expected: FAIL (`carryIds` est `undefined`).

- [ ] **Step 3: Implémenter le champ**

Dans `arrow.js`, `createArrow` — ajouter le champ avant la fermeture de l'objet (à côté de `bounces: 0,`) :

```js
    bounces: 0,              // remaining laser reflections
    carryIds: [],            // index des joueurs embrochés portés par cette flèche
```

Dans `spawnArrow`, après `a.bounces = def.bounces || 0;` :

```js
  a.bounces = def.bounces || 0;
  a.carryIds = [];
```

Dans `release`, après `a.state = 'STUCK';` :

```js
export function release(pool, a) {
  a.active = false;
  a.state = 'STUCK';
  a.carryIds = [];
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/arrow.test.js -t "impale carry state"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(arrow): champ carryIds (corps embrochés portés)"
```

---

## Task 3: `updateArrow` plante (sans rebond/split) quand elle porte un corps

**Files:**
- Modify: `arrow.js:82-101` (boucle de sous-step dans `updateArrow`)
- Test: `tests/arrow.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Le grid est un tableau de lignes de cellules numériques (`SOLID = 1`). Construire un petit grid avec un mur, lancer un laser/bolt portant un corps, et vérifier qu'il se plante (`STUCK`) au lieu de rebondir/splitter. Ajouter dans `tests/arrow.test.js` :

```js
import { SOLID } from '../tilemap.js';

describe('une flèche porteuse se plante sans réaction spéciale', () => {
  // grid 5 colonnes × 1 ligne, mur SOLID en colonne 4 ; TILE=10
  const wallGrid = () => [[0, 0, 0, 0, SOLID]];
  const cfg = { ...DEFAULT_CONFIG, W: 50, H: 10, TILE: 10, arrowStraightDist: 1000 };

  it('un laser porteur ne rebondit pas, il se plante', () => {
    const a = createArrow();
    spawnArrow(a, 30, 2, 1, 0, 0, cfg, 'laser'); // vers la droite, vers le mur
    a.carryIds = [1];        // porte un corps
    a.bounces = 3;           // aurait rebondi sans corps
    for (let i = 0; i < 30 && a.state === 'IN_FLIGHT'; i++) updateArrow(a, cfg, wallGrid(), 1 / 60);
    expect(a.state).toBe('STUCK');
  });

  it('un bolt porteur ne se fragmente pas, il se plante', () => {
    const a = createArrow();
    spawnArrow(a, 30, 2, 1, 0, 0, cfg, 'bolt');
    a.carryIds = [1];
    for (let i = 0; i < 30 && a.state === 'IN_FLIGHT'; i++) updateArrow(a, cfg, wallGrid(), 1 / 60);
    expect(a.state).toBe('STUCK');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/arrow.test.js -t "se plante sans réaction"`
Expected: FAIL (le laser passe `IN_FLIGHT` après rebond / le bolt passe `SPLIT`).

- [ ] **Step 3: Implémenter le court-circuit**

Dans `arrow.js`, dans la boucle de sous-step de `updateArrow`, remplacer le bloc qui gère le contact terrain (actuellement) :

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

par :

```js
    if (arrowBoxStops(grid, nx, ny, a.w, a.h, cfg.TILE, a.type)) {
      const def = ARROW_TYPES[a.type] || {};
      // Une flèche qui porte un corps devient un projectile lourd : elle ignore
      // ses réactions spéciales (rebond laser / fragmentation bolt) et se plante.
      const carrying = a.carryIds.length > 0;
      if (!carrying && def.bounces && a.bounces > 0) {
        const axis = tileHitAxis(grid, a.x, a.y, nx, ny, a.w, a.h, cfg.TILE, a.type);
        if (axis.x) a.vx = -a.vx;
        if (axis.y) a.vy = -a.vy;
        a.bounces--;
        return a; // resume next frame with reflected velocity
      }
      a.state = carrying ? 'STUCK' : (def.explosive ? 'EXPLODE' : (def.splitCount ? 'SPLIT' : 'STUCK'));
      a.vx = 0; a.vy = 0;
      return a; // rest at the last clear position (a.x, a.y)
    }
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/arrow.test.js`
Expected: PASS (les nouveaux + tous les anciens tests d'arrow).

- [ ] **Step 5: Commit**

```bash
git add arrow.js tests/arrow.test.js
git commit -m "feat(arrow): une flèche porteuse se plante sans rebond ni split"
```

---

## Task 4: `impale` et `carryFollow` dans `combat.js`

**Files:**
- Modify: `combat.js` (ajout de deux fonctions exportées, après `killOrShield`)
- Test: `tests/combat.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `tests/combat.test.js`. Compléter l'import en tête du fichier pour inclure `impale` et `carryFollow` :

```js
describe('impale & carry', () => {
  const mkArrow = () => ({ x: 100, y: 50, w: 6, h: 2, vx: 200, vy: 0, carryIds: [] });
  const mkPlayer = (index) => ({ index, x: 100, y: 50, w: 6, h: 12, vx: 0, vy: 0, state: 'AIRBORNE', shield: false });

  it('impale tue, marque impaled, embroche et accélère ×1.5', () => {
    const a = mkArrow();
    const p = mkPlayer(1);
    impale(a, p, cfg());
    expect(p.state).toBe('DEAD');
    expect(p.impaled).toBe(true);
    expect(a.carryIds).toEqual([1]);
    expect(a.vx).toBeCloseTo(300); // 200 × 1.5
  });

  it('deux kills successifs composent l’accélération (×2.25)', () => {
    const a = mkArrow();
    impale(a, mkPlayer(1), cfg());
    impale(a, mkPlayer(2), cfg());
    expect(a.carryIds).toEqual([1, 2]);
    expect(a.vx).toBeCloseTo(450); // 200 × 1.5 × 1.5
  });

  it('carryFollow recentre les corps portés sur la flèche', () => {
    const a = { ...mkArrow(), x: 130, y: 40, carryIds: [1] };
    const players = [mkPlayer(0), mkPlayer(1)];
    carryFollow(a, players);
    const p = players.find((q) => q.index === 1);
    // centre flèche = (133, 41) ; centre corps doit coïncider → x = 133 - 3, y = 41 - 6
    expect(p.x).toBeCloseTo(130);
    expect(p.y).toBeCloseTo(35);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/combat.test.js -t "impale & carry"`
Expected: FAIL (`impale` / `carryFollow` non définies).

- [ ] **Step 3: Implémenter les fonctions**

Dans `combat.js`, après `killOrShield`, ajouter :

```js
// Embrochage : tue le joueur, le marque comme corps porté par la flèche, l'ajoute
// à la liste des corps embrochés et accélère la flèche (composé à chaque kill).
// À n'appeler QUE quand le kill n'est pas absorbé par un bouclier.
export function impale(arrow, player, cfg) {
  player.state = 'DEAD';
  player.vx = 0; player.vy = 0;
  player.impaled = true;
  arrow.carryIds.push(player.index);
  arrow.vx *= cfg.impaleSpeedMult;
  arrow.vy *= cfg.impaleSpeedMult;
}

// Recentre chaque corps embroché sur la position courante de la flèche (empilés).
export function carryFollow(arrow, players) {
  const cx = arrow.x + arrow.w / 2;
  const cy = arrow.y + arrow.h / 2;
  for (const id of arrow.carryIds) {
    const p = players.find((q) => q.index === id);
    if (!p) continue;
    p.x = cx - p.w / 2;
    p.y = cy - p.h / 2;
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/combat.test.js`
Expected: PASS (nouveaux + anciens).

- [ ] **Step 5: Commit**

```bash
git add combat.js tests/combat.test.js
git commit -m "feat(combat): impale (embrochage+accélération) et carryFollow"
```

---

## Task 5: `advance` diffère la fin de round avec `holdRound`

**Files:**
- Modify: `game.js:9-26` (`advance`)
- Test: `tests/game.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/game.test.js` (réutiliser les imports `advance`/`createGame` existants ; `cfg` ou un objet `{ roundsToWin: N }` selon le style du fichier) :

```js
it('ne termine pas le round tant que holdRound est vrai', () => {
  const game = createGame();
  game.state = 'PLAYING';
  const players = [
    { index: 0, state: 'AIRBORNE', roundsWon: 0 },
    { index: 1, state: 'DEAD', roundsWon: 0 },
  ];
  // un seul vivant → roundOver serait vrai, mais une flèche porte encore un corps
  advance(game, players, { roundsToWin: 3 }, true);
  expect(game.state).toBe('PLAYING');
  // la flèche s'est plantée → holdRound repasse faux, le round se termine
  advance(game, players, { roundsToWin: 3 }, false);
  expect(game.state).toBe('ROUND_END');
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/game.test.js -t "holdRound"`
Expected: FAIL (le round passe ROUND_END dès le 1er appel car `holdRound` est ignoré).

- [ ] **Step 3: Implémenter le paramètre**

Dans `game.js`, modifier la signature et la garde de `advance` :

```js
// One call per fixed step. Mutates: awards a won round; transitions state.
// holdRound (optionnel) : tant qu'il est vrai, ne pas terminer le round même si
// roundOver — laisse une flèche embrocheuse finir de transporter ses corps.
// States: LOBBY → PLAYING → (ROUND_END → RESPAWN → PLAYING)* → MATCH_END.
export function advance(game, players, cfg, holdRound = false) {
  if (game.state === 'PLAYING') {
    if (!holdRound && roundOver(players)) {
```

(le reste du corps est inchangé.)

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/game.test.js`
Expected: PASS (nouveaux + anciens).

- [ ] **Step 5: Commit**

```bash
git add game.js tests/game.test.js
git commit -m "feat(game): advance diffère la fin de round via holdRound"
```

---

## Task 6: Flag `impaled` sur le joueur + reset au respawn

**Files:**
- Modify: `player.js:7-27` (`createPlayer`)
- Modify: `sketch.js:108-118` (`respawnAll`)

- [ ] **Step 1: Ajouter le flag dans la factory**

Dans `player.js`, `createPlayer`, ajouter après `shield: false,` :

```js
    shield: false,
    impaled: false,
```

- [ ] **Step 2: Réinitialiser au respawn**

Dans `sketch.js`, dans la boucle de `respawnAll`, après `p.shield = false;` :

```js
      p.shield = false;
      p.impaled = false;
```

- [ ] **Step 3: Vérifier la suite**

Run: `npm test`
Expected: PASS (champ additif, rien ne casse).

- [ ] **Step 4: Commit**

```bash
git add player.js sketch.js
git commit -m "feat(player): flag impaled (corps embroché) + reset au respawn"
```

---

## Task 7: Brancher l'embrochage dans la résolution flèche→joueur (`sketch.js`)

**Files:**
- Modify: `sketch.js:8,12` (imports), `sketch.js:165-198` (mise à jour des flèches + résolution)

- [ ] **Step 1: Importer `impale` et `carryFollow`**

Dans `sketch.js`, compléter l'import depuis `./combat.js` (ligne 12) pour inclure `impale, carryFollow` :

```js
import { toroidalOverlap, canCatch, arrowLethal, isStomp, isInvulnerable, killOrShield, playersInRadius, destructibleCellsInRadius, spikeOverlap, impale, carryFollow } from './combat.js';
```

- [ ] **Step 2: Appeler `carryFollow` après l'update des flèches**

Dans `stepPlaying`, juste après la boucle `for (const a of arrowPool) updateArrow(a, cfg, grid, FIXED);` (ligne 165), ajouter :

```js
    for (const a of arrowPool) updateArrow(a, cfg, grid, FIXED);
    // les corps embrochés suivent leur flèche tant qu'elle vole, puis restent figés
    for (const a of arrowPool) {
      if (a.active && a.carryIds.length > 0) carryFollow(a, players);
    }
```

- [ ] **Step 3: Brancher la mort non-explosive vers `impale`**

Dans la résolution flèche→joueur (lignes 182-198), remplacer la branche `arrowLethal` :

```js
        else if (arrowLethal(a, p.index, cfg)) {
          if (ARROW_TYPES[a.type]?.explosive) explodeAt(a.x, a.y, a.type);
          else killOrShield(p);
          a.active = false;
        }
```

par :

```js
        else if (arrowLethal(a, p.index, cfg)) {
          if (ARROW_TYPES[a.type]?.explosive) {
            explodeAt(a.x, a.y, a.type);
            a.active = false;
          } else if (killOrShield(p)) {
            // mort confirmée (pas de bouclier) → embrochage + accélération, la flèche continue
            impale(a, p, cfg);
          } else {
            // bouclier absorbé → la flèche est consommée comme avant
            a.active = false;
          }
        }
```

Note : `impale` met `p.state = 'DEAD'` ; la boucle `for (const p of players)` continue de tester les autres joueurs encore vivants pour la même flèche, permettant la chaîne de kills dans une même frame. Le `if (p.state === 'DEAD') continue;` en tête de boucle ignore les corps déjà embrochés. La garde `if (!a.active) break;` ne s'applique plus à l'embrochage (la flèche reste active).

- [ ] **Step 4: Vérifier la suite**

Run: `npm test`
Expected: PASS (les modules purs restent verts ; `sketch.js` n'a pas de test direct mais ne doit rien régresser).

- [ ] **Step 5: Commit**

```bash
git add sketch.js
git commit -m "feat(sketch): embrochage des kills non-explosifs + suivi des corps"
```

---

## Task 8: Différer la fin de round dans l'orchestration (`sketch.js`)

**Files:**
- Modify: `sketch.js:255-257` (branche `PLAYING` de `q5.update`)

- [ ] **Step 1: Calculer `anyCarrying` et le passer à `advance`**

Dans `q5.update`, dans la boucle d'accumulation, remplacer :

```js
      if (game.state === 'PLAYING') {
        stepPlaying();
        advance(game, players, cfg);
      } else if (game.state === 'ROUND_END') {
```

par :

```js
      if (game.state === 'PLAYING') {
        stepPlaying();
        // tant qu'une flèche porte un corps, on diffère la fin de round pour que
        // le transport jusqu'au mur soit visible (notamment en duel)
        const anyCarrying = arrowPool.some((a) => a.active && a.carryIds.length > 0);
        advance(game, players, cfg, anyCarrying);
      } else if (game.state === 'ROUND_END') {
```

- [ ] **Step 2: Vérifier la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add sketch.js
git commit -m "feat(sketch): diffère la fin de round tant qu'une flèche transporte un corps"
```

---

## Task 9: Dessiner les cadavres embrochés (`render.js`)

**Files:**
- Modify: `render.js:88-100` (boucle de rendu des joueurs)

- [ ] **Step 1: Rendre les corps `DEAD && impaled`**

Dans `render.js`, remplacer le début de la boucle des joueurs :

```js
  // players + ghosts (skip the dead)
  for (const player of players) {
    if (player.state === 'DEAD') continue;
```

par :

```js
  // players + ghosts. On saute les morts SAUF les corps embrochés, dessinés comme
  // cadavres inertes (gris) à leur position (suivie/épinglée par la flèche).
  for (const player of players) {
    if (player.state === 'DEAD') {
      if (player.impaled) {
        fill('#6b7280'); // gris cadavre
        for (const dx of [-W, 0, W]) {
          for (const dy of [-H, 0, H]) {
            rect(player.x + dx, player.y + dy, player.w, player.h);
          }
        }
      }
      continue;
    }
```

(le reste de la boucle — sprite vivant, bouclier, viseur — est inchangé.)

- [ ] **Step 2: Vérification manuelle dans le navigateur**

Run: `npm run dev` puis ouvrir l'URL Vite. Démarrer un duel, tuer un joueur d'une flèche normale et observer : le corps gris est embarqué le long de la trajectoire et reste planté contre le mur/sol ; le round se termine après l'impact.
Expected: comportement conforme. (Pas de test automatisé : `render.js` touche q5play et n'est pas testé sous vitest.)

- [ ] **Step 3: Commit**

```bash
git add render.js
git commit -m "feat(render): dessine les cadavres embrochés (gris) suivant la flèche"
```

---

## Task 10: Vérification finale

- [ ] **Step 1: Suite complète verte**

Run: `npm test`
Expected: PASS — tous les fichiers, ~140 tests + les nouveaux.

- [ ] **Step 2: Revue manuelle multi-joueurs**

Run: `npm run dev`. Tester à 3-4 joueurs : une flèche qui enchaîne deux kills accélère visiblement (×2.25), porte les deux corps, et se plante au mur ; vérifier qu'un bouclier stoppe la flèche sans embrochage ; vérifier qu'un catch en dodge récupère la flèche.
Expected: tous les cas du spec §7 se comportent comme décrit.

- [ ] **Step 3: Commit final éventuel** (si ajustements de feel)

```bash
git add -A
git commit -m "polish(arrow): ajustements feel embrochage"
```

---

## Couverture du spec (self-review)

- §2 Périmètre (normal/laser/bolt/drill embrochent, bomb/superbomb explosent) → Task 7 (branche explosive vs non-explosive via `ARROW_TYPES[a.type]?.explosive`).
- §3 Règle laser/bolt (pas de rebond/split en portant un corps) → Task 3.
- §4 Modèle de données (`carryIds`, `impaled`) → Tasks 2 et 6.
- §5 Accélération composée / embrochage / suivi / plantage → Tasks 1, 3, 4, 7.
- §6 Modules (combat, arrow, sketch, game, render, config) → Tasks 1-9.
- §7 Bouclier (pas d'impale) → Task 7 (branche `else if (killOrShield(p))`). Catch (déjà géré, flèche consommée avant la branche lethal) → comportement existant conservé, corps déjà embrochés restent `impaled`. Respawn reset → Task 6.
- §8 Tests (combat, arrow, game) → Tasks 2, 3, 4, 5.
