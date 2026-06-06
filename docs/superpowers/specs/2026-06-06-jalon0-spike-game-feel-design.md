# Jalon 0 — Spike de game feel — Design

**Date** : 2026-06-06
**Projet** : TowerFall-like en q5play.js (voir `PRD_TowerFall_like_q5play.md`)
**Périmètre** : Jalon 0 du PRD §10 uniquement. Premier sous-projet d'une série (chaque jalon = son propre cycle spec → plan → implémentation).

## Objectif

Valider le ressenti de déplacement (« game feel ») d'un seul archer dans une arène à écran unique bouclé, avant de construire le combat dessus. **Critère d'acceptation** : le mouvement « se sent bien » (PRD §11) — saut contrôlable, wrap fluide, collisions nettes.

C'est le pari technique central du projet (PRD §9.1, §12) : prouver qu'un mouvement **cinématique custom** sur grille de tuiles donne le contrôle déterministe requis, là où Box2D dynamique échouerait.

## Dans le périmètre

- Un archer contrôlable au clavier (placeholder, pas de pixel art).
- Course (accél/décél), saut à hauteur variable, gravité + plafond de chute.
- Wall-slide et wall-jump.
- Finitions de feel : **coyote time**, **jump buffering**, **apex hang**.
- Collisions AABB contre une grille de tuiles : solides + plateformes one-way (traversée par le bas, drop-through volontaire).
- **Wrap toroïdal** horizontal ET vertical (collision continue + rendu fantôme).
- Boucle logique à **pas de temps fixe** (60 Hz) découplée du rendu.
- **Panneau debug live** : sliders éditant les paramètres en temps réel + overlay d'état.
- Détection WebGPU au boot avec message de repli.
- Arène de test « A » (symétrique) décrite en données ASCII.

## Hors périmètre (jalons ultérieurs)

Flèches, tir, esquive/attrape, mort, écrasement, multijoueur, manettes, menus, score, manches, audio, pixel art, power-ups, IA. La structure du code (couche input abstraite, machine à états) **prépare** ces ajouts sans les implémenter.

## Décisions de conception

| # | Décision | Choix retenu |
|---|----------|--------------|
| 1 | Représentation visuelle | Boîtes/rectangles placeholder colorés (l'effort va sur la physique) |
| 2 | Arène de test | « A » symétrique : sol des deux côtés avec trou central (wrap vertical), murs latéraux (wall-jump), structure flottante centrale, one-way étagées, bords latéraux ouverts (wrap horizontal) |
| 3 | Finitions de feel | Socle + coyote time + jump buffering + apex hang (les trois optionnels retenus) |
| 4 | Calibrage | Panneau debug live (sliders temps réel + overlay), bouton « copier valeurs » vers `config.js` |
| 5 | Moteur mouvement/collision | **Approche 1** : cinématique custom + AABB vs grille de tuiles, axes séparés ; q5play pour le rendu seulement (pas de corps dynamiques Box2D pour le gameplay) |
| 6 | Organisation du code | Découpage modulaire en modules ES (pas un seul `sketch.js`) |
| 7 | Tests | Vitest sur les fonctions pures (collision/wrap/one-way) ; feel validé manuellement |

## Architecture

### Résolution & grille
- Résolution logique **320×180** (16:9), affichée ×4 → 1280×720, nearest-neighbor (pixel-perfect).
- Tuiles de **10 px** → grille **32×18**.
- Hitbox archer compacte ~8×12 px.
- **Système de coordonnées interne** : top-left logique (0,0 en haut à gauche) pour simplifier les maths de tilemap et le modulo de wrap ; conversion au moment du dessin (q5 a une origine centrée — on translate le canvas).

### Données d'arène (data-driven, PRD §9.5)
Arène A décrite en tableau de chaînes ASCII dans `arena.js` :
- `#` = tuile solide (collision sur toutes faces)
- `=` = plateforme one-way
- `.` = vide
- `S` = point de spawn de l'archer

Parsée en grille 2D + liste de spawns. Modifier l'ASCII suffit à changer l'arène — aucun code à toucher.

### Découpage en fichiers (modules ES)
- `index.html` — q5play via CDN + importmap `box2d3-wasm` (bloc copié de `../cassebrique/index.html`), canvas.
- `config.js` — **toutes** les constantes calibrables (cf. tableau de paramètres). Source de vérité éditée par le panneau debug.
- `arena.js` — ASCII de l'arène A + parsing → grille + spawns.
- `tilemap.js` — **fonctions pures** : lookup de tuile en modulo, résolution AABB-vs-grille par axe, helpers de wrap. (Testé avec Vitest.)
- `input.js` — clavier brut (`kb` q5play) → **intentions abstraites** : `{ moveX: -1|0|1, jumpPressed (edge), jumpHeld, down }`. Découple l'entrée des intentions pour préparer manettes/IA/rebinding.
- `player.js` — machine à états de l'archer + intégration cinématique (consomme intentions + config + tilemap).
- `render.js` — dessin des tuiles + archer + **rendu fantôme** aux bords.
- `debug.js` — panneau de sliders + overlay d'état + reset + copier-valeurs.
- `sketch.js` — boot, détection WebGPU, création du canvas, câblage des modules, **boucle à pas fixe**.

### Boucle à pas de temps fixe
Dans le callback frame de q5play :
1. Accumuler `deltaTime`.
2. Tant que l'accumulateur ≥ 1/60 s : lire intentions, `player.update(dt_fixe)`, décrémenter l'accumulateur. (Borner le nombre de pas par frame pour éviter la spirale de la mort.)
3. **Un seul** rendu par frame (`render.draw()` + `debug.draw()`).

Game feel reproductible, indépendant du framerate.

## L'archer : pipeline & machine à états

Pipeline par pas fixe : **clavier brut → intentions abstraites → mise à jour physique → mise à jour FSM**.

### Machine à états
- **Au sol** : course (accél vers `v_max`, décél au relâchement). → *En l'air* (saut, ou chute du bord avec coyote).
- **En l'air** : gravité (réduite au sommet via apex hang), plafond de chute. → *Au sol* (atterrissage) · → *Wall-slide* (contact mur + chute + poussée vers le mur).
- **Wall-slide** : chute plafonnée à `v_slide`. → *En l'air* (wall-jump ou relâche le mur) · → *Au sol* (touche le sol).

(États *Esquive* et *Mort* ajoutés au J1.)

### Règles de feel
- **Saut à hauteur variable** : relâcher la touche pendant la montée écrête `v_y` (coupe l'ascension).
- **Coyote time** : fenêtre de ~6 frames après avoir quitté un sol pendant laquelle le saut reste possible.
- **Jump buffering** : un appui saut ~6 frames avant l'atterrissage est mémorisé et déclenché au contact.
- **Apex hang** : gravité multipliée par ~0.5 quand `|v_y|` < seuil (sommet du saut).
- **Wall-jump** : impulsion latérale (s'éloigne du mur) + verticale.

### Paramètres calibrables (valeurs de départ PRD §5.1, dans `config.js`)
| Paramètre | Valeur init. | Rôle |
|---|---|---|
| `v_max` | 90 px/s | vitesse de course cible |
| `accel` | ~10 frames → v_max | réactivité au sol |
| `v_jump` | -150 px/s | impulsion de saut |
| `gravity` | 600 px/s² | chute |
| `v_fall_max` | 240 px/s | plafond de chute |
| `v_slide` | 60 px/s | chute le long d'un mur |
| `wall_jump_x / wall_jump_y` | impulsion latérale + verticale | saut mural |
| `coyote_frames` | 6 | saut tardif après le bord |
| `buffer_frames` | 6 | saut anticipé avant l'atterrissage |
| `apex_gravity_mult` | 0.5 | réduction de gravité au sommet |
| `apex_vy_threshold` | à calibrer | seuil d'activation de l'apex hang |

### Commandes clavier (par défaut, via la couche input)
- **←/→** ou **Q/D** : déplacement
- **Espace** ou **W** : saut (hauteur variable)
- **↓/S** : drop-through des one-way
- **Tab** : toggle panneau debug · **R** : reset params · **C** : copier valeurs

## Collision & wrap (hotspot de bugs — PRD §5.5, §12)

### Résolution par axes séparés
1. Déplacer l'AABB sur **X seul** → résoudre les chevauchements horizontaux (snap contre la tuile, `v_x = 0`).
2. Déplacer sur **Y seul** → résoudre le vertical (snap, `v_y = 0`, met à jour `au_sol`).

Évite les accrochages dans les coins. **Sous-pas** (anti-tunneling) : si le déplacement d'un pas dépasse une tuile, subdiviser le mouvement en increments ≤ taille de tuile.

### Wrap toroïdal = modulo
- Le **lookup de tuile** indexe en modulo : `grille[(row+H)%H][(col+W)%W]`. Un test de collision près d'un bord « voit » déjà les tuiles d'en face → **pas de saut de collision** au passage de la couture.
- La **position** est wrappée en fin de pas : `x = ((x % Wpx) + Wpx) % Wpx`, idem y.
- S'applique horizontalement ET verticalement (toroïdal complet).

### Plateformes one-way
Collision **seulement si** : `v_y ≥ 0` (descend) ET le bas de l'archer était au-dessus du haut de la plateforme au pas précédent ET `down` non pressé. Sinon traversée (montée par le bas) ou drop-through volontaire (↓).

### Rendu fantôme
Quand l'AABB de l'archer (ou une tuile) chevauche un bord, le dessiner une **seconde fois** décalé de ±Wpx / ±Hpx pour qu'il apparaisse des deux côtés pendant la transition. Pas de pop visuel.

## Outillage & robustesse

### Panneau debug live (`debug.js`)
- Toggle par **Tab**.
- Sliders éditant `config.js` **en temps réel** (bornés à des plages saines).
- Overlay : état FSM, `v=(vx,vy)`, `au_sol`, `mur`, timers coyote/buffer.
- **R** : reset aux valeurs par défaut. **C** : copier le bloc de valeurs calibrées (à coller dans `config.js` pour figer le feel trouvé).

### Détection WebGPU (PRD §9.7, §12)
Au boot, vérifier la disponibilité WebGPU ; si absent, afficher un message clair (« WebGPU requis — navigateur incompatible ») plutôt qu'un canvas noir.

## Tests

- **Vitest** (Vite est déjà la dépendance de dev des projets voisins). Cible : les **fonctions pures** de `tilemap.js`.
  - Résolution AABB par axe (X, Y) contre une mini-grille fixture.
  - Lookup de tuile en modulo (y compris indices négatifs et hors-bornes).
  - Wrap de position (valeurs négatives, > taille, sur les deux axes).
  - Logique one-way (descend/monte, drop-through, position relative au pas précédent).
  - Cas couture du wrap : collision continue à travers le bord.
- **Feel** : validé **manuellement** contre la checklist PRD §11 (mort instantanée → N/A au J0 ; saut contrôlable, wrap fluide, collisions nettes) via l'overlay debug.

## Critères d'acceptation du J0

1. L'archer court, saute (hauteur variable), tombe avec plafond, le tout réglable en live.
2. Coyote time et jump buffering perceptibles ; apex hang améliore le contrôle au sommet.
3. Wall-slide et wall-jump fonctionnels sur les murs latéraux.
4. One-way : franchissables par le bas, atterrissables par le haut, drop-through avec ↓.
5. Wrap horizontal ET vertical fluides, sans saut de collision ni pop visuel (rendu fantôme).
6. Boucle à pas fixe : feel identique quel que soit le framerate.
7. Message clair si WebGPU indisponible.
8. Tests Vitest verts sur les helpers purs.
9. **Gate subjectif** : « le mouvement se sent bien ».

## Risques & mitigations (spécifiques J0)

| Risque | Mitigation |
|---|---|
| Couture du wrap (téléport, double collision) | Lookup en modulo (collision continue) + tests Vitest dédiés + rendu fantôme |
| Tunneling à vitesse élevée | Sous-pas ≤ taille de tuile |
| Feel « pas fun » | Panneau debug live dès le départ ; toutes les valeurs exposées |
| WebGPU indisponible | Détection + message au boot |
| Sur-ingénierie pour un spike | Périmètre strict ; modules petits et focalisés |
