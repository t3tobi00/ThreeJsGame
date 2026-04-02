# Base Defense Tycoon — Project Documentation

## Game Overview

A hyper-casual 3D base defense tycoon built with Three.js. "Fake Ad" aesthetic — high saturation, bouncy animations, satisfying feedback loops. Isometric top-down perspective, virtual joystick controls, procedurally generated geometry (no external assets).

---

## Development History

### Phase 1: Foundation (Movement/Input)
- Three.js boilerplate: Renderer, Camera, Lighting, Scene
- Player entity (blue capsule mesh, squash-stretch)
- Virtual joystick (touch/mouse) with dead zone
- Frame-rate-independent movement system
- Modular architecture established (entities/, systems/, config/, ui/, utils/)

### Phase 2: Core Juice (Combat/Harvest)
- Enemy spawning with simple steering AI toward player/base
- Auto-combat system: projectiles via ObjectPool, distance-based targeting
- Magnetic harvest: enemy death drops resource disks, Bezier arc flight to player
- Jelly stack: trailing lag, sway, squash/stretch (ResourceStack utility)
- HUD with animated resource counter and HP bar

### Phase 3: Base Building & Expansion
- Unlock zones with dashed borders and cost UI (CanvasTexture)
- Drain system: reverse vacuum, peels resources into zones
- Level system: zone-to-structure replacement with bounce animation
- Turret (auto-fires) and Wall (HP, damage flash) structures
- Particle system (pooled explosions)

### Phase 4: Selling System
- Selling table: player walks near, meat arcs from stack to table
- Villager NPCs: queue system, walk to table, buy meat, pay coins, exit
- Coin tray with stack animation
- Road visual (paved stones)
- ResourceStack utility: reusable spring-stack for all resource holders
- ResourceTransfer utility: reusable Bezier-arc flight animation

### Phase 5: ECS Migration (2026-04-01)
Full migration from legacy coupled systems to pure ECS architecture.

**What was done (10 tasks):**
1. EventBus pub/sub singleton (`src/core/EventBus.js`)
2. 9 JSON archetype files + ArchetypeLoader (`src/config/archetypes/`, `src/core/ArchetypeLoader.js`)
3. 12 new component definitions (Collector, Depositor, Trader, AgentAI, Tag, 6 anim components)
4. EntityFactory rewritten to read from JSON archetypes
5. StackSystem made ECS-driven (no player reference)
6. CollectorSystem replaced HarvestSystem (deleted)
7. DepositorSystem replaced SellingSystem (deleted)
8. AgentAISystem + TraderSystem replaced VillagerSystem + CoinSystem (deleted)
9. CombatSystem + EnemySystem made pure ECS, Player.js + Enemy.js OOP classes deleted
10. Final cleanup — TransactionSystem dead code removed

**Key architecture changes:**
- Systems communicate via EventBus events, never direct references
- Entity archetypes defined in JSON — new types require zero code
- All per-entity tunable values in `src/config/archetypes/*.json`
- `gameConfig.js` retained for global values (camera, renderer, wave timing, UI, zones)

**Event flow:**
```
EnemySystem emits entity:died
  -> CollectorSystem spawns disks, arcs to player, emits item:collected
    -> StackSystem adds to inventory, emits stack:changed
      -> HUD updates meat count
DepositorSystem (player near table) emits item:deposited
  -> TraderSystem sends front villager, emits trade:complete
    -> AgentAISystem exits villager, respawns new one
```

**Deleted files:** HarvestSystem.js, SellingSystem.js, VillagerSystem.js, CoinSystem.js, Player.js, Enemy.js, TransactionSystem.js

### Phase 6: Full Modularization (2026-04-01)
Converted all remaining hardcoded systems to data-driven architecture. New content (entities, resources, levels) now requires only JSON.

**What was done (14 tasks across 3 layers):**

Layer 1 — Foundations:
1. MeshPresets registry — named mesh builders (character, table, disk, coin, rock, tree, wall, turret, etc.)
2. All archetypes gain `mesh` field — EntityFactory uses MeshPresets instead of hardcoded mesh creation
3. ResourceRegistry + resources.json — data-driven resource definitions (meat, coin, wood)
4. CollectorSystem + TraderSystem use ResourceRegistry for mesh creation

Layer 2 — Refactors:
5. TraderSystem reads Trader component (`rate`, `gives`, `minStock`) instead of hardcoded values
6. AgentAISystem queue config moved to QUEUE_CONFIG in gameConfig.js
7. HealthSystem — tracks HP, emits entity:died, enables player death in future
8. Wall + Turret converted to ECS entities (archetypes + components, legacy classes deleted)

Layer 3 — New Architecture:
9. GridSystem — 2D numbered grid with adjacency detection and debug overlay
10. SceneLoader + level-1.json — data-driven level loading replaces hardcoded Environment.js
11. Component_UnlockZone + UnlockZoneSystem — multi-resource drain (simultaneous, partial funding)
12. BuildSystem — spawns buildings (one-time) or units (repeatable) on zone:funded
13. Final integration — main.js wired to new systems, legacy files deleted
14. Documentation update

**New files:** MeshPresets.js, ResourceRegistry.js, resources.json, GridSystem.js, SceneLoader.js, level-1.json, HealthSystem.js, UnlockZoneSystem.js, BuildSystem.js, Component_UnlockZone.js, unlock-turret.json

**Deleted files:** Wall.js, Turret.js, Environment.js, Road.js, UnlockZone.js, DrainSystem.js, LevelSystem.js, StorageNode.js, Villager.js, Component_TransactionLogic.js

**Key architecture additions:**
- `MeshPresets` — register named mesh builders, archetypes reference by name + color/scale overrides
- `ResourceRegistry` — JSON-defined resources, stamps `mesh.userData.resourceType` for identification
- `GridSystem` — numbered cells with row/col, adjacency, debug overlay for level design
- `SceneLoader` — reads level JSON, builds ground/fence/props/road, returns grid for system wiring
- Unlock zones support multi-resource costs, simultaneous draining, build (one-time) and spawner (repeatable) types

### Phase 8: Collision System + Safe Zone (2026-04-02)

Introduced physical collision for all solid entities and a full safe zone mechanic with health, enemy barrier, and zone-based combat rules.

---

#### Collision System

**Component_Collider** (pure data):
- `shape`: `'box'` or `'circle'`
- `width` / `depth`: box half-extents on XZ plane
- `radius`: circle radius
- `isStatic`: static bodies don't get pushed (walls, tables, fence)
- `isTrigger`: detects overlap without push (reserved for future zones)
- `disabled`: runtime flag — CollisionSystem skips disabled colliders (used by GateSystem when gate is open)

**CollisionSystem** — queries `['Transform', 'Collider']`:
- Partitions entities into static vs dynamic lists each frame
- Each dynamic entity is pushed out of every overlapping static entity
- Collision is 2D on XZ plane only (Y ignored)
- Supports `circle-box` (nearest-point push-out) and `box-box` (AABB shortest-axis push-out)
- Runs **last** in the system list — after movement and enemy AI — so positions are corrected after all movement is applied

**Fence collision design decision — edge-based, not cell-based:**
The original implementation created one full-size box per fence cell. This was wrong: fence logs only appear on the outer edges of fence cells (using `edgeMode: "outer"`), not filling the whole cell. The fix creates one thin box collider per fence edge, exactly where logs are drawn. Horizontal edges: `width=half, depth=0.15`. Vertical edges: `width=0.15, depth=half`. This means the player can walk up to the inner side of the fence without being blocked from the inside.

**Gate collider:** `gate.json` has a box collider. GateSystem sets `collider.disabled = true` when `openRatio > 0.8` (fully open) and re-enables it at `openRatio < 0.3`. CollisionSystem skips disabled colliders automatically.

**Archetypes with colliders:**

| Archetype  | Shape  | width | depth | radius | isStatic |
|------------|--------|-------|-------|--------|----------|
| player     | circle | —     | —     | 0.4    | false    |
| enemy      | circle | —     | —     | 0.4    | false    |
| wall       | box    | 1.0   | 0.4   | —      | true     |
| meat-table | box    | 1.0   | 1.0   | —      | true     |
| coin-tray  | box    | 1.0   | 1.0   | —      | true     |
| turret     | box    | 0.75  | 0.75  | —      | true     |
| gate       | box    | 4.0   | 0.5   | —      | true     |
| fence edge | box    | half or 0.15 | 0.15 or half | — | true |

---

#### Safe Zone System

**What the safe zone is:**
A rectangular grid-cell region defined by `{minRow, maxRow, minCol, maxCol}` in `level-1.json`. It has health. While active, it enforces three rules:
1. Enemies cannot enter the interior
2. Player cannot shoot out
3. Contact damage cannot pass through the boundary wall

**Why bounds, not fence cells:**
The zone is not tied to where fence logs happen to be placed. It is an abstract rectangular region anchored to the grid. This makes it expandable (just grow `maxRow`/`maxCol`) and lets it work even if the fence is partially destroyed or not yet built. Future zone types can reuse the same bounds concept.

**Component_SafeZone** (data):
- `health` / `maxHealth`: zone HP pool
- `bounds`: `{minRow, maxRow, minCol, maxCol}` — the rectangular zone boundary
- `active`: set to `false` when health reaches 0 (permanent until rebuilt)
- `fenceGroup`: THREE.Group reference — hidden when zone dies
- `fenceColliderIds`: array of ECS entity IDs for fence edge colliders — disabled when zone dies

`fenceGroup` and `fenceColliderIds` are not archetype-configurable — they are wired in `main.js` after `SceneLoader.load()` returns them.

**SafeZoneSystem** — queries `['SafeZone']`:

Rule 1 — **Player shooting disabled inside zone:**
System keeps `_playerWasInside` flag. Each frame it checks if player's grid cell is inside the zone bounds. On a state change (transition), it directly sets `shooter.enabled = false/true` on the player's Shooter component and emits `zone:player_entered` / `zone:player_exited`. No per-frame cost after transition — the zone drives state, not the player.

Why this design: the player shouldn't be able to shoot at enemies through the fence from inside. Disabling the Shooter component was chosen over destroying projectiles mid-flight because it's simpler, cheaper, and feels intentional (gun puts itself away when you step inside).

Rule 2 — **Enemy boundary damage:**
Each enemy at a boundary cell (`row == minRow/maxRow` or `col == minCol/maxCol`) drains zone health at 10 HP/sec. Enemies crowding the fence whittle down the zone over time. No individual fence log HP — all damage goes to the single zone health pool.

Rule 3 — **Enemy hard block:**
If an enemy somehow ends up strictly inside the zone (e.g. spawned wrong, numerical edge case), SafeZoneSystem pushes them to the nearest boundary edge. This is a belt-and-suspenders fix — the fence edge colliders (CollisionSystem) are the primary barrier.

**Enemy AI targeting inside zone (EnemySystem):**
When player is inside an active zone, chasing enemies no longer target `playerPos` directly. Instead each enemy targets `nearestBoundaryPoint(enemyPos)` — the nearest point on the zone's outer rectangle perimeter to that specific enemy. This means:
- Enemies naturally cluster at the closest fence segment
- They do not pathfind through the open gate even when it's open
- When zone dies, targeting reverts to player position immediately (same frame)

Why this matters: without this fix, enemies in chase state aim straight toward the player. The shortest path from outside often passes through the gate opening — so they'd walk in. Redirecting to the boundary point eliminates this without needing pathfinding.

**Contact damage blocked across boundary (ContactDamageSystem):**
Before checking range, the system checks whether attacker and target are on opposite sides of an active zone boundary (one inside, one outside). If so, damage is skipped. This prevents zombies pressing against the outer fence from dealing damage to a player standing against the inner fence — even if the physical distance is within `contact.range`.

**Zone death sequence (when health → 0):**
1. `zone.active = false`
2. `fenceGroup.visible = false` — logs disappear
3. All fence edge collider IDs → `collider.disabled = true`
4. Player `shooter.enabled = true` (unconditional re-enable)
5. `EventBus.emit('zone:destroyed')` — future systems can listen

After zone death: enemies chase player normally, contact damage resumes, fence is fully passable.

**Zone rebuild:** Not yet implemented. Planned as a player-cost action in a future phase.

---

#### Level changes (level-1.json)

- Fence top row fully closed: added `[10,13], [10,14], [10,15], [10,16]` — the base is now fully enclosed with a single gate opening at the south
- Meat-table entity removed (selling mechanic deferred)
- Two coin trays repositioned inside the base (`z: -5`)
- `safeZone` block added: `health: 200, bounds: {minRow:10, maxRow:19, minCol:10, maxCol:19}`

---

### Phase 7: Grid-Based Level Design (2026-04-02)
All level layout is now grid-cell-driven. Fence, gate, entities, and zones are placed by `[row, col]` coordinates in the level JSON.

**What was done:**
1. Grid coordinates switched from flat cell IDs to `[row, col]` — stable across grid expansion
2. Fence placement driven by cell array in level JSON with edge detection (outer/inner/both modes)
3. Door cells define gate gaps in the fence — Gate auto-aligns to outer edge
4. All assets sized to grid cells (cellSize=2): table=2×2 or 4×2, coin tray=2×2, unlock zone=2×2
5. Safe zone ground simplified to match rectangular fence layout
6. Debug overlay shows `row|col` labels (e.g., `15|17` = row 15, col 17)

**Grid coordinate system:**
- Coordinates use `[row, col]` format — both are whole numbers
- Debug overlay displays as `row|col` (pipe separator, not decimal)
- Stable across grid expansion — changing grid origin/size does NOT change existing coordinates
- All level design (fence, doors, entity placement) references `[row, col]`

**Fence JSON format:**
```json
"fence": {
    "cells": [[10,10], [10,11], [10,12], ...],
    "doorCells": [[19,13], [19,14], [19,15], [19,16]],
    "edgeMode": "outer"
}
```
- `edgeMode`: `"outer"` = logs only on outside edges, `"inner"` = inside only, `"both"` = all exposed edges
- Edge detection uses centroid of all barrier cells to determine inner vs outer

---

## Known Issues

- Unlock zones have no UI (no dashed lines, resource counts, or drain animation) — planned for next phase
- Turret projectiles miss moving enemies (no lead-target prediction)
- Trees/stones are raw meshes, not ECS entities (no player interaction yet)
- Safe zone has no HUD health bar — player cannot see zone HP
- Safe zone cannot be rebuilt after destruction — planned for future phase
- Enemy wander targets are not zone-aware (wandering enemies may pick a target inside the zone — SafeZoneSystem hard-blocks them but it looks abrupt)

---

## Current File Map

```
src/
  main.js                    — Bootstrap, render loop, system wiring
  config/
    gameConfig.js            — Global tunable values (camera, renderer, waves, UI, zones, queue)
    resources.json           — Resource type definitions (meat, coin, wood)
    archetypes/              — JSON entity definitions (player, enemy, villager, wall, turret, etc.)
    levels/
      level-1.json           — First level definition (grid, ground, fence, props, entities, zones)
  core/
    Renderer.js              — WebGLRenderer wrapper
    Camera.js                — Isometric camera + lerp follow
    Lighting.js              — Scene lighting
    Scene.js                 — Scene wrapper
    EventBus.js              — Pub/sub singleton
    ArchetypeLoader.js       — Loads + resolves JSON archetypes with inheritance
    MeshPresets.js           — Named mesh builder registry
    ResourceRegistry.js      — Resource type registry (creates meshes from resources.json)
    GridSystem.js            — 2D numbered grid with adjacency detection
    SceneLoader.js           — Loads level JSON, builds environment
  ecs/
    ECSManager.js            — Core ECS registry
    components/              — 20 component definitions (Transform, Movement, Health, UnlockZone, Collider, SafeZone, etc.)
  entities/
    EntityFactory.js         — Creates entities from JSON archetypes via MeshPresets
    Projectile.js            — Pooled projectile mesh
    ResourceDisk.js          — "Meat" drop mesh (legacy, may be unused)
    Gate.js                  — Animated gate
  systems/
    MovementSystem.js        — Joystick -> movement (ECS)
    CombatSystem.js          — Auto-fire + projectile collision (ECS)
    EnemySystem.js           — Spawn + steer enemies (ECS)
    CollectorSystem.js       — Magnetic harvest (ECS)
    StackSystem.js           — Jelly stack physics (ECS)
    DepositorSystem.js       — Player-to-table transfer (ECS)
    AgentAISystem.js         — Villager queue/movement (ECS)
    TraderSystem.js          — Buy/sell transactions (ECS, reads Trader component)
    HealthSystem.js          — HP tracking + entity death events
    UnlockZoneSystem.js      — Multi-resource drain into zones
    BuildSystem.js           — Spawn buildings/units on zone:funded
    CollisionSystem.js       — AABB + circle-box push-out (XZ plane, static vs dynamic)
    SafeZoneSystem.js        — Zone health, enemy barrier, player shooter toggle, zone death
    ContactDamageSystem.js   — Contact damage (zone-boundary-aware)
    CameraSystem.js          — Rubber-band camera follow
    ParticleSystem.js        — Pooled particle effects
  state/
    GameState.js             — Global state (resources, unlocks, progression)
  ui/
    Joystick.js              — Virtual joystick
    HUD.js                   — Resource counter, HP bar
    FloatingUI.js            — In-world floating text
  utils/
    ObjectPool.js            — Generic pool (acquire/release)
    ResourceStack.js         — Reusable vertical spring-stack
    ResourceTransfer.js      — Reusable Bezier-arc flight
```

---

## Phase 9: Planned (Not Started)

**Safe Zone:**
- Safe zone HUD health bar (player needs to see zone HP)
- Zone rebuild mechanic (player spends resources to restore fence + zone)
- Enemy wander AI zone-awareness (don't pick wander targets inside zone)
- Zone expansion — player unlocks additional grid rows/cols, bounds grow outward

**Combat:**
- Turret lead-target prediction (projectiles aim ahead of moving enemies)
- New enemy types: Speeder (fast, low HP), Tank (slow, high HP) — archetypes already defined in JSON
- Boss: Cylinder King
- Infinite wave generator with scaling difficulty

**Base Building:**
- Unlock zone UI: dashed borders, resource type icons, count display, drain animation
- Selling mechanic restored: meat-table + villager trading loop (was removed for safe zone focus)
- Wall repair mechanic
- Player upgrade zones

**World:**
- Trees/stones as ECS entities with player interaction
- Level progression (Lone Outpost → Dusty Junction → Neon Oasis → Sandstorm Siege)

---

## ECS Feature Development Guide

Every new feature follows the same 3-step pattern:

```
1. Define the data     → Add a Component (or reuse existing ones)
2. Define the behavior → Write a System that queries those components
3. Define the entity   → Add a JSON archetype that composes the components
```

Nothing else changes. No rewiring main.js, no touching other systems. Systems never know about each other — they only know about **components** and **events**.

### Adding New Entity Types (Zero Code)

Any entity variant = a JSON file in `src/config/archetypes/`. Example:

```json
// archetypes/ranged-enemy.json — enemy that shoots back at the player
{
  "extends": "enemy",
  "type": "RangedEnemy",
  "components": {
    "Shooter": { "fireRate": 1.5, "range": 8, "damage": 1, "faction": "enemy", "targetFactions": ["player"] }
  }
}
```

CombatSystem already queries `['Transform', 'Shooter']` and targets by faction — so ranged enemies work immediately with no code changes.

### Enemies Shooting Player

Player archetype already has `Health` component. Enemies just need `Shooter` added (see above). CombatSystem handles targeting via `targetFactions`. For game-over when player dies, add a small `HealthSystem` that:
- Listens to `entity:damaged` events
- Checks if player HP <= 0
- Emits `player:died` → triggers game over screen

### Unlock Zones (Buildings / NPC Spawning)

DrainSystem already drains resources from the player's stack into zones. Extend it:
- When a zone is fully funded, emit `zone:unlocked { zoneId, type }`
- A `BuildSystem` listens and calls `factory.create('turret', pos)` or `factory.create('villager-hut', pos)`
- New building types = new JSON archetypes. Zero code.

### Storage System

Already built — any entity with `InventoryStack` + `Tag` is a storage node. DepositorSystem auto-detects targets by tag. New storage types are just JSON:

```json
// archetypes/wood-chest.json
{
  "type": "WoodChest",
  "components": {
    "InventoryStack": { "maxCapacity": 30, "acceptsTypes": ["wood"] },
    "Tag": { "tags": ["chest", "storage"] }
  }
}
```

### New Transaction Types

`Trader` component supports `accepts`/`gives`/`rate`. A blacksmith that converts iron to swords:

```json
{ "Trader": { "accepts": "iron", "gives": "sword", "rate": 3, "minStock": 3 } }
```

TraderSystem handles the rest.

### Grid-Based Level Design (Implemented)

All level layout is driven by `level-1.json` and the grid coordinate system:

```json
{
  "grid": { "origin": { "x": -30, "z": -30 }, "cellSize": 2, "cols": 30, "rows": 30 },
  "fence": {
    "cells": [[10,10], [10,11], ...],
    "doorCells": [[19,13], [19,14], [19,15], [19,16]],
    "edgeMode": "outer"
  },
  "entities": [
    { "archetype": "meat-table", "cell": [10, 14], "gridSpan": [1, 2] }
  ],
  "unlockZones": [
    { "cell": [18, 12], "type": "build", "cost": { "meat": 20 }, "builds": "turret" }
  ]
}
```

- Grid coordinates `[row, col]` are stable across grid expansion
- Fence auto-detects which edges need logs (outer/inner/both)
- All assets sized to grid cells (cellSize=2)
- Enable debug overlay with `"debug": { "showGrid": true }` to see cell labels

### Expandable Walls and Area

Walls are already an archetype (`wall.json`). To make them expandable:
- Add a `Buildable` component: `{ "upgradeStages": [{ "hp": 10 }, { "hp": 25 }, { "hp": 50 }], "currentStage": 0 }`
- A `UpgradeSystem` listens to `zone:unlocked` or a new `upgrade:requested` event
- Each upgrade stage can change mesh scale, HP, and visual appearance
- Expanding the base area = unlocking new zones that push the buildable perimeter outward

### The Mental Model

```
Want new entity?     → Write a .json archetype file
Want new behavior?   → Write a System that queries components
Want new data shape? → Write a Component class
Want new level?      → Write a level .json with entity placements
Want to tune values? → Edit the .json archetype (no code changes)
```
