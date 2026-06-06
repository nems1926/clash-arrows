# PRD — Jeu de combat à l'arc en arène (inspiré de *TowerFall Ascension*)

**Document** : Product Requirements Document
**Version** : 1.0
**Objet** : Spécifier le jeu de référence (*TowerFall Ascension*) en vue de concevoir et implémenter un jeu similaire en JavaScript avec **q5play.js**.
**Statut** : Draft pour développement

---

## 1. Résumé exécutif

*TowerFall Ascension* (Matt Thorson / Maddy Makes Games, 2014) est un jeu de combat à l'arc en arène, en local, pour 1 à 4 joueurs. Le principe : des archers s'affrontent dans une petite arène à un seul écran, avec un nombre limité de flèches qu'il faut ramasser, et une mort en un seul coup. Le « game feel » repose sur des déplacements nerfs et précis, une esquive qui permet d'attraper les flèches, et un écran qui **boucle sur lui-même** (sortir à gauche = réapparaître à droite).

L'objectif de ce PRD n'est **pas** de cloner *TowerFall* à l'identique (propriété intellectuelle, assets), mais de capturer les **mécaniques et le ressenti** afin d'en produire une déclinaison originale jouable en navigateur avec q5play.js.

---

## 2. Objectifs produit et périmètre

### 2.1 Objectifs
- Reproduire la boucle de jeu cœur : se déplacer, tirer, esquiver, ramasser des flèches, tuer en un coup.
- Offrir un mode **Versus local** jouable à 2–4 (clavier + manettes) avec des manches rapides.
- Garantir un « game feel » réactif (entrées < 1 frame de latence perçue, mort instantanée, redémarrage de manche immédiat).
- Architecture suffisamment modulaire pour ajouter types de flèches, arènes et modes ultérieurement.

### 2.2 Non-objectifs (hors périmètre v1)
- Multijoueur en réseau (online).
- Éditeur d'arènes intégré pour le joueur.
- Reproduction exacte des assets, personnages nommés ou roster officiel de *TowerFall*.
- Plateformes natives (consoles) ; cible = navigateur desktop.

### 2.3 Plateforme cible
- Navigateur desktop moderne supportant **WebGPU** (prérequis de q5.js v4 / q5play). Prévoir un message de repli si WebGPU indisponible.
- Entrées : clavier (jusqu'à 2 joueurs au clavier en pratique) + manettes Gamepad API (q5play gère les contrôleurs, y compris Joy-Con).

---

## 3. Public cible

- **Joueurs** : amateurs de party games locaux et de jeux de plateforme/combat compétitifs rapides. Sessions courtes, « encore une manche ».
- **Pré-requis** : aucun ; prise en main en quelques secondes (déplacer, sauter, tirer, esquiver).

---

## 4. Boucle de gameplay (core loop)

```
Apparition (spawn) → Mouvement / positionnement → Tir & esquive →
   ├─ Touché par une flèche / écrasé → Mort → fin de manche pour ce joueur
   └─ Ramasser des flèches au sol/dans les murs → continuer
Dernier archer en vie → gagne la manche → manche suivante
Premier à N manches → gagne le match
```

Caractéristiques clés du ressenti :
- **One-hit kill** : une flèche ou un écrasement tue instantanément.
- **Munitions rares** : on commence avec un carquois limité (≈ 3 flèches) ; gérer ses tirs et récupérer ses flèches est central.
- **Arène fermée et bouclée** : pas de hors-jeu latéral/vertical, l'espace est toroïdal.
- **Manches très courtes** (souvent < 30 s), redémarrage quasi instantané.

---

## 5. Spécifications fonctionnelles détaillées

> Les valeurs numériques ci-dessous sont des **points de départ à calibrer** (game feel). Travailler en unités « pixels logiques » à résolution interne fixe (ex. 320×180 ou 426×240 mis à l'échelle).

### 5.1 Déplacement de l'archer

| Action | Comportement | Valeur indicative |
|---|---|---|
| Course | Accélération vers vitesse cible, décélération au relâchement | v_max ≈ 90 px/s ; accel rapide (~10 frames pour atteindre v_max) |
| Saut | Saut à hauteur variable (relâcher la touche coupe l'ascension) | v_jump ≈ -150 px/s ; gravité ≈ 600 px/s² |
| Gravité | Constante ; vitesse de chute plafonnée | v_fall_max ≈ 240 px/s |
| Accroche/glissade murale | Au contact d'un mur en l'air, ralentit la chute (wall slide) | v_slide ≈ 60 px/s |
| Saut mural (wall jump) | Saut diagonal en s'éloignant du mur | impulsion latérale + verticale |
| Esquive / Dash (dodge) | Voir 5.3 — mécanique signature | — |

Détails à soigner pour le feel :
- **Coyote time** : tolérance de quelques frames pour sauter après avoir quitté une plateforme.
- **Jump buffering** : mémoriser l'appui saut quelques frames avant l'atterrissage.
- **Apex hang** : légère réduction de gravité au sommet du saut (optionnel mais améliore le contrôle).
- Hitbox du personnage compacte et centrée ; collisions « tile-based » nettes.

### 5.2 Tir à l'arc

- **Visée à 8 directions** (calée sur le stick/les touches directionnelles) ; *TowerFall* utilise une visée directionnelle, pas une visée libre à 360° à la souris. Choisir 8 directions pour rester fidèle au feel ; une variante souris (360°) peut être un mode optionnel.
- **Trajectoire** : la flèche subit la **gravité** et décrit un arc → la maîtrise des trajectoires est une compétence clé.
- **Vitesse de flèche** initiale ≈ 220 px/s (à calibrer), gravité de flèche < gravité du joueur.
- **Carquois** : nombre de flèches limité (défaut 3). HUD affichant le stock par joueur.
- **Plantage** : une flèche qui touche un mur/plateforme/sol s'y **plante** et reste **ramassable** ; une flèche qui tombe au sol est ramassable.
- **Récupération** : passer sur/contre une flèche au repos la remet au carquois. C'est la principale source de munitions.

### 5.3 Esquive (dodge) et attrape (catch) — mécanique signature

- L'**esquive** est un dash bref dans une direction, avec une **fenêtre d'invulnérabilité** au début.
- Pendant la fenêtre active, si une flèche entre en contact, le joueur **l'attrape** au lieu de mourir, et l'ajoute à son carquois (l'attrape récompense le timing).
- Après l'esquive : courte **récupération** (cooldown) avant de pouvoir réesquiver, pour éviter le spam.
- Paramètres à calibrer : durée totale de l'esquive, durée de la fenêtre d'invulnérabilité (sous-ensemble du dash), distance, cooldown.
- L'esquive sert aussi de **mobilité** (repositionnement rapide, esquive de bombe).

### 5.4 Combat et conditions de mort

Un archer meurt si :
1. Il est touché par une flèche (ennemie ou la sienne, selon réglage friendly fire) hors fenêtre d'esquive et sans bouclier actif.
2. Il est **écrasé** (stomp) : un joueur qui retombe sur la tête d'un autre le tue (à la *Mario*). Détection : collision verticale par le dessus avec vitesse descendante.
3. Il est pris dans une explosion (flèche-bombe), un piège d'arène, etc.

À calibrer : friendly-fire on/off, l'auto-touche par ricochet (flèche laser), zones de dégâts des explosions.

### 5.5 Écran bouclé (wrap toroïdal)

- L'arène **boucle horizontalement et verticalement** : un objet (joueur, flèche, ennemi) qui sort par un bord réapparaît par le bord opposé.
- S'applique aux joueurs, flèches, projectiles et certains ennemis.
- Implémentation : modulo des positions sur la largeur/hauteur logique ; gérer le **rendu en double** près des bords (afficher l'entité des deux côtés pendant la transition) et la **continuité des collisions** au passage.

### 5.6 Types de flèches

Roster représentatif (sélectionner un sous-ensemble pour le MVP ; chaque type est un comportement enfichable) :

| Type | Comportement | Priorité |
|---|---|---|
| Normale | Trajectoire balistique standard, se plante et se ramasse | **MVP** |
| Bombe | Explose à l'impact, zone de dégâts (rayon) | **MVP** |
| Super-bombe | Explosion plus large | v2 |
| Laser | Rebondit (≈ 3 fois) et/ou traverse, vol tendu et rapide | v2 |
| Foudre (bolt) | Vol très rapide, éclair/scission à l'impact | v2 |
| Perceuse (drill) | Traverse partiellement murs/plateformes minces | v2 |
| Ronces (bramble) | Génère des piques à l'impact, créant un danger de zone | v2 |
| Détonateur (trigger) | Se plante puis explose sur commande du tireur | v3 |
| Prisme | Variante avancée (rebonds/scission) | v3 |

> Les flèches spéciales sont généralement **distribuées par les pickups de l'arène**, pas dans le carquois de départ. Le carquois de départ contient des flèches normales.

### 5.7 Power-ups / trésors d'arène

Coffres/objets qui apparaissent dans l'arène et confèrent un bonus temporaire ou un type de flèche :

| Power-up | Effet |
|---|---|
| Bouclier | Absorbe un coup (puis disparaît) |
| Ailes | Esquive/saut aérien supplémentaire ou plané |
| Bottes de vitesse | Déplacement plus rapide pendant une durée |
| Orbe de temps | Ralentit le temps pour les autres joueurs |
| Miroir / clone | Crée un leurre |
| Recharge de flèches spéciales | Remplit le carquois d'un type de flèche (bombe, laser…) |

Apparition : sur des points de spawn d'arène, à intervalles, parfois dans des coffres à ouvrir en tirant dessus.

### 5.8 Arènes / niveaux

- Arène à **un seul écran** (pas de scrolling), bouclée (5.5).
- Éléments constitutifs :
  - **Plateformes solides** (collision sur toutes faces).
  - **Plateformes traversables (one-way)** : franchissables par le bas, atterrissables par le haut ; descente possible (ex. bas + saut).
  - **Murs** pour wall-slide / wall-jump.
  - **Éléments destructibles** (optionnel) : se brisent sous explosion.
  - **Trappes / dangers** (optionnel v2) : piques, lave, plateformes mobiles.
- **Points de spawn** des joueurs (répartis, équilibrés) et des power-ups.
- Format de données d'arène : grille de tuiles + couches (collision, one-way, spawns joueurs, spawns objets). Voir 9.5.

### 5.9 Modes de jeu

1. **Versus (MVP)** : 2–4 archers, dernier en vie gagne la manche ; premier à N manches (configurable, ex. 5/10) gagne le match. Variantes optionnelles (à activer) : friendly fire, types de flèches autorisés, vitesse, etc.
2. **Quest (v2, PvE)** : 1–2 joueurs en coop contre des vagues d'ennemis sur des arènes prédéfinies. Conditions de victoire : survivre/éliminer toutes les vagues.
3. **Trials (v3, solo)** : défis chronométrés / cibles à toucher dans un temps imparti, pour entraîner la maîtrise des trajectoires.

### 5.10 Ennemis (pour le mode Quest, v2)

Comportements simples et lisibles, p. ex. : ennemi qui fonce au corps-à-corps, ennemi archer (tire des flèches), ennemi volant, ennemi qui se scinde à la mort. Chacun = machine à états (patrouille → détection → attaque). Sensibles aux mêmes règles (écrasement, flèches, wrap).

### 5.11 IA pour le Versus solo (optionnel v2)

Bots remplaçant des joueurs absents : viser le joueur le plus proche, esquiver les flèches entrantes (réaction probabiliste), ramasser des flèches quand le carquois est vide. Difficulté = paramètres de précision/temps de réaction.

---

## 6. UI / UX

- **Écran titre** + sélection de mode.
- **Lobby Versus** : assignation joueurs/contrôleurs, choix de l'archer (skin/couleur), réglages de match.
- **HUD en jeu** : par joueur, indicateur de flèches restantes ; compteur de manches gagnées ; éventuel indicateur de cooldown d'esquive.
- **Transitions** : annonce de victoire de manche, écran « K.O. » bref, redémarrage rapide (touche unique pour relancer).
- **Écran de fin de match** : vainqueur + bouton rejouer.
- **Pause / réglages** : volume, plein écran, réassignation des touches.

Principe UX : minimiser les frictions entre deux manches — l'objectif est l'enchaînement immédiat.

---

## 7. Audio

- **SFX** : tir, plantage de flèche, attrape (catch), saut, esquive (whoosh), mort, explosion, ramassage de power-up, fin de manche.
- **Musique** : boucle d'ambiance par arène + jingle de victoire.
- Feedback audio crucial pour le timing de l'esquive/attrape : son distinct quand l'attrape réussit.

---

## 8. Direction artistique

- **Pixel art** rétro, lisible à petite résolution, mise à l'échelle entière (nearest-neighbor, pas de flou).
- Palette contrastée : silhouettes des archers et trajectoires de flèches doivent rester lisibles à 4 joueurs.
- Couleur distincte par joueur (P1/P2/P3/P4) pour identification immédiate.
- Effets : particules d'explosion, traînées de flèches spéciales, flash sur la mort/l'attrape.
- **Assets originaux** (ne pas réutiliser les sprites de *TowerFall*).

---

## 9. Architecture technique avec q5play.js

> **q5play.js** : moteur de jeu web s'appuyant sur **q5.js WebGPU** (rendu) et **Box2D v3 WASM** (physique). API orientée *Sprite* / *Group*, gestion intégrée des entrées clavier/souris/manettes, animations par spritesheet. Successeur de p5play (API proche, ~10× plus rapide). Licence « Creator » : usage personnel et commercial libre ; **usage éducatif (enseigner à coder) soumis à une licence séparée** — à vérifier selon le contexte d'utilisation.

### 9.1 Choix de moteur de mouvement : physique vs. cinématique

**Décision recommandée** : ne **pas** confier les déplacements des archers à la simulation rigide-body de Box2D. Les plateformers « tight » comme *TowerFall* exigent un contrôle déterministe (hauteur de saut variable, wall-slide, coyote time, écrasement, wrap d'écran propre) difficile à obtenir avec un solveur physique générique.

Approche conseillée :
- **Mouvement cinématique custom** pour joueurs/flèches : intégrer position/vitesse à la main, résolution de collision contre une **grille de tuiles** (séparation des axes X puis Y, classique AABB vs tilemap).
- Réserver Box2D / les capacités physiques de q5play à des éléments « bonus » (débris d'explosion, objets décoratifs) si utile, sans en dépendre pour le cœur.
- Concrètement avec q5play : utiliser les *Sprites* pour le rendu et la détection d'**overlap/collision** (`sprite.overlaps(...)`, groupes), mais piloter la position via une logique maison plutôt que via `world.gravity` + colliders dynamiques. Configurer les colliders en **kinematic** pour garder la main sur le mouvement.
- Boucle à **pas de temps fixe** (ex. 60 Hz logique) pour un game feel reproductible, découplée du rendu.

> Cette décision est le principal arbitrage technique du projet : prototyper tôt un « jump + wall slide + wrap » pour valider le ressenti avant d'industrialiser.

### 9.2 Entités (Sprites / Groups)

- `Group` par catégorie : `players`, `arrows`, `pickups`, `enemies`, `terrain` (tiles solides), `oneWay`.
- Chaque archer = Sprite + état (au sol, en l'air, sur mur, en esquive, mort) en machine à états.
- Flèche = Sprite + état (en vol, plantée, au repos/ramassable) + type (stratégie de comportement enfichable, cf. 5.6).

### 9.3 Détection de collisions / interactions

Utiliser les overlaps de q5play entre groupes :
- `arrows` ↔ `players` : mort / attrape (selon état esquive) / bouclier.
- `players` ↔ `players` : écrasement (test vertical + vitesse).
- `arrows`/`players` ↔ `terrain` / `oneWay` : résolution de mouvement (logique maison) + plantage des flèches.
- `players` ↔ `pickups` : application d'effet.
- Explosions : test de distance (rayon) au moment de l'événement, pas un corps physique persistant.

### 9.4 Gestion des entrées multijoueurs

- q5play expose le clavier (`kb`) et les contrôleurs/manettes (Gamepad API, support Joy-Con documenté).
- Mapper chaque joueur à une **source d'entrée** (clavier zone 1, clavier zone 2, manette 1, manette 2…), avec table de bindings réassignable.
- Actions abstraites par joueur : `left/right/up/down`, `jump`, `shoot`, `dodge`, `aim` (8 directions). Découpler la couche « input brut » de la couche « intentions » pour faciliter manettes + IA + rebinding.

### 9.5 Données de niveaux

- Arène = JSON : dimensions logiques, grille de tuiles (indices), couches (`solid`, `oneWay`, `playerSpawns`, `pickupSpawns`), métadonnées (musique, dangers).
- Chargement → instanciation des Sprites de terrain + placement des spawns.
- Permet d'ajouter des arènes sans toucher au code (data-driven).

### 9.6 Architecture états de jeu (state machine globale)

`Boot → Title → ModeSelect → Lobby → MatchSetup → Round(Playing → RoundEnd) → MatchEnd → (rejouer)`
Chaque état gère son update/draw ; transitions explicites. Le `Round` contient la boucle de jeu à pas fixe.

### 9.7 Performance / qualité

- Recycler les Sprites (pool de flèches/particules) plutôt que créer/détruire à chaque frame.
- Résolution interne basse mise à l'échelle (pixel-perfect).
- Tester la disponibilité WebGPU au démarrage ; message clair si absent.

---

## 10. Découpage en jalons (phasage)

**Jalon 0 — Spike technique (game feel)**
Un archer dans une arène : déplacement, saut variable, wall-slide, gravité, **wrap d'écran**, collisions tilemap. Valider le ressenti. *Critère : le mouvement « se sent bien ».*

**Jalon 1 — Combat minimal**
Tir de flèche normale (arc balistique, 8 directions), plantage + ramassage, esquive avec fenêtre d'attrape, mort par flèche, écrasement. *Critère : un duel 1v1 fonctionnel.*

**Jalon 2 — Versus jouable (MVP)**
2–4 joueurs, clavier + manettes, manches + score, 2–3 arènes, HUD flèches, redémarrage rapide, flèche-bombe + 1 power-up. *Critère : une soirée Versus tient debout.*

**Jalon 3 — Contenu**
Roster de types de flèches élargi, power-ups supplémentaires, arènes additionnelles, bots IA Versus.

**Jalon 4 — Modes additionnels**
Quest (PvE, ennemis, vagues) puis Trials (solo chrono).

**Jalon 5 — Finition**
Audio complet, effets/particules, menus, réglages, écrans de transition, polish.

---

## 11. Critères d'acceptation « game feel »

- Mort instantanée et lisible ; cause de mort identifiable.
- Saut contrôlable (hauteur variable, coyote time, buffering perçus).
- L'esquive-attrape récompense clairement le timing (feedback audio/visuel net).
- Le wrap d'écran est fluide (rendu double aux bords, pas de saut de collision).
- Une manche perdue est immédiatement rejouable.
- À 4 joueurs, l'action reste lisible (couleurs, trajectoires, taille des sprites).

---

## 12. Risques techniques

| Risque | Impact | Mitigation |
|---|---|---|
| Dépendance WebGPU (q5.js v4) | Jeu inaccessible sur navigateurs/GPU non compatibles | Détection au boot + message ; viser navigateurs récents |
| Box2D inadapté au feel platformer | Mouvement « flottant » / imprécis | Mouvement cinématique maison (cf. 9.1), Box2D en complément seulement |
| Wrap d'écran + collisions | Bugs aux bords (téléport, double dégât) | Tester tôt ; rendu fantôme + résolution de collision côté wrap |
| Multijoueur local / multi-manettes | Mappage et conflits d'entrées | Couche d'abstraction d'input + assignation explicite en lobby |
| Termes de licence q5play (usage éducatif) | Contrainte si finalité pédagogique | Vérifier la licence selon l'usage réel (perso/commercial vs enseignement du code) |
| Équilibrage / game feel | Jeu pas « fun » sans tuning | Itérer dès le Jalon 0, valeurs exposées comme paramètres |

---

## Annexe A — Glossaire
- **Wrap toroïdal** : l'arène boucle horizontalement et verticalement.
- **Dodge / catch** : esquive avec fenêtre permettant d'attraper une flèche au lieu de mourir.
- **Stomp** : tuer un adversaire en lui retombant dessus.
- **One-way platform** : plateforme franchissable par le bas, solide par le haut.
- **Quiver / carquois** : réserve de flèches limitée du joueur.

## Annexe B — Référence
Jeu source : *TowerFall Ascension* (Maddy Makes Games / Matt Thorson, 2014). Ce PRD vise une **déclinaison originale** des mécaniques, sans réutilisation d'assets ni du contenu protégé.
