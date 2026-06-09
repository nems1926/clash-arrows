# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

A working local multiplayer arena archery fighter inspired by *TowerFall Ascension*
(1–4 player versus, one-hit kills, limited arrows, dodge-to-catch, toroidal screen
wrap), built in JavaScript on **q5play.js**. Milestones 0→3 of the PRD are implemented;
fullscreen was the most recent feature.

What runs today (open `index.html`):
- 2–4 player versus on keyboard + gamepad, lobby → rounds → match-end loop.
- Custom kinematic platformer movement: variable jump, coyote/buffer, wall-slide,
  wall-jump, apex hang, toroidal wrap, separated-axis tile collision.
- Combat: 8-direction ballistic arrows, plant + pickup, dodge with catch window,
  death by arrow, stomp, spikes, destructible tiles, explosions.
- 6 arenas, 6 arrow types (normal / bomb / superbomb / laser / bolt / drill),
  arrow + shield pickups, arrow HUD, fullscreen toggle.

`PRD_TowerFall_like_q5play.md` remains the source of truth for *intent* and for
unbuilt content (more power-ups, AI bots, Quest/Trials modes, audio/particle polish —
PRD §10 milestones 4–5). Numeric feel values in PRD §5 are starting points; the live
ones are in `config.js` and tunable from the debug panel. Read the relevant PRD
section before extending a system.

## Tech stack & running

- **q5play.js** — game engine over q5.js (WebGPU rendering) + Box2D v3 (WASM). Loaded
  from CDN in `index.html` (`q5js.org/q5.js`, `q5play.org/q5play.js`, importmap maps
  `box2d3-wasm` → `q5play.org/Box2D.deluxe.mjs`). Not an npm dependency. q5play exposes
  globals (`Canvas`, `world`, `kb`, `contros`, `displayMode`, `q5`, …) without imports.
- **Box2D is effectively unused for gameplay.** `world.gravity.y = 0`; all archer/arrow
  motion is hand-integrated (see architecture below). q5play is used for the canvas,
  the render loop (`q5.update`), input globals, and fullscreen.
- **Run / dev:** open `index.html` directly, or `npm run dev` (Vite) for live reload.
  WebGPU is required (q5.js v4) — `sketch.js` checks `navigator.gpu` at boot and shows a
  fallback message if absent.
- **Tests:** `npm test` (vitest, `vitest run`) or `npm run test:watch`. ~140 tests across
  `tests/*.test.js`, one file per game module. **Keep them green.**

## Architecture (this is where the project diverges from the PRD — read this)

The PRD §9 sketched a Sprite/Group-per-category design. The implementation deliberately
went a different way, and the difference is the most important thing to understand:

**Gameplay logic is plain data objects + pure functions, with zero q5play/DOM/WebGPU
dependency.** Every game module (`player.js`, `arrow.js`, `tilemap.js`, `combat.js`,
`game.js`, `score.js`, `quiver.js`, `pickup.js`, `lobby.js`, `aim.js`, `input.js`,
`arena.js`, `fullscreen.js`) exports functions that take state in and return/mutate it —
e.g. `createPlayer(x,y,cfg)` + `updatePlayer(p, intent, cfg, grid, dt)`. This is what
makes the whole game unit-testable under Node/vitest without a browser. **Preserve this
boundary:** new gameplay rules go in a pure module with a test; only `sketch.js`,
`render.js`, `hud.js`, `debug.js`, and `input.js` may touch q5play globals.

- **`sketch.js` is the only orchestrator.** It owns the q5 boot, the fixed-timestep
  accumulator loop, the global game-state branching (LOBBY / PLAYING / ROUND_END /
  RESPAWN / MATCH_END), wires modules together, and runs every per-step interaction
  (arrow↔player, stomp, spikes, pickups, explosions). It holds no reusable logic worth
  testing — that all lives in the pure modules it calls.
- **Coordinates are top-left AABB in logical pixels.** A 320×180 logical grid (`config.js`
  `W`/`H`), `TILE = 10` → 32×18 cells. An entity's `x,y` is the **top-left corner** of its
  box (NOT the center). Only `render.js` bridges to q5's centered canvas:
  `translate(-W*SCALE/2, -H*SCALE/2); scale(SCALE)` so logical (0,0) draws at top-left.
  `SCALE = 4`, nearest-neighbor (`noSmooth()` + `displayMode(MAXED, PIXELATED)`).
- **Custom kinematic movement** (`player.js` + `tilemap.js`): integrate velocity by hand,
  resolve X then Y against the tile grid with separated-axis AABB. `tilemap.js` is the
  collision core (`resolveX`/`resolveY`/`wallContact`/`wrap` + arrow-vs-tile helpers).
- **Fixed-timestep 60 Hz** decoupled from rendering: `sketch.js` accumulates
  `deltaTime`, steps `stepPlaying()` in `FIXED = 1/60` slices (clamped against the spiral
  of death). One step == one frame; timers in `config.js` are in frames.
- **Toroidal wrap:** `wrap()` modulos positions over W/H; `tilemap` cell lookups and
  `combat.toroidalOverlap` wrap across the seam so fast arrows still register hits.
- **State machines as string fields, not classes.** Archer FSM
  (GROUNDED/AIRBORNE/WALLSLIDE/DODGING/DEAD) is derived each step at the end of
  `updatePlayer`. Arrow FSM (IN_FLIGHT/STUCK/EXPLODE/SPLIT) drives `arrow.updateArrow`;
  `sketch.js` reacts to EXPLODE/SPLIT. Global FSM lives in `game.advance`.
- **Arrow types are data** (`ARROW_TYPES` in `arrow.js`): a behavior table keyed by type
  string (`explosive`, `radiusMult`, `speedMult`, `bounces`, `splitCount`, `pierces`,
  `flat`). Add a type by adding a row + the branch that reads its flag — no new class.
- **Input is layered:** raw read (`readKeys`/`readGamepad`, keyboard or `contros[i]`) →
  normalized key shape → abstract `computeIntent` (moveX, jumpHeld/Pressed,
  shootPressed, dodgePressed, up/down). Movement, gamepads, and any future AI share the
  intent path. Each player is bound to a `source` (keyboard or gamepad index) in the lobby.
- **Arenas are ASCII data** (`arena.js`): rows of chars (`#` solid, `=` one-way,
  `%` destructible, `^` spike, `S` spawn, `P` pickup spawn) parsed by `parseArena` into a
  numeric grid + spawn lists. Adding an arena = adding an array to `ARENAS`. (Note: this is
  the ASCII form, not the JSON-layer form the PRD imagined — same goal, simpler shape.)
- **Pooling:** arrows use a fixed pool (`createPool`/`acquire`/`release` in `arrow.js`);
  no per-frame allocation. Explosions are transient `{x,y,r,life}` flashes + a one-shot
  radius test, not bodies.

`config.js` mirrors all geometry + feel constants into one `DEFAULT_CONFIG` object that
is threaded through every pure function as `cfg`, so logic never reaches for module-level
globals and tests can clone/override it freely.

`globalThis.__game` is exported from `sketch.js` for debugging/manual inspection.
`spritesheet/` holds generated art that is not yet wired in (rendering is still
primitives).

## Conventions

- Constants `UPPER_CASE`, variables/functions `lowercase`, would-be classes are factory
  functions returning plain objects (`createX`) — there are no ES classes in gameplay code.
- Low logical resolution (320×180) scaled ×4 nearest-neighbor for crisp pixel art.
- Comments are bilingual (English + French); match the surrounding file. Commit messages
  and the `docs/` specs/plans are in French.
- Every new gameplay module ships with a `tests/<module>.test.js`. Tests import the pure
  module directly — they never boot q5play.

## Workflow (how features get built here)

Per-milestone delivery, captured in `docs/superpowers/`:
**brainstorm → spec (`specs/<date>-<name>-design.md`) → plan
(`plans/<date>-<name>.md`) → subagent-driven implementation → `git merge --no-ff` to
`main`.** Specs and plans are the design record; read the matching pair before changing a
system that already has one. (`.superpowers/` working dir is gitignored.)

## Build order (PRD §10 milestones)

0. **Spike** ✅ — movement feel, screen wrap, tilemap collision.
1. **Minimal combat** ✅ — normal arrow, plant/pickup, dodge+catch, death, stomp.
2. **Versus MVP** ✅ — 2–4 players, keyboard + gamepad, rounds + score, arenas, HUD,
   fast restart, bomb arrow + power-up.
3. **Content** ✅ — extra arrow types, more arenas, spikes/destructibles, pickups.
4. **Quest/Trials modes** — not started. 5. **Polish** (audio, particles, menus) — not started.
AI bots and remaining power-ups (PRD §5/§10) are also still open.
