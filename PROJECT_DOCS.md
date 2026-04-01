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

### Phase 5: ECS Migration (Current — 2026-04-01)
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

---

## Known Issues

### Villagers Not Moving (Priority: HIGH)
After ECS migration (Task 8), villagers spawn at the road start but stay idle — they don't walk to their queue positions or trade. The AgentAISystem state machine and queue logic need debugging. Likely causes:
- `AgentAISystem.register()` relies on `_ecs` being set, but `_ecs` is lazily initialized on first `update()` call — the register calls happen before the first frame
- Queue slot positions may not match the road/table layout
- The `_handleArrival` exiting case references `this.scene` which may not be properly passed

### Dual Visual Objects at Table/Tray Positions
The old `StorageNode` (meatTableNode) and the new ECS `meat-table` entity both create meshes at the same position. Visual overlap exists. Low priority — fix by hiding one.

---

## Current File Map

```
src/
  main.js                    — Bootstrap, render loop, system wiring
  config/
    gameConfig.js            — Global tunable values
    archetypes/              — JSON entity definitions (player, enemy, villager, etc.)
  core/
    Renderer.js              — WebGLRenderer wrapper
    Camera.js                — Isometric camera + lerp follow
    Lighting.js              — Scene lighting
    Scene.js                 — Scene wrapper
    EventBus.js              — Pub/sub singleton
    ArchetypeLoader.js       — Loads + resolves JSON archetypes
  ecs/
    ECSManager.js            — Core ECS registry
    components/              — 17 component definitions (Transform, Movement, Health, etc.)
  entities/
    EntityFactory.js         — Creates entities from JSON archetypes
    Projectile.js            — Pooled projectile mesh
    ResourceDisk.js          — "Meat" drop mesh
    UnlockZone.js            — Build zone with cost UI
    Turret.js                — Sentry structure
    Wall.js                  — Barrier structure
    StorageNode.js           — Visual storage (meat table, coin tray)
    Road.js                  — Paved road visual
    Environment.js           — Ground plane, zones
    CoinTray.js              — Legacy coin storage (may be unused)
    MeatTable.js             — Legacy meat table (may be unused)
    Villager.js              — Legacy villager class (may be unused)
  systems/
    MovementSystem.js        — Joystick -> movement (ECS)
    CombatSystem.js          — Auto-fire + projectile collision (ECS)
    EnemySystem.js           — Spawn + steer enemies (ECS)
    CollectorSystem.js       — Magnetic harvest (ECS, replaces HarvestSystem)
    StackSystem.js           — Jelly stack physics (ECS)
    DepositorSystem.js       — Player-to-table transfer (ECS, replaces SellingSystem)
    AgentAISystem.js         — Villager queue/movement (ECS, replaces VillagerSystem)
    TraderSystem.js          — Buy/sell transactions (ECS, replaces CoinSystem)
    CameraSystem.js          — Rubber-band camera follow
    ParticleSystem.js        — Pooled particle effects
    DrainSystem.js           — Resource drain into unlock zones
    LevelSystem.js           — Zone->structure replacement
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

## Phase 6: Planned (Not Started)
- Boss: Cylinder King
- Infinite wave generator
- New enemy types: Speeder (fast, low HP), Tank (slow, high HP) — archetypes already defined in JSON
- Wall repair mechanic
- Player upgrade zones
- Level progression (Lone Outpost -> Dusty Junction -> Neon Oasis -> Sandstorm Siege)
