# Jalon 0 — Spike de game feel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single controllable archer in a one-screen toroidal arena with tight, tunable movement (run, variable jump, wall-slide/jump, coyote/buffer/apex) and seamless screen wrap, to validate the game feel before any combat.

**Architecture:** Custom kinematic movement (no Box2D dynamic bodies). Pure functions for tile-grid AABB collision + wrap (Vitest-tested). The player is a pure reducer `updatePlayer(state, intent, cfg, grid, dt)` driven by a fixed-timestep (60 Hz) accumulator loop, decoupled from rendering. q5play provides only the canvas, keyboard, and per-frame callback.

**Tech Stack:** q5play.js (CDN, WebGPU), ES modules, Vite (dev server), Vitest (unit tests for pure functions).

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Loads q5play (CDN + importmap), the canvas host. |
| `package.json` | Vite + Vitest dev deps and scripts. |
| `config.js` | Logical constants (resolution, tiles) + `DEFAULT_CONFIG` tunables. Single source of truth for feel values. |
| `arena.js` | Arena "A" ASCII + `parseArena()` → grid + spawns (pure). |
| `tilemap.js` | Pure collision/wrap helpers: `wrap`, `cellAt`, `isSolidAt`, `resolveX`, `resolveY`, `wallContact`. |
| `input.js` | `readKeys()` (q5play `kb` adapter) + `computeIntent()` (pure mapping → abstract intentions). |
| `player.js` | `createPlayer()` + `updatePlayer()` pure reducer (state machine + kinematics). |
| `render.js` | `drawWorld()` — tiles + player + ghost rendering at wrap edges. |
| `debug.js` | `createDebug()` / `drawDebug()` — live sliders, state overlay, reset, copy. |
| `sketch.js` | Boot, WebGPU detection, wiring, fixed-timestep loop. |
| `tests/*.test.js` | Vitest unit tests for the pure modules. |

**Coordinate convention:** player `x,y` are **top-left** in logical pixels (0..320, 0..180). Grid cells encode `EMPTY=0, SOLID=1, ONEWAY=2`. Rendering translates the centered-origin q5 canvas to a top-left logical space scaled ×4.

---

## Task 1: Project scaffold + WebGPU boot

**Files:**
- Create: `package.json`, `index.html`, `config.js`, `sketch.js`, `tests/smoke.test.js`

- [ ] **Step 1: Write a smoke test (proves Vitest runs)**

`tests/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, TILE, COLS, ROWS } from '../config.js';

describe('config', () => {
  it('has a 32x18 grid of 10px tiles', () => {
    expect(TILE).toBe(10);
    expect(COLS).toBe(32);
    expect(ROWS).toBe(18);
  });
  it('exposes tunable defaults', () => {
    expect(DEFAULT_CONFIG.vMax).toBe(90);
    expect(DEFAULT_CONFIG.gravity).toBe(600);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails (no config yet)**

Run: `npx vitest run tests/smoke.test.js`
Expected: FAIL — cannot resolve `../config.js`.

- [ ] **Step 3: Create `config.js`**

```js
export const TILE = 10;
export const W = 320;
export const H = 180;
export const COLS = W / TILE; // 32
export const ROWS = H / TILE; // 18
export const PLAYER_W = 8;
export const PLAYER_H = 12;
export const SCALE = 4;

// All feel values are tunable live via the debug panel.
// Starting values from PRD §5.1.
export const DEFAULT_CONFIG = {
  vMax: 90,            // px/s   run target speed
  accel: 540,          // px/s²  ~10 frames to reach vMax
  decel: 540,          // px/s²  ground deceleration on release
  vJump: -150,         // px/s   jump impulse (negative = up)
  gravity: 600,        // px/s²
  vFallMax: 240,       // px/s   fall speed cap
  vSlide: 60,          // px/s   wall-slide fall cap
  wallJumpX: 120,      // px/s   horizontal wall-jump impulse
  wallJumpY: -150,     // px/s   vertical wall-jump impulse
  coyoteFrames: 6,
  bufferFrames: 6,
  apexGravityMult: 0.5,
  apexVyThreshold: 40, // px/s   |vy| below this gets reduced gravity
  jumpCutMult: 0.5,    // ascent cut on jump release
  // mirror the geometry so updatePlayer needs only cfg
  TILE, W, H, PLAYER_W, PLAYER_H,
};
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/smoke.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `package.json`**

```json
{
  "name": "towerfall-like",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 6: Install deps**

Run: `npm install`
Expected: creates `node_modules/`, `package-lock.json`.

- [ ] **Step 7: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TowerFall-like — Spike J0</title>
  <style>body{margin:0;background:#000;display:flex;justify-content:center}</style>

  <script type="module" src="https://q5js.org/q5.js"></script>
  <script type="importmap">
    { "imports": { "box2d3-wasm": "https://q5play.org/Box2D.deluxe.mjs" } }
  </script>
  <script type="module" src="https://q5play.org/q5play.js"></script>

  <script type="module" src="sketch.js"></script>
</head>
<body></body>
</html>
```

- [ ] **Step 8: Create `sketch.js` boot stub (WebGPU detection + empty arena draw)**

```js
import { W, H, SCALE } from './config.js';

if (!navigator.gpu) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:1rem">' +
    'WebGPU requis — ce navigateur est incompatible.</p>';
} else {
  await Canvas(W * SCALE, H * SCALE);
  world.gravity.y = 0;     // on gère la gravité nous-mêmes (cinématique custom)
  pixelDensity(1);
  noSmooth();              // pixel-perfect, pas de flou

  q5.update = function () {
    background('#0d1b2a');
  };
}
```

- [ ] **Step 9: Verify it boots**

Run: `npm run dev`, open the printed URL.
Expected: a dark blue (`#0d1b2a`) 1280×720 canvas, no console errors. (On a non-WebGPU browser: the fallback message instead.)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json index.html config.js sketch.js tests/smoke.test.js
git commit -m "feat(j0): project scaffold, config, WebGPU boot"
```

---

## Task 2: tilemap — wrap + cell lookup

**Files:**
- Create: `tilemap.js`, `tests/tilemap.test.js`

- [ ] **Step 1: Write failing tests for `wrap`, `cellAt`, `isSolidAt`**

`tests/tilemap.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { wrap, cellAt, isSolidAt } from '../tilemap.js';

const grid = [
  [0, 1, 0],
  [2, 0, 1],
];

describe('wrap', () => {
  it('wraps positive overflow', () => expect(wrap(325, 320)).toBe(5));
  it('wraps negative into range', () => expect(wrap(-3, 320)).toBe(317));
  it('leaves in-range values', () => expect(wrap(100, 320)).toBe(100));
});

describe('cellAt (modulo indexing)', () => {
  it('reads in-bounds cells', () => expect(cellAt(grid, 1, 0)).toBe(1));
  it('wraps column index', () => expect(cellAt(grid, 3, 0)).toBe(0)); // col 3 → 0
  it('wraps negative row', () => expect(cellAt(grid, 0, -1)).toBe(2)); // row -1 → 1
});

describe('isSolidAt', () => {
  it('true for solid', () => expect(isSolidAt(grid, 1, 0)).toBe(true));
  it('false for empty/oneway', () => {
    expect(isSolidAt(grid, 0, 0)).toBe(false);
    expect(isSolidAt(grid, 0, 1)).toBe(false); // oneway is not "solid"
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/tilemap.test.js`
Expected: FAIL — cannot resolve `../tilemap.js`.

- [ ] **Step 3: Implement `tilemap.js` (these three functions only)**

```js
export const EMPTY = 0;
export const SOLID = 1;
export const ONEWAY = 2;

export function wrap(value, max) {
  return ((value % max) + max) % max;
}

export function cellAt(grid, col, row) {
  const rows = grid.length;
  const cols = grid[0].length;
  const r = ((row % rows) + rows) % rows;
  const c = ((col % cols) + cols) % cols;
  return grid[r][c];
}

export function isSolidAt(grid, col, row) {
  return cellAt(grid, col, row) === SOLID;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/tilemap.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j0): tilemap wrap + modulo cell lookup"
```

---

## Task 3: arena — ASCII → grid + spawns

**Files:**
- Create: `arena.js`, `tests/arena.test.js`

- [ ] **Step 1: Write failing tests for `parseArena`**

`tests/arena.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseArena, ARENA_A } from '../arena.js';
import { SOLID, ONEWAY, EMPTY } from '../tilemap.js';

describe('parseArena', () => {
  it('maps characters to cell codes and collects spawns', () => {
    const { grid, spawns } = parseArena(['#=.', '..S']);
    expect(grid[0]).toEqual([SOLID, ONEWAY, EMPTY]);
    expect(grid[1]).toEqual([EMPTY, EMPTY, EMPTY]); // S is walkable space
    expect(spawns).toEqual([{ col: 2, row: 1 }]);
  });
});

describe('ARENA_A', () => {
  it('is 18 rows of 32 columns', () => {
    expect(ARENA_A).toHaveLength(18);
    for (const row of ARENA_A) expect(row).toHaveLength(32);
  });
  it('has at least one spawn', () => {
    expect(parseArena(ARENA_A).spawns.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/arena.test.js`
Expected: FAIL — cannot resolve `../arena.js`.

- [ ] **Step 3: Implement `arena.js`**

`#`=solid, `=`=one-way, `S`=spawn (walkable), `.`=empty. Layout A: ground both sides with a central hole (vertical wrap), side walls (wall-jump), a central floating platform, stacked one-way platforms, open side edges (horizontal wrap).

```js
import { SOLID, ONEWAY, EMPTY } from './tilemap.js';

// 32 columns × 18 rows. Row 0 = top.
export const ARENA_A = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '............========............', // 4  one-way (top center)
  '................................', // 5
  '................................', // 6
  '................................', // 7
  '............########............', // 8  solid floating platform
  '................................', // 9
  '................................', // 10
  '......========....========......', // 11 one-way (left + right)
  '................................', // 12
  '...#........................#...', // 13 walls
  '...#........................#...', // 14 walls
  '...#..S..................S..#...', // 15 walls + spawns
  '############........############', // 16 ground (central hole)
  '############........############', // 17 ground
];

export function parseArena(ascii) {
  const grid = [];
  const spawns = [];
  for (let r = 0; r < ascii.length; r++) {
    const row = [];
    for (let c = 0; c < ascii[r].length; c++) {
      const ch = ascii[r][c];
      if (ch === '#') row.push(SOLID);
      else if (ch === '=') row.push(ONEWAY);
      else {
        row.push(EMPTY);
        if (ch === 'S') spawns.push({ col: c, row: r });
      }
    }
    grid.push(row);
  }
  return { grid, spawns };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/arena.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add arena.js tests/arena.test.js
git commit -m "feat(j0): arena A data + parser"
```

---

## Task 4: tilemap — horizontal AABB resolution (`resolveX`)

**Files:**
- Modify: `tilemap.js`
- Modify: `tests/tilemap.test.js`

- [ ] **Step 1: Add failing tests for `resolveX`**

Append to `tests/tilemap.test.js`:
```js
import { resolveX } from '../tilemap.js';

// 4 cols × 3 rows; a solid wall in column 2.
const wallGrid = [
  [0, 0, 1, 0],
  [0, 0, 1, 0],
  [0, 0, 1, 0],
];
const TILE = 10;

describe('resolveX', () => {
  it('moves freely when nothing is hit', () => {
    const r = resolveX(wallGrid, 0, 0, 8, 8, 5, TILE);
    expect(r).toEqual({ x: 5, hit: false, wallDir: 0 });
  });
  it('snaps against a wall on the right', () => {
    // AABB w=8 moving right into column 2 (x from 12 → wants 18)
    const r = resolveX(wallGrid, 12, 0, 8, 8, 6, TILE);
    expect(r.x).toBe(20 - 8); // right edge flush to col 2 left edge (x=20)
    expect(r.hit).toBe(true);
    expect(r.wallDir).toBe(1);
  });
  it('snaps against a wall on the left', () => {
    // column 2 spans x[20,30]; AABB at x=30 moving left into it
    const r = resolveX(wallGrid, 30, 0, 8, 8, -6, TILE);
    expect(r.x).toBe(30); // left edge flush to col 2 right edge (x=30)
    expect(r.hit).toBe(true);
    expect(r.wallDir).toBe(-1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/tilemap.test.js`
Expected: FAIL — `resolveX` is not exported.

- [ ] **Step 3: Implement `resolveX` in `tilemap.js`**

```js
// Move an AABB (top-left x,y, size w,h) along X by dx, snapping to solids.
export function resolveX(grid, x, y, w, h, dx, TILE) {
  let nx = x + dx;
  const rowStart = Math.floor(y / TILE);
  const rowEnd = Math.floor((y + h - 0.001) / TILE);
  let hit = false;
  let wallDir = 0;
  if (dx > 0) {
    const col = Math.floor((nx + w - 0.001) / TILE);
    for (let r = rowStart; r <= rowEnd; r++) {
      if (isSolidAt(grid, col, r)) {
        nx = col * TILE - w;
        hit = true;
        wallDir = 1;
        break;
      }
    }
  } else if (dx < 0) {
    const col = Math.floor(nx / TILE);
    for (let r = rowStart; r <= rowEnd; r++) {
      if (isSolidAt(grid, col, r)) {
        nx = (col + 1) * TILE;
        hit = true;
        wallDir = -1;
        break;
      }
    }
  }
  return { x: nx, hit, wallDir };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/tilemap.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j0): horizontal AABB resolution"
```

---

## Task 5: tilemap — vertical AABB resolution (`resolveY`, solids)

**Files:**
- Modify: `tilemap.js`
- Modify: `tests/tilemap.test.js`

- [ ] **Step 1: Add failing tests for `resolveY` against solids**

Append to `tests/tilemap.test.js`:
```js
import { resolveY } from '../tilemap.js';

// 3 cols × 3 rows, floor along the bottom row.
const floorGrid = [
  [0, 0, 0],
  [0, 0, 0],
  [1, 1, 1],
];

describe('resolveY (solids)', () => {
  it('falls freely when nothing is hit', () => {
    const r = resolveY(floorGrid, 0, 0, 8, 8, 5, TILE, false, 8);
    expect(r).toEqual({ y: 5, hit: false, grounded: false });
  });
  it('lands on the floor and reports grounded', () => {
    // floor top is y=20; AABB h=8 falling from y=14 wants y=20
    const r = resolveY(floorGrid, 0, 14, 8, 8, 6, TILE, false, 22);
    expect(r.y).toBe(20 - 8); // bottom flush to floor top
    expect(r.hit).toBe(true);
    expect(r.grounded).toBe(true);
  });
  it('bonks head on a ceiling when moving up', () => {
    const ceil = [[1, 1, 1], [0, 0, 0], [0, 0, 0]];
    const r = resolveY(ceil, 0, 12, 8, 8, -6, TILE, false, 20);
    expect(r.y).toBe(10); // top flush to ceiling bottom (row 0 spans [0,10])
    expect(r.hit).toBe(true);
    expect(r.grounded).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/tilemap.test.js`
Expected: FAIL — `resolveY` is not exported.

- [ ] **Step 3: Implement `resolveY` (solids only for now)**

```js
// Move an AABB along Y by dy. `dropThrough` and `prevBottom` are used by
// one-way platforms (added in the next task); ignored for solids here.
export function resolveY(grid, x, y, w, h, dy, TILE, dropThrough, prevBottom) {
  let ny = y + dy;
  const colStart = Math.floor(x / TILE);
  const colEnd = Math.floor((x + w - 0.001) / TILE);
  let hit = false;
  let grounded = false;
  if (dy > 0) {
    const row = Math.floor((ny + h - 0.001) / TILE);
    for (let c = colStart; c <= colEnd; c++) {
      if (cellAt(grid, c, row) === SOLID) {
        ny = row * TILE - h;
        hit = true;
        grounded = true;
        break;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor(ny / TILE);
    for (let c = colStart; c <= colEnd; c++) {
      if (cellAt(grid, c, row) === SOLID) {
        ny = (row + 1) * TILE;
        hit = true;
        break;
      }
    }
  }
  return { y: ny, hit, grounded };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/tilemap.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j0): vertical AABB resolution vs solids"
```

---

## Task 6: tilemap — one-way platforms + wall contact

**Files:**
- Modify: `tilemap.js`
- Modify: `tests/tilemap.test.js`

- [ ] **Step 1: Add failing tests for one-way + `wallContact`**

Append to `tests/tilemap.test.js`:
```js
import { wallContact } from '../tilemap.js';

// one-way platform along the bottom row
const owGrid = [
  [0, 0, 0],
  [0, 0, 0],
  [2, 2, 2],
];

describe('resolveY (one-way)', () => {
  it('lands when falling from above', () => {
    const r = resolveY(owGrid, 0, 14, 8, 8, 6, TILE, false, 22); // prevBottom 22 ≤ top 20
    expect(r.y).toBe(20 - 8);
    expect(r.grounded).toBe(true);
  });
  it('passes through when rising from below', () => {
    const r = resolveY(owGrid, 0, 24, 8, 8, -6, TILE, false, 32);
    expect(r.hit).toBe(false); // upward movement never blocked by one-way
  });
  it('passes through when already overlapping (prevBottom below top)', () => {
    const r = resolveY(owGrid, 0, 18, 8, 8, 6, TILE, false, 27); // prevBottom 27 > top 20
    expect(r.hit).toBe(false);
  });
  it('drops through when dropThrough is true', () => {
    const r = resolveY(owGrid, 0, 14, 8, 8, 6, TILE, true, 22);
    expect(r.hit).toBe(false);
  });
});

describe('wallContact', () => {
  it('detects a solid to the right', () => {
    expect(wallContact(wallGrid, 11, 0, 8, 8, TILE)).toBe(1); // col 2 solid at x≥20
  });
  it('detects a solid to the left', () => {
    const g = [[1, 0, 0], [1, 0, 0], [1, 0, 0]];
    expect(wallContact(g, 10, 0, 8, 8, TILE)).toBe(-1);
  });
  it('returns 0 in open space', () => {
    expect(wallContact(floorGrid, 12, 0, 8, 8, TILE)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/tilemap.test.js`
Expected: FAIL — one-way not handled / `wallContact` missing.

- [ ] **Step 3: Replace `resolveY` with the one-way-aware version and add `wallContact`**

Replace the `resolveY` body's downward branch so it also lands on one-way platforms, then add `wallContact`:
```js
export function resolveY(grid, x, y, w, h, dy, TILE, dropThrough, prevBottom) {
  let ny = y + dy;
  const colStart = Math.floor(x / TILE);
  const colEnd = Math.floor((x + w - 0.001) / TILE);
  let hit = false;
  let grounded = false;
  if (dy > 0) {
    const row = Math.floor((ny + h - 0.001) / TILE);
    const tileTop = row * TILE;
    for (let c = colStart; c <= colEnd; c++) {
      const cell = cellAt(grid, c, row);
      const solid = cell === SOLID;
      // one-way: only when descending, not dropping, and we were above the top
      const oneWay = cell === ONEWAY && !dropThrough && prevBottom <= tileTop + 0.001;
      if (solid || oneWay) {
        ny = tileTop - h;
        hit = true;
        grounded = true;
        break;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor(ny / TILE);
    for (let c = colStart; c <= colEnd; c++) {
      if (cellAt(grid, c, row) === SOLID) {
        ny = (row + 1) * TILE;
        hit = true;
        break;
      }
    }
  }
  return { y: ny, hit, grounded };
}

// Returns -1 (solid on left), 1 (solid on right), or 0 (none).
export function wallContact(grid, x, y, w, h, TILE) {
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + h - 0.001) / TILE);
  const colR = Math.floor((x + w + 0.001) / TILE);
  const colL = Math.floor((x - 0.001) / TILE);
  let right = false;
  let left = false;
  for (let r = r0; r <= r1; r++) {
    if (isSolidAt(grid, colR, r)) right = true;
    if (isSolidAt(grid, colL, r)) left = true;
  }
  if (right) return 1;
  if (left) return -1;
  return 0;
}
```

- [ ] **Step 4: Run to confirm pass (all tilemap tests)**

Run: `npx vitest run tests/tilemap.test.js`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add tilemap.js tests/tilemap.test.js
git commit -m "feat(j0): one-way platforms + wall contact"
```

---

## Task 7: input — abstract intentions

**Files:**
- Create: `input.js`, `tests/input.test.js`

- [ ] **Step 1: Write failing tests for `computeIntent`**

`tests/input.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeIntent } from '../input.js';

const none = { left: false, right: false, up: false, down: false, jump: false };

describe('computeIntent', () => {
  it('maps left/right to moveX', () => {
    expect(computeIntent({ ...none, right: true }, none).moveX).toBe(1);
    expect(computeIntent({ ...none, left: true }, none).moveX).toBe(-1);
    expect(computeIntent({ ...none, left: true, right: true }, none).moveX).toBe(0);
  });
  it('detects jump press edge', () => {
    const prev = { ...none, jump: false };
    const now = computeIntent({ ...none, jump: true }, prev);
    expect(now.jumpPressed).toBe(true);
    expect(now.jumpHeld).toBe(true);
  });
  it('does not re-fire jumpPressed while held', () => {
    const prev = { jump: true };
    const now = computeIntent({ ...none, jump: true }, prev);
    expect(now.jumpPressed).toBe(false);
    expect(now.jumpHeld).toBe(true);
  });
  it('passes down through', () => {
    expect(computeIntent({ ...none, down: true }, none).down).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/input.test.js`
Expected: FAIL — cannot resolve `../input.js`.

- [ ] **Step 3: Implement `input.js`**

`readKeys` is a thin q5play `kb` adapter (not unit-tested — verified at runtime in Task 11). `computeIntent` is the pure, tested mapper.
```js
// q5play exposes `kb` as a global. Adjust key names here if the runtime
// check in Task 11 shows different identifiers.
export function readKeys() {
  return {
    left: kb.pressing('left') || kb.pressing('a') || kb.pressing('q'),
    right: kb.pressing('right') || kb.pressing('d'),
    up: kb.pressing('up'),
    down: kb.pressing('down') || kb.pressing('s'),
    jump: kb.pressing('space') || kb.pressing('w'),
  };
}

export function computeIntent(keys, prev) {
  const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return {
    moveX,
    jumpHeld: keys.jump,
    jumpPressed: keys.jump && !prev.jump && !prev.jumpHeld,
    down: keys.down,
  };
}
```

Note: `prev` may be either a raw keys object (`prev.jump`) or a prior intent (`prev.jumpHeld`); both are handled so the caller can pass back the previous keys.

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/input.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add input.js tests/input.test.js
git commit -m "feat(j0): input adapter + pure intent mapping"
```

---

## Task 8: player — core kinematics (run, gravity, collide, wrap)

**Files:**
- Create: `player.js`, `tests/player.test.js`

- [ ] **Step 1: Write failing tests for core movement**

`tests/player.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createPlayer, updatePlayer } from '../player.js';
import { DEFAULT_CONFIG } from '../config.js';

const DT = 1 / 60;
const cfg = () => ({ ...DEFAULT_CONFIG });

// floor along bottom row of a 4×4 grid (10px tiles → 40×40 px)
const grid = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [1, 1, 1, 1],
];

describe('player core', () => {
  it('accelerates horizontally toward vMax', () => {
    const p = createPlayer(10, 0, cfg());
    updatePlayer(p, { moveX: 1, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vx).toBeLessThanOrEqual(DEFAULT_CONFIG.vMax);
  });

  it('gains downward velocity from gravity while airborne', () => {
    const p = createPlayer(10, 0, cfg());
    const before = p.vy;
    updatePlayer(p, { moveX: 0, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    expect(p.vy).toBeGreaterThan(before);
  });

  it('caps fall speed at vFallMax', () => {
    const p = createPlayer(10, 0, cfg());
    for (let i = 0; i < 600; i++) {
      updatePlayer(p, { moveX: 0, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    }
    expect(p.vy).toBeLessThanOrEqual(DEFAULT_CONFIG.vFallMax + 0.001);
  });

  it('lands on the floor and becomes grounded', () => {
    const p = createPlayer(10, 0, cfg()); // bottom row top is y=30; player h=12
    for (let i = 0; i < 120; i++) {
      updatePlayer(p, { moveX: 0, jumpHeld: false, jumpPressed: false, down: false }, cfg(), grid, DT);
    }
    expect(p.grounded).toBe(true);
    expect(p.y).toBeCloseTo(30 - DEFAULT_CONFIG.PLAYER_H, 5);
  });

  it('wraps horizontally past the right edge', () => {
    const c = cfg();
    const p = createPlayer(c.W - 2, 0, c);
    p.vx = c.vMax;
    updatePlayer(p, { moveX: 1, jumpHeld: false, jumpPressed: false, down: false }, c, grid, DT);
    expect(p.x).toBeLessThan(c.W);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/player.test.js`
Expected: FAIL — cannot resolve `../player.js`.

- [ ] **Step 3: Implement `player.js` (core only)**

```js
import { resolveX, resolveY, wrap } from './tilemap.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export function createPlayer(x, y, cfg) {
  return {
    x, y,
    w: cfg.PLAYER_W, h: cfg.PLAYER_H,
    vx: 0, vy: 0,
    grounded: false,
    wallDir: 0,
    coyote: 0,
    buffer: 0,
    jumpHeldPrev: false,
    facing: 1,
    prevBottom: y + cfg.PLAYER_H,
    state: 'AIRBORNE',
  };
}

export function updatePlayer(p, intent, cfg, grid, dt) {
  // horizontal accel / decel
  if (intent.moveX !== 0) {
    p.vx = clamp(p.vx + intent.moveX * cfg.accel * dt, -cfg.vMax, cfg.vMax);
    p.facing = intent.moveX;
  } else {
    const drop = cfg.decel * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - sign(p.vx) * drop;
  }

  // gravity + fall cap
  p.vy = Math.min(p.vy + cfg.gravity * dt, cfg.vFallMax);

  // move + collide (separated axes)
  p.prevBottom = p.y + p.h;
  const rx = resolveX(grid, p.x, p.y, p.w, p.h, p.vx * dt, cfg.TILE);
  p.x = rx.x;
  if (rx.hit) p.vx = 0;
  const ry = resolveY(grid, p.x, p.y, p.w, p.h, p.vy * dt, cfg.TILE, intent.down, p.prevBottom);
  p.y = ry.y;
  p.grounded = ry.grounded;
  if (ry.hit) p.vy = 0;

  // toroidal wrap
  p.x = wrap(p.x, cfg.W);
  p.y = wrap(p.y, cfg.H);

  p.jumpHeldPrev = intent.jumpHeld;
  return p;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/player.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add player.js tests/player.test.js
git commit -m "feat(j0): player core kinematics + collision + wrap"
```

---

## Task 9: player — jump, wall-slide/jump, apex hang, FSM

**Files:**
- Modify: `player.js`
- Modify: `tests/player.test.js`

- [ ] **Step 1: Add failing tests for jump / coyote / buffer / variable / wall / apex / state**

Append to `tests/player.test.js`:
```js
const press = (over = {}) => ({ moveX: 0, jumpHeld: true, jumpPressed: true, down: false, ...over });
const idle = (over = {}) => ({ moveX: 0, jumpHeld: false, jumpPressed: false, down: false, ...over });

// a left wall in column 0, no floor reachable quickly
const wallGridP = [
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
];

describe('player jump & states', () => {
  it('jumps when grounded', () => {
    const p = createPlayer(10, 0, cfg());
    for (let i = 0; i < 120; i++) updatePlayer(p, idle(), cfg(), grid, DT); // settle on floor
    expect(p.grounded).toBe(true);
    updatePlayer(p, press(), cfg(), grid, DT);
    expect(p.vy).toBeLessThan(0); // moving up
  });

  it('allows a coyote jump shortly after leaving the ground', () => {
    const c = cfg();
    const p = createPlayer(10, 0, c);
    for (let i = 0; i < 120; i++) updatePlayer(p, idle(), c, grid, DT);
    p.grounded = false;           // simulate just walked off an edge
    p.coyote = c.coyoteFrames;
    updatePlayer(p, press(), c, grid, DT);
    expect(p.vy).toBeLessThan(0);
  });

  it('cuts ascent when the jump button is released (variable height)', () => {
    const c = cfg();
    const p = createPlayer(10, 0, c);
    p.vy = -150;
    p.jumpHeldPrev = true;
    updatePlayer(p, idle(), c, grid, DT); // released this frame, still ascending
    expect(p.vy).toBeGreaterThan(-150 * c.jumpCutMult - 50); // roughly halved (plus gravity)
    expect(p.vy).toBeLessThan(0);
  });

  it('wall-slides: caps fall speed when pushing into a wall', () => {
    const c = cfg();
    const p = createPlayer(10, 5, c); // x=10 → left edge flush to col 0 wall
    p.vy = c.vFallMax;
    updatePlayer(p, idle({ moveX: -1 }), c, wallGridP, DT);
    expect(p.vy).toBeLessThanOrEqual(c.vSlide + 0.001);
    expect(p.state).toBe('WALLSLIDE');
  });

  it('wall-jumps away from the wall', () => {
    const c = cfg();
    const p = createPlayer(10, 5, c);
    p.vy = 10;
    updatePlayer(p, press({ moveX: -1 }), c, wallGridP, DT);
    expect(p.vy).toBeLessThan(0);  // upward
    expect(p.vx).toBeGreaterThan(0); // pushed right, away from left wall
  });

  it('applies reduced gravity near the apex', () => {
    const c = cfg();
    const slow = createPlayer(10, 0, c); slow.vy = 0;           // |vy| < threshold
    const fast = createPlayer(10, 0, c); fast.vy = c.vFallMax;  // |vy| ≫ threshold
    updatePlayer(slow, idle(), c, grid, DT);
    const fastBefore = fast.vy;
    updatePlayer(fast, idle(), c, grid, DT);
    const slowGain = slow.vy - 0;
    const fastGain = Math.min(fast.vy, c.vFallMax) - fastBefore; // ~0 (capped) — compare against full step
    expect(slowGain).toBeLessThan(c.gravity * DT); // reduced, not full gravity
  });

  it('reports GROUNDED state on the floor', () => {
    const p = createPlayer(10, 0, cfg());
    for (let i = 0; i < 120; i++) updatePlayer(p, idle(), cfg(), grid, DT);
    expect(p.state).toBe('GROUNDED');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/player.test.js`
Expected: FAIL — jump/wall/apex/state behavior not implemented yet.

- [ ] **Step 3: Replace `updatePlayer` with the full version**

```js
export function updatePlayer(p, intent, cfg, grid, dt) {
  // 1. timers (one fixed step == one frame)
  p.coyote = p.grounded ? cfg.coyoteFrames : p.coyote - 1;
  p.buffer = intent.jumpPressed ? cfg.bufferFrames : p.buffer - 1;

  // 2. horizontal accel / decel
  if (intent.moveX !== 0) {
    p.vx = clamp(p.vx + intent.moveX * cfg.accel * dt, -cfg.vMax, cfg.vMax);
    p.facing = intent.moveX;
  } else {
    const drop = cfg.decel * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - sign(p.vx) * drop;
  }

  // 3. wall contact (pre-move probe)
  const wc = wallContact(grid, p.x, p.y, p.w, p.h, cfg.TILE);

  // 4. jump (ground / coyote) or wall-jump
  if (p.buffer > 0) {
    if (p.grounded || p.coyote > 0) {
      p.vy = cfg.vJump;
      p.buffer = 0;
      p.coyote = 0;
      p.grounded = false;
    } else if (wc !== 0) {
      p.vy = cfg.wallJumpY;
      p.vx = -wc * cfg.wallJumpX;
      p.buffer = 0;
    }
  }

  // 5. variable jump height: cut ascent on release
  if (p.jumpHeldPrev && !intent.jumpHeld && p.vy < 0) {
    p.vy *= cfg.jumpCutMult;
  }

  // 6. gravity with apex hang
  let g = cfg.gravity;
  if (Math.abs(p.vy) < cfg.apexVyThreshold) g *= cfg.apexGravityMult;
  p.vy = Math.min(p.vy + g * dt, cfg.vFallMax);

  // 7. wall slide: cap fall when pushing into a wall while airborne
  if (!p.grounded && wc !== 0 && intent.moveX === wc && p.vy > 0) {
    p.vy = Math.min(p.vy, cfg.vSlide);
  }

  // 8. move + collide (separated axes)
  p.prevBottom = p.y + p.h;
  const rx = resolveX(grid, p.x, p.y, p.w, p.h, p.vx * dt, cfg.TILE);
  p.x = rx.x;
  if (rx.hit) p.vx = 0;
  const ry = resolveY(grid, p.x, p.y, p.w, p.h, p.vy * dt, cfg.TILE, intent.down, p.prevBottom);
  p.y = ry.y;
  p.grounded = ry.grounded;
  if (ry.hit) p.vy = 0;

  // 9. toroidal wrap
  p.x = wrap(p.x, cfg.W);
  p.y = wrap(p.y, cfg.H);

  // 10. FSM state + remembered inputs
  if (p.grounded) p.state = 'GROUNDED';
  else if (wc !== 0 && intent.moveX === wc && p.vy > 0) p.state = 'WALLSLIDE';
  else p.state = 'AIRBORNE';
  p.wallDir = wc;
  p.jumpHeldPrev = intent.jumpHeld;
  return p;
}
```

Add the import for `wallContact` at the top of `player.js`:
```js
import { resolveX, resolveY, wallContact, wrap } from './tilemap.js';
```

- [ ] **Step 4: Run to confirm pass (all player tests)**

Run: `npx vitest run tests/player.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — tilemap, arena, input, player, smoke.

- [ ] **Step 6: Commit**

```bash
git add player.js tests/player.test.js
git commit -m "feat(j0): jump, coyote, buffer, wall-slide/jump, apex, FSM"
```

---

## Task 10: render — tiles + player

**Files:**
- Create: `render.js`

- [ ] **Step 1: Implement `render.js`**

q5 has a centered origin; translate to a top-left logical space scaled ×4, then draw in logical pixels (corner-mode rect).
```js
import { SOLID, ONEWAY } from './tilemap.js';
import { W, H, SCALE, TILE } from './config.js';

const COL = {
  bg: '#0d1b2a',
  solid: '#6b7280',
  oneway: '#38bdf8',
  player: '#4ade80',
};

export function drawWorld(grid, player, cfg) {
  background(COL.bg);
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2); // logical (0,0) at top-left
  scale(SCALE);
  noStroke();

  // tiles
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell === SOLID) {
        fill(COL.solid);
        rect(c * TILE, r * TILE, TILE, TILE);
      } else if (cell === ONEWAY) {
        fill(COL.oneway);
        rect(c * TILE, r * TILE + 1, TILE, 3); // thin top lip
      }
    }
  }

  // player (single copy for now; ghosting added next task)
  fill(COL.player);
  rect(player.x, player.y, player.w, player.h);

  pop();
}
```

- [ ] **Step 2: Manual smoke (wired in next task)**

No standalone run yet — `drawWorld` is exercised in Task 11. Confirm the file has no syntax errors:
Run: `node --check render.js`
Expected: no output (valid).

- [ ] **Step 3: Commit**

```bash
git add render.js
git commit -m "feat(j0): world + player renderer"
```

---

## Task 11: sketch — fixed-timestep loop (playable!)

**Files:**
- Modify: `sketch.js`

- [ ] **Step 1: Replace `sketch.js` with the full wiring + fixed-step loop**

```js
import { DEFAULT_CONFIG, W, H, SCALE } from './config.js';
import { ARENA_A, parseArena } from './arena.js';
import { createPlayer, updatePlayer } from './player.js';
import { readKeys, computeIntent } from './input.js';
import { drawWorld } from './render.js';

if (!navigator.gpu) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:1rem">' +
    'WebGPU requis — ce navigateur est incompatible.</p>';
} else {
  await Canvas(W * SCALE, H * SCALE);
  world.gravity.y = 0;
  pixelDensity(1);
  noSmooth();

  const cfg = { ...DEFAULT_CONFIG };
  const { grid, spawns } = parseArena(ARENA_A);
  const sp = spawns[0];
  const player = createPlayer(sp.col * cfg.TILE, sp.row * cfg.TILE, cfg);

  let prevKeys = { left: false, right: false, up: false, down: false, jump: false };
  const FIXED = 1 / 60;
  let acc = 0;

  q5.update = function () {
    acc += Math.min(deltaTime / 1000, 0.1); // clamp to avoid spiral of death
    while (acc >= FIXED) {
      const keys = readKeys();
      const intent = computeIntent(keys, prevKeys);
      updatePlayer(player, intent, cfg, grid, FIXED);
      prevKeys = keys;
      acc -= FIXED;
    }
    drawWorld(grid, player, cfg);
  };

  // expose for the debug panel (next tasks)
  globalThis.__game = { cfg, player };
}
```

- [ ] **Step 2: Run and verify it plays**

Run: `npm run dev`, open the URL.
Expected:
- Arena A renders (grey ground with a central gap, blue one-way lips, side walls).
- Green archer falls and lands on the floor.
- ←/→ (or Q/D) run; Space/W jumps with variable height; holding into a side wall while falling slows the descent; jumping off the wall pushes away.
- Falling into the central hole reappears at the top; running off a side reappears on the other side.

- [ ] **Step 3: If keys don't respond, fix `readKeys`**

Open the browser console and run `kb` to inspect available methods/keys; adjust the identifiers in `input.js` `readKeys()` (e.g. `' '` vs `'space'`). Re-run Task 7 tests after any change: `npx vitest run tests/input.test.js` (should still PASS — only `readKeys` changed).

- [ ] **Step 4: Commit**

```bash
git add sketch.js input.js
git commit -m "feat(j0): fixed-timestep loop — playable archer"
```

---

## Task 12: render — ghost rendering at wrap edges

**Files:**
- Modify: `render.js`

- [ ] **Step 1: Add ghost copies of the player across the seams**

Replace the player-drawing block in `drawWorld` with a 3×3 offset draw so the archer appears on both sides during a wrap transition:
```js
  // player + ghosts (draw at -W/0/+W and -H/0/+H offsets)
  fill(COL.player);
  for (const dx of [-W, 0, W]) {
    for (const dy of [-H, 0, H]) {
      rect(player.x + dx, player.y + dy, player.w, player.h);
    }
  }
```
(Only copies that fall within the logical 0..W / 0..H view are visible; the rest draw off-screen and are clipped — cheap for a single sprite.)

- [ ] **Step 2: Run and verify smooth wrap**

Run: `npm run dev`.
Expected: walking off the right edge, the archer is visible simultaneously on both edges mid-transition — no pop. Same vertically through the central hole.

- [ ] **Step 3: Commit**

```bash
git add render.js
git commit -m "feat(j0): ghost rendering for seamless wrap"
```

---

## Task 13: debug — state overlay

**Files:**
- Create: `debug.js`
- Modify: `sketch.js`

- [ ] **Step 1: Implement the overlay in `debug.js`**

```js
import { W, H, SCALE } from './config.js';

export function createDebug() {
  return { visible: true };
}

export function drawDebug(dbg, player, cfg) {
  if (!dbg.visible) return;
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  fill('#4ade80');
  textFont('monospace');
  textSize(14);
  textAlign(LEFT, TOP);
  const lines = [
    `état: ${player.state}`,
    `v: (${player.vx.toFixed(0)}, ${player.vy.toFixed(0)})`,
    `sol:${player.grounded ? '✔' : '✘'} mur:${player.wallDir}`,
    `coyote:${Math.max(0, player.coyote)} buf:${Math.max(0, player.buffer)}`,
  ];
  lines.forEach((l, i) => text(l, 6, 6 + i * 16));
  pop();
}
```

- [ ] **Step 2: Wire it into `sketch.js`**

Add the import near the others:
```js
import { createDebug, drawDebug } from './debug.js';
```
Create it after the player and draw it each frame. Replace the body of `q5.update`'s draw section so it reads:
```js
    drawWorld(grid, player, cfg);
    drawDebug(dbg, player, cfg);
```
And add, right after `const player = ...`:
```js
  const dbg = createDebug();
```

- [ ] **Step 3: Run and verify the overlay**

Run: `npm run dev`.
Expected: top-left text showing state, velocity, grounded/wall, coyote/buffer counters, updating live as you move.

- [ ] **Step 4: Commit**

```bash
git add debug.js sketch.js
git commit -m "feat(j0): live state overlay"
```

---

## Task 14: debug — live sliders, reset, copy

**Files:**
- Modify: `debug.js`
- Modify: `sketch.js`

- [ ] **Step 1: Extend `debug.js` with an HTML slider panel**

Replace `createDebug` and add a `PARAMS` table + buttons. Sliders mutate `cfg` in place (live tuning); Tab toggles the panel and the overlay together.
```js
import { W, H, SCALE } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

const PARAMS = [
  ['vMax', 0, 300], ['accel', 0, 2000], ['decel', 0, 2000],
  ['vJump', -400, 0], ['gravity', 0, 2000], ['vFallMax', 0, 600],
  ['vSlide', 0, 300], ['wallJumpX', 0, 400], ['wallJumpY', -400, 0],
  ['coyoteFrames', 0, 20], ['bufferFrames', 0, 20],
  ['apexGravityMult', 0, 1], ['apexVyThreshold', 0, 200], ['jumpCutMult', 0, 1],
];

export function createDebug(cfg) {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:0;right:0;background:rgba(0,0,0,.82);color:#cbd5e1;' +
    'font:11px monospace;padding:8px;z-index:10;max-height:100vh;overflow:auto';

  const valSpans = {};
  for (const [key, min, max] of PARAMS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin:2px 0';
    const label = document.createElement('span');
    label.textContent = key;
    label.style.width = '110px';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min; slider.max = max; slider.step = (max - min) / 200;
    slider.value = cfg[key];
    const val = document.createElement('span');
    val.textContent = cfg[key];
    val.style.width = '40px';
    slider.oninput = () => { cfg[key] = parseFloat(slider.value); val.textContent = cfg[key]; };
    valSpans[key] = { slider, val };
    row.append(label, slider, val);
    panel.append(row);
  }

  const reset = document.createElement('button');
  reset.textContent = 'R: reset';
  reset.onclick = () => {
    for (const [key] of PARAMS) {
      cfg[key] = DEFAULT_CONFIG[key];
      valSpans[key].slider.value = cfg[key];
      valSpans[key].val.textContent = cfg[key];
    }
  };
  const copy = document.createElement('button');
  copy.textContent = 'C: copier';
  copy.onclick = () => {
    const out = {};
    for (const [key] of PARAMS) out[key] = cfg[key];
    const text = JSON.stringify(out, null, 2);
    navigator.clipboard?.writeText(text);
    console.log('[config calibré]\n' + text);
  };
  panel.append(reset, copy);
  document.body.append(panel);

  const dbg = { visible: true, panel };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      dbg.visible = !dbg.visible;
      panel.style.display = dbg.visible ? 'block' : 'none';
    } else if (e.key === 'r' || e.key === 'R') {
      reset.onclick();
    } else if (e.key === 'c' || e.key === 'C') {
      copy.onclick();
    }
  });
  return dbg;
}
```
Keep `drawDebug` from Task 13 unchanged (it already guards on `dbg.visible`).

- [ ] **Step 2: Pass `cfg` into `createDebug` in `sketch.js`**

Change the creation line to:
```js
  const dbg = createDebug(cfg);
```

- [ ] **Step 3: Run and verify live tuning**

Run: `npm run dev`.
Expected:
- Slider panel on the right; dragging `gravity`/`vJump`/`vMax` changes the feel immediately.
- **Tab** hides/shows panel + overlay. **R** resets to defaults. **C** logs the calibrated values to the console and copies them to the clipboard.

- [ ] **Step 4: Commit**

```bash
git add debug.js sketch.js
git commit -m "feat(j0): live tuning panel (sliders, reset, copy)"
```

---

## Task 15: Acceptance validation (game-feel gate)

**Files:** none (manual validation against spec §"Critères d'acceptation du J0").

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all PASS (smoke, tilemap, arena, input, player).

- [ ] **Step 2: Walk the acceptance checklist in the browser**

Run: `npm run dev`, then confirm each:
1. Run accelerates/decelerates; jump height varies with how long Space is held.
2. Coyote time: jump fires just after running off a ledge. Jump buffering: pressing just before landing still jumps. Apex hang: noticeable float at the top of a jump.
3. Wall-slide on both side walls; wall-jump pushes away + up.
4. One-way platforms: land from above, rise through from below, drop through with ↓.
5. Horizontal wrap (run off a side) and vertical wrap (fall in the central hole) are smooth with ghost rendering.
6. Feel is unchanged whether the tab is at 60 fps or throttled (fixed timestep).
7. Disabling WebGPU shows the fallback message (optional: test in a non-WebGPU context).

- [ ] **Step 3: Calibrate and lock the feel**

Tune via the panel until the movement "feels good", press **C**, and paste the copied values into `DEFAULT_CONFIG` in `config.js`.

- [ ] **Step 4: Re-run tests (values changed)**

Run: `npm test`
Expected: PASS. (If a test asserted an exact default that you changed, update the assertion to match the new default.)

- [ ] **Step 5: Commit**

```bash
git add config.js
git commit -m "feat(j0): calibrated game-feel values — spike complete"
```

---

## Self-Review notes

- **Spec coverage:** scaffold/WebGPU (T1), resolution+grid+config (T1), arena data-driven (T3), wrap+modulo collision (T2/T4/T5/T6), one-way (T6), input abstraction (T7), run/jump/gravity/fall-cap (T8), coyote/buffer/variable/wall-slide/wall-jump/apex/FSM (T9), fixed-timestep loop (T11), tiles+ghost render (T10/T12), debug overlay+sliders+reset+copy (T13/T14), Vitest on pure functions (T2–T9), manual feel validation (T15). All spec sections map to a task.
- **Known simplification (documented):** cross-seam collision against *solid* tiles is not handled; arena A wraps through open space (central hole + open sides + no ceiling), so no snapping conflict arises. General cross-seam solid collision is out of scope for the spike.
- **Type consistency:** `resolveX`→`{x,hit,wallDir}`, `resolveY`→`{y,hit,grounded}`, `wallContact`→`-1|0|1`, `computeIntent`→`{moveX,jumpHeld,jumpPressed,down}`, player fields stable across T8/T9. `cfg` carries geometry (`TILE,W,H,PLAYER_W,PLAYER_H`) so `updatePlayer` needs no extra imports.
