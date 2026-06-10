# Sprites animés pour l'archer — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le rendu rectangle du joueur par des sprites pixel-art animés (run / jump / dodge / roll), teintés par joueur, extraits des planches de `spritesheet/`.

**Architecture:** Pipeline d'assets hors-runtime (`tools/extract-sprites.mjs` → atlas propres + `frames.js`). Logique d'animation dans un module pur testable (`sprite.js`). `render.js` blitte les frames (nearest-neighbor, `tint()` par joueur, fantômes toroïdaux), avec fallback rectangle si les images ne sont pas prêtes. Un seul ajout dans la physique pure (`player.js` : booléen `rolling`).

**Tech Stack:** JavaScript ES modules, q5play.js (rendu/loadImage/tint/image), vitest (tests), `pngjs` (devDependency, outillage d'extraction uniquement).

**Référence design :** `docs/superpowers/specs/2026-06-10-sprites-animations-design.md`

**Valeurs config utiles** (`config.js`) : `PLAYER_W=8`, `PLAYER_H=12`, `vJump=-160`, `vFallMax=240`, `dodgeDuration=3`, `rollDuration=7`. Comptes de frames attendus : run 12, dodge 8, roll 10, jump 8.

---

## File Structure

- **Créé** `tools/extract-sprites.mjs` — script ponctuel d'extraction (décode, détecte bandes, découpe, normalise, écrit atlas + meta).
- **Créé** `spritesheet/atlas/{run,jump,dodge,roll}.png` — atlas propres (générés, commités).
- **Créé** `spritesheet/atlas/frames.js` — `export default` des géométries `{frameW,frameH,count}` (généré, commité ; module ES pour éviter `fetch` sous `file://`).
- **Créé** `sprite.js` — module pur : table des clips + `selectClip` / `frameIndexFor` / `spriteFor`.
- **Créé** `tests/sprite.test.js` — tests du module pur.
- **Modifié** `player.js` — ajout du booléen `rolling`.
- **Modifié** `tests/player.test.js` — tests `rolling`.
- **Modifié** `render.js` — `loadSprites()` + rendu sprite dans `drawWorld`.
- **Modifié** `sketch.js` — appel `loadSprites()` au boot, import mis à jour.
- **Modifié** `package.json` — `pngjs` en `devDependencies`.

---

## Task 1 : Outil d'extraction + atlas

**Files:**
- Create: `tools/extract-sprites.mjs`
- Modify: `package.json` (devDependencies)
- Génère: `spritesheet/atlas/{run,jump,dodge,roll}.png`, `spritesheet/atlas/frames.js`

> ⚠️ Cette tâche n'est pas du TDD : c'est du traitement d'image avec une boucle de vérification visuelle. Le « test » est la sortie console (comptes de frames == attendus) **et** l'inspection des PNG générés. Si un compte est faux, ajuster les seuils de gap/largeur et relancer.

- [ ] **Step 1: Ajouter pngjs en devDependency**

Run: `npm install --save-dev pngjs`
Expected: `pngjs` apparaît dans `package.json` › `devDependencies`, exit 0.

- [ ] **Step 2: Écrire le script d'extraction**

Create `tools/extract-sprites.mjs` :

```js
// Extraction one-shot des planches de présentation vers des atlas propres.
// Lancer : node tools/extract-sprites.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const SRC = 'spritesheet';
const OUT = 'spritesheet/atlas';
mkdirSync(OUT, { recursive: true });

const decode = (p) => PNG.sync.read(readFileSync(p));

// Masque "encre" (1 = avant-plan).
//  mode 'alpha'    : pixel encre si alpha > 32 (planches RGBA).
//  mode 'colorkey' : fond = les 2 couleurs les plus fréquentes (damier incrusté) ;
//                    encre = tout le reste (tolérance L1 = 24).
function inkMask(png, mode) {
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  if (mode === 'alpha') {
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > 32 ? 1 : 0;
    return mask;
  }
  const hist = new Map();
  for (let i = 0; i < width * height; i++) {
    const key = (data[i*4] << 16) | (data[i*4+1] << 8) | data[i*4+2];
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
  const near = (r, g, b) => top.some((t) =>
    Math.abs(r - ((t>>16)&255)) + Math.abs(g - ((t>>8)&255)) + Math.abs(b - (t&255)) <= 24);
  for (let i = 0; i < width * height; i++)
    mask[i] = near(data[i*4], data[i*4+1], data[i*4+2]) ? 0 : 1;
  return mask;
}

const rowOcc = (mask, w, h) => {
  const occ = new Int32Array(h);
  for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) c += mask[y*w+x]; occ[y] = c; }
  return occ;
};
const colOcc = (mask, w, y0, y1) => {
  const occ = new Int32Array(w);
  for (let x = 0; x < w; x++) { let c = 0; for (let y = y0; y < y1; y++) c += mask[y*w+x]; occ[x] = c; }
  return occ;
};

// Plages contiguës [start,end) où occ > thresh, fusionnées tant que le trou < minGap.
function clusters(occ, thresh, minGap) {
  const ranges = []; let start = -1, gap = 0;
  for (let i = 0; i < occ.length; i++) {
    if (occ[i] > thresh) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0) { if (++gap >= minGap) { ranges.push([start, i - gap + 1]); start = -1; gap = 0; } }
  }
  if (start >= 0) ranges.push([start, occ.length - gap]);
  return ranges;
}

// Les n bandes de frames = les n clusters de lignes les plus HAUTS (les personnages),
// ce qui écarte titres / en-têtes / étiquettes (clusters courts).
function findBands(mask, w, h, n) {
  let rows = clusters(rowOcc(mask, w, h), 2, 3);
  rows.sort((a, b) => (b[1]-b[0]) - (a[1]-a[0]));
  rows = rows.slice(0, n).sort((a, b) => a[0] - b[0]);
  return rows;
}

// bbox serré de l'encre dans [x0,x1)×[y0,y1).
function bbox(mask, w, x0, x1, y0, y1) {
  let minx = x1, maxx = x0, miny = y1, maxy = y0, found = false;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (mask[y*w+x]) {
    found = true; if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y;
  }
  return found ? { x: minx, y: miny, w: maxx-minx+1, h: maxy-miny+1 } : null;
}

// Découpe une bande en frames : un trou transparent ≥ 4px sépare 2 personnages ;
// on ignore les clusters trop fins (< 6px) qui sont du bruit / étiquettes isolées.
function extractBand(png, mask, band) {
  const [y0, y1] = band;
  return clusters(colOcc(mask, png.width, y0, y1), 0, 4)
    .filter(([a, b]) => b - a > 6)
    .map(([cx0, cx1]) => bbox(mask, png.width, cx0, cx1, y0, y1))
    .filter(Boolean);
}

// Compose un atlas horizontal : cellule commune, frame centrée X, pieds au bas (bottom).
// Ne copie QUE les pixels encre → fond réellement transparent.
function writeAtlas(name, src, mask, frames) {
  const cellW = Math.max(...frames.map((f) => f.w));
  const cellH = Math.max(...frames.map((f) => f.h));
  const out = new PNG({ width: cellW * frames.length, height: cellH });
  out.data.fill(0);
  frames.forEach((f, idx) => {
    const dx0 = idx * cellW + ((cellW - f.w) >> 1);
    const dy0 = cellH - f.h;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (!mask[(f.y+y)*src.width + (f.x+x)]) continue; // hors-encre → transparent
      const si = ((f.y+y)*src.width + (f.x+x)) * 4;
      const di = ((dy0+y)*out.width + (dx0+x)) * 4;
      out.data[di] = src.data[si]; out.data[di+1] = src.data[si+1];
      out.data[di+2] = src.data[si+2]; out.data[di+3] = 255;
    }
  });
  writeFileSync(`${OUT}/${name}.png`, PNG.sync.write(out));
  return { frameW: cellW, frameH: cellH, count: frames.length };
}

const meta = {};
const rdr = decode(`${SRC}/run_dodge_roll.png`);
const rdrMask = inkMask(rdr, 'alpha');
const [runB, dodgeB, rollB] = findBands(rdrMask, rdr.width, rdr.height, 3);
meta.run   = writeAtlas('run',   rdr, rdrMask, extractBand(rdr, rdrMask, runB));
meta.dodge = writeAtlas('dodge', rdr, rdrMask, extractBand(rdr, rdrMask, dodgeB));
meta.roll  = writeAtlas('roll',  rdr, rdrMask, extractBand(rdr, rdrMask, rollB));

const jmp = decode(`${SRC}/jump.png`);
const jmpMask = inkMask(jmp, 'colorkey');
const [jumpB] = findBands(jmpMask, jmp.width, jmp.height, 1);
meta.jump = writeAtlas('jump', jmp, jmpMask, extractBand(jmp, jmpMask, jumpB));

const EXPECT = { run: 12, dodge: 8, roll: 10, jump: 8 };
let ok = true;
for (const k of Object.keys(EXPECT)) {
  const got = meta[k].count;
  if (got !== EXPECT[k]) ok = false;
  console.log(`${k}: ${got} frames (attendu ${EXPECT[k]}) — cellule ${meta[k].frameW}x${meta[k].frameH}`);
}
writeFileSync(`${OUT}/frames.js`, 'export default ' + JSON.stringify(meta, null, 2) + ';\n');
console.log(ok ? '✅ comptes OK' : '⚠️ comptes inattendus — ajuster les seuils (gap/largeur min)');
```

- [ ] **Step 3: Lancer l'extraction**

Run: `node tools/extract-sprites.mjs`
Expected: 4 lignes de log avec les comptes, puis `✅ comptes OK`. Si `⚠️` : ajuster dans le script le `minGap` (4) et/ou le seuil de largeur (`> 6`) de `extractBand`, ou le `2`/`3` de `findBands`, puis relancer. Itérer jusqu'à obtenir 12 / 8 / 10 / 8.

- [ ] **Step 4: Vérifier visuellement les atlas**

Ouvrir `spritesheet/atlas/run.png`, `jump.png`, `dodge.png`, `roll.png`. Vérifier : fond transparent propre, un personnage entier par cellule, pas de texte résiduel, pieds alignés en bas. Si une frame est coupée/fusionnée, ajuster les seuils et relancer le Step 3.

- [ ] **Step 5: Vérifier que la suite de tests reste verte**

Run: `npm test`
Expected: tous les tests passent (cette tâche n'a touché aucun module de jeu).

- [ ] **Step 6: Commit**

```bash
git add tools/extract-sprites.mjs package.json package-lock.json spritesheet/atlas
git commit -m "feat(sprites): outil d'extraction + atlas run/jump/dodge/roll"
```

---

## Task 2 : Module pur `sprite.js`

**Files:**
- Create: `sprite.js`
- Test: `tests/sprite.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `tests/sprite.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { selectClip, frameIndexFor, spriteFor, CLIPS, IDLE_FRAME } from '../sprite.js';

const cfg = { vJump: -160, vFallMax: 240, dodgeDuration: 3, rollDuration: 7 };
const base = { state: 'GROUNDED', vx: 0, vy: 0, facing: 1, rolling: false, dodgeTime: 0 };

describe('selectClip', () => {
  it('run quand au sol et en mouvement', () => {
    expect(selectClip({ ...base, state: 'GROUNDED', vx: 50 })).toBe('run');
  });
  it('idle quand au sol et immobile', () => {
    expect(selectClip({ ...base, state: 'GROUNDED', vx: 0 })).toBe('idle');
  });
  it('jump quand airborne ou wallslide', () => {
    expect(selectClip({ ...base, state: 'AIRBORNE' })).toBe('jump');
    expect(selectClip({ ...base, state: 'WALLSLIDE' })).toBe('jump');
  });
  it('roll vs dodge selon rolling', () => {
    expect(selectClip({ ...base, state: 'DODGING', rolling: true })).toBe('roll');
    expect(selectClip({ ...base, state: 'DODGING', rolling: false })).toBe('dodge');
  });
});

describe('frameIndexFor', () => {
  it('idle renvoie la frame calme fixe', () => {
    expect(frameIndexFor('idle', base, 0, cfg)).toBe(IDLE_FRAME);
  });
  it('run boucle avec l\'horloge', () => {
    const cycle = CLIPS.run.count / CLIPS.run.fps; // durée d'un cycle en s
    expect(frameIndexFor('run', base, 0, cfg)).toBe(0);
    expect(frameIndexFor('run', base, cycle, cfg)).toBe(0); // a rebouclé
    expect(frameIndexFor('run', base, 1 / CLIPS.run.fps, cfg)).toBe(1);
  });
  it('jump mappe vy : montée→0, chute→dernière', () => {
    expect(frameIndexFor('jump', { ...base, vy: cfg.vJump }, 0, cfg)).toBe(0);
    expect(frameIndexFor('jump', { ...base, vy: cfg.vFallMax }, 0, cfg)).toBe(CLIPS.jump.count - 1);
  });
  it('dodge mappe la progression sur dodgeTime', () => {
    // dodgeTime == durée → progression 0 → frame 0
    expect(frameIndexFor('dodge', { ...base, dodgeTime: 3 }, 0, cfg)).toBe(0);
    // dodgeTime == 1, durée 3 → floor((1-1/3)*8) = 5
    expect(frameIndexFor('dodge', { ...base, dodgeTime: 1 }, 0, cfg)).toBe(5);
  });
  it('roll mappe la progression sur rollDuration', () => {
    expect(frameIndexFor('roll', { ...base, dodgeTime: 7 }, 0, cfg)).toBe(0);
    expect(frameIndexFor('roll', { ...base, dodgeTime: 1 }, 0, cfg))
      .toBe(Math.floor((1 - 1 / 7) * CLIPS.roll.count));
  });
});

describe('spriteFor', () => {
  it('flipX selon facing, idle dessiné depuis l\'atlas run', () => {
    const s = spriteFor({ ...base, state: 'GROUNDED', vx: 0, facing: -1 }, 0, cfg);
    expect(s.flipX).toBe(true);
    expect(s.atlas).toBe('run');
    expect(s.clip).toBe('idle');
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/sprite.test.js`
Expected: FAIL — `Cannot find module '../sprite.js'`.

- [ ] **Step 3: Implémenter le module**

Create `sprite.js` :

```js
// Logique d'animation — module pur (aucune dépendance q5/DOM, testable).
// Mappe l'état joueur (FSM + vitesses + timers) vers (clip, frame, flip).

// Comportement par clip. count = nb de frames (doit matcher spritesheet/atlas/frames.js).
// run/jump : horloge libre (boucle) à `fps`. dodge/roll : pilotés par le timer (pas de fps).
export const CLIPS = {
  run:   { count: 12, fps: 14, loop: true },
  jump:  { count: 8,  fps: 12, loop: true },
  dodge: { count: 8 },
  roll:  { count: 10 },
};

export const MOVE_EPS = 5;   // |vx| (px/s) seuil idle <-> run
export const IDLE_FRAME = 0; // frame calme, prise dans l'atlas run

const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function selectClip(p) {
  if (p.state === 'DODGING') return p.rolling ? 'roll' : 'dodge';
  if (p.state === 'GROUNDED') return Math.abs(p.vx) > MOVE_EPS ? 'run' : 'idle';
  return 'jump'; // AIRBORNE / WALLSLIDE (DEAD est ignoré au rendu)
}

// vy : vJump (montée pleine) -> 0 .. count-1 -> vFallMax (chute pleine).
function jumpFrame(vy, cfg) {
  const n = CLIPS.jump.count;
  const t = (vy - cfg.vJump) / (cfg.vFallMax - cfg.vJump);
  return clampInt(Math.floor(t * n), 0, n - 1);
}

// Le clip entier se joue pile sur la durée de l'action : progression = 1 - timer/durée.
function timerFrame(dodgeTime, count, duration) {
  const prog = duration > 0 ? 1 - dodgeTime / duration : 0;
  return clampInt(Math.floor(prog * count), 0, count - 1);
}

export function frameIndexFor(clip, p, clock, cfg) {
  if (clip === 'idle') return IDLE_FRAME;
  if (clip === 'run')  return Math.floor(clock * CLIPS.run.fps) % CLIPS.run.count;
  if (clip === 'jump') return jumpFrame(p.vy, cfg);
  if (clip === 'dodge') return timerFrame(p.dodgeTime, CLIPS.dodge.count, cfg.dodgeDuration);
  if (clip === 'roll')  return timerFrame(p.dodgeTime, CLIPS.roll.count, cfg.rollDuration);
  return 0;
}

// Descripteur prêt à blitter. `atlas` = quelle image source (idle puise dans run).
export function spriteFor(p, clock, cfg) {
  const clip = selectClip(p);
  return {
    clip,
    atlas: clip === 'idle' ? 'run' : clip,
    frameIndex: frameIndexFor(clip, p, clock, cfg),
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
git commit -m "feat(sprites): module pur d'animation (selectClip/frameIndexFor)"
```

---

## Task 3 : Booléen `rolling` dans `player.js`

**Files:**
- Modify: `player.js` (createPlayer + updatePlayer, bloc dodge ~L38-55)
- Test: `tests/player.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `tests/player.test.js` (nouveau bloc `describe`, en réutilisant `cfg`/`grid`/`DT` du fichier) :

```js
describe('rolling flag (roll vs dodge)', () => {
  const fullIntent = (o) => ({ moveX: 0, up: false, down: false, jumpHeld: false, jumpPressed: false, dodgePressed: false, shootPressed: false, ...o });

  it('createPlayer initialise rolling à false', () => {
    expect(createPlayer(10, 0, cfg()).rolling).toBe(false);
  });
  it('un dodge vers le bas met rolling à true (roulade)', () => {
    const p = createPlayer(10, 0, cfg());
    updatePlayer(p, fullIntent({ dodgePressed: true, down: true }), cfg(), grid, DT);
    expect(p.state).toBe('DODGING');
    expect(p.rolling).toBe(true);
  });
  it('un dodge horizontal laisse rolling à false', () => {
    const p = createPlayer(10, 0, cfg());
    updatePlayer(p, fullIntent({ dodgePressed: true, moveX: 1 }), cfg(), grid, DT);
    expect(p.state).toBe('DODGING');
    expect(p.rolling).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/player.test.js -t "rolling flag"`
Expected: FAIL — `createPlayer(...).rolling` vaut `undefined` (≠ false) et `p.rolling` n'est pas posé.

- [ ] **Step 3: Implémenter**

Dans `player.js`, `createPlayer` — ajouter le champ à côté de `dodgeTime` (L25) :

```js
    dodgeTime: 0, invulnTime: 0, dodgeCooldownTimer: 0,
    rolling: false,
```

Dans `updatePlayer`, bloc de démarrage du dodge (L42-54), poser `rolling` dans chaque branche :

```js
    if (dir.y > 0) {
      // downward input (down or down-diagonal) is a roll: a longer, full-speed
      // horizontal dash that hugs the ground — not a downward dive.
      const rollDir = intent.moveX !== 0 ? intent.moveX : p.facing;
      p.dodgeTime = cfg.rollDuration;
      p.vx = rollDir * cfg.dodgeSpeed;
      p.vy = 0;
      p.facing = rollDir;
      p.rolling = true;
    } else {
      p.dodgeTime = cfg.dodgeDuration;
      p.vx = dir.x * cfg.dodgeSpeed;
      p.vy = dir.y * cfg.dodgeSpeed;
      p.rolling = false;
    }
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/player.test.js`
Expected: PASS (nouveaux tests + tous les tests joueur existants).

- [ ] **Step 5: Commit**

```bash
git add player.js tests/player.test.js
git commit -m "feat(sprites): flag rolling pour distinguer roll et dodge"
```

---

## Task 4 : Rendu des sprites dans `render.js` + câblage `sketch.js`

**Files:**
- Modify: `render.js` (imports en tête, `drawWorld` bloc joueurs L49-70, ajout `loadSprites`)
- Modify: `sketch.js` (import L5, appel `loadSprites()` après `noSmooth()` ~L26)

> Pas de test unitaire (frontière q5). Vérification : tests existants verts + lancement réel (Task 5).

- [ ] **Step 1: Ajouter les imports et le chargement dans `render.js`**

En tête de `render.js`, après les imports existants (après L3) :

```js
import { spriteFor } from './sprite.js';
import FRAMES from './spritesheet/atlas/frames.js';

let IMAGES = null;
const animClocks = new Map(); // player.index -> secondes écoulées

// Appelé une fois au boot (sketch.js), après la création du Canvas.
export function loadSprites() {
  IMAGES = {
    run:   loadImage('spritesheet/atlas/run.png'),
    jump:  loadImage('spritesheet/atlas/jump.png'),
    dodge: loadImage('spritesheet/atlas/dodge.png'),
    roll:  loadImage('spritesheet/atlas/roll.png'),
  };
}

const spritesReady = () =>
  IMAGES && ['run', 'jump', 'dodge', 'roll'].every((k) => IMAGES[k] && IMAGES[k].width > 0);

// Dessine le sprite animé du joueur (dans le repère déjà translaté+scalé de drawWorld).
function drawPlayerSprite(p) {
  let clk = (animClocks.get(p.index) || 0) + deltaTime / 1000; // deltaTime: global q5 (ms)
  animClocks.set(p.index, clk);
  const s = spriteFor(p, clk, p.cfg || DEFAULT_CFG);
  const img = IMAGES[s.atlas];
  const { frameW, frameH } = FRAMES[s.atlas];
  const sx = s.frameIndex * frameW;
  const destH = 18;                         // ~1.5 tuile (cf. design)
  const destW = frameW * (destH / frameH);  // conserve le ratio
  const cx = p.x + p.w / 2;                 // centre X de la hitbox
  const footY = p.y + p.h;                  // bas de la hitbox = pieds
  tint(PLAYER_COLORS[p.index % PLAYER_COLORS.length]);
  for (const dx of [-W, 0, W]) {
    for (const dy of [-H, 0, H]) {
      push();
      translate(cx + dx, footY + dy);
      if (s.flipX) scale(-1, 1);
      image(img, -destW / 2, -destH, destW, destH, sx, 0, frameW, frameH);
      pop();
    }
  }
  noTint();
}
```

> Note : `spriteFor` a besoin de `cfg` (pour `jumpFrame`/`timerFrame`). Les joueurs ne portent pas `cfg`. Utiliser une constante locale des valeurs nécessaires — ajouter en tête de `render.js`, sous les imports :
>
> ```js
> import { DEFAULT_CONFIG } from './config.js';
> const DEFAULT_CFG = DEFAULT_CONFIG; // jumpFrame/timerFrame lisent vJump/vFallMax/dodgeDuration/rollDuration
> ```
>
> (Le rendu n'a pas accès au `cfg` runtime calibré ; les paramètres lus ici — `vJump`, `vFallMax`, `dodgeDuration`, `rollDuration` — ne sont pas exposés au panneau debug, donc `DEFAULT_CONFIG` suffit. `p.cfg || DEFAULT_CFG` permet une surcharge future sans casser.)

- [ ] **Step 2: Remplacer le dessin rectangle du joueur dans `drawWorld`**

Dans `render.js` › `drawWorld`, le bloc actuel (L50-57) :

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

devient (sprite si prêt, sinon fallback rectangle) :

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

> Laisser intacts le bloc `shield` (L58-62) et le bloc `aimDir` (L63-69) qui suivent — ils s'appliquent par-dessus le sprite.

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
Expected: ~140 tests PASS (render/sketch non testés mais aucun module pur cassé).

- [ ] **Step 5: Commit**

```bash
git add render.js sketch.js
git commit -m "feat(sprites): rendu des sprites animés teintés par joueur"
```

---

## Task 5 : Vérification visuelle & réglages

**Files:** réglages éventuels dans `sprite.js` (constantes) — pas de nouveau fichier.

> Tâche manuelle de polissage. Lancer le jeu et observer.

- [ ] **Step 1: Lancer le jeu**

Run: `npm run dev` puis ouvrir l'URL locale (WebGPU requis). Démarrer une partie 2 joueurs.

- [ ] **Step 2: Checklist d'observation**

Vérifier :
- Course : l'animation run boucle proprement en se déplaçant au sol.
- Immobile : pose idle stable (pas de défilement). Si la frame `IDLE_FRAME` (0) n'est pas la plus « calme », tester une autre valeur dans `sprite.js`.
- Saut : frames de montée en sautant, frames de chute en retombant (mapping `vy`). Ajuster `jumpFrame` si l'ordre des frames source ne correspond pas (ex. inverser `t` en `1 - t`).
- Dodge / roll : le clip se joue entièrement et pile sur la durée de l'action.
- Orientation : le sprite regarde bien dans le sens de `facing` (flip correct). Si inversé, ajuster `flipX` en `p.facing > 0`.
- Teinte : P1..P4 distinguables. Si une couleur rend terne, c'est le point de décision « atlas recolorés » du design (voir ci-dessous).

- [ ] **Step 3 (conditionnel) : recolor par joueur si le tint() est terne**

Si `tint()` multiplicatif rend les sprites trop sombres/ternes pour P2/P3/P4 : étendre `tools/extract-sprites.mjs` pour générer un atlas par joueur via rotation de teinte (HSL) du sprite vert d'origine, et faire pointer `IMAGES` sur la variante du joueur dans `drawPlayerSprite`. (Hors périmètre si `tint()` est jugé suffisant.)

- [ ] **Step 4: Commit des réglages (si modifs)**

```bash
git add sprite.js
git commit -m "polish(sprites): réglages idle/jump/flip après vérif visuelle"
```

---

## Self-Review (couverture du spec)

- **Extraction → atlas propres + frames.js** : Task 1. ✅
- **`tint()` par joueur, fallback recolor** : Task 4 (tint) + Task 5 Step 3 (fallback recolor). ✅
- **Taille ~18 px, centré X, pieds au sol** : Task 4 Step 1 (`destH=18`, `-destW/2`, `-destH` depuis `footY`). ✅
- **Module pur `sprite.js` + mapping FSM (run/idle/jump/dodge/roll), jump par vy, dodge/roll par timer, flipX** : Task 2. ✅
- **`player.js` rolling + test** : Task 3. ✅
- **render.js loadSprites + animateurs + fantômes toroïdaux + shield/visée conservés + fallback rectangle** : Task 4. ✅
- **Tests sprite.test.js / player.test.js** : Tasks 2 et 3. ✅
- **Points ouverts (idle, mapping jump, tint)** : Task 5. ✅

Pas de placeholder. Types/noms cohérents entre tâches (`selectClip`, `frameIndexFor`, `spriteFor`, `CLIPS`, `IDLE_FRAME`, `loadSprites`, `spritesReady`, `FRAMES[atlas].frameW/frameH`). Géométrie (`frameW`/`frameH`/`count`) cohérente entre `frames.js` (Task 1) et ses consommateurs (Tasks 2/4).
