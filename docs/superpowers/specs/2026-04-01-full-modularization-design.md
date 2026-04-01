# Full Game Modularization — Design Spec

**Date:** 2026-04-01
**Goal:** Convert all remaining hardcoded systems to data-driven ECS architecture. After this work, new content (entities, resources, levels, structures, unlock zones) requires only JSON — no code changes.

**Approach:** Layered Build — 3 layers, each self-contained and testable.

---

## Layer 1: Foundations

### 1A — Mesh Presets System

**New file:** `src/core/MeshPresets.js`

A registry of named mesh builder functions. Each preset takes an options object and returns a `THREE.Object3D`.

**Built-in presets (migrated from existing code):**

| Preset | Source | Description |
|--------|--------|-------------|
| `character` | `EntityFactory._createCharacterMesh` | Capsule body + sphere head + eyes |
| `table` | `EntityFactory._createTableMesh` | Box surface |
| `disk` | `CollectorSystem._makeDiskMesh` | Flat cylinder (meat, wood, etc.) |
| `coin` | `TraderSystem._makeCoinMesh` | Thin cylinder |
| `rock` | `Environment.createProps` | Icosahedron with random scale |
| `dead-tree` | `Environment.createProps` | Trunk + 3 branch cylinders |
| `fence-log` | `Environment.createFence` | Small cylinder |
| `wall` | `Wall.js` | Box + cap detail |
| `turret` | `Turret.js` | Cylinder base + cannon |
| `unlock-zone` | `UnlockZone.js` | Plane with dashed border |

**API:**
```js
MeshPresets.register(name, builderFn)    // register a new preset
MeshPresets.create(name, options)        // create a mesh from preset + options
MeshPresets.has(name)                    // check if preset exists
```

**JSON archetype integration — new `mesh` field:**
```json
{
  "type": "Player",
  "mesh": { "preset": "character", "color": "0x3366ff" },
  "components": { ... }
}
```

**Changes:**
- `EntityFactory._createMesh()` → calls `MeshPresets.create(archetype.mesh.preset, archetype.mesh)`
- `EntityFactory._createCharacterMesh()`, `_createTableMesh()` → moved into MeshPresets as registered presets
- `MESH_COLORS` map in EntityFactory → deleted (colors now in archetype JSON `mesh` field)

### 1B — Resource Registry

**New file:** `src/core/ResourceRegistry.js`
**New config:** `src/config/resources.json`

Maps resource type names to visual definitions and metadata. Systems call `ResourceRegistry.createMesh(type)` instead of hardcoding geometry.

**resources.json:**
```json
{
  "meat": {
    "mesh": { "preset": "disk", "color": "0xff3333", "radius": 0.3, "height": 0.1 },
    "stackOffset": 0.22,
    "value": 1
  },
  "coin": {
    "mesh": { "preset": "coin", "color": "0xffdd00", "radius": 0.15, "height": 0.05 },
    "stackOffset": 0.12,
    "value": 1
  },
  "wood": {
    "mesh": { "preset": "disk", "color": "0x8B4513", "radius": 0.25, "height": 0.12 },
    "stackOffset": 0.20,
    "value": 1
  }
}
```

**API:**
```js
await ResourceRegistry.load()            // reads resources.json at startup
ResourceRegistry.get(type)               // returns { mesh, stackOffset, value }
ResourceRegistry.createMesh(type)        // creates mesh via MeshPresets, sets mesh.userData.resourceType
ResourceRegistry.types()                 // returns all registered type names
```

**Key detail:** Every mesh created by ResourceRegistry gets `mesh.userData.resourceType = type` stamped on it. This is how UnlockZoneSystem (Layer 3) identifies resource types in a mixed stack.

**Changes:**
- `CollectorSystem._makeDiskMesh()` → `ResourceRegistry.createMesh('meat')`
- `TraderSystem._makeCoinMesh()` → `ResourceRegistry.createMesh(trader.gives)`
- ObjectPool factory function → `() => ResourceRegistry.createMesh('meat')`
- Coins get pooled too (currently created fresh each time)
- `COIN_CONFIG.size`, mesh-related `STACK_CONFIG` values → moved into `resources.json`

**Untouched:** ResourceStack utility, InventoryStack component, stacking/wobble physics.

---

## Layer 2: Refactor Existing Systems

### 2A — Trading System Cleanup

**Goal:** TraderSystem reads from Trader component data instead of hardcoded values. Queue config moves to gameConfig.

**TraderSystem changes:**

Before (hardcoded):
```js
const meatToBuy = Math.min(3, tableInventory.stack.getCount());
const coinsToGive = Math.ceil(meatToBuy * (COIN_CONFIG.valuePerMeat || 1));
```

After (data-driven):
```js
const trader = ecs.getComponent(buyerId, 'Trader');
const meatToBuy = Math.min(trader.rate, tableInventory.stack.getCount());
const coinsToGive = Math.ceil(meatToBuy * ResourceRegistry.get(trader.gives).value);
```

Trader component fields now fully used:
- `accepts` → resource type to take from table
- `gives` → resource type to pay back
- `rate` → items per transaction
- `minStock` → minimum table stock to trigger trade

Coin creation uses ResourceRegistry:
```js
// Before: this._makeCoinMesh()
// After:  ResourceRegistry.createMesh(trader.gives)
```

`_makeCoinMesh()` deleted from TraderSystem.

**AgentAISystem changes:**

Queue constants move to `gameConfig.js`:
```js
export const QUEUE_CONFIG = {
    start: { x: 0, z: -12 },
    spacing: 1.8,
    tableApproach: { x: 0, z: -10.5 },
    exitTarget: { x: 0, z: -30 },
    arriveThreshold: 0.3
};
```

AgentAISystem imports QUEUE_CONFIG instead of top-level `const QUEUE_START = ...` etc.

**main.js changes:**

Initial villager spawn loop reads `VILLAGER_CONFIG.initialCount` (already defined in gameConfig but currently unused).

**Untouched:** State machine logic, EventBus events, queue advancement, respawn mechanics.

### 2B — Structure ECS Conversion

**Goal:** Convert Wall.js and Turret.js from legacy classes to ECS entities.

**Rewritten archetypes:**

```json
// wall.json
{
  "type": "Wall",
  "mesh": { "preset": "wall", "color": "0x888888" },
  "components": {
    "Health": { "hp": 100, "maxHp": 100 },
    "Tag": { "tags": ["wall", "structure", "static"] },
    "FlashAnim": { "color": "0xff0000", "duration": 0.15 }
  }
}

// turret.json
{
  "type": "Turret",
  "mesh": { "preset": "turret", "color": "0xaaaaaa" },
  "components": {
    "Health": { "hp": 50, "maxHp": 50 },
    "Shooter": { "fireRate": 0.8, "range": 12, "damage": 1, "targetFactions": ["enemy"] },
    "Tag": { "tags": ["turret", "structure", "static"] }
  }
}
```

**Responsibility migration:**

| Legacy | New ECS handler |
|--------|----------------|
| `Wall.takeDamage()` | `entity:damaged` event → HealthSystem |
| `Wall.destroy()` | `entity:died` event → remove mesh, destroy entity |
| `Turret.update()` targeting | CombatSystem (already queries `['Transform', 'Shooter']`) |
| `Turret.fire()` | CombatSystem (already handles projectile spawning) |
| Bounce-in animation | SpawnAnim component (future AnimSystem) |

**New system:** `HealthSystem.js`
- Queries `['Transform', 'Health']`
- Listens to `entity:damaged` events
- Decrements HP (respecting armor)
- Emits `entity:died` when HP <= 0
- Enables player death / game-over in the future

**Deleted files:** `Wall.js`, `Turret.js`

**LevelSystem.js changes:** Currently creates Wall/Turret instances directly. After conversion, calls `factory.create('wall', pos)` and `factory.create('turret', pos)`.

**UnlockZone.js — NOT converted here.** Deferred to Layer 3 where it's replaced by the grid-based UnlockZoneSystem.

---

## Layer 3: New Architecture

### 3A — Grid System

**New file:** `src/core/GridSystem.js`

A 2D grid mapping numbered cells to world positions with adjacency detection.

**Grid definition (in level JSON):**
```json
{
  "grid": {
    "origin": { "x": -9, "z": -9 },
    "cellSize": 2,
    "cols": 10,
    "rows": 10
  }
}
```

Cell numbering (left-to-right, top-to-bottom):
```
 0  1  2  3  4  5  6  7  8  9
10 11 12 13 14 15 16 17 18 19
20 21 22 23 24 25 ...
```

**API:**
```js
grid.cellToWorld(cellId)     → THREE.Vector3 (center of cell)
grid.worldToCell(pos)        → cellId (nearest)
grid.getRow(cellId)          → row number
grid.getCol(cellId)          → column number
grid.getNeighbors(cellId)    → [up, down, left, right] cell IDs
grid.areAdjacent(a, b)       → boolean
grid.getCells(ids)           → [{ id, row, col, pos }]
```

**Debug overlay:** Semi-transparent grid on the ground plane with visible cell numbers. Toggled via `gameConfig.DEBUG_GRID`. Used during level design, hidden in production.

**Wall auto-connection via `WallConnectorSystem`:**

When walls are placed on adjacent cells, the system picks the correct mesh preset based on neighbor configuration:
- No adjacent walls → `"wall-post"`
- One side → `"wall-end"`
- Two opposite sides → `"wall-straight"`
- Two perpendicular sides → `"wall-corner"` (rotated to correct orientation)
- Three sides → `"wall-t-junction"`

Wall presets handle the visual shape. The system only picks which preset and rotation.

### 3B — Level JSON + SceneLoader

**New file:** `src/core/SceneLoader.js`

Reads a level JSON and spawns everything — replaces hardcoded Environment.js.

**Level JSON structure:**
```json
{
  "name": "Lone Outpost",
  "grid": {
    "origin": { "x": -9, "z": -9 },
    "cellSize": 2,
    "cols": 10,
    "rows": 10
  },
  "ground": {
    "safeZone": {
      "cells": [22,23,24,25,32,33,34,35,42,43,44,45],
      "color": "0x66cc66",
      "texture": "turf"
    },
    "dangerZone": { "size": 100, "color": "0xe6c280" }
  },
  "entities": [
    { "archetype": "wall", "cells": [10, 11, 12, 20, 30] },
    { "archetype": "gate", "cells": [13, 14] },
    { "archetype": "turret", "cells": [4] },
    { "archetype": "dead-tree", "cells": [71, 78, 85] },
    { "archetype": "rock", "cells": [62, 67, 93], "scatter": true }
  ],
  "spawners": {
    "villagerRoad": {
      "start": { "x": 0, "z": -24 },
      "tableCell": 5,
      "trayCell": 15
    },
    "enemies": {
      "spawnDistance": 35,
      "spawnInterval": 2
    }
  },
  "unlockZones": [
    { "cell": 40, "type": "build", "cost": { "meat": 15 }, "builds": "turret" },
    { "cell": 50, "type": "spawner", "cost": { "meat": 10, "wood": 10 }, "spawns": "archer", "count": 1 }
  ]
}
```

**SceneLoader flow:**
1. Load level JSON
2. Create GridSystem from grid config
3. Create ground planes from ground config
4. For each entity placement → `factory.create(archetype, grid.cellToWorld(cell))`
5. For wall groups → WallConnectorSystem auto-picks presets based on adjacency
6. For spawner config → configure EnemySystem, AgentAISystem with positions
7. For unlock zones → create UnlockZone ECS entities
8. Optionally render debug grid overlay

**Deleted/replaced:**
- `Environment.js` → replaced by SceneLoader + level JSON
- `Road.js` → road becomes a ground texture zone or entity in level JSON
- Hardcoded positions in main.js → all in level JSON

**main.js simplifies to:**
```js
const level = await SceneLoader.load('levels/level-1.json');
```

Multiple levels = multiple JSON files. Zero code changes.

### 3C — Unlock Zone System

**New component:** `Component_UnlockZone.js`

```js
class Component_UnlockZone {
    constructor({
        type = 'build',              // 'build' | 'spawner'
        cost = {},                    // { meat: 15, wood: 10 }
        drainRate = 0.15,            // seconds between drain ticks
        range = 3.0,                 // activation range
        builds = null,               // (build type) archetype name
        spawns = null,               // (spawner type) archetype name
        spawnCount = 1               // (spawner type) units per cycle
    } = {}) {
        this.type = type;
        this.cost = cost;
        this.progress = {};           // runtime: { meat: 0, wood: 0 }
        this.drainRate = drainRate;
        this.range = range;
        this.builds = builds;
        this.spawns = spawns;
        this.spawnCount = spawnCount;
        this.timeSinceLastDrain = 0;

        // Initialize progress counters from cost
        for (const key of Object.keys(cost)) {
            this.progress[key] = 0;
        }
    }
}
```

**New system:** `UnlockZoneSystem.js`
- Queries `['Transform', 'UnlockZone']`
- Each frame:
  1. Find nearby entities with `InventoryStack` (player or any carrier) within `zone.range`
  2. If carrier is in range and has matching resources:
     - Respect `drainRate` timing
     - For EACH resource type in `cost` that isn't fully funded:
       - Scan carrier's stack for `mesh.userData.resourceType === type`
       - Pop one matching mesh
       - Arc it to zone via ResourceTransfer (visual feedback)
       - Increment `progress[type]`
       - Emit `stack:changed` for carrier
     - All matching types drain simultaneously
  3. When ALL types in `progress` meet their `cost`:
     - Emit `zone:funded { zoneId, type, builds/spawns }`

**New system:** `BuildSystem.js`
- Listens to `zone:funded`
- **Build type:** `factory.create(zone.builds, zonePos)` → remove zone entity → emit `zone:built`
- **Spawner type:** spawn `zone.spawnCount` entities → reset `zone.progress` to zeros → zone stays → emit `zone:spawned`

**UI feedback:** Floating text showing progress per resource type (e.g., "5/15 meat  3/10 wood") via existing FloatingUI system.

**Archetype examples:**

```json
// archetypes/unlock-turret.json
{
  "type": "UnlockZone",
  "mesh": { "preset": "unlock-zone", "color": "0x00aaff" },
  "components": {
    "UnlockZone": {
      "type": "build",
      "cost": { "meat": 15 },
      "drainRate": 0.15,
      "range": 3.0,
      "builds": "turret"
    },
    "Tag": { "tags": ["unlock-zone"] }
  }
}

// archetypes/unlock-archers.json
{
  "type": "UnlockZone",
  "mesh": { "preset": "unlock-zone", "color": "0xff8800" },
  "components": {
    "UnlockZone": {
      "type": "spawner",
      "cost": { "meat": 10, "wood": 10 },
      "drainRate": 0.15,
      "range": 3.0,
      "spawns": "archer",
      "spawnCount": 1
    },
    "Tag": { "tags": ["unlock-zone"] }
  }
}
```

**Deleted/replaced:**
- `UnlockZone.js` legacy class
- `DrainSystem.js` → replaced by UnlockZoneSystem (same mechanic but multi-resource, ECS-driven)
- Unlock zone logic in `LevelSystem.js` → replaced by BuildSystem

---

## Summary: New / Modified / Deleted Files

### New Files
| File | Layer | Purpose |
|------|-------|---------|
| `src/core/MeshPresets.js` | 1A | Mesh preset registry |
| `src/core/ResourceRegistry.js` | 1B | Resource type registry |
| `src/config/resources.json` | 1B | Resource definitions |
| `src/systems/HealthSystem.js` | 2B | HP tracking, death events |
| `src/core/GridSystem.js` | 3A | 2D grid with adjacency |
| `src/systems/WallConnectorSystem.js` | 3A | Auto-connect wall presets |
| `src/core/SceneLoader.js` | 3B | Level JSON loader |
| `src/config/levels/level-1.json` | 3B | First level definition |
| `src/ecs/components/Component_UnlockZone.js` | 3C | Unlock zone data |
| `src/systems/UnlockZoneSystem.js` | 3C | Multi-resource drain |
| `src/systems/BuildSystem.js` | 3C | Build/spawn on zone funded |

### Modified Files
| File | Layer | Changes |
|------|-------|---------|
| `src/entities/EntityFactory.js` | 1A | Use MeshPresets, read `mesh` field from archetypes |
| `src/config/archetypes/*.json` | 1A | Add `mesh` field to all archetypes |
| `src/systems/CollectorSystem.js` | 1B | Use ResourceRegistry for mesh creation |
| `src/systems/TraderSystem.js` | 2A | Read Trader component, use ResourceRegistry |
| `src/systems/AgentAISystem.js` | 2A | Import QUEUE_CONFIG from gameConfig |
| `src/config/gameConfig.js` | 2A | Add QUEUE_CONFIG, use VILLAGER_CONFIG.initialCount |
| `src/config/archetypes/wall.json` | 2B | Rewrite with Health, Tag, mesh field |
| `src/config/archetypes/turret.json` | 2B | Rewrite with Shooter, Health, mesh field |
| `src/systems/LevelSystem.js` | 2B | Use factory.create instead of legacy classes |
| `src/main.js` | 3B | Replace manual setup with SceneLoader.load() |

### Deleted Files
| File | Layer | Reason |
|------|-------|--------|
| `src/entities/Wall.js` | 2B | Replaced by wall archetype + ECS |
| `src/entities/Turret.js` | 2B | Replaced by turret archetype + CombatSystem |
| `src/entities/Environment.js` | 3B | Replaced by SceneLoader + level JSON |
| `src/entities/Road.js` | 3B | Replaced by level JSON ground config |
| `src/entities/UnlockZone.js` | 3C | Replaced by UnlockZoneSystem |
| `src/systems/DrainSystem.js` | 3C | Replaced by UnlockZoneSystem |
| `src/entities/StorageNode.js` | 3B | Already unused (ECS meat-table replaced it) |
| `src/entities/CoinTray.js` | 3B | Already unused |
| `src/entities/MeatTable.js` | 3B | Already unused |
| `src/entities/Villager.js` | 3B | Already unused (legacy class) |
| `src/ecs/components/Component_TransactionLogic.js` | 2A | Dead code from ECS migration |

---

## Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mesh system | Presets + overrides (named builders in code, color/scale from JSON) | Balances flexibility with simplicity. New visual variants = register a preset function. |
| Resource entities | Pooled meshes, NOT full ECS entities | Performance — 50+ resources on screen. ResourceRegistry makes them data-driven without ECS overhead. |
| Grid addressing | Hybrid numbered cells with row/col internally | Quick reference by number for level design conversation, row/col for adjacency/auto-connect logic. |
| Unlock zones | Two types: build (one-time) and spawner (repeatable) | Covers tower placement and archer spawning. Extensible for future zone types. |
| Multi-resource drain | Simultaneous (all matching types at once) | Faster, more satisfying gameplay feel. |
| Wall auto-connection | WallConnectorSystem picks preset by neighbor config | Grid adjacency enables automatic corner/straight/T-junction selection. |
| UnlockZone.js timing | Deferred to Layer 3, not Layer 2 | Tightly coupled with grid system. Converting twice would be wasteful. |
| Resource type tagging | `mesh.userData.resourceType` | Lightweight — uses built-in Three.js field, no new components needed. |
