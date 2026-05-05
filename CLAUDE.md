# Base Defense Tycoon - Project Guide

> **🚧 ACTIVE FOCUS: PROTOTYPE MODE 🚧**
> The full project focus is on the `?prototype` mode — a 5-minute playable-ad-style
> demo of the V1 game idea. Legacy gameplay and diorama mode are kept working but
> NOT being actively developed. V1 phase docs (under `newGameDesign/`) are
> reference only.
>
> **Read first when continuing work:**
> 1. `newGameDesign/PROTOTYPE_STATUS.md` — current state of the prototype build
> 2. `newGameDesign/PROTOTYPE_PLAN.md` — locked design spec (25 decisions)
> 3. `~/.claude/plans/yes-binary-bentley.md` — full implementation plan
>
> **Boot the prototype:** `python3 -m http.server 8000` then `http://localhost:8000/?prototype`

## Quick Orientation

Read these files to understand the project:
- `newGameDesign/PROTOTYPE_STATUS.md` — current prototype build state (priority for active work)
- `newGameDesign/PROTOTYPE_PLAN.md` — locked spec for the 5-min playable-ad prototype
- `PROJECT_DOCS.md` — Full development history, current architecture, known issues
- `ISOMETRIC_MOBILE_GUIDE.md` — Camera/viewport lessons learned
- `idea.md` — Original game design specification

## Tech Stack

- **Engine:** Three.js (latest via CDN)
- **Architecture:** Pure ECS (Entity-Component-System) with ES modules — no bundler
- **Assets:** Procedurally generated geometry and Canvas-based textures (no external image dependencies)
- **UI:** HTML/CSS overlays for joystick, HUD, and screens — keep WebGL canvas for 3D only
- **Entity definitions:** JSON archetypes in `src/config/archetypes/*.json`
- **System communication:** EventBus (pub/sub) — systems never reference each other directly

## Project Structure

```
src/
├── main.js                  # Bootstrap, render loop, system wiring
├── config/
│   ├── gameConfig.js        # Global tunable values (camera, renderer, waves, UI, zones)
│   └── archetypes/          # JSON entity definitions (player, enemy, villager, etc.)
├── core/
│   ├── EventBus.js          # Pub/sub singleton
│   ├── ArchetypeLoader.js   # Loads + resolves JSON archetypes with inheritance
│   ├── Renderer.js, Camera.js, Lighting.js, Scene.js
├── ecs/
│   ├── ECSManager.js        # Core ECS registry (createEntity, addComponent, queryEntities, etc.)
│   └── components/          # 17 component definitions (pure data classes)
├── entities/
│   ├── EntityFactory.js     # Creates entities from JSON archetypes via COMPONENT_MAP
│   └── Projectile.js, UnlockZone.js, Turret.js, Wall.js, StorageNode.js, etc.
├── systems/                 # ECS systems (registered in main.js, run via ecs.update())
│   ├── EnemySystem.js, CombatSystem.js, CollectorSystem.js, StackSystem.js
│   ├── DepositorSystem.js, AgentAISystem.js, TraderSystem.js, MovementSystem.js
│   └── CameraSystem.js, ParticleSystem.js, DrainSystem.js, LevelSystem.js
├── state/GameState.js       # Global game state
├── ui/                      # Joystick, HUD, FloatingUI
└── utils/                   # ObjectPool, ResourceStack, ResourceTransfer
```

## Coding Rules

- **Entity values in JSON:** Per-entity tunable values (speeds, ranges, HP, etc.) go in `src/config/archetypes/*.json`. Global values stay in `gameConfig.js`.
- **No direct system references:** Systems communicate via `EventBus.emit()` / `EventBus.on()`. Never import one system into another.
- **Object pooling:** Anything spawned frequently (projectiles, resource disks, enemies) MUST use `ObjectPool`.
- **Frame-rate independence:** All movement/animation uses `deltaTime`.
- **Simple code:** Prefer readable code over clever abstractions. Each module should be understandable in isolation.
- **Consult Three.js skills:** Use the installed `threejs-*` skills for rendering, animation, lighting, or material code.

## ECS Architecture

### How Entities Work
1. JSON archetypes define component bundles (`src/config/archetypes/*.json`)
2. `EntityFactory.create(archetypeName, pos)` reads the archetype, creates an ECS entity, attaches all components
3. Systems registered in `main.js` query entities by component requirements each frame

### Event Flow
```
entity:died     → CollectorSystem spawns disks
item:collected  → StackSystem adds to inventory
stack:changed   → HUD updates count
item:deposited  → TraderSystem triggers villager trade
agent:at_table  → TraderSystem executes transaction
trade:complete  → AgentAISystem exits villager
agent:exited    → AgentAISystem respawns villager
entity:damaged  → (future: FlashAnimSystem)
entity:spawned  → (future: SpawnAnimSystem)
```

## Core Game Mechanics

### Jelly Stack
Resources stack on player's back with wobbly spring physics (trailing lag, sway, squash/stretch).

### Magnetic Harvest
Enemy death -> resource disks scatter -> Bezier arc flight to player when in range.

### Drain & Build
Standing in unlock zone peels resources one-by-one into the zone with UI feedback.

### Selling Loop
Player deposits meat on table -> villager buys meat -> pays coins to tray.

## Visual Style

"Fake Ad" hyper-casual: high saturation, high contrast, bouncy animations. Isometric top-down, rubber-band camera follow, squash/stretch on all entities.

## Performance Goals

- Target 60 FPS on mobile
- Pool frequently spawned objects
- Selective shadow casting
- Cap pixel ratio for high-DPI screens
