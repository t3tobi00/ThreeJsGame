# Base Defense Tycoon - Project Memory

## 1. Project Overview & Aesthetic
- **Genre**: Hyper-casual 3D base defense tycoon game.
- **Tech Stack**: Vanilla Three.js (via CDN), ES6 modules, HTML/CSS for UI. NO heavy full-engine frameworks.
- **Target Aesthetic**: "Fake Ad" style — extremely high saturation, high contrast, smooth animations, wobbly/bouncy physics.
- **Performance Goal**: 60 FPS on mobile devices, achieved via object pooling and minimal draw calls.

## 2. Directory Structure & File System
The project strictly follows a modular ES6 architecture. Each file has a single responsibility.
- `index.html`: Entry point.
- `src/main.js`: Main bootstrap and render loop.
- `src/config/`: Configuration values (`gameConfig.js`). **Rule: All game-tunable values (colors, speeds, costs, ranges) live here. No magic numbers in code.**
- `src/core/`: Three.js boilerplate wrappers (`Renderer.js`, `Lighting.js`, `Camera.js`).
- `src/entities/`: 3D game objects containing their meshes, materials, and local state (e.g., `Player.js`, `Enemy.js`, `ResourceDisk.js`, `UnlockZone.js`, `Turret.js`, `Wall.js`).
- `src/systems/`: Data-driven logic layers that update entities every frame (e.g., `MovementSystem.js`, `CombatSystem.js`, `HarvestSystem.js`, `StackSystem.js`, `DrainSystem.js`, `LevelSystem.js`).
- `src/ui/`: 2D HTML/CSS overlays kept separate from the WebGL canvas (e.g., `Joystick.js`, `HUD.js`, `FloatingUI.js`).
- `src/state/`: Global state management (`GameState.js`) tracking resources, unlocked buildings, and level progression.
- `src/utils/`: Shared generic helpers like `ObjectPool.js` (crucial for mobile performance) and math utilities.

## 3. Core Mechanics & Systems (Completed up to Phase 3)

### Phase 1: Foundation (Boilerplate & Movement)
- **MovementSystem & Input**: A virtual dynamic joystick (`Joystick.js`) that appears on touch/click, converting 2D screen input into a frame-rate independent 3D movement vector for the player.
- **CameraSystem**: Isometric top-down rubber-band perspective. The camera uses a lerp function to follow the player with a soft trailing delay for a weighty feel.
- **Visual Feedback**: The player capsule uses dynamic squash-and-stretch scaling based on velocity, and instantly snaps rotation to the movement vector.

### Phase 2: Core Juice (Combat & Harvesting)
- **EnemySystem**: Spawns enemies (red cylinders) outside the Safe Zone. Enemies use basic steering AI to move toward the player or base.
- **CombatSystem**: An auto-combat logic. It continuously checks distances; if an enemy enters the `aggroRange`, the player auto-fires pooled projectiles (`Projectile.js`). Upon hit, enemy HP is reduced.
- **HarvestSystem (Magnetic Harvest)**: When an enemy dies, it drops `ResourceDisk` entities ("Meat"). The system polls distance to disks, and when the player is within `pullRange`, disks fly to the player along a parabolic Bezier arc (high arc) accelerating into the player.
- **StackSystem (Jelly Stack)**: Signature mechanic. Collected resources stack vertically on the player's back. Uses a lerp blend to create a trailing lag effect that sways on direction changes but remains stable. Includes squash-and-stretch scale pops when a new disk is added.

### Phase 3: Base Building & Expansion (Drain & Structures)
- **UnlockZones**: Defined square areas (dark green) with static dashed borders and in-world `CanvasTexture` UI denoting build costs.
- **DrainSystem**: The "Reverse Vacuum" loop. When the player stands on an Unlock Zone, movement is locked, and resources are rhythmically peeled off the player's stack into the structure, triggering a scale-pulse feedback loop on the counter.
- **Structures & LevelSystem**: Once a zone is fully funded, the `LevelSystem` replaces the zone with a physical structure using a bouncy scale-overshoot animation.
  - **Turret**: A modular sentry that hooks into the existing `CombatSystem` using multi-owner firing to shoot at enemies from the shared projectile pool.
  - **Wall**: A physical barrier blocking enemies, with health and damage flash effects.

## 4. Current State & Remaining Work (Phase 4 & 5)
- **Phase 1-3**: Fully implemented. Core survival loop + tycoon base-building loop are operational.
- **Selling System**: Fully implemented and bugfixed. Player carries meat → walks to table → meat flies to table → villagers queue on road → first villager approaches → buys meat → coins appear in tray → villager exits on road → new villager spawns.
- **Phase 4**: Setup level progression (The Lone Outpost -> The Dusty Junction -> The Neon Oasis -> The Sandstorm Siege). Introduce new enemy types (Speeders, Tanks), wall repair mechanics, and player upgrade zones (stack limits, fire rate).
- **Phase 5**: Boss implementation (Cylinder King), infinite wave generation, particle effects (explosions based on pooled particle systems), post-processing (bloom), and final mobile optimization passes.

## 5. Shared Utility Patterns (Reuse These)

### `src/utils/ResourceStack.js` — Vertical stacking with spring physics
Use for any resource that needs to stack vertically with wobble. Works in world space (scene children) and local space (group children).
```js
const stack = new ResourceStack({ stackOffset: 0.22, stiffness: 0.6, lerpFactor: 0.35, maxSize: 20 });
stack.add(mesh, { animate: true }); // add with pop-in
stack.pop();                         // remove top
stack.update(basePosition);          // call every frame
stack.clear(scene);                  // dispose all (pass group for local-space items)
```
Currently used by: StackSystem (player meat), CoinTray (coins), MeatTable (table meat), Villager (carried meat).

### `src/utils/ResourceTransfer.js` — Bezier-arc flight animation
Use for any resource that needs to fly from point A to point B with an arc. Caller adds mesh to scene; utility animates it; `onArrive` callback fires on landing.
```js
const transfer = new ResourceTransfer();
transfer.send(mesh, fromPos, toPos, { arcHeight: 3, duration: 0.5, spin: true, onArrive: (m) => stack.add(m) });
transfer.update(deltaTime); // call every frame
```
Currently used by: MeatTable (player stack → table surface).

### `src/config/gameConfig.js` — `SELLING_TABLE_POSITION`
Single source of truth for the selling table world position `{x:0, y:0.3, z:-9.2}`. Import this instead of hardcoding anywhere.

## 6. Coding Principles & Guidelines for LLMs (CRITICAL)
1. **No External Assets**: Use procedural geometry and Canvas-based textures. No external image loads to avoid async complexity unless necessary.
2. **Object Pooling**: For anything spawned repeatedly (projectiles, enemies, resource disks, particles), you MUST use `ObjectPool.js` instead of rapid `new` and `.dispose()`.
3. **Configuration first**: If you are adjusting a speed, color, scale, or count — do it in `config/gameConfig.js`. 
4. **Separation of Concerns**: Do not put AI logic inside an Entity file. Entities hold meshes and state (HP, Active). Systems hold logic (Updating position, calculating damage).
5. **Frame-Rate Independence**: Always multiply movement and animation deltas by time `dt` passed from the main render loop.
