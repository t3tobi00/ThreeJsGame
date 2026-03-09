# Architecture Map — Base Defense Tycoon

> **Last Updated**: 2025-06-10 14:30:00 — selling_system_add
> When you add, remove, or rename a file or its exports, update this document.

---

## Tech Stack
- **Rendering**: Vanilla Three.js (CDN import)
- **Language**: ES6 modules (no bundler)
- **UI**: HTML/CSS overlays on top of WebGL canvas
- **No external assets** — all geometry is procedural, textures are CanvasTexture

---

## Directory Tree

```
project-root/
├── index.html                  ← Entry point, loads src/main.js as module
├── src/
│   ├── main.js                 ← Bootstrap, render loop, deltaTime dispatch
│   ├── config/
│   │   └── gameConfig.js       ← ALL tunable values (colors, speeds, costs, ranges)
│   ├── core/
│   │   ├── Renderer.js         ← Three.js WebGLRenderer wrapper
│   │   ├── Camera.js           ← Isometric camera + lerp follow
│   │   └── Lighting.js         ← Scene lighting setup
│   ├── entities/
│   │   ├── Player.js           ← Player capsule mesh, squash-stretch state
│   │   ├── Enemy.js            ← Red cylinder mesh, HP, active flag
│   │   ├── Projectile.js       ← Pooled projectile mesh + velocity
│   │   ├── ResourceDisk.js     ← "Meat" drop, Bezier arc flight state
│   │   ├── UnlockZone.js       ← Build zone: dashed border, CanvasTexture cost UI
│   │   ├── Turret.js           ← Sentry mesh, fires via CombatSystem
│   │   ├── Wall.js             ← Barrier mesh, HP, damage flash
│   │   ├── CoinTray.js         ← Coin storage with vertical stack animation
│   │   ├── MeatTable.js        ← Selling table meat manager with transfer anim
│   │   ├── Villager.js         ← NPC with queue states, coin/meat holding
│   │   └── Road.js            ← Paved stone road visual
│   ├── systems/
│   │   ├── MovementSystem.js   ← Joystick input → 3D movement vector, dt-scaled
│   │   ├── CameraSystem.js     ← Rubber-band lerp follow
│   │   ├── EnemySystem.js      ← Spawn logic, steering AI toward player/base
│   │   ├── CombatSystem.js     ← Auto-fire, distance checks, multi-owner (player+turrets)
│   │   ├── HarvestSystem.js    ← Magnetic pull, Bezier arc flight to player
│   │   ├── StackSystem.js      ← Jelly stack: lerp trail, sway, squash-stretch
│   │   ├── DrainSystem.js      ← Reverse vacuum: peel resources into unlock zones
│   │   ├── LevelSystem.js      ← Zone→Structure replacement, bouncy spawn anim
│   │   ├── SellingSystem.js    ← Player-to-table meat transfer, table management
│   │   ├── VillagerSystem.js   ← Villager spawn, queue, transactions, exit/delete
│   │   └── CoinSystem.js      ← Coin economy, tray stack updates
│   ├── state/
│   │   └── GameState.js        ← Global state: resources, unlocks, level progression
│   ├── ui/
│   │   ├── Joystick.js         ← Dynamic virtual joystick (touch/mouse)
│   │   ├── HUD.js              ← Resource counter, HP bar overlays
│   │   └── FloatingUI.js       ← In-world floating text/icons
│   └── utils/
│       └── ObjectPool.js       ← Generic pool: acquire/release, preWarm
```

---

## Module Dependency Graph (high level)

```
main.js
├── core/Renderer.js
├── core/Camera.js
├── core/Lighting.js
├── config/gameConfig.js
├── state/GameState.js
├── entities/* (creates instances)
├── systems/* (passes entities + dt each frame)
└── ui/* (overlays on canvas)

systems/CombatSystem.js
├── imports: gameConfig (ranges, damage)
├── reads: Player position, Enemy positions, Turret positions
├── uses: ObjectPool<Projectile>
└── mutates: Enemy.hp, Projectile.active

systems/HarvestSystem.js
├── imports: gameConfig (pullRange, arcHeight)
├── reads: Player position, ResourceDisk positions
└── mutates: ResourceDisk.active, triggers StackSystem.addDisk()

systems/DrainSystem.js
├── imports: gameConfig (drainRate, drainInterval)
├── reads: Player position, UnlockZone bounds
├── mutates: GameState.resources, UnlockZone.funded
└── triggers: LevelSystem.spawnStructure() when zone fully funded

systems/SellingSystem.js
├── imports: gameConfig (detectionRange, transferSpeed)
├── reads: Player position, StackSystem.stack
├── uses: MeatTable (meat display and transfer animations)
└── mutates: StackSystem.stack (removes meat)

systems/VillagerSystem.js
├── imports: gameConfig (spawn positions, speeds, exit distance)
├── reads: CoinTray (for coin additions), MeatTable (for meat removal)
├── uses: Villager (entity instances)
└── mutates: CoinTray (adds coins), Villager states/positions

systems/CoinSystem.js
├── imports: gameConfig (coin values)
├── uses: CoinTray (visual stack)
└── mutates: CoinTray.coins (adds/removes)
```

---

## Key Exports Quick Reference

| File                    | Key Exports                                      |
|-------------------------|--------------------------------------------------|
| `gameConfig.js`         | `PLAYER`, `ENEMY`, `COMBAT`, `HARVEST`, `STACK`, `DRAIN`, `TURRET`, `WALL`, `ZONES`, `COIN`, `TRAY`, `VILLAGER`, `SELLING`, `ROAD` |
| `GameState.js`          | `state` (singleton), `addResources()`, `spendResources()`, `unlockZone()` |
| `ObjectPool.js`         | `class ObjectPool` — `acquire()`, `release(obj)`, `preWarm(count)` |
| `Player.js`             | `class Player` — `mesh`, `velocity`, `stackCount` |
| `Enemy.js`              | `class Enemy` — `mesh`, `hp`, `active`, `speed`  |
| `CombatSystem.js`       | `init(scene, pool)`, `update(dt)`, `registerOwner(entity)` |
| `MovementSystem.js`     | `init(player, joystick)`, `update(dt)`           |
| `CoinTray.js`          | `class CoinTray` — `addCoin()`, `removeCoin()`, `update()` |
| `MeatTable.js`          | `class MeatTable` — `addMeatToTable()`, `removeMeatFromTable()`, `transferMeat()`, `update()` |
| `Villager.js`           | `class Villager` — `moveTo()`, `receiveMeat()`, `giveCoins()`, `update()` |
| `SellingSystem.js`      | `class SellingSystem` — `update(dt, playerPos)`, `getMeatOnTable()`, `removeMeatFromTable()` |
| `VillagerSystem.js`     | `class VillagerSystem` — `spawnInitialVillagers()`, `handleTransaction()`, `update()` |
| `CoinSystem.js`         | `class CoinSystem` — `addCoin()`, `addCoins()`, `getCoinCount()`, `update()` |

---

## Notes for Agents
- **gameConfig.js is sacred**: Every tunable number lives here. If you're tempted to hardcode a value, put it in config instead.
- **ObjectPool.js is mandatory**: Anything spawned repeatedly (projectiles, enemies, disks, particles) MUST use the pool. No `new` in hot loops.
- **Entities hold state, Systems hold logic**: Never put AI/update logic inside entity files.
- **Selling system flow**: Player → SellingSystem → MeatTable ← VillagerSystem ← Villagers → CoinTray ← CoinSystem
