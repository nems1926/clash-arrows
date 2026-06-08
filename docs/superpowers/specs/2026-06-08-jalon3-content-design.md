# Jalon 3 — Contenu (types de flèches + arènes + piques) — Design

**Date :** 2026-06-08
**Statut :** validé (en attente de plan d'implémentation)

## Objectif

Élargir la variété du Versus avec quatre nouveaux **types de flèches** enfichables
(laser, foudre, super-bombe, perceuse), un nouveau type de tuile **danger (piques)**
létal au contact, **+3 arènes** (total 6), et une **distribution de flèches spéciales
par pickups** qui ajoute quelques flèches du type tiré (sans remplacer tout le carquois).

Hors périmètre (reportés au jalon 4) : power-ups au-delà du bouclier (ailes, bottes,
orbe de temps, clone) et bots IA Versus.

## Architecture (rappel)

Comme aux J1/J2 : la **logique de décision** (réflexion, éventail, prédicats d'arrêt,
distribution carquois, parsing) en **fonctions pures testées Vitest** ; le **câblage
q5play** (rendu, spawn des fragments depuis le pool, explosion, overlaps) en couche
fine vérifiée par `node --check` + validation manuelle navigateur. Mouvement et
collision terrain restent cinématiques custom.

**Approche retenue (A) :** étendre la table data `ARROW_TYPES` avec des champs
déclaratifs et brancher les quelques cas spéciaux dans `updateArrow`/`explodeAt`.
Pas de pattern stratégie : on reste cohérent avec le code existant.

## Composants

### 1. Types de flèches

Table `ARROW_TYPES` (dans `arrow.js`) enrichie de champs déclaratifs :

```js
export const ARROW_TYPES = {
  normal:    { color: '#fcd34d' },
  bomb:      { color: '#fb7185', explosive: true },
  superbomb: { color: '#f43f5e', explosive: true, radiusMult: 2 },
  laser:     { color: '#38bdf8', speedMult: 1.6, flat: true, bounces: 3 },
  bolt:      { color: '#c084fc', speedMult: 2.0, flat: true, splitCount: 3 },
  drill:     { color: '#fbbf24', speedMult: 1.2, pierces: true },
};
```

Conventions de champs (absence = comportement normal) :
- `explosive` : à l'impact terrain → état `EXPLODE` (existant).
- `radiusMult` : multiplie `cfg.explosionRadius` lors de l'explosion.
- `speedMult` : multiplie `cfg.arrowSpeed` au spawn.
- `flat` : pas de gravité (vol tendu) — la branche gravité de `updateArrow` est ignorée.
- `bounces` : nombre de rebonds avant de se planter (laser).
- `splitCount` : nombre de fragments générés à l'impact (foudre).
- `pierces` : ne s'arrête que sur SOLID (traverse one-way/destructibles).

**Spawn typé** — `spawnArrow` applique `speedMult` à la vitesse et initialise
`a.bounces = ARROW_TYPES[type].bounces ?? 0`.

**Comportements dans `updateArrow`** (boucle de sous-pas existante) :

- **Super-bombe** : identique à la bombe (`explosive`) ; le rayon élargi est appliqué
  côté `explodeAt`, qui lit `radiusMult` du type.
- **Surface d'impact centralisée** : un prédicat pur `arrowStopsAt(cell, type)`
  remplace le test « toute tuile bloquante » et décide, par type, ce qui arrête/dévie
  la flèche :
  - `normal`/`bomb`/`superbomb` : SOLID, ONEWAY, DESTRUCT (comportement actuel).
  - `drill` (`pierces`) : **SOLID uniquement** (traverse one-way et destructibles
    **sans les détruire** — YAGNI).
  - `laser` : SOLID et DESTRUCT (rebondit dessus), **traverse les one-way**.
- **Perceuse (`pierces`)** : utilise `arrowStopsAt` ci-dessus ; ne se plante que sur SOLID.
- **Laser (`bounces`, `flat`)** : à l'impact sur une surface d'arrêt laser (SOLID/DESTRUCT),
  si `a.bounces > 0`, on **réfléchit** la vélocité via le helper pur `tileHitAxis(...)`
  (renvoie quel(s) axe(s) bloque(nt)) — `vx = -vx` si axe X, `vy = -vy` si axe Y — et on
  décrémente `a.bounces`. Quand `a.bounces === 0`, comportement normal → `STUCK` (ramassable).
- **Foudre (`splitCount`, `flat`)** : à l'impact → nouvel état `SPLIT`. `sketch.js`
  détecte `SPLIT`, puise `splitCount` flèches **`normal`** du pool, orientées en
  éventail autour de la direction d'impact via le helper pur
  `splitDirections(dirX, dirY, count, spread)`, puis désactive la foudre. Les fragments
  étant `normal`, pas de récursion. Si le pool est épuisé, on génère ce qu'on peut.

Helpers purs (testés) : `tileHitAxis`, `splitDirections` (dans `arrow.js` ou
`tilemap.js`/`aim.js` selon la dépendance), `arrowStopsAt`.

### 2. Tuile danger (piques)

- `tilemap.js` : constante `SPIKE = 4`. **Non bloquante** — `isBlocking` reste
  `SOLID || DESTRUCT` (la collision traverse les piques). Les flèches **ne se plantent
  pas** dessus (piques ignorées dans `arrowBoxHitsTile`).
- `arena.js` : `parseArena` mappe le caractère `^` → `SPIKE` (cellule marchable côté
  collision, mais létale).
- Létalité : helper pur `spikeOverlap(grid, player, TILE)` (test AABB du joueur contre
  les cellules SPIKE, renvoie booléen). Chaque frame dans `sketch.js`, pour chaque
  joueur vivant et non invulnérable qui chevauche une pique → `killOrShield(p)`.
  Le bouclier absorbe, l'invuln d'esquive survit.
- `render.js` : dessine les piques (couleur/forme distincte).

### 3. Distribution par pickups

- `quiver.js` : helper pur `addArrows(p, type, n, cap)` — empile jusqu'à `n` flèches
  `type` sans dépasser `cap`.
- `pickup.js` : `randomType(rand)` tire dans
  `PICKUP_TYPES = ['shield', 'bomb', 'superbomb', 'laser', 'bolt', 'drill']`
  (uniforme, `rand` injecté → testable).
- `config.js` : `pickupArrowCount: 3`.
- `sketch.js` `updatePickups` : à la collecte, si `type === 'shield'` → `p.shield = true` ;
  sinon `addArrows(p, type, cfg.pickupArrowCount, cfg.quiverCapacity)`.
- HUD : la couleur du prochain tir lit déjà `ARROW_TYPES[nt].color` → compatible
  automatiquement avec les nouveaux types.

### 4. Arènes (+3)

- `arena.js` : trois nouvelles arènes `ARENA_D/E/F`, chacune **32×18**, **≥4 spawns `S`**,
  **≥1 spawn pickup `P`**, exploitant piques `^`, destructibles `%`, one-way `=`.
  `ARENAS = [A, B, C, D, E, F]` (6). Tirage par manche (`pickRandomArena`) inchangé.
- `render.js` : rendu des piques (cf. composant 2).

## Flux de données

1. Pickup collecté → `addArrows`/`shield` → carquois typé du joueur.
2. Tir → `spawnArrow(type)` applique `speedMult`, init `bounces`.
3. `updateArrow` (sous-pas) : gravité sautée si `flat` ; impact terrain branché par
   type → `STUCK` / rebond (laser) / `EXPLODE` (bombe, super-bombe) / `SPLIT` (foudre) ;
   perceuse ne s'arrête que sur SOLID.
4. `sketch.js` post-update : `EXPLODE` → `explodeAt` (rayon × `radiusMult`) ;
   `SPLIT` → spawn des fragments via `splitDirections`.
5. Chaque frame : `spikeOverlap` → `killOrShield` pour les joueurs sur piques.

## Gestion d'erreurs / cas limites

- Laser au coin (deux axes touchés) : `tileHitAxis` peut renvoyer X **et** Y → double
  réflexion (demi-tour). Acceptable.
- Foudre avec pool épuisé : on génère le nombre de fragments disponibles, sans planter.
- Pickup `shield` : ne touche pas au carquois.
- `bounces`/`flat` absents : flèches existantes (normal/bomb) inchangées — non-régression
  garantie par les tests J1/J2.
- Piques + explosion : indépendants (les piques ne sont pas détruites).

## Tests

**Purs (Vitest) :**
- `tileHitAxis` — détection axe horizontal / vertical / coin.
- `splitDirections` — `count` directions en éventail autour de la direction d'impact.
- `arrowStopsAt` — perceuse s'arrête sur SOLID seulement ; normal sur SOLID/ONEWAY/DESTRUCT.
- `addArrows` — ajoute `n`, respecte `cap`.
- `randomType` — tire dans `PICKUP_TYPES` selon `rand` injecté.
- `spikeOverlap` — vrai sur recouvrement d'une cellule SPIKE, faux sinon.
- `parseArena` — `^` → `SPIKE`.
- `ARENAS` — 6 entrées, chacune 32×18, ≥4 spawns, ≥1 pickup.

**Comportements flèches (via `updateArrow` sur grille de test) :**
- Laser rebondit (inverse la vélocité) puis se plante après `bounces` rebonds.
- Foudre passe à `SPLIT` à l'impact.
- Perceuse traverse one-way/destructible, s'arrête sur solid.
- Super-bombe : `explosive` + `radiusMult` lu par l'explosion.

**Câblage q5play (non unitaire)** : `node --check` + validation manuelle navigateur
(split depuis le pool, explosion super-bombe, mort sur piques, rendu des nouveaux
types et de la tuile pique).

## Phases d'implémentation (pour le plan)

- **A** — Table `ARROW_TYPES` enrichie + spawn typé (`speedMult`, `bounces`, `flat`).
- **B** — Perceuse (`arrowStopsAt`).
- **C** — Laser (`tileHitAxis` + rebond).
- **D** — Foudre (`splitDirections` + `SPLIT` + spawn fragments).
- **E** — Super-bombe (`radiusMult` dans l'explosion).
- **F** — Piques (`SPIKE`, `spikeOverlap`, parse `^`, rendu, létalité).
- **G** — Pickups étendus (`addArrows`, pool `PICKUP_TYPES`, `pickupArrowCount`).
- **H** — Arènes D/E/F + tests d'ensemble (6).

Chaque phase : helpers purs testés d'abord (TDD), puis câblage `node --check` + manuel.

## Couverture spec → besoin

- 4 types de flèches enfichables → A–E. ✓
- Distribution via pickups (ajoute quelques flèches) → G. ✓
- Tuile danger létale (bouclier/invuln respectés) → F. ✓
- +3 arènes (total 6) avec piques → H. ✓
- Tout paramétrable / data-driven → table `ARROW_TYPES`, `config.js`. ✓
- Logique risquée en fonctions pures testées → `tileHitAxis`, `splitDirections`,
  `arrowStopsAt`, `spikeOverlap`, `addArrows`, `randomType`. ✓
