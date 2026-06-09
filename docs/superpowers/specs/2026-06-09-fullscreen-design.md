# Spec — Affichage plein écran

Date : 2026-06-09
Statut : validé (design)

## Objectif

Permettre au joueur d'afficher le jeu en plein écran, avec une image nette
(pixel art) et sans déformation, en touchant le moins possible au code existant.

## Décisions validées

1. **Mise à l'échelle** : ratio 16:9 préservé, bandes noires (letterbox) si
   l'écran n'est pas 16:9, pixels nets (nearest-neighbor).
2. **Déclencheur** : touche **F** *et* **double-clic** sur le canvas basculent
   l'entrée/sortie. **Échap** sort (géré nativement par le navigateur).
3. **Mode fenêtré** : le canvas remplit la fenêtre du navigateur en permanence
   (même comportement letterbox qu'en plein écran), et suit les
   redimensionnements. Remplace l'affichage actuel en boîte fixe 1280×720.

## Principe directeur

Le buffer interne reste **1280×720** (`W*SCALE` = 320×180 × `SCALE`=4).
Aucune modification de `render.js`, de la constante `SCALE`, ni de la logique de
jeu. Tout l'agrandissement est délégué au moteur q5 via `displayMode`.

## Changements

### `sketch.js` — displayMode

Après `await Canvas(W*SCALE, H*SCALE)` :

```js
displayMode(MAXED, PIXELATED);
```

- **MAXED** : le canvas remplit son parent en gardant le ratio, avec letterbox.
- **PIXELATED** : agrandissement nearest-neighbor → pixels nets (cohérent avec
  `noSmooth()` / `pixelDensity(1)` déjà présents, qui restent en place).
- Appliqué en permanence (fenêtré + plein écran).

### `sketch.js` — câblage des déclencheurs

`q5.update` s'exécute dans un `requestAnimationFrame` et ne peut donc pas
appeler `fullscreen()` (l'API Fullscreen exige un vrai geste utilisateur). On
passe par les hooks d'événement de q5, qui s'exécutent dans la pile d'un vrai
événement DOM :

```js
import { toggleFullscreen } from './fullscreen.js';

q5.keyPressed    = () => { if (key === 'f' || key === 'F') toggleFullscreen(q5); };
q5.doubleClicked = () => toggleFullscreen(q5);
```

À confirmer d'un coup d'œil contre l'API q5 (déjà vérifiée dans `q5.d.ts`) :
noms exacts des hooks (`keyPressed`, `doubleClicked`) et des constantes
(`MAXED`, `PIXELATED`).

### `fullscreen.js` — nouveau module (bascule pure, testable)

```js
export const toggleFullscreen = (api) => api.fullscreen(!api.fullscreen());
```

Le module n'a aucune dépendance DOM : il reçoit l'objet `api` (q5) et lit/écrit
l'état plein écran. Le câblage des hooks reste dans `sketch.js`.

### `index.html` — CSS

Le body doit occuper tout le viewport pour que MAXED dispose de la place :

```css
html,body{margin:0;height:100%;background:#000;overflow:hidden}
```

Le `display:flex;justify-content:center` actuel est retiré : MAXED gère lui-même
le centrage et le letterbox.

### Indice à l'écran

Ajouter une ligne au texte du lobby (`drawCenter` dans la branche `LOBBY` de
`sketch.js`) :

```
F ou double-clic : plein ecran
```

## Tests

`tests/fullscreen.test.js` (vitest, pur, sans DOM) :

- `toggleFullscreen` lit l'état courant via `api.fullscreen()` puis rappelle
  `api.fullscreen(...)` avec la valeur inversée.
  - depuis fenêtré (`fullscreen()` → `false`) ⇒ appelle `fullscreen(true)`.
  - depuis plein écran (`fullscreen()` → `true`) ⇒ appelle `fullscreen(false)`.

Le câblage des hooks et `displayMode` ne sont pas testables unitairement
(dépendance DOM/moteur) ; ils seront validés manuellement dans le navigateur.

## Vérification manuelle

1. Ouvrir le jeu : le canvas remplit la fenêtre du navigateur, pixels nets,
   ratio préservé (letterbox si la fenêtre n'est pas 16:9).
2. Appuyer sur **F** ⇒ plein écran. Re-appuyer sur **F** ⇒ retour fenêtré.
3. Double-cliquer sur le canvas ⇒ bascule plein écran de la même façon.
4. En plein écran, **Échap** ⇒ retour fenêtré.
5. Redimensionner la fenêtre ⇒ le jeu se réajuste sans déformation.
6. Le rendu reste net à toutes les tailles (pas de flou de mise à l'échelle).

## Hors périmètre (YAGNI)

- Bouton on-screen dédié.
- Mémorisation de l'état plein écran entre sessions.
- Déclenchement à la manette (l'API Fullscreen n'accepte pas l'activation
  gamepad).
