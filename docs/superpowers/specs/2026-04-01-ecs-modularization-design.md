# ECS Modularization Design — Base Defense Tycoon
**Date:** 2026-04-01  
**Status:** Approved  
**Scope:** Full ECS migration of all game systems — shooting, harvesting, stacking, depositing, trading, villager AI

---

## 1. Problem

The current codebase has a hard coupling chain between legacy systems:

```
VillagerSystem → SellingSystem → StackSystem → Player (direct ref)
HarvestSystem  → enemySystem.onEnemyDeath (callback hook)
CombatSystem   → enemySystem.enemies (legacy array fallback)
```

No system can be reused. You cannot give a Turret a stack, give an Enemy a shooting behavior, or assign harvesting to a Villager — because each system is hardwired to a specific class. Tunable values are split between `gameConfig.js` and hardcoded inline numbers.

---

## 2. Goals

- Any behavior (shooting, collecting, stacking, depositing, trading) assignable to any entity
- All tunable values (speeds, ranges, sizes, rates, animation params) editable in JSON — no code changes
- New entity types (Speeder, Tank, Boss) defined in JSON with zero new code
- Game stays playable throughout the migration (incremental, not big-bang)
- Systems communicate via events, never via direct references

---

## 3. Approach: Behaviors-as-Presets + JSON Archetypes on Pure ECS

**B+C hybrid:**
- **Components** are pure data structs (the ECS already supports this via `ECSManager`)
- **Behaviors** are named presets (`"shooter"`, `"collector"`, `"stacker"`) that map to a bundle of components + default config
- **Archetypes** are JSON files (`archetypes/player.json`) that compose behaviors and override any component values
- **EventBus** decouples systems — they emit events, never call each other

**Component granularity:** Fine-grained — logic and animation are separate components. `FlyToAnim` is shared by both `CollectorSystem` (resources fly to player) and `DepositorSystem` (resources fly off player to table).

**Migration strategy:** Incremental — port one system at a time, delete legacy code after each port passes.

---

## 4. Component Library

### 4.1 Logic Components

| Component | Key Fields | Used By |
|---|---|---|
| `Transform` | `position`, `rotation`, `scale` | All entities |
| `Movement` | `speed`, `velocity`, `faction` | Player, Enemy, Villager |
| `Health` | `hp`, `maxHp`, `armor` | Player, Enemy, Wall |
| `Shooter` | `fireRate`, `range`, `damage`, `faction` | Player, Turret, Enemy (future) |
| `Collector` | `radius`, `resourceTypes[]`, `pullForce` | Player, Turret (future) |
| `InventoryStack` | `maxSize`, `items[]`, `stackOffset` | Player, Villager, MeatTable |
| `Depositor` | `range`, `targetTag`, `transferRate` | Player (near table) |
| `Trader` | `accepts`, `gives`, `rate`, `minStock` | Villager, MeatTable |
| `AgentAI` | `state`, `target`, `queueSlot`, `exitDist` | Villager, future NPCs |
| `Tag` | `tags: string[]` | All entities |

### 4.2 Animation Components

| Component | Key Fields | Reused By |
|---|---|---|
| `FlyToAnim` | `arcHeight`, `speed`, `easing` | `CollectorSystem` + `DepositorSystem` |
| `SpringStackAnim` | `wobble`, `squash`, `lag`, `offset` | All `InventoryStack` holders |
| `SquashStretch` | `intensity`, `frequency`, `trigger` | Player, projectile impact |
| `WalkAnim` | `bobHeight`, `bobFreq`, `tiltAngle` | Player, Villager, Enemy |
| `FlashAnim` | `color`, `duration`, `onEvent` | Enemy hit, Wall damage |
| `SpawnAnim` | `type: "bounce"\|"pop"`, `duration` | Structures, Villager arrival |

Animation components are pure data — they hold parameters only. The corresponding system reads them and drives the Three.js mesh.

---

## 5. JSON Archetype Format

All archetypes live in `src/config/archetypes/*.json`. `EntityFactory.js` reads these at load time and assembles ECS entities.

### 5.1 Format

```json
{
  "type": "Player",
  "behaviors": ["shooter", "collector", "stacker", "depositor"],
  "components": {
    "Movement":       { "speed": 10 },
    "Shooter":        { "fireRate": 0.5, "range": 10, "damage": 1, "faction": "player" },
    "Collector":      { "radius": 5, "resourceTypes": ["meat"] },
    "InventoryStack": { "maxSize": 20 },
    "Depositor":      { "range": 4, "targetTag": "table", "transferRate": 0.3 },
    "FlyToAnim":      { "arcHeight": 2.5, "speed": 8 },
    "SpringStackAnim":{ "wobble": 0.3, "lag": 0.15 },
    "SquashStretch":  { "intensity": 0.2 }
  }
}
```

### 5.2 Inheritance via `extends`

```json
{
  "extends": "enemy",
  "type": "Speeder",
  "components": {
    "Movement": { "speed": 9 },
    "Health":   { "hp": 1 }
  }
}
```

Speeder inherits all of `enemy.json` and overrides only speed and HP. New enemy types require zero code.

### 5.3 Archetype Files

```
src/config/archetypes/
  player.json
  enemy.json
  speeder.json       ← extends enemy
  tank.json          ← extends enemy
  villager.json
  turret.json
  wall.json
  meat-table.json
  coin-tray.json
```

### 5.4 Relationship to gameConfig.js

`gameConfig.js` is **not deleted**. It retains only global, non-entity values:
- Camera settings
- Renderer settings
- Wave spawn timing
- UI layout constants
- Zone positions

All per-entity tunable values move into archetype JSON files.

---

## 6. EventBus

A lightweight pub/sub singleton (`src/core/EventBus.js`) replaces all direct system-to-system calls.

### 6.1 API

```js
EventBus.emit('event:name', payload)
EventBus.on('event:name', (payload) => { ... })
EventBus.off('event:name', handler)
```

### 6.2 Event Catalog

| Event | Emitted By | Heard By | Payload |
|---|---|---|---|
| `entity:died` | `EnemySystem` | `CollectorSystem` | `{ entityId, position, drops[] }` |
| `item:collected` | `CollectorSystem` | `StackSystem` | `{ collectorId, itemType, mesh }` |
| `stack:changed` | `StackSystem` | `HUD`, `DepositorSystem` | `{ entityId, count }` |
| `item:deposited` | `DepositorSystem` | `TraderSystem` | `{ depositorId, targetId, itemType }` |
| `trade:complete` | `TraderSystem` | `StackSystem`, `HUD` | `{ traderId, gave, received }` |
| `entity:damaged` | `CombatSystem` | `FlashSystem` | `{ entityId, amount }` |
| `entity:spawned` | `EntityFactory` | `SpawnAnimSystem` | `{ entityId, type }` |

### 6.3 Decoupling Result

Before:
```
VillagerSystem.update() → sellingSystem.getMeatOnTable()
SellingSystem.update()  → stackSystem.stack.length
HarvestSystem           → enemySystem.onEnemyDeath callback
```

After:
```
EnemySystem        emits  → entity:died
CollectorSystem    hears  → entity:died, emits → item:collected
StackSystem        hears  → item:collected
DepositorSystem    hears  → stack:changed, emits → item:deposited
TraderSystem       hears  → item:deposited, emits → trade:complete
AgentAISystem      hears  → trade:complete
```

No system holds a reference to any other system.

---

## 7. New System Map

| New System | Replaces | Queries Components |
|---|---|---|
| `CollectorSystem` | `HarvestSystem` | `Collector`, `Transform`, `FlyToAnim` |
| `StackSystem` *(refactored)* | `StackSystem` (legacy) | `InventoryStack`, `SpringStackAnim` |
| `DepositorSystem` | `SellingSystem` | `Depositor`, `Transform`, `InventoryStack`, `FlyToAnim` |
| `TraderSystem` | `VillagerSystem` (transaction logic) | `Trader`, `InventoryStack` |
| `AgentAISystem` | `VillagerSystem` (movement/state) | `AgentAI`, `Movement`, `Transform` |
| `CombatSystem` *(cleaned)* | `CombatSystem` (hybrid) | `Shooter`, `Transform`, `Tag` |
| `AnimationSystem` | inline anim in entity classes | `SpringStackAnim`, `FlyToAnim`, `WalkAnim`, `FlashAnim`, `SquashStretch`, `SpawnAnim` |

`AnimationSystem` is a single system that handles all animation components — the only place Three.js mesh transforms happen for animated behaviors.

---

## 8. New File Map

```
src/
  core/
    EventBus.js                  ← NEW: pub/sub singleton
  config/
    archetypes/                  ← NEW: one JSON per entity type
      player.json
      enemy.json
      speeder.json
      tank.json
      villager.json
      turret.json
      wall.json
      meat-table.json
      coin-tray.json
  ecs/
    ECSManager.js                ← EXISTS: no changes needed
    components/                  ← NEW: one file per component definition/defaults
      Transform.js
      Movement.js
      Health.js
      Shooter.js
      Collector.js
      InventoryStack.js
      Depositor.js
      Trader.js
      AgentAI.js
      Tag.js
      FlyToAnim.js
      SpringStackAnim.js
      SquashStretch.js
      WalkAnim.js
      FlashAnim.js
      SpawnAnim.js
  entities/
    EntityFactory.js             ← MODIFY: reads archetypes/*.json, assembles ECS entities
  systems/
    CollectorSystem.js           ← NEW (replaces HarvestSystem)
    StackSystem.js               ← REFACTOR (reads InventoryStack component)
    DepositorSystem.js           ← NEW (replaces SellingSystem)
    TraderSystem.js              ← NEW (replaces VillagerSystem transaction logic)
    AgentAISystem.js             ← NEW (replaces VillagerSystem movement/state)
    AnimationSystem.js           ← NEW (handles all anim components)
    CombatSystem.js              ← MODIFY (remove legacy bridge)
    EnemySystem.js               ← MODIFY (emit entity:died instead of callback)

  [DELETE after migration complete]
    systems/HarvestSystem.js
    systems/SellingSystem.js
    systems/VillagerSystem.js
    systems/CoinSystem.js
    entities/Player.js           ← OOP class (replaced by archetype)
    entities/Enemy.js            ← OOP class (replaced by archetype)
```

---

## 9. Migration Steps (Incremental)

Each step leaves the game fully playable. Delete legacy code only after the step passes.

| Step | Task | Deletes |
|---|---|---|
| 1 | Build `EventBus.js` + `ArchetypeLoader` in `EntityFactory.js`. Load all JSON archetypes. No gameplay change. | — |
| 2 | Port `StackSystem` → reads `InventoryStack` + `SpringStackAnim` components. Player back stack works via ECS. | Old StackSystem internals |
| 3 | Port `HarvestSystem` → `CollectorSystem`. Emits `item:collected`. StackSystem listens. | `HarvestSystem.js` |
| 4 | Port `SellingSystem` → `DepositorSystem`. Reuses `FlyToAnim`. Emits `item:deposited`. | `SellingSystem.js` |
| 5 | Port `VillagerSystem` → `AgentAISystem` + `TraderSystem`. Villager is JSON archetype. Emits `trade:complete`. | `VillagerSystem.js`, `CoinSystem.js` |
| 6 | Remove CombatSystem legacy bridge. Delete `Player.js` / `Enemy.js` OOP classes. | Legacy bridge code, OOP classes |

---

## 10. What Does NOT Change

- `ECSManager.js` — already solid, no changes needed
- `gameConfig.js` — kept for global/non-entity settings
- `ResourceStack.js` / `ResourceTransfer.js` utilities — used internally by `AnimationSystem`
- `ObjectPool.js` — still used for projectiles and resource disks
- All rendering (Three.js meshes) stays in entity constructors — only animation driving moves to `AnimationSystem`
- UI / HUD — listens to EventBus events, no other changes
- `MovementSystem.js` / `CameraSystem.js` / `DrainSystem.js` / `LevelSystem.js` — out of scope for this migration

---

## 11. Success Criteria

- [ ] All entity tunable values live in `archetypes/*.json` — changing a number requires no code edit
- [ ] New enemy type (e.g. Tank) created by adding one JSON file and zero code
- [ ] No system holds a direct reference to any other system
- [ ] Player, Turret, future NPCs can all share `Collector`, `Shooter`, `InventoryStack` by adding components in JSON
- [ ] Game plays identically to pre-migration at every step
