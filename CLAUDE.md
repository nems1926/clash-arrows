# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Greenfield.** The repository currently contains only `PRD_TowerFall_like_q5play.md` — no code has been written yet. The PRD is the source of truth for *what* to build: an original arena archery fighter inspired by *TowerFall Ascension* (local 1–4 player versus, one-hit kills, limited arrows, dodge-to-catch, toroidal screen wrap), built in JavaScript with **q5play.js**.

When implementing, read the relevant PRD section first. Key sections: §5 functional specs (movement/shooting/dodge values to calibrate), §9 technical architecture, §10 milestone phasing, §11 game-feel acceptance criteria.

## Tech stack & running

This project follows the same setup as the sibling q5js projects (`../cassebrique`, `../animation`):

- **q5play.js** — game engine over q5.js (WebGPU rendering) + Box2D v3 (WASM physics). Loaded from CDN in `index.html`, *not* installed via npm. q5play exposes globals (`Sprite`, `Group`, `Canvas`, `world`, `kb`, `mouse`, …) without imports.
- Game code lives in `sketch.js` as an ES module (`<script type="module">`). The CDN setup needs an importmap for `box2d3-wasm` — copy the `<script>`/`<importmap>` block from `../cassebrique/index.html`.
- **Run / dev:** open `index.html` directly, or `npm run dev` (Vite, the only dev dependency) for live reload. No build step, no test framework is set up.
- WebGPU is required (q5.js v4). Detect availability at boot and show a fallback message if absent (PRD §9.7, §12).

## Conventions (match the existing projects)

- **Centered-origin coordinate system:** (0,0) is the canvas center; positive Y is down. A sprite's x/y is its *center*, not its top-left corner.
- Constants in UPPER_CASE, variables and functions in lowercase, classes in PascalCase.
- Work in **low logical pixel resolution** (e.g. 320×180 or 426×240) scaled up with nearest-neighbor for crisp pixel art (PRD §8, §9.7).

## Core architecture decisions (from PRD §9 — read before building movement/physics)

The single most important technical decision: **do NOT drive archer/arrow movement with Box2D dynamic bodies.** Tight platformers need deterministic control (variable jump height, wall-slide, coyote time, stomp, clean screen wrap) that a generic rigid-body solver fights against. Instead:

- **Custom kinematic movement:** integrate position/velocity by hand; resolve collisions against a **tile grid** with separated-axis AABB (resolve X, then Y). Configure q5play colliders as `KINEMATIC` so the engine doesn't apply `world.gravity` or dynamic forces to gameplay entities. Use Box2D/dynamic bodies only for cosmetic extras (explosion debris).
- **Fixed-timestep logic loop** (e.g. 60 Hz) decoupled from rendering, for reproducible game feel.
- **Toroidal wrap (§5.5):** positions are modulo'd over logical width/height. This needs *ghost rendering* near edges (draw the entity on both sides during transition) and collision continuity across the seam — a known bug hotspot, prototype it early.

**Entity organization (§9.2):** one `Group` per category — `players`, `arrows`, `pickups`, `enemies`, `terrain` (solid tiles), `oneWay`. Each archer and each arrow is a Sprite plus an explicit **state machine** (archer: grounded/airborne/wall/dodging/dead; arrow: in-flight/stuck/pickup-able). Arrow *types* (§5.6) are pluggable behaviors.

**Collisions/interactions (§9.3):** use q5play group overlaps for `arrows↔players` (death / catch-during-dodge / shield), `players↔players` (stomp = vertical-from-above + downward velocity), `players↔pickups`. Use custom resolution (not physics) for movement vs `terrain`/`oneWay` and for arrow planting. Explosions are a one-shot radius distance-test, not a persistent body.

**Global game-state machine (§9.6):** `Boot → Title → ModeSelect → Lobby → MatchSetup → Round(Playing → RoundEnd) → MatchEnd`. Each state owns its update/draw; the fixed-step gameplay loop lives inside `Round`.

**Input abstraction (§9.4):** map each player to an input source (keyboard zone 1/2, gamepad 1/2…) via a rebindable table. Separate raw input from abstract *intentions* (`left/right/up/down/jump/shoot/dodge/aim` 8-direction) so gamepads, rebinding, and future AI all share one path.

**Levels are data-driven (§9.5):** arenas are JSON — logical dimensions, tile grid, and layers (`solid`, `oneWay`, `playerSpawns`, `pickupSpawns`) plus metadata. Adding an arena must not require code changes.

**Performance (§9.7):** pool/recycle arrow and particle sprites instead of create/destroy per frame.

## Build order (PRD §10 milestones)

Build in this sequence; each milestone has an explicit acceptance gate:

0. **Spike** — one archer: move, variable jump, wall-slide, gravity, **screen wrap**, tilemap collision. Gate: movement *feels good*.
1. **Minimal combat** — normal arrow (ballistic, 8-dir), plant + pickup, dodge with catch window, death by arrow, stomp. Gate: a working 1v1.
2. **Playable versus (MVP)** — 2–4 players, keyboard + gamepad, rounds + score, 2–3 arenas, arrow HUD, fast restart, bomb arrow + 1 power-up. Gate: a versus session holds up.
3. Content (more arrow types, power-ups, arenas, AI bots) → 4. Quest/Trials modes → 5. Polish (audio, particles, menus).

Numeric values in §5 are **starting points to calibrate** — expose them as tunable parameters from the start (PRD §12 risk on game feel). Game-feel acceptance criteria are in §11.
