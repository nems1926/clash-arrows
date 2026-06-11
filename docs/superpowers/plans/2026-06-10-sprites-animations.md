# Sprites animés pour le joueur (course) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le rendu rectangle du joueur par un sprite archer **animé en course** issu de `spritesheet/run32.webp`, sans changer la hitbox (8×12) ni la taille à l'écran.

**Architecture:** Logique d'animation dans un module pur testable (`sprite.js` : état joueur → `{clip, frameIndex, flipX}`). `render.js` charge la planche (`loadImage`) et blitte le bon sous-rectangle 32×32 à ~12 px de haut, centré sur la hitbox, pieds en bas, avec fallback rectangle tant que l'image n'est pas chargée. `player.js` n'est pas touché.

**Tech Stack:** JavaScript ES modules, q5play.js (`loadImage`/`image`/`push`/`scale`), vitest (tests du module pur).

**Référence design :** `docs/superpowers/specs/2026-06-10-sprites-animations-design.md`

**Faits utiles :**
- Asset : `spritesheet/run32.webp` — 256×32, **8 frames de 32×32**, fond **transparent** (alpha vérifié). Grille régulière, aucune extraction nécessaire.
- `config.js` : `PLAYER_W=8`, `PLAYER_H=12`, `W=320`, `H=180`, `SCALE=4`.
- `player.js` : `p.facing` vaut toujours ±1 (init 1, mis à jour seulement si `moveX≠0`). États FSM : `GROUNDED` / `AIRBORNE` / `WALLSLIDE` / `DODGING` / `DEAD`.
- `render.js` : `drawWorld(grid, players)` dessine déjà le repère `translate(-W*SCALE/2,-H*SCALE/2); scale(SCALE)`, les fantômes toroïdaux 3×3, le contour `shield` et la ligne `aimDir`. `PLAYER_COLORS` y est exporté.
- ⚠️ Des fichiers `sprite.js` et `tests/sprite.test.js` d'une tentative précédente existent (non commités). La Task 1 les **écrase** avec le contenu ci-dessous.

---

## File Structure

- **Créé/écrasé** `sprite.js` — module pur : `CLIPS`, `MOVE_EPS`, `IDLE_FRAME`, `selectClip`, `frameIndexFor`, `spriteFor`.
- **Créé/écrasé** `tests/sprite.test.js` — tests du module pur.
- **Modifié** `render.js` — `loadSprites()` + `drawPlayerSprite()` + branchement dans `drawWorld`.
- **Modifié** `sketch.js` — import `loadSprites` + appel au boot.

---

## Task 1 : Module pur `sprite.js`

**Files:**
- Create (overwrite): `sprite.js`
- Test (overwrite): `tests/sprite.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Écrire (écraser) `tests/sprite.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { selectClip, frameIndexFor, spriteFor, CLIPS, IDLE_FRAME, MOVE_EPS } from '../sprite.js';

const base = { state: 'GROUNDED', vx: 0, facing: 1 };

describe('selectClip', () => {
  it('run quand au sol et en mouvement horizontal', () => {
    expect(selectClip({ ...base, state: 'GROUNDED', vx: 50 })).toBe('run');
    expect(selectClip({ ...base, state: 'GROUNDED', vx: -50 })).toBe('run');
  });
  it('idle quand au sol et (quasi) immobile', () => {
    expect(selectClip({ ...base, state: 'GROUNDED', vx: 0 })).toBe('idle');
    expect(selectClip({ ...base, state: 'GROUNDED', vx: MOVE_EPS - 1 })).toBe('idle');
  });
  it('idle hors du sol (pas de clip dédié pour jump/dodge)', () => {
    expect(selectClip({ ...base, state: 'AIRBORNE', vx: 80 })).toBe('idle');
    expect(selectClip({ ...base, state: 'WALLSLIDE', vx: 80 })).toBe('idle');
    expect(selectClip({ ...base, state: 'DODGING', vx: 80 })).toBe('idle');
  });
});

describe('frameIndexFor', () => {
  it('idle renvoie la frame de repos fixe', () => {
    expect(frameIndexFor('idle', 0)).toBe(IDLE_FRAME);
    expect(frameIndexFor('idle', 12.3)).toBe(IDLE_FRAME);
  });
  it('run avance avec l\'horloge et boucle', () => {
    expect(frameIndexFor('run', 0)).toBe(0);
    expect(frameIndexFor('run', 1 / CLIPS.run.fps)).toBe(1);
    const cycle = CLIPS.run.count / CLIPS.run.fps; // un cycle complet en secondes
    expect(frameIndexFor('run', cycle)).toBe(0);   // a rebouclé
  });
});

describe('spriteFor', () => {
  it('expose clip + frame + flipX selon facing, atlas run', () => {
    const right = spriteFor({ ...base, state: 'GROUNDED', vx: 50, facing: 1 }, 0);
    expect(right.clip).toBe('run');
    expect(right.atlas).toBe('run');
    expect(right.frameIndex).toBe(0);
    expect(right.flipX).toBe(false);

    const left = spriteFor({ ...base, state: 'GROUNDED', vx: 50, facing: -1 }, 0);
    expect(left.flipX).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/sprite.test.js`
Expected: FAIL — `Cannot find module '../sprite.js'` ou exports manquants.

- [ ] **Step 3: Implémenter le module**

Écrire (écraser) `sprite.js` :

```js
// Logique d'animation — module pur (aucune dépendance q5/DOM, testable).
// Mappe l'état joueur (FSM + vitesse) vers (clip, frame, flip).
// Portée actuelle : course horizontale uniquement (run32.webp, 8 frames).
// Les états aériens / dodge retombent sur la frame de repos en attendant
// leurs propres clips.

// Comportement par clip. count = nb de frames (doit matcher le spritesheet).
// run : horloge libre à `fps`, en boucle.
export const CLIPS = {
  run: { count: 8, fps: 12, loop: true },
};

export const MOVE_EPS = 5;   // |vx| (px/s) seuil idle <-> run
export const IDLE_FRAME = 0; // frame de repos (puise dans l'atlas run)

export function selectClip(p) {
  if (p.state === 'GROUNDED') return Math.abs(p.vx) > MOVE_EPS ? 'run' : 'idle';
  return 'idle'; // AIRBORNE / WALLSLIDE / DODGING : pas encore de clip dédié
}

export function frameIndexFor(clip, clock) {
  if (clip === 'run') return Math.floor(clock * CLIPS.run.fps) % CLIPS.run.count;
  return IDLE_FRAME; // idle (et tout clip inconnu)
}

// Descripteur prêt à blitter. `atlas` = quelle image source (idle puise dans run).
export function spriteFor(p, clock) {
  const clip = selectClip(p);
  return {
    clip,
    atlas: 'run',
    frameIndex: frameIndexFor(clip, clock),
    flipX: p.facing < 0,
  };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/sprite.test.js`
Expected: PASS (tous les cas verts).

- [ ] **Step 5: Commit**

```bash
git add sprite.js tests/sprite.test.js
git commit -m "feat(sprites): module pur d'animation course (selectClip/frameIndexFor)"
```

---

## Task 2 : Rendu du sprite dans `render.js` + câblage `sketch.js`

**Files:**
- Modify: `render.js` (imports en tête après L3 ; bloc joueurs de `drawWorld` L50-57 ; ajout `loadSprites`/`drawPlayerSprite`)
- Modify: `sketch.js` (import L5 ; appel après `noSmooth()` L25)

> Pas de test unitaire (frontière q5 : `loadImage`/`image` n'existent pas sous Node). Vérification : `npm test` reste vert + lancement réel (Task 3).

- [ ] **Step 1: Ajouter les imports et le chargement dans `render.js`**

En tête de `render.js`, juste après la ligne `import { ARROW_TYPES } from './arrow.js';` (L3), ajouter :

```js
import { spriteFor, CLIPS } from './sprite.js';

const SHEET = 'spritesheet/run32.webp';
const FRAME = 32; // cellule source carrée 32x32 (8 frames)
let RUN_IMG = null;
const animClocks = new Map(); // player.index -> secondes écoulées

// Appelé une fois au boot (sketch.js), après la création du Canvas.
export function loadSprites() {
  RUN_IMG = loadImage(SHEET);
}

const spritesReady = () => RUN_IMG && RUN_IMG.width > 0;

// Dessine le sprite animé du joueur dans le repère déjà translaté+scalé de drawWorld.
// Cellule carrée 32x32 mise à ~12 px de haut : l'archer rend ~8 large x 12 haut,
// centré X sur la hitbox, pieds alignés sur le bas de la hitbox.
function drawPlayerSprite(p) {
  const clk = (animClocks.get(p.index) || 0) + deltaTime / 1000; // deltaTime: global q5 (ms)
  animClocks.set(p.index, clk);
  const s = spriteFor(p, clk);
  const sx = s.frameIndex * FRAME;
  const destH = 12;            // ~ hauteur hitbox (cf. design)
  const destW = destH;         // cellule carrée -> conserve le ratio de la planche
  const cx = p.x + p.w / 2;    // centre X de la hitbox
  const footY = p.y + p.h;     // bas de la hitbox = pieds
  for (const dx of [-W, 0, W]) {
    for (const dy of [-H, 0, H]) {
      push();
      translate(cx + dx, footY + dy);
      if (s.flipX) scale(-1, 1);
      image(RUN_IMG, -destW / 2, -destH, destW, destH, sx, 0, FRAME, FRAME);
      pop();
    }
  }
}
```

> Note : `CLIPS` est importé pour rester cohérent avec le module (non strictement requis ici) ; si le linter se plaint d'un import inutilisé, retirer `, CLIPS`.

- [ ] **Step 2: Brancher le sprite dans `drawWorld` (avec fallback)**

Dans `render.js` › `drawWorld`, remplacer le bloc actuel (L50-57) :

```js
  for (const player of players) {
    if (player.state === 'DEAD') continue;
    fill(PLAYER_COLORS[player.index % PLAYER_COLORS.length]);
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        rect(player.x + dx, player.y + dy, player.w, player.h);
      }
    }
```

par (sprite si prêt, sinon fallback rectangle) :

```js
  for (const player of players) {
    if (player.state === 'DEAD') continue;
    if (spritesReady()) {
      drawPlayerSprite(player);
    } else {
      fill(PLAYER_COLORS[player.index % PLAYER_COLORS.length]);
      for (const dx of [-W, 0, W]) {
        for (const dy of [-H, 0, H]) {
          rect(player.x + dx, player.y + dy, player.w, player.h);
        }
      }
    }
```

> Laisser intacts juste après : le bloc `if (player.shield) { ... }` et le bloc `if (player.aimDir) { ... }` — ils se dessinent par-dessus le sprite. Le `}` de fermeture de la boucle `for (const player ...)` reste tel quel.

- [ ] **Step 3: Câbler `loadSprites()` dans `sketch.js`**

Dans `sketch.js`, mettre à jour l'import (L5) :

```js
import { drawWorld, drawArrows, drawExplosions, drawPickup, loadSprites } from './render.js';
```

Et appeler `loadSprites()` juste après `noSmooth();` (L25), avant `displayMode(...)` :

```js
  noSmooth();
  loadSprites();
  displayMode(MAXED, PIXELATED); // remplit le parent, letterbox, pixels nets
```

- [ ] **Step 4: Vérifier que les tests restent verts**

Run: `npm test`
Expected: ~140 tests PASS (aucun module pur cassé ; render/sketch non testés).

- [ ] **Step 5: Commit**

```bash
git add render.js sketch.js
git commit -m "feat(sprites): rendu du sprite archer animé en course"
```

---

## Task 3 : Vérification visuelle & réglages

**Files:** réglages éventuels dans `sprite.js` (constantes) ou `render.js` (`destH`) — pas de nouveau fichier.

> Tâche manuelle de polissage. Lancer le jeu et observer.

- [ ] **Step 1: Lancer le jeu**

Run: `npm run dev` puis ouvrir l'URL locale (WebGPU requis). Démarrer une partie 2 joueurs.

- [ ] **Step 2: Checklist d'observation**

Vérifier :
- **Transparence** : pas de carré blanc/opaque autour de l'archer (le WebP est alpha).
- **Course** : l'animation boucle proprement en se déplaçant au sol.
- **Immobile** : pose `idle` stable (pas de défilement). Si `IDLE_FRAME` (0) n'est pas la plus « calme », tester une autre valeur (0-7) dans `sprite.js`.
- **Orientation** : le sprite regarde dans le sens du déplacement. Si inversé, passer `flipX` à `p.facing > 0` dans `spriteFor` (`sprite.js`).
- **Taille / ancrage** : l'archer fait ~la taille de l'ancienne boîte, pieds posés au sol (pas flottant ni enfoncé). Ajuster `destH` (`render.js`) si besoin.
- **Vitesse** : si l'animation paraît trop rapide/lente, ajuster `CLIPS.run.fps` dans `sprite.js`.
- **Wrap toroïdal** : un joueur qui traverse le bord réapparaît avec son sprite de l'autre côté.

- [ ] **Step 3: Commit des réglages (si modifs)**

```bash
git add sprite.js render.js
git commit -m "polish(sprites): réglages idle/flip/taille/fps après vérif visuelle"
```

---

## Self-Review (couverture du spec)

- **Asset `run32.webp` blitté directement (pas d'extraction)** : Task 2 (`loadImage(SHEET)`, sous-rect `sx = frameIndex*32`). ✅
- **Module pur `sprite.js` : run vs idle, airborne/wallslide/dodging→idle, run en boucle, flipX selon facing** : Task 1. ✅
- **Taille ~12 px, centré X, pieds au sol** : Task 2 Step 1 (`destH=12`, `-destW/2`, `-destH` depuis `footY`). ✅
- **Fantômes toroïdaux 3×3 conservés** : Task 2 Step 1 (boucle `dx`/`dy`). ✅
- **Shield + ligne de visée conservés** : Task 2 Step 2 (blocs laissés intacts). ✅
- **Fallback rectangle tant que l'image n'est pas chargée** : Task 2 Step 2 (`spritesReady()`). ✅
- **`player.js` inchangé** : aucune tâche ne le touche. ✅
- **Pas de distinction par joueur (pas de tint)** : `drawPlayerSprite` ne teinte pas. ✅
- **`sketch.js` appelle `loadSprites()` au boot** : Task 2 Step 3. ✅
- **Tests verts** : Task 1 (nouveaux) + Task 2 Step 4 (`npm test`). ✅

Pas de placeholder. Noms cohérents entre tâches : `selectClip`, `frameIndexFor`, `spriteFor`, `CLIPS`, `IDLE_FRAME`, `MOVE_EPS` (Task 1) ; `loadSprites`, `spritesReady`, `drawPlayerSprite`, `RUN_IMG`, `FRAME` (Task 2). Signature `spriteFor(p, clock)` et `frameIndexFor(clip, clock)` identiques entre module, tests et appelant.
