# Jalon 2 — Contenu MVP (bombe, bouclier, arènes) — Design

**Date** : 2026-06-07
**Projet** : TowerFall-like en q5play.js (voir `PRD_TowerFall_like_q5play.md`)
**Périmètre** : reste du PRD-J2 (§10), le J1 ayant déjà absorbé la coquille Versus (2–4 joueurs, manettes, manches/score, HUD, lobby, redémarrage). Troisième sous-projet de la série (chaque jalon = son cycle spec → plan → implémentation). S'appuie sur le J1 (`2026-06-07-jalon1-combat-minimal-design.md`).

## Objectif

Donner de la **variété** au Versus : un type de flèche spécial (**bombe**, avec explosion et terrain destructible), un **power-up** (**bouclier**), et **3 arènes** tirées au hasard par manche. Le jalon introduit deux systèmes extensibles — **types de flèche enfichables** et **pickups d'arène** — réutilisables au J3.

**Critère d'acceptation** (PRD-J2) : « une soirée Versus tient debout » — variété de jeu, pickups contestés, arènes différentes.

## Dans le périmètre

- **Type de flèche enfichable** + la **flèche-bombe** (explosion à rayon).
- **Carquois typé** (pile mixte de types).
- **Tuiles destructibles** + reset d'arène par manche.
- **Pickups d'arène** : spawn temporisé, un seul à la fois, type aléatoire, ramassage au contact.
- **Power-up bouclier** (absorbe un coup) + **pickup-bombe** (remplit le carquois de bombes).
- **3 arènes** data-driven (A enrichie + B + C), ≥4 spawns + `pickupSpawns` + destructibles, **tirage aléatoire par manche**.
- Paramètres exposés au panneau debug.

## Hors périmètre (jalons ultérieurs)

Autres types de flèches (laser, foudre, perceuse, ronces, détonateur, prisme), autres power-ups (ailes, bottes, orbe de temps, miroir), coffres à ouvrir en tirant, chaînage d'explosions, destruction des solides non-destructibles, sélection d'arène au lobby, bots IA, modes Quest/Trials, audio, pixel art.

## Décisions de conception

| # | Décision | Choix retenu |
|---|----------|--------------|
| 1 | Cœur du jalon | Reste PRD-J2 : flèche-bombe + bouclier + arènes |
| 2 | Carquois | **Pile typée mixte** ; `quiverStart=3`, `quiverCapacity=6` |
| 3 | Apparition pickups | **Temporisée** à des points d'arène, **ramassage au contact** |
| 4 | Cadence pickups | **Un seul à la fois**, type aléatoire (bombe/bouclier), respawn après T |
| 5 | Explosion | Tue tout dans le rayon (tireur inclus) ; **bouclier** et **invuln d'esquive** protègent ; **détruit les tuiles destructibles** |
| 6 | Arènes | **3 arènes**, **tirage aléatoire par manche**, ≥4 spawns + pickupSpawns + destructibles |
| 7 | Architecture | Logique de décision en **fonctions pures testées** ; câblage q5play (rendu/overlap) fin, comme au J1 |

## Système de types de flèche (enfichable)

`arrow.js` gagne un champ **`type`** (`'normal' | 'bomb'`) et une table **`ARROW_TYPES`** décrivant par type : sa **couleur** et le comportement d'impact. Le moteur `updateArrow` reste commun (balistique + vol tendu `arrowStraightDist` + sous-pas anti-enfouissement) ; à l'impact terrain il fixe l'état selon le type :
- `normal` → `STUCK` (se plante, ramassable — comportement actuel) ;
- `bomb` → `EXPLODE` (signale une explosion au point d'impact, traitée par la couche combat).

Cela prépare les types futurs sans toucher au moteur. La résolution des effets (rayon, morts, destruction) vit dans `combat.js`/`sketch.js` car elle a besoin des joueurs et de la grille.

## Carquois typé (pile mixte)

`quiver.js` devient une **pile de types** plafonnée à `quiverCapacity`.
- État joueur : `quiver: string[]` (ex. `['normal','normal','normal']` au départ, longueur `quiverStart=3`).
- `canShoot(p)` = pile non vide.
- `shootType(p)` retire et renvoie le type du dessus (le tir spawn une flèche de ce type ; pile vide → `null`).
- `addArrow(p, type)` empile `type` **si** `length < quiverCapacity` (ramasser une flèche plantée ré-empile **son** type ; une bombe ramassée reste une bombe ; au-delà de 6, ignoré).
- `fillWith(p, type, cap)` remplit la pile de `type` jusqu'à `cap` (utilisé par le pickup-bombe ; `cap = quiverCapacity = 6` par défaut, réglable).
- HUD : nombre de flèches + **type du prochain tir** (couleur).

> `quiverStart = 3` (départ) et `quiverCapacity = 6` (max au ramassage) sont distincts.

## Flèche-bombe & explosion

- Vole comme une normale (balistique, vol tendu). À l'**impact** :
  - **terrain bloquant** → `EXPLODE` (au lieu de `STUCK`) ;
  - **joueur** : s'il est en fenêtre d'attrape (esquive) → **captée** comme bombe (ajoutée au carquois, pas d'explosion) ; sinon → **explose** au point de contact.
- **Explosion** = événement one-shot au point d'impact, rayon `explosionRadius` (tunable) :
  - tout joueur dans le rayon **meurt**, **sauf** s'il est en invuln d'esquive (`isInvulnerable`) ou protégé par un **bouclier** (consommé) — via `killOrShield` ;
  - toute **tuile destructible** (`DESTRUCT`) dans le rayon est retirée (→ vide) ;
  - effet visuel : flash/cercle bref ; **pas de chaînage** entre bombes (MVP) ; les solides non-destructibles ne sont pas affectés.

## Tuiles destructibles & reset d'arène

- Nouveau type de tuile **`DESTRUCT`** (ASCII `%`) : **bloquant** pour le mouvement, le plantage et le wall-contact (comme un solide), mais **supprimable** par explosion.
- `tilemap.js` : helper **`isBlocking(cell)`** (= `SOLID || DESTRUCT`) utilisé par `resolveX`, `resolveY`, `wallContact`, et `arrowBoxHitsTile`. One-way (`ONEWAY`) inchangé.
- La grille étant **mutée en jeu** (tuiles détruites), chaque manche **re-clone** la grille depuis les données d'arène (les destructibles régénèrent à la manche suivante).

## Système de pickups

Nouveau module `pickup.js` + état spawner dans `sketch.js`.
- **Donnée pickup** : `{ active, type: 'bomb'|'shield', x, y, w, h }`. Un seul actif à la fois.
- **Spawner** : timer `pickupRespawnFrames` (tunable). Si aucun pickup actif et timer écoulé → `chooseSpawn(pickupSpawns, rand)` choisit un point libre, type aléatoire (bombe/bouclier), activation.
- **Ramassage** : overlap joueur↔pickup (toroïdal) →
  - `bomb` → `fillWith(player, 'bomb', quiverCapacity)` ;
  - `shield` → `player.shield = true`.
  Puis pickup désactivé, timer relancé.
- `chooseSpawn(points, rand)` est **pur** (random injecté) → testable.

## Bouclier

- Champ `player.shield` (bool), réinitialisé à `false` au respawn.
- **Absorbe un seul coup autrement létal**, quelle qu'en soit la source. Toutes les morts passent par `killOrShield(p)` : si `p.shield` → le consommer (survie) ; sinon `p.state = 'DEAD'`.
- Routes de mort concernées : flèche létale, explosion, stomp.
- Indicateur visuel : aura/contour autour de l'archer.

## Les 3 arènes (data-driven)

- `arena.js` : `ARENA_A` (enrichie) + `ARENA_B` + `ARENA_C`, exportées dans `ARENAS = [A, B, C]`.
- Caractères ASCII : `#` solide, `=` one-way, `%` **destructible**, `S` spawn joueur, `P` **spawn pickup**, `.` vide.
- `parseArena(ascii)` renvoie `{ grid, spawns, pickupSpawns }`. Chaque arène : **≥4 `S`**, quelques `P`, quelques `%`.
- **Tirage aléatoire par manche** : au démarrage de chaque manche, `sketch.js` choisit une arène au hasard, re-parse (grille fraîche), repositionne les joueurs sur ses spawns, réinitialise le spawner de pickups.

## Architecture & fichiers

| Fichier | Changement |
|---|---|
| `config.js` | + `explosionRadius`, `pickupRespawnFrames`, `quiverCapacity` (=6) ; `quiverStart` reste 3 |
| `tilemap.js` | + `DESTRUCT` ; `isBlocking` utilisé par `resolveX/Y`, `wallContact`, `arrowBoxHitsTile` |
| `arena.js` | + 2 arènes, parse `%`/`P`, renvoie `pickupSpawns`, `ARENAS` |
| `arrow.js` | + `type`, table `ARROW_TYPES` ; `updateArrow` → `EXPLODE` (bombe/terrain) vs `STUCK` (normale) |
| `quiver.js` | refacto **pile typée** : `canShoot`, `shootType`, `addArrow(type)`, `fillWith(type, cap)` |
| `combat.js` | + `isInvulnerable`, `killOrShield`, `playersInRadius` (toroïdal), `destructibleCellsInRadius` |
| `pickup.js` | **nouveau** : données pickup + `chooseSpawn` (pur) + effets |
| `player.js` | + `shield` ; reset au respawn |
| `render.js` | + tuiles destructibles, pickups, flèches bombe, flash d'explosion, aura bouclier |
| `hud.js` | carquois typé (compte + type du prochain tir) + indicateur bouclier |
| `debug.js` | + sliders `explosionRadius`, `pickupRespawnFrames`, `quiverCapacity` |
| `sketch.js` | arène par manche (`let grid/spawns/pickupSpawns`, rebuild au respawn), spawner pickups, explosion bombe, morts via `killOrShield`, ramassage pickups |

## Paramètres calibrables (ajouts à `config.js`)

| Paramètre | Valeur init. | Rôle |
|---|---|---|
| `quiverStart` | 3 | flèches au départ (déjà présent) |
| `quiverCapacity` | 6 | maximum de flèches au ramassage |
| `explosionRadius` | ~24 px | rayon de l'explosion de bombe |
| `pickupRespawnFrames` | ~360 (~6 s) | délai avant réapparition d'un pickup |

## Tests (Vitest, fonctions pures)

- **quiver** : `shootType` retire le dessus (vide → null) ; `addArrow(type)` empile le bon type ; plafond `quiverCapacity` respecté ; `fillWith` remplit jusqu'à `cap` ; `canShoot`.
- **combat** : `playersInRadius` (dans/hors, couture toroïdale) ; `killOrShield` (bouclier consommé puis mort au 2e coup) ; `isInvulnerable` ; `destructibleCellsInRadius` (uniquement des `%` dans le rayon).
- **arrow** : bombe → `EXPLODE` sur terrain, normale → `STUCK` ; `type` transporté du tir au plantage/à l'explosion.
- **tilemap** : `DESTRUCT` bloque (`resolveX/Y` s'arrêtent dessus, `wallContact` le détecte, `arrowBoxHitsTile` true) ; one-way et solides inchangés.
- **arena** : `%`→`DESTRUCT`, `P`→`pickupSpawns`, ≥4 spawns par arène, `ARENAS` longueur 3.
- **pickup** : `chooseSpawn` (random injecté) renvoie un point libre ; effets (bomb→fillWith, shield→flag).
- *Feel & overlaps q5play* : validés manuellement (overlay debug + smoke), comme au J1.

## Critères d'acceptation du J2

1. La flèche-bombe explose à l'impact (terrain ou joueur), tue dans un rayon, et détruit les tuiles destructibles ; bouclier et invuln d'esquive protègent.
2. Le carquois est typé : départ 3 normales, ramassage jusqu'à 6, une bombe ramassée reste une bombe ; HUD montre le type du prochain tir.
3. Un pickup unique apparaît à intervalle sur un point d'arène, de type aléatoire ; le ramasser donne bombes (carquois rempli) ou bouclier.
4. Le bouclier absorbe un coup létal (toute source) puis disparaît.
5. 3 arènes jouables, tirées au hasard par manche, avec ≥4 spawns ; destructibles régénérés à chaque manche.
6. Tous les nouveaux paramètres réglables au panneau debug.
7. Tests Vitest verts sur les fonctions pures (quiver typé, explosion/rayon, killOrShield, tilemap destructible, arènes, pickups).
8. **Gate** : une session Versus variée « tient debout ».

## Risques & mitigations (spécifiques J2)

| Risque | Mitigation |
|---|---|
| Modifs de collision tilemap (`isBlocking`) cassent le mouvement J0 | Couverture par tests J0 existants + nouveaux tests `DESTRUCT` |
| Grille mutée + reset par manche | Clone profond des données d'arène ; reset explicite du spawner et des positions |
| Explosion/pickup à la couture toroïdale | Distances modulo (`playersInRadius`, overlap) + tests dédiés |
| Carquois typé : régressions tir/ramassage/HUD | Refacto `quiver.js` couvert par tests ; HUD validé manuellement |
| Équilibrage (rayon, cadence pickups, capacité) | Tout exposé au panneau debug dès le départ |
