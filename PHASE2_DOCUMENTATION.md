# Phase 2 Documentation: Core Juice

## 1. Overview
Phase 2 expanded the foundation of **Base Defense Tycoon** by adding the core gameplay loop and the "hyper-casual juice" that defines the game's feel. This phase introduced enemies, an auto-combat system, and the signature "Magnetic Harvest" and "Jelly Stack" resource collection mechanics.

## 2. Technical Architecture Additions
Phase 2 strictly adhered to the modular ES6 architecture established in Phase 1, introducing several new entities and data-driven systems.

- **`src/utils/ObjectPool.js`**: A new utility class for managing reusable Three.js objects to maintain 60FPS on mobile by preventing garbage collection spikes.
- **`src/config/gameConfig.js`**: Expanded with `ENEMY_CONFIG`, `COMBAT_CONFIG`, and `STACK_CONFIG` to centralize all tunable values.

## 3. New Visual Entities

### Enemies (`src/entities/Enemy.js`)
- **Body**: Red cylinder representations of hostiles.
- **Visuals**: Emissive glowing red eyes for high contrast against the earthy Danger Zone.
- **State**: Tracks essential gameplay state (ALIVE, DYING, DEAD) and HP.

### Combat Assets
- **Projectile (`src/entities/Projectile.js`)**: Small, glowing white spheres fired by the player.
- **Aggro Ring (`src/entities/AggroRing.js`)**: A semi-transparent white ring geometry attached to the player contextually visualizing the auto-combat range.

### Resources
- **Resource Disk (`src/entities/ResourceDisk.js`)**: Flat red cylinders representing collected "meat". Serve as both the physical drops on the floor and the elements in the player's stack.

## 4. Core Game Systems

### `EnemySystem`
- Handles periodic spawning of enemies at a configured distance (`spawnDistance`) outside the Safe Zone.
- AI Logic: Basic steering behavior where enemies calculate the vector toward the player, normalize it, and move at a constant speed, snapping their rotation to face the movement direction.

### `CombatSystem`
- **Auto-Targeting**: Continuously calculates the distance to all active enemies. If the closest enemy enters the `aggroRange`, it triggers firing.
- **Firing Mechanics**: Retrieves a projectile from the `ObjectPool`, calculates the directional vector to the target, and sets the projectile's velocity.
- **Collision Detection**: Simple distance-based hit-testing between projectiles and enemies. Upon hit, reduces HP. If HP zeroes, triggers the enemy death flow.

### `HarvestSystem` (Magnetic Harvest)
- Constantly polls distances between the player and loose `ResourceDisks` on the ground.
- When the player is within `pullRange`, it triggers the "Magnetic Harvest" mechanic.
- Uses `THREE.QuadraticBezierCurve3` to calculate a satisfying parabolic flight path (a high arc) from the ground to the player, updating the target in real-time if the player moves.

### `StackSystem` (Jelly Stack)
- Manages an array of collected disks on the player's back.
- **Physics-Based Trailing**: Calculates an "ideal" vertically aligned position for every disk in the stack based on its index. 
- Disks use `lerp` blending between following the exact path of the disk below it and aligning strictly to the ideal vertical stack. This configuration provides a stable base while allowing for a juicy, rubbery sway that doesn't collapse horizontally when the player moves quickly.
- **Scale Feedback**: Adds a "squash and stretch" scale pop animation to newly added disks.

## 5. UI Updates
- **`src/ui/HUD.js`**: A responsive HTML/CSS overlay built specifically to keep 2D information out of the WebGL canvas.
- Features the Meat Resource Counter with CSS keyframe-based `pop-bounce` animations triggered dynamically by state changes in the `StackSystem`.

## 6. Performance Optimization
- **Object Pooling**: Implemented pooling via `ObjectPool.js` for Enemies, Projectiles, and Resource Disks. By avoiding runtime `new` instantiations and `.dispose()` calls, the CPU load is dramatically reduced, minimizing stutter.
- **Math Optimization**: Reused existing vectors and used squared distances where possible to maintain performance during collision and distance checking.
