# TowerFall-like

Jeu de combat à l'arc en arène, en local de 1 à 4 joueurs, inspiré de
*TowerFall Ascension* : morts en un coup, flèches limitées, esquive pour
attraper les flèches, et écran toroïdal (on ressort de l'autre côté).

Construit en JavaScript sur **q5play.js** (q5.js / WebGPU + Box2D), sans étape
de build. Le mouvement et les flèches sont intégrés à la main (cinématique
maison sur grille de tuiles) ; Box2D n'est pas utilisé pour le gameplay.

## Prérequis

- Un navigateur compatible **WebGPU** (Chrome/Edge récents). Au démarrage, le jeu
  vérifie `navigator.gpu` et affiche un message d'erreur s'il est absent.
- **Node.js** uniquement pour le serveur de dev et les tests (aucune dépendance
  runtime n'est installée : q5play est chargé depuis un CDN dans `index.html`).

## Lancer le jeu

```bash
npm install      # installe vite + vitest (dev uniquement)
npm run dev      # serveur de dev avec rechargement à chaud → ouvre l'URL affichée
```

On peut aussi ouvrir `index.html` directement dans un navigateur WebGPU.

## Contrôles

**Lobby**
- `Espace` : le clavier rejoint la partie
- `A` / `START` (manette) : une manette rejoint la partie
- `Entrée` : démarrer (2 joueurs minimum)
- `F` ou double-clic : plein écran (`Échap` pour sortir)

**En jeu — clavier**

| Action  | Touches                |
|---------|------------------------|
| Gauche  | `←` / `A` / `Q`        |
| Droite  | `→` / `D`              |
| Viser haut / bas | `↑` / `↓` ou `S` |
| Sauter  | `Espace` / `W`         |
| Tirer   | `E`                    |
| Esquive | `Maj` (Shift)          |

**En jeu — manette** : stick gauche / croix directionnelle pour se déplacer et
viser, `A` saut, `X` tir, `R` / gâchette droite esquive.

La direction de tir suit la direction maintenue (8 directions). Une esquive bien
timée attrape une flèche au lieu de mourir. Le premier à **5 manches** gagne le
match.

## Tests

La logique de jeu est faite de fonctions pures testables sans navigateur.

```bash
npm test            # lance toute la suite (vitest)
npm run test:watch  # mode watch
```

Chaque module de gameplay possède son fichier `tests/<module>.test.js`. Garde la
suite au vert.

## Structure du projet

```
index.html      Boot q5play (CDN) + chargement de sketch.js
sketch.js       Orchestrateur unique : boot, boucle à pas fixe 60 Hz, états de jeu
config.js       Géométrie + constantes de feel (DEFAULT_CONFIG), réglables au debug
player.js       Mouvement cinématique de l'archer + machine à états
tilemap.js      Collision AABB axe par axe sur la grille, wrap toroïdal
arena.js        Arènes en ASCII + parsing → grille numérique
arrow.js        Flèches : pool, types (table de comportements), vol, plantage
combat.js       Overlaps, attrape, létalité, stomp, explosions, spikes
game.js         Machine à états globale (lobby → manches → fin de match)
score.js        Décompte des manches / vainqueur
quiver.js       Carquois (capacité, ajout, tir)
pickup.js       Bonus (flèches, bouclier)
lobby.js        Attribution des sources d'entrée aux slots joueurs
input.js        Lecture clavier/manette → intentions abstraites
aim.js          Vecteur de visée 8 directions
render.js       Dessin du monde (passe en repère centré q5)
hud.js          Affichage des flèches / état
debug.js        Panneau de réglage live des constantes
fullscreen.js   Bascule plein écran
tests/          Tests vitest (un fichier par module)
docs/           Specs et plans de conception par jalon
PRD_TowerFall_like_q5play.md   Document de référence (intention du jeu)
```

Le mouvement et les flèches travaillent en **pixels logiques** sur une grille de
**320 × 180** (`TILE = 10` → 32 × 18 cases), affichée ×4 au rendu (pixel art net).
Les coordonnées `x,y` d'une entité sont le **coin haut-gauche** de sa boîte.

## Créer une nouvelle arène

Les arènes sont des données : une grille **ASCII de 32 colonnes × 18 lignes**, sans
code à écrire. Ligne 0 = haut de l'écran.

### 1. Caractères disponibles

| Car. | Signification           | Effet en jeu                                            |
|------|-------------------------|---------------------------------------------------------|
| `.`  | vide                    | rien (espace traversable)                               |
| `#`  | solide                  | bloque le mouvement et les flèches                      |
| `=`  | plateforme traversable  | solide par le dessus seulement ; on saute au travers, on descend avec `↓` |
| `%`  | destructible            | bloque, mais détruit par les explosions                 |
| `^`  | pique                   | tue au contact (laisse passer les flèches)              |
| `S`  | spawn joueur            | point d'apparition d'un archer (case vide par ailleurs) |
| `P`  | spawn de bonus          | emplacement possible d'un pickup (case vide par ailleurs)|

Prévois **au moins 4 `S`** (jusqu'à 4 joueurs) et **au moins 1 `P`**.

### 2. Ajouter l'arène

Édite `arena.js` : déclare ta grille puis ajoute-la au tableau `ARENAS` — c'est la
seule étape, la sélection aléatoire en début de manche la prendra automatiquement.

```js
export const ARENA_G = [
  '................................', // 0
  '..............P.................', // 1
  '................................', // 2
  '...S......................S.....', // 3
  '..#####..............#####......', // 4
  '................................', // 5
  '......======....======..........', // 6
  '................................', // 7
  '....%%%%............%%%%........', // 8
  '................................', // 9
  '................................', // 10
  '...S......................S.....', // 11
  '..#####..............#####......', // 12
  '................................', // 13
  '................................', // 14
  '#####...^^^^^^...^^^^^...#####..', // 15
  '################################', // 16
  '################################', // 17
];

// plus bas dans le fichier :
export const ARENAS = [ARENA_A, ARENA_B, ARENA_C, ARENA_D, ARENA_E, ARENA_F, ARENA_G];
```

### 3. Règles à respecter

- **Exactement 18 lignes de 32 caractères.** Une ligne plus courte/longue décale la
  grille et casse les collisions.
- Le monde **wrappe** (toroïdal) : un personnage qui sort à gauche revient à droite,
  en haut → en bas. Pense les bords comme connectés, pas comme des murs.
- Garde les `S` sur des cases **vides** (pas dans un mur) et assez espacés pour un
  départ équitable.
- Évite d'enfermer un spawn ou un bonus derrière des `#` infranchissables.

### 4. Vérifier

`parseArena` ignore les caractères inconnus (traités comme vide) — relis donc bien
ta grille. La suite `tests/arena.test.js` vérifie le parsing ; lance `npm test`
après ajout. Pour tester en jeu, lance `npm run dev` : les arènes sont tirées au
hasard à chaque manche (`pickRandomArena`).
