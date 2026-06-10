# Sprites animés pour l'archer — design

Date : 2026-06-10
Statut : validé (brainstorm), prêt pour plan d'implémentation.

## Objectif

Remplacer le rendu du joueur en rectangle plein par des sprites animés pixel-art,
pour les états **course (run)**, **saut (jump)**, **dodge** et **roulade (roll)**.
Les planches source sont fournies dans `spritesheet/` :

- `spritesheet/run_dodge_roll.png` (2816×1536, RGBA) — 3 sections empilées :
  section 1 = run (12 frames), section 2 = dodge (8 frames), section 3 = roll (10 frames).
- `spritesheet/jump.png` (2815×479, RGB) — 1 animation de saut (8 frames).

## Contrainte clé : planches de présentation, pas d'atlas

Les deux planches contiennent du texte incrusté (titre, en-têtes « SECTION… »,
étiquettes F1/F2…) et ne sont **pas** sur une grille régulière. `jump.png` est en
RGB (pas d'alpha) — le fond damier est potentiellement incrusté dans les pixels.
Une étape d'**extraction** est donc obligatoire avant toute animation.

## Décisions de design (issues du brainstorm)

- **Extraction** : pré-traiter en atlas propres via un script Node ponctuel
  (je découpe/recadre/normalise moi-même les planches existantes).
- **Distinction des 4 joueurs** : **teinte par joueur** (P1 vert, P2 bleu, P3 rose,
  P4 jaune), via `tint()` multiplicatif. Fallback : atlas recolorés pré-calculés
  par décalage de teinte si le `tint()` rend les couleurs ternes (tranché à la
  vérification visuelle).
- **Taille d'affichage** : **~18 px logiques de haut** (~1.5 tuile). La hitbox reste
  8×12 ; le sprite déborde, centré horizontalement sur la hitbox, **pieds alignés
  sur le bas de la hitbox**.

## Architecture

Respecte la frontière du projet (CLAUDE.md) : logique pure et testable d'un côté,
seul `render.js`/`sketch.js` touchent q5play.

### 1. Pipeline d'assets (hors runtime)

- **`tools/extract-sprites.mjs`** — dev only, exécuté une fois, `pngjs` en
  **devDependency** (lib pure JS, outillage uniquement ; le jeu continue de charger
  q5play depuis le CDN, aucune dépendance runtime ajoutée).
- Étapes :
  1. Décoder le PNG en RGBA. Pour `jump.png` (RGB), color-key le fond (damier ou
     couleur unie) → alpha d'abord.
  2. Repérer les bandes de frames (run / dodge / roll) par histogramme d'occupation
     des lignes, en écartant les bandes de texte (profil différent des personnages).
  3. Dans chaque bande, projection en colonnes sur l'alpha → les espaces transparents
     entre personnages séparent les frames (12 / 8 / 10 / 8).
  4. Recadrer chaque frame à sa boîte englobante, puis normaliser à une cellule
     commune par animation, **ancrée pieds-au-sol (bottom-center)** pour éviter le
     tremblement entre frames.
  5. Écrire dans **`spritesheet/atlas/`** : un PNG propre par animation
     (`run.png`, `jump.png`, `dodge.png`, `roll.png`) + **`frames.json`**
     `{ run:{frameW,frameH,count,fps}, jump:{…}, dodge:{…}, roll:{…} }`.
- Vérification visuelle de chaque atlas, itération sur le découpage si une frame est
  mal coupée. Atlas + JSON commités ; le script reste pour régénérer.

### 2. Module pur `sprite.js` (+ `tests/sprite.test.js`)

Aucune dépendance q5/DOM — testable sous vitest.

- **Table des clips** : durées / fps / boucle ou non, alimentée par `frames.json`.
- **`selectClip(player)` → nom de clip** selon le FSM existant :
  - `GROUNDED` + |vx| > seuil → **run** ;
  - `GROUNDED` immobile (|vx| ≤ seuil) → **idle** (frame calme du run, maintenue) ;
  - `AIRBORNE` / `WALLSLIDE` → **jump** (frame choisie selon `vy`) ;
  - `DODGING` + `rolling` → **roll** ; `DODGING` sans `rolling` → **dodge** ;
  - `DEAD` → rien (déjà ignoré au rendu).
- **`frameIndexFor(...)` → index de frame** :
  - **run / jump** : horloge libre à `fps` fixe, en boucle.
  - **jump** : mapping de la frame sur `vy` (frames de montée quand `vy < 0`,
    d'apex/descente quand `vy ≥ 0`) — réglage fin à la vérif visuelle.
  - **dodge / roll** : `index = floor((1 − timer/duration) · count)`, où
    `timer = dodgeTime` et `duration = dodgeDuration` (3) ou `rollDuration` (7).
    Le clip entier se joue pile sur la durée de l'action (sinon un fps fixe ne tient
    pas : le dodge ne dure que 3 frames pour 8 frames d'animation).
- Retour : descripteur **`{ clip, frameIndex, flipX }`**, `flipX` dérivé de
  `player.facing`.

### 3. `player.js` — un seul ajout

- Ajout du booléen **`rolling`** sur l'objet joueur : `true` sur la branche roll
  (input vers le bas), `false` sinon. Distingue roll et dodge qui partagent l'état
  `DODGING`. Initialisé dans `createPlayer`, positionné dans `updatePlayer`.
- Test associé dans `tests/player.test.js`.

### 4. `render.js` — branchement q5

- **`loadSprites()`** appelé au boot depuis `sketch.js` : `loadImage` des 4 atlas +
  parse de `frames.json`.
- **Map d'animateurs** côté render, clé = `player.index`, dont l'horloge est avancée
  chaque frame.
- Pour chaque joueur vivant :
  - appel à `sprite.js` pour `{ clip, frameIndex, flipX }` ;
  - rect destination ~18 px de haut, centré horizontalement sur la hitbox, pieds sur
    le bas de la hitbox ;
  - `image()` du sous-rectangle de l'atlas, **nearest-neighbor** ;
  - **`tint()` par couleur joueur** (`PLAYER_COLORS`) ; flip horizontal selon `flipX` ;
  - conserve les **fantômes toroïdaux** (3×3) et le rendu **shield / ligne de visée**
    actuels.
- **Fallback** : si les images ne sont pas encore chargées, retomber sur le rendu
  rectangle actuel → jamais d'écran vide.

### 5. Tests

- `tests/sprite.test.js` : mapping état → clip ; sélection de frame jump selon `vy` ;
  normalisation dodge/roll sur le timer ; `flipX` selon `facing` ; cas idle.
- `tests/player.test.js` : `rolling` correctement positionné (roll vs dodge vs reset).
- Le rendu lui-même n'est pas testé unitairement (frontière q5) — vérification à l'œil.

## Points laissés ouverts pour la vérification visuelle (non bloquants)

- La **frame d'idle** exacte (frame calme du run).
- Le **mapping précis des frames de jump** sur `vy`.
- Le rendu du **`tint()`** par joueur (sinon bascule sur atlas recolorés pré-calculés).
- Pas d'animation dédiée pour **WALLSLIDE** (réutilise une frame de jump) ni pour
  **DEAD** (joueur déjà masqué au rendu).

## Hors périmètre

- Animations de tir à l'arc, de mort, d'atterrissage dédiée.
- Sprites pour flèches, pickups, décor (restent en primitives).
- Particules / audio (jalon 5 du PRD).
