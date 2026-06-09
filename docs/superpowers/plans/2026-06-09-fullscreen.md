# Affichage plein écran — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au joueur d'afficher le jeu en plein écran (touche F ou double-clic), avec image nette et ratio préservé, sans toucher à la logique de rendu.

**Architecture:** Le buffer interne reste 1280×720. Tout l'agrandissement est délégué au moteur q5 via `displayMode(MAXED, PIXELATED)`, appliqué en permanence (fenêtré + plein écran). La bascule plein écran est une fonction pure isolée dans `fullscreen.js`, câblée aux hooks d'événement DOM de q5 (`keyPressed`, `doubleClicked`) dans `sketch.js`.

**Tech Stack:** q5.js / q5play.js (globals, CDN), vitest (tests purs sans DOM), ESM.

---

## File Structure

- **Create** `fullscreen.js` — bascule plein écran pure (`toggleFullscreen(api)`). Aucune dépendance DOM ; reçoit l'objet q5 en paramètre.
- **Create** `tests/fullscreen.test.js` — test unitaire de la bascule avec un faux `api`.
- **Modify** `sketch.js` — `displayMode(MAXED, PIXELATED)` après `Canvas(...)`, câblage des hooks `keyPressed`/`doubleClicked`, ligne d'indice dans le lobby.
- **Modify** `index.html` — CSS body plein viewport, retrait du flex de centrage.

---

## Task 1: Module de bascule plein écran (pur, testé)

**Files:**
- Create: `fullscreen.js`
- Test: `tests/fullscreen.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/fullscreen.test.js` :

```js
import { describe, it, expect, vi } from 'vitest';
import { toggleFullscreen } from '../fullscreen.js';

describe('toggleFullscreen', () => {
  it('passe en plein écran depuis le mode fenêtré', () => {
    const api = { fullscreen: vi.fn(() => false) };
    toggleFullscreen(api);
    expect(api.fullscreen).toHaveBeenLastCalledWith(true);
  });

  it('sort du plein écran quand il est actif', () => {
    const api = { fullscreen: vi.fn(() => true) };
    toggleFullscreen(api);
    expect(api.fullscreen).toHaveBeenLastCalledWith(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- fullscreen`
Expected: FAIL — `Failed to resolve import "../fullscreen.js"` (le module n'existe pas).

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `fullscreen.js` :

```js
// Bascule l'état plein écran via l'API q5. Pure : aucune dépendance DOM,
// reçoit l'objet q5 (`api`) qui expose fullscreen() en lecture et écriture.
export const toggleFullscreen = (api) => api.fullscreen(!api.fullscreen());
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- fullscreen`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add fullscreen.js tests/fullscreen.test.js
git commit -m "feat(fullscreen): bascule plein écran pure et testée"
```

---

## Task 2: Câblage q5 + displayMode + indice lobby

**Files:**
- Modify: `sketch.js`
- Modify: `index.html`

> Pas de test unitaire : ce câblage dépend du DOM et du moteur q5. Validé en vérification manuelle (Task 3). Implémenter directement.

- [ ] **Step 1: CSS plein viewport dans `index.html`**

Remplacer la ligne `<style>` actuelle :

```html
  <style>body{margin:0;background:#000;display:flex;justify-content:center}</style>
```

par :

```html
  <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style>
```

Le centrage flex est retiré : `displayMode(MAXED)` gère lui-même le centrage et le letterbox.

- [ ] **Step 2: Importer la bascule dans `sketch.js`**

Ajouter l'import après la ligne `import { createGame, advance } from './game.js';` (vers la ligne 14) :

```js
import { toggleFullscreen } from './fullscreen.js';
```

- [ ] **Step 3: Activer `displayMode` après la création du canvas**

Dans `sketch.js`, juste après les lignes :

```js
  await Canvas(W * SCALE, H * SCALE);
  world.gravity.y = 0;
  pixelDensity(1);
  noSmooth();
```

ajouter :

```js
  displayMode(MAXED, PIXELATED); // remplit le parent, letterbox, pixels nets
```

- [ ] **Step 4: Câbler les hooks de déclenchement**

Dans `sketch.js`, juste avant la ligne `q5.update = function () {` (vers la ligne 215), ajouter :

```js
  // Plein écran : F ou double-clic. Échap sort (natif navigateur).
  // Les hooks q5 s'exécutent dans la pile d'un vrai événement DOM, condition
  // requise par l'API Fullscreen (impossible depuis q5.update / rAF).
  q5.keyPressed = () => { if (key === 'f' || key === 'F') toggleFullscreen(q5); };
  q5.doubleClicked = () => toggleFullscreen(q5);
```

- [ ] **Step 5: Ajouter l'indice dans le lobby**

Dans `sketch.js`, branche `if (game.state === 'LOBBY')`, ajouter une ligne au
tableau passé à `drawCenter` (après la ligne `canStart(slots) ? ... : ...`) :

```js
        canStart(slots) ? 'ENTREE : demarrer' : 'minimum 2 joueurs',
        'F ou double-clic : plein ecran',
      ]);
```

- [ ] **Step 6: Vérifier que la suite de tests passe toujours**

Run: `npm test`
Expected: PASS (tous les tests existants + les 2 de Task 1 ; aucune régression).

- [ ] **Step 7: Commit**

```bash
git add sketch.js index.html
git commit -m "feat(fullscreen): displayMode MAXED/PIXELATED + bascule F/double-clic"
```

---

## Task 3: Vérification manuelle dans le navigateur

**Files:** aucun (validation runtime)

> q5/q5play est chargé depuis le CDN et requiert WebGPU ; ces comportements ne
> sont pas couverts par vitest. Cette tâche valide le rendu réel et confirme les
> noms d'API q5 (`MAXED`, `PIXELATED`, `doubleClicked`).

- [ ] **Step 1: Lancer le serveur de dev**

Run: `npm run dev`
Ouvrir l'URL affichée (Vite) dans un navigateur compatible WebGPU.

- [ ] **Step 2: Dérouler la checklist**

1. Au chargement : le canvas remplit la fenêtre du navigateur, pixels nets, ratio 16:9 préservé (letterbox si la fenêtre n'est pas 16:9).
2. Appuyer sur **F** ⇒ plein écran. Re-appuyer sur **F** ⇒ retour fenêtré.
3. Double-cliquer sur le canvas ⇒ bascule plein écran de la même façon.
4. En plein écran, **Échap** ⇒ retour fenêtré.
5. Redimensionner la fenêtre ⇒ le jeu se réajuste sans déformation.
6. Le rendu reste net à toutes les tailles (pas de flou de mise à l'échelle).
7. Le lobby affiche bien la ligne « F ou double-clic : plein ecran ».

- [ ] **Step 3: Si un nom d'API q5 diffère**

Si la console signale un identifiant indéfini (ex. `MAXED`, `PIXELATED`,
`doubleClicked` introuvables), corriger contre l'API q5 réelle (cf. `q5.d.ts`),
relancer la checklist, puis committer le correctif :

```bash
git add sketch.js
git commit -m "fix(fullscreen): aligne les noms d'API q5"
```

(Si tout passe du premier coup, aucun commit ici.)

---

## Self-Review

- **Couverture spec :** mise à l'échelle (Task 2 step 3) ✓ ; déclencheur F + double-clic (Task 2 step 4) ✓ ; mode fenêtré remplit la fenêtre (Task 2 step 1 + step 3) ✓ ; module testable (Task 1) ✓ ; indice lobby (Task 2 step 5) ✓ ; vérif manuelle (Task 3) ✓. Hors périmètre respecté (aucun bouton/persistance/manette).
- **Placeholders :** aucun — tout le code est explicite.
- **Cohérence des types :** `toggleFullscreen(api)` défini en Task 1 et appelé avec `q5` en Task 2 ; signature `api.fullscreen()` lecture/écriture cohérente entre test et usage.
