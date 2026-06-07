# Jalon 1 — Combat minimal — Design

**Date** : 2026-06-07
**Projet** : TowerFall-like en q5play.js (voir `PRD_TowerFall_like_q5play.md`)
**Périmètre** : Jalon 1 du PRD §10, **élargi** par décision (voir ci-dessous). Deuxième sous-projet d'une série (chaque jalon = son propre cycle spec → plan → implémentation). S'appuie sur le J0 (`2026-06-06-jalon0-spike-game-feel-design.md`).

## Objectif

Construire le combat sur le socle de mouvement du J0 : tirer, esquiver/attraper, mourir, jusqu'à une **session Versus jouable à 2–4 humains**. Critère d'acceptation : un duel/free-for-all fonctionnel avec manches, score et redémarrage immédiat.

## Décision de périmètre (élargissement assumé)

Le J1 de la PRD vise « un duel 1v1 fonctionnel » ; les manettes, le 2–4 joueurs, les manches et le score y sont placés au J2. **Par décision explicite, ce jalon les remonte** : il absorbe donc une grande partie du périmètre J2. Restent reportés : flèche-bombe, power-ups, arènes supplémentaires.

## Dans le périmètre

- **Joueurs / input** : 2 à 4 **joueurs humains**, clavier + manettes (Gamepad API). **Lobby minimal** « rejoindre ». Règle d'assignation : le clavier n'occupe un slot que s'il reste de la place **et** s'il y a < 4 manettes branchées.
- **Visée / tir** : visée **8 directions = direction tenue** (déplacement/stick) ; défaut = sens du regard (`facing`) si neutre. **Un seul bouton tir**. Identique clavier et manette.
- **Flèche normale** : trajectoire **balistique** (gravité flèche < gravité joueur), tir 8-dir, **plantage** dans solide/one-way/sol, reste **ramassable** ; ramassage → carquois. Pool de flèches (recyclage).
- **Carquois** : départ à `quiverStart` (défaut 3) flèches normales.
- **Esquive (dodge)** : **dash directionnel** (8-dir, neutre = facing) avec **fenêtre d'invulnérabilité + attrape** en début de dash, puis **cooldown**. Attraper une flèche pendant la fenêtre → `quiver +1`, flèche recyclée.
- **Mort** : par flèche (adverse **toujours** létale ; sa propre flèche létale **après un délai d'armement**), et par **stomp** (retombée sur la tête : par le dessus + vitesse descendante).
- **Boucle / états** : machine à états globale `Boot → Lobby → Round(Playing → RoundEnd) → MatchEnd → Lobby`. Manche + **score** (manches gagnées) + **premier à N manches** + écran de victoire.
- **HUD** : par joueur, stock de flèches + manches gagnées, couleur du joueur.
- **Arène** : réutilisation de l'**arène A** du J0 (data-driven ASCII).
- **Paramètres** : toutes les valeurs de combat **exposées au panneau debug** dès le départ (comme le J0).

## Hors périmètre (jalons ultérieurs)

Flèche-bombe et autres types de flèches, power-ups / pickups d'arène (le groupe `pickups` est créé mais vide au J1), arènes supplémentaires, IA / bots, modes Quest/Trials, audio, pixel art, menus Title/ModeSelect, réassignation de touches en jeu.

## Décisions de conception

| # | Décision | Choix retenu |
|---|----------|--------------|
| 1 | Périmètre joueurs | 2–4 humains, clavier + manettes ; clavier seulement si < 4 manettes et slot libre |
| 2 | Modèle de visée | 8-dir = direction tenue ; défaut = facing ; un bouton tir ; identique clavier/manette |
| 3 | Modèle d'esquive | **Dash directionnel** (mobilité + fenêtre invuln/attrape), pas une roulade sur place |
| 4 | Structure de manche | Manche + score + premier-à-N + écran de victoire (machine à états globale) |
| 5 | Assignation joueurs | **Lobby minimal** « rejoindre » (Start manette / touche clavier) |
| 6 | Auto-touche | Sa propre flèche létale **après délai d'armement** (ignorée juste après le tir) |
| 7 | Extras inclus | **HUD flèches/score uniquement** ; bombe, power-ups, arènes en plus → reportés |
| 8 | Archi combat | **Sprites/Groups q5play + `Group.overlaps()`** pour les interactions (PRD §9.3) ; mouvement + plantage restent **custom et purs** (continuité J0) |

## Architecture

Prolongement du style modulaire ES du J0. **Mouvement et collision terrain restent cinématiques custom et purs** (volet J0 inchangé) ; q5play n'intervient que pour les **overlaps d'interaction de combat** et le rendu.

### Découpage en fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `config.js` | étendu | + paramètres combat (cf. tableau dédié) |
| `tilemap.js` | inchangé | réutilisé pour le plantage des flèches (lookup cellule pur) |
| `arena.js` | inchangé | arène A réutilisée |
| `input.js` | étendu | généralisé N joueurs : sources (clavier + manettes), bindings, intent par joueur (aim 8-dir, shoot/dodge en *edge*) |
| `lobby.js` | nouveau | logique + écran « rejoindre » : assignation source→joueur, règle « clavier si < 4 manettes » |
| `player.js` | étendu | + états `DODGING`/`DEAD`, carquois, facing/aim, action tir, action dodge, timers invuln/cooldown |
| `arrow.js` | nouveau | données pures + update balistique + plantage vs grille + wrap + pool ; FSM `IN_FLIGHT → STUCK` ; type *normal* enfichable |
| `combat.js` | nouveau | câblage `Group.overlaps()` → événements (mort/attrape/ramassage/stomp) + **prédicats purs** testables |
| `game.js` | nouveau | machine à états globale `Lobby/Round/RoundEnd/MatchEnd` + score |
| `hud.js` | nouveau | flèches + manches gagnées par joueur |
| `render.js` | étendu | + flèches (vol/plantée + ghosts), indicateur de visée, flash dodge/mort |
| `debug.js` | étendu | + sliders des paramètres combat |
| `sketch.js` | étendu | boot → instancie `game.js`, pilote la boucle à pas fixe selon l'état actif |

### Pont coordonnées ↔ Sprites q5play

La vérité interne reste en **top-left logique** (0,0 en haut à gauche), conservée pour le mouvement et la collision terrain (tilemap.js/player.js inchangés sur ce volet). Les Sprites q5play (origine **centrée**, x/y = **centre**, +Y bas) sont créés uniquement comme **proxies d'overlap + rendu** : à chaque pas, `sprite.x/y` est synchronisé depuis les coords logiques via un **unique helper** `logicalToWorld(lx, ly, w, h)`. Colliders en **KINEMATIC** (q5play n'applique ni `world.gravity` ni forces aux entités de gameplay).

### Entités

**Archer** (extension du FSM J0) :
- États ajoutés : `DODGING` (dash actif + sous-fenêtre invuln/attrape), `DEAD`.
- Données ajoutées : `quiver` (défaut `quiverStart`), `aimDir` (8-dir dérivée de l'intent, défaut `facing`), `color` (P1–P4), `roundsWon`, timers `dodgeTime` / `invulnTime` / `dodgeCooldown`.
- Actions : **tir** (si `quiver > 0` : décrémente, spawn arrow depuis le pool dans `aimDir` à la bouche de l'arc), **dodge** (si cooldown écoulé : dash directionnel + ouverture de la fenêtre invuln/attrape).

**Flèche** (`arrow.js`) :
- Données pures + **pool** (recyclage, PRD §9.7).
- FSM : `IN_FLIGHT` (intégration balistique : `arrowGravity` < gravité joueur, **wrap toroïdal**, plantage au contact d'un solide/one-way via lookup cellule pur) → `STUCK` (immobile, ramassable).
- `owner` (joueur tireur) + `ageFrames` (pour le délai d'armement auto-touche).
- Type *normal* implémenté comme **stratégie enfichable** (prépare bombe/laser des jalons suivants sans les coder).

### Machine à états globale (`game.js`)

`Boot → Lobby → Round(Playing → RoundEnd) → MatchEnd → Lobby`. Title/ModeSelect sautés (un seul mode). Chaque état possède `update(dt)` / `draw()`. La **boucle à pas fixe 60 Hz** du J0 vit dans `Round.Playing`.
- `Lobby` : voir Input/Lobby.
- `Round.Playing` : boucle de jeu (cf. ci-dessous).
- `RoundEnd` : ≤ 1 joueur en vie → +1 manche au survivant, courte annonce + K.O., relance instantanée (re-spawn de tous, carquois plein).
- `MatchEnd` : premier à `roundsToWin` manches → écran vainqueur + rejouer (retour Lobby).

## Interactions de combat (`Group.overlaps()` + couture du wrap)

Groupes q5play : `players`, `arrows`, `pickups` (vide au J1).

- **`arrows ↔ players`** → selon l'état de la cible et l'origine de la flèche :
  - cible en **fenêtre d'attrape** (dodge) → **attrape** : flèche recyclée au pool, `quiver +1`, événement `catch`.
  - sinon, flèche adverse **ou** sa propre flèche *après délai d'armement* → **mort** (`DEAD`), événement `death`.
  - sa propre flèche *pendant l'armement* (`ageFrames < selfArmFrames`) → ignorée.
- **`players ↔ players`** → **stomp** si prédicat pur vrai : attaquant au-dessus (chevauchement vertical par le haut) **et** `vy > 0` (descend) au contact. Le stompé meurt (`death`) ; le stompeur rebondit (`vy = -stompBounceVy`).
- **`players ↔ pickups`** : câblage présent mais inactif au J1 (groupe vide).

### Couture du wrap (hotspot — PRD §5.5, §12)

Les `overlaps()` q5play ne « voient » pas à travers le bord. Deux mécanismes complémentaires :
1. **Sprites-fantômes capteurs** : quand une entité chevauche un bord, positionner un sprite proxy décalé de ±W / ±H (réutilise la logique de ghost du J0), ajouté aux groupes le temps de la transition — l'overlap se déclenche des deux côtés.
2. **Filet de sécurité** : prédicats de combat doublés d'un test de **distance modulo (toroïdale)** pour les trajectoires rapides. Couverts par Vitest sur la couture.

À **prototyper tôt** (comme le wrap au J0) : valider qu'attrape et mort se déclenchent proprement au passage du bord. C'est le principal risque du choix « Groups q5play ».

## Input multi-joueurs & lobby

- **Sources** : clavier (1 zone = 1 joueur) + manettes (Gamepad API, exposée par q5play). Table de bindings par source (réassignable plus tard).
- **Intent par joueur** (couche abstraite, prolonge le J0, **pure et testable**) :
  `{ moveX, aimDir (8-dir = direction tenue, défaut facing), jumpHeld, jumpPressed (edge), shootPressed (edge), dodgePressed (edge), down }`.
- **Lobby** (`lobby.js`) : chaque appareil rejoint en pressant son bouton (Start manette / touche clavier). Le clavier n'occupe un slot que s'il reste de la place **et** s'il y a < 4 manettes. Nombre de joueurs = ceux qui ont rejoint (2–4). Couleur attribuée par joueur (P1–P4). « Tous prêts » → lance le match.

## Round, score, match & HUD

- `Round.Playing` (60 Hz) : lecture intents (par joueur) → update joueurs → update flèches → sync Sprites → overlaps combat → traitement des événements (mort / attrape / ramassage / stomp).
- **Fin de manche** : ≤ 1 joueur en vie → `RoundEnd`, +1 manche au survivant, annonce + K.O. bref, relance instantanée (re-spawn de tous, carquois plein).
- **Match** : premier à `roundsToWin` manches (défaut 5, configurable) → `MatchEnd` : écran vainqueur + rejouer (retour Lobby).
- **HUD** (`hud.js`) : par joueur, stock de flèches + manches gagnées, à la couleur du joueur. Lisible à 4 joueurs (PRD §11).

## Paramètres calibrables (ajouts à `config.js`, exposés au panneau debug)

| Paramètre | Valeur init. (PRD §5) | Rôle |
|---|---|---|
| `arrowSpeed` | 220 px/s | vitesse initiale de la flèche |
| `arrowGravity` | ~300 px/s² (< joueur) | arc balistique de la flèche |
| `quiverStart` | 3 | flèches de départ |
| `dodgeSpeed` | à calibrer | vitesse du dash d'esquive |
| `dodgeDuration` | à calibrer | durée totale du dash (frames) |
| `dodgeInvulnFrames` | sous-ensemble du dash | fenêtre invulnérabilité + attrape |
| `dodgeCooldown` | à calibrer | anti-spam d'esquive |
| `selfArmFrames` | quelques frames | délai d'armement de l'auto-touche |
| `stompBounceVy` | à calibrer | rebond vertical du stompeur |
| `roundsToWin` | 5 | manches pour gagner le match |

## Tests (Vitest, sur fonctions pures)

- Intégration balistique de la flèche (position/vitesse, gravité, wrap).
- Plantage : détection de cellule solide/one-way au bout de la flèche.
- Prédicat **attrape** (dans / hors fenêtre invuln), **armement** (avant / après délai), **stomp** (au-dessus + vy>0 vs latéral).
- Résolution **aim 8-dir** depuis l'intent (toutes combinaisons + neutre → facing).
- Carquois (tir décrémente ; ramassage / attrape incrémente).
- Cas **couture du wrap** sur les prédicats de combat (distance modulo).
- Logique de **score / fin de manche** (≤ 1 vivant), match-à-N.
- Logique d'**assignation lobby** (règle « clavier si < 4 manettes »).
- *Feel & overlaps q5play* : validés **manuellement** (overlay debug + smoke test), comme au J0.

## Critères d'acceptation du J1

1. 2–4 joueurs humains rejoignent via le lobby ; clavier assigné seulement si < 4 manettes et slot libre.
2. Visée 8-dir (= direction tenue, défaut facing) ; un bouton tir ; identique clavier/manette.
3. Flèche normale balistique : se plante (solide/one-way/sol) et se ramasse pour recharger le carquois.
4. Esquive = dash directionnel avec fenêtre invuln/attrape claire (feedback) + cooldown ; attraper une flèche la met au carquois.
5. Mort par flèche (adverse toujours ; sienne après armement) et par stomp (par le dessus + descente) ; mort instantanée et lisible.
6. Manche → dernier en vie → +1 au score → relance instantanée ; premier à N → écran vainqueur.
7. HUD lisible : flèches + manches par joueur, à 4 joueurs.
8. Wrap : attrape et mort se déclenchent correctement à travers la couture (sprites-fantômes + filet distance-modulo).
9. Tests Vitest verts sur les fonctions pures (balistique, plantage, attrape, armement, stomp, aim, carquois, score, lobby).
10. **Gate subjectif** : le combat « se sent bien » (tir, esquive/attrape, stomp).

## Risques & mitigations (spécifiques J1)

| Risque | Mitigation |
|---|---|
| Overlaps q5play à travers la couture du wrap | Sprites-fantômes capteurs + filet distance-modulo + tests dédiés ; prototyper tôt |
| Pont coords logiques ↔ Sprites centrés | Un seul helper de conversion ; vérité interne top-left conservée |
| Déterminisme menacé par Sprites/overlaps | Mouvement + plantage restent purs ; overlaps seulement pour les interactions ; smoke test |
| Mapping multi-manettes & conflits d'entrées | Couche intent abstraite + assignation explicite en lobby |
| Sur-périmètre (J1 absorbe une partie du J2) | HUD inclus, mais bombe/power-ups/arènes reportés ; un seul mode, arène A |
| Game feel combat (dodge/tir/stomp) | Tous les paramètres exposés au panneau debug dès le départ |
| Tunneling de flèche rapide | `arrowSpeed` ≈ 220 px/s → ~3,7 px/frame < tuile (10 px) ; lookup au bout de la flèche ; sous-pas si un type rapide arrive plus tard |
