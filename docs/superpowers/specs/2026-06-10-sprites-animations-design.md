# Sprites animés pour le joueur (course) — design

Date : 2026-06-10
Statut : validé (brainstorm), prêt pour plan d'implémentation.

## Objectif

Remplacer le rendu du joueur en rectangle plein par un sprite pixel-art **animé en
course**, à partir de la planche fournie `spritesheet/run32.webp`. Périmètre volontairement
étroit : uniquement la course (run) et une pose statique pour tout le reste. La taille de
jeu du joueur (hitbox) ne change pas.

## Asset source

- `spritesheet/run32.webp` — **256×32, 8 frames de 32×32**, **fond transparent**
  (WebP VP8X avec canal alpha vérifié). Grille régulière : aucune extraction / aucun
  color-key nécessaire ; `loadImage` peut blitter directement les sous-rectangles.
- Le personnage occupe toute la hauteur de la cellule (y 0→31, pieds en bas) et ~22 px de
  large, à peu près centré horizontalement dans les 32 px.

## Décisions de design (issues du brainstorm)

- **Distinction des joueurs** : **aucune pour l'instant**. Les 4 joueurs dessinent le même
  archer, sans teinte ni marqueur de couleur. (La distinction visuelle par personnage est
  remise à plus tard, hors périmètre.)
- **Taille d'affichage** : **~12 px logiques de haut**, soit la taille à l'écran de la boîte
  actuelle. La hitbox reste **8×12** ; le sprite est dessiné dans une cellule carrée 32×32
  mise à l'échelle (l'archer rend donc ~8 de large × ~12 de haut), **centré horizontalement
  sur la hitbox**, **pieds alignés sur le bas de la hitbox**.
- **États couverts** : **run** (course au sol) et **idle** (une frame figée). Les états
  AIRBORNE / WALLSLIDE / DODGING retombent sur la frame idle faute d'art dédié. DEAD n'est
  pas dessiné (déjà ignoré au rendu).
- **Vitesse d'animation** : fps fixe (~12), réglable après vérif visuelle. Pas d'asservissement
  à la vitesse de déplacement.

## Architecture

Respecte la frontière du projet (CLAUDE.md) : logique d'animation **pure et testable** d'un
côté, **seul `render.js` / `sketch.js`** touchent q5play.

### 1. Module pur `sprite.js` (+ `tests/sprite.test.js`)

Aucune dépendance q5/DOM — testable sous vitest. Mappe l'état joueur (FSM + `vx` + `facing`)
vers un descripteur de blit.

- **`CLIPS = { run: { count: 8, fps: 12, loop: true } }`** — `count` doit matcher la planche.
- **`MOVE_EPS`** (~5 px/s) : seuil idle ↔ run sur `|vx|`. **`IDLE_FRAME`** (0) : frame de
  repos, puisée dans l'atlas run (réglable à la vérif visuelle).
- **`selectClip(p)`** :
  - `GROUNDED` + `|vx| > MOVE_EPS` → `'run'` ;
  - `GROUNDED` quasi immobile → `'idle'` ;
  - `AIRBORNE` / `WALLSLIDE` / `DODGING` → `'idle'` (pas encore de clip dédié).
- **`frameIndexFor(clip, clock)`** :
  - `run` : horloge libre → `floor(clock · fps) % count`, en boucle ;
  - `idle` (et tout clip inconnu) → `IDLE_FRAME`.
- **`spriteFor(p, clock)`** → **`{ clip, atlas: 'run', frameIndex, flipX: p.facing < 0 }`**.
  `facing` est toujours ±1 (initialisé à 1, mis à jour seulement si `moveX ≠ 0`), donc le
  flip est sûr.

### 2. `render.js` — branchement q5

- **`loadSprites()`** appelé au boot depuis `sketch.js` : `loadImage('spritesheet/run32.webp')`.
  La géométrie des frames est constante (cellule 32×32, 8 frames) — pas de fichier de
  métadonnées nécessaire (planche uniforme).
- **Horloges d'animation** côté render : `Map` clé = `player.index`, avancée chaque frame de
  `deltaTime / 1000` (deltaTime : global q5, ms).
- **`drawPlayerSprite(p)`** (dans le repère déjà translaté+scalé de `drawWorld`) :
  - `{ frameIndex, flipX } = spriteFor(p, clock)` ; `sx = frameIndex · 32` ;
  - **`destH ≈ 12`**, **`destW ≈ 12`** (cellule carrée → conserve le ratio de la planche) ;
  - `cx = p.x + p.w / 2` (centre X de la hitbox), `footY = p.y + p.h` (pieds = bas de la
    hitbox) ; dessin à `(cx − destW/2, footY − destH)` ;
  - **flip horizontal** via `scale(-1, 1)` quand `flipX` ;
  - **nearest-neighbor** (déjà actif globalement) ;
  - conserve les **fantômes toroïdaux 3×3** (boucle `dx ∈ {−W,0,W}`, `dy ∈ {−H,0,H}`).
- Les blocs **shield (contour)** et **aimDir (ligne de visée)** existants restent inchangés,
  dessinés **par-dessus** le sprite.
- **Fallback** : si l'image n'est pas encore chargée (`width === 0`), retomber sur le rendu
  rectangle coloré actuel → jamais de joueur vide.

### 3. `sketch.js`

- Mettre à jour l'import de `render.js` pour inclure `loadSprites`.
- Appeler **`loadSprites()` au boot**, après la création du Canvas (à côté de `noSmooth()`).

### 4. `player.js`

- **Aucune modification.** Pas de `rolling`/dodge dans le périmètre. Hitbox et constantes de
  feel inchangées.

## Tests

- `tests/sprite.test.js` : mapping état → clip (run vs idle ; airborne/wallslide/dodging →
  idle) ; avance + bouclage des frames run ; idle = frame fixe ; `flipX` selon `facing`.
- Le rendu lui-même n'est pas testé unitairement (frontière q5) — vérification à l'œil au
  lancement.
- `npm test` doit rester vert (~140 tests existants non touchés).

## Points laissés ouverts pour la vérification visuelle (non bloquants)

- La **frame d'idle** exacte (`IDLE_FRAME`, défaut 0) si une autre pose est plus calme.
- Le **fps** de la course si l'animation paraît trop rapide/lente.
- Le sens du **flip** (`p.facing < 0`) si le sprite source regarde déjà à gauche par défaut.

## Hors périmètre

- Animations de saut / dodge / roll / mort / tir.
- Distinction visuelle des joueurs (teinte ou personnages distincts) — remis à plus tard.
- Sprites pour flèches, pickups, décor (restent en primitives).
- Particules / audio (jalon 5 du PRD).
