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
- **Flat Square Design**: Replaced circular zones with compact, dark-green square bases for a modern hyper-casual look.
- **Static Dash Pattern**: Custom `ShaderMaterial` renders a thick white dashed border with a "Corners & Middles" static pattern.
- **In-World UI**: Resource costs and icons are rendered directly on the floor via `CanvasTexture`, eliminating HTML/CSS overhead for zones.
- **Tactile Feedback**: Text planes feature a "Scale Pop" on resource drain, and structures use a "Back-out" scale animation (overshoot and settle) when completed.

### Structures
- **Turret (`src/entities/Turret.js`)**: 
    - Modular sentry with a rotating head and auto-targeting logic.
    - Shares the `CombatSystem` projectile pool for performance.
- **Wall (`src/entities/Wall.js`)**: 
    - Physics-blocking barrier with health and damage flash effects.

## 4. Key Systems

### `LevelSystem`
- Orchestrates the transition from "Unlock Zone" to "Structure" upon completion.
- Coordinates positions to prevent overlap between the new square zones.

### `DrainSystem`
- Handles the parabolic "peeling" of resources from the player stack into construction sites.
- Collision logic uses a forgiving proximity trigger based on `ZONE_CONFIG.size`.

### `ParticleSystem`
- pooled point-based system for "pop" bursts upon building completion.

### `CombatSystem` (Updated)
- Now supports multi-owner firing, allowing Turrets to utilize the existing player projectile pooling logic.

## 5. Visuals & Polish
- **Mobile Perspective**: Updated `CAMERA_CONFIG` to a steeper, tighter isometric view (FOV 35, top-down offset).
- **In-World Icons**: Uses Meat emojis and gold coins rendered directly into the 3D scene.

## 6. Performance
- **Resource Management**: Removed `FloatingUI` dependency for zones, reducing DOM complexity.
- **Shader Power**: Border patterns and animations are calculated on the GPU to maintain 60 FPS.
