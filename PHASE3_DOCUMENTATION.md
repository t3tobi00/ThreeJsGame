# Phase 3 Documentation: Base Building & Expansion

## 1. Overview
Phase 3 introduced the "Reverse Vacuum" investment loop, allowing players to spend collected "Meat" resources to build base infrastructure. This layer of gameplay transitions the game from a pure arcade survival experience into a tycoon-style progression loop.

## 2. Technical Architecture
Strict adherence to the modular ES6 architecture continued, with the addition of several new systems and entities.

- **`src/state/GameState.js`**: Centralized state management for global resource tracking and level progression.
- **`src/ui/FloatingUI.js`**: A 3D-to-2D projection system that maps world coordinates of buildings to HTML/CSS labels for real-time cost feedback.
- **`src/systems/DrainSystem.js`**: Handles the rhythmic "peeling" of resources from the player stack into active construction sites.

## 3. New Entities & Visuals

### Unlock Zones (`src/entities/UnlockZone.js`)
- **Marching Ants Border**: A custom `ShaderMaterial` on a `TorusGeometry` that creates a spinning dashed line effect on the floor.
- **Hologram Previews**: Semi-transparent, wireframe versions of structures that spin and float within the zone using `MeshStandardMaterial` with emissive mapping.
- **State-Driven**: Zones transition from active construction to hidden once the resource cost reaches zero.

### Structures
- **Turret (`src/entities/Turret.js`)**: 
    - A modular sentry with a rotating head.
    - Features auto-targeting of the nearest enemy and a recoil animation when firing.
    - Connected to the `CombatSystem`'s projectile object pool.
- **Wall (`src/entities/Wall.js`)**: 
    - A physics barrier (block) with health and damage indicators (red flash).
- **Juicy Entry**: All structures use a "Back-out" easing scale animation (overshoot and settle) when they are "boinged" into existence.

## 4. Key Systems

### `LevelSystem`
- Defines the layout for each level, instantiating `UnlockZones` at specific coordinates.
- Orchestrates the transition from "Hologram Zone" to "Real Structure" upon completion.

### `ParticleSystem`
- A pooled point-based system that triggers white "pop" bursts when a building is completed, enhancing the tactile feedback of construction.

### `CombatSystem` (Updated)
- Now supports multi-owner firing. The system exposes a `spawnProjectile` utility, allowing both the player and multiple Turrets to share the same optimized object pool for projectiles.

## 5. UI & Polish
- **Floating HUD**: Strategic use of the `FloatingUI` class ensures that resource costs feel physically attached to the 3D world, maintaining a high-quality "hyper-casual" aesthetic without cluttering the screen mid-game.
- **Physics-Based Resource Flow**: When draining, resources follow a parabolic arc (Bezier-like) from the player's back into the center of the zone, mirroring the "Magnetic Harvest" mechanic from Phase 2.

## 6. Performance
- **Shader Optimization**: Marching ants effect is handled entirely on the GPU.
- **Math**: Reused existing Three.js vectors and matrices to avoid garbage collection during projection calculations in `FloatingUI`.
