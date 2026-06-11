# Flèches embrocheuses (impale & carry) — Design

Date : 2026-06-11
Statut : validé, prêt pour planification

## 1. Intention

Une flèche non-explosive qui tue un joueur ne disparaît plus. Elle **accélère
(×1.5)**, **embroche le cadavre** (épinglé à la flèche) et **poursuit sa
trajectoire**. Chaque nouveau joueur touché est tué, embroché, et redonne ×1.5
(composé). La flèche s'arrête en se **plantant sur le terrain** (sol, mur ou
plateforme one-way), emportant tous les cadavres qui restent épinglés au point
d'impact. En duel, la fin de round est **différée** jusqu'à ce que la flèche se
plante, pour que le transport soit visible.

Inspiration : l'effet « impale » de *TowerFall*, où une flèche cloue le corps
contre le mur.

## 2. Périmètre

- **Embrochent** : `normal`, `laser`, `bolt`, `drill` (toutes les non-explosives).
- **Inchangées** : `bomb`, `superbomb` — elles explosent au contact d'un joueur
  comme aujourd'hui (`render`/`combat` existants), sans transport.

## 3. Règle de conflit laser/bolt

Le laser rebondit et le bolt se fragmente au contact du terrain. Ces réactions
entrent en conflit avec le transport.

> **Règle :** dès qu'une flèche porte au moins un cadavre (`carryIds.length > 0`),
> elle **ignore sa réaction terrain spéciale**. Le laser ne rebondit plus, le bolt
> ne se fragmente plus : la flèche se comporte comme un projectile lourd et se
> **plante** simplement au prochain terrain.

Cela donne une sémantique uniforme « transport jusqu'au mur, reste plantée »
pour les quatre types embrocheurs.

## 4. Modèle de données

- **Flèche** (`arrow.js`) : nouveau champ `carryIds: []` — index des joueurs
  embrochés portés par cette flèche. Le nombre de kills = `carryIds.length`.
  Initialisé/réinitialisé dans `createArrow`, `spawnArrow` et `release`.
- **Joueur** (`player.js`) : nouveau flag `impaled: false` — cadavre embroché
  ou épinglé, à dessiner comme corps inerte. Réinitialisé au respawn.

## 5. Règles de comportement

- **Accélération** : à chaque kill, `a.vx *= cfg.impaleSpeedMult` et
  `a.vy *= cfg.impaleSpeedMult` (`impaleSpeedMult = 1.5`). Direction préservée,
  effet composé (1.5×, puis 2.25×, puis 3.375×…).
- **Embrochage** : le joueur tué passe `DEAD` + `impaled = true`, son index est
  poussé dans `a.carryIds`.
- **Suivi** : à chaque step, les cadavres listés dans `carryIds` sont recentrés
  sur la position de la flèche (empilés sur sa position courante).
- **Plantage** : quand `updateArrow` détecte un terrain via `arrowBoxStops`, la
  flèche passe `STUCK` à sa dernière position libre ; les cadavres `impaled`
  restent figés là et continuent d'être dessinés comme cadavres jusqu'au respawn.
- **Gravité** : inchangée. Les flèches non-flat arquent après `arrowStraightDist`,
  donc une flèche embrocheuse finit toujours par retomber sur un sol même sans mur.

## 6. Modules touchés

Frontière préservée : la logique pure va dans `combat.js`/`arrow.js`/`game.js`
avec tests ; seuls `sketch.js`/`render.js` touchent q5play.

- **`combat.js`** (pur) :
  - `impale(arrow, player, cfg)` → met `player.state = 'DEAD'`,
    `player.impaled = true`, push `player.index` dans `arrow.carryIds`, multiplie
    `arrow.vx`/`arrow.vy` par `cfg.impaleSpeedMult`. (N'est appelée que si le kill
    n'est pas absorbé par un bouclier.)
  - `carryFollow(arrow, players)` → recale chaque cadavre porté sur la position de
    la flèche (centre corps = centre flèche).
  - `arrowLethal` inchangé.
- **`arrow.js`** :
  - Champ `carryIds` (init/reset).
  - `updateArrow` : si `carryIds.length > 0`, court-circuiter les branches
    bounce (laser) et split (bolt) → planter directement (`STUCK`).
- **`sketch.js`** :
  - Résolution flèche→joueur : pour les types non-explosifs, brancher la mort vers
    `impale(...)` au lieu de `a.active = false`, **sauf** si le bouclier absorbe
    (voir §7). La flèche reste active et continue.
  - Appeler `carryFollow` pour chaque flèche active porteuse à chaque step.
  - Calculer `anyCarrying = arrowPool.some(a => a.active && a.carryIds.length > 0)`
    et **différer** la transition PLAYING→ROUND_END tant qu'il est vrai.
- **`game.js`** :
  - `advance(game, players, cfg, holdRound = false)` — quand `holdRound` est vrai,
    ne pas déclencher `roundOver` (le round reste PLAYING). Reste pur et testable.
- **`render.js`** :
  - Dessiner les joueurs `DEAD && impaled` comme cadavres (corps inerte) au lieu
    de les ignorer (actuellement `if (player.state === 'DEAD') continue;`).
- **`config.js`** :
  - `impaleSpeedMult: 1.5`.

## 7. Cas limites

- **Bouclier** : si `killOrShield` renvoie `false` (bouclier absorbe), pas
  d'embrochage ni d'accélération — la flèche est consommée comme aujourd'hui. Le
  bouclier « arrête le train ».
- **Catch (dodge invuln)** : un joueur qui catch une flèche porteuse la récupère
  en munition ; les cadavres portés sont relâchés et épinglés au point de catch
  (ils gardent `impaled`, donc restent dessinés). La flèche est consommée.
- **Owner / armement** : `arrowLethal` inchangé — une flèche peut tuer son lanceur
  si armée (free-for-all).
- **Tunneling** : détection de kill conservée par frame (pattern existant). À très
  haute vitesse composée (jusqu'à ×3.375 sur 3 kills) un corps fin pourrait être
  traversé ; risque accepté, cohérent avec l'existant (bolt à ×2 aujourd'hui).
  Affinage par sous-step possible plus tard si nécessaire.
- **Respawn** : `respawnAll` doit réinitialiser `impaled = false` sur chaque
  joueur (en plus du reset de position/état existant) et recycler les flèches
  (`carryIds` vidé via `release`).

## 8. Tests (vitest, modules purs)

- **`combat.test.js`**
  - `impale` met le joueur `DEAD` + `impaled`, ajoute son index à `carryIds`,
    multiplie la vélocité par 1.5.
  - Deux kills successifs sur la même flèche → vélocité composée ×2.25.
  - `carryFollow` recale les corps portés sur la position de la flèche.
- **`arrow.test.js`**
  - Une flèche avec `carryIds` non vide se plante au terrain sans rebondir (laser)
    ni se fragmenter (bolt) → `state === 'STUCK'`.
- **`game.test.js`**
  - `advance` ne termine pas le round tant que `holdRound` est vrai ; le termine
    (passe ROUND_END / MATCH_END) quand il repasse faux.

## 9. Hors périmètre

- Particules / son de l'impact (jalon 5 polish).
- Détection de kill sous-step anti-tunneling (affinage futur si besoin).
- Comportement spécifique des cadavres empilés (ils se superposent sur la flèche ;
  pas d'offset le long de la trajectoire).
