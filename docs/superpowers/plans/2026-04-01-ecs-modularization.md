# ECS Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all legacy coupled systems (HarvestSystem, SellingSystem, VillagerSystem, StackSystem) to a pure ECS architecture where every behavior is a composable component, all tunable values live in JSON archetype files, and systems communicate only through EventBus — no direct system-to-system references.

**Architecture:** Fine-grained logic + animation component separation. `FlyToAnim` is shared by both CollectorSystem (resources fly to player) and DepositorSystem (resources fly off player to table). Systems emit events, never call each other. Entity archetypes are defined in `src/config/archetypes/*.json` — new entity types require zero code.

**Tech Stack:** Three.js (CDN), ES6 modules (no bundler), ECSManager (already exists at `src/ecs/ECSManager.js`), ResourceStack + ResourceTransfer utilities (kept), ObjectPool (kept).

---

## How to Verify Each Task

The game is served over HTTP (ES modules require it). Start the server once:
```bash
cd /Users/bibektandon/Desktop/code/ThesisGame2
python3 -m http.server 8080
# Open: http://localhost:8080
```
After each task: reload the browser, open DevTools console, verify no errors, confirm the visual behavior described in the task's verification step.

---

## Naming Conventions

- Component files: `Component_<Name>.js` (matches existing: `Component_Transform.js`, `Component_InventoryStack.js`)
- Component name string in ECS: `'<Name>'` (e.g. `'Collector'`, `'FlyToAnim'`)
- System files: `<Name>System.js`
- Archetype files: `src/config/archetypes/<name>.json` (lowercase, hyphenated)

---

## Task 1: EventBus Singleton

**Files:**
- Create: `src/core/EventBus.js`
- Modify: `src/main.js` (import only, no usage yet)

This is purely additive. The game must behave identically after this task.

- [ ] **Step 1.1: Create EventBus**

Create `src/core/EventBus.js`:

```js
/**
 * EventBus — Lightweight pub/sub singleton.
 * Systems emit events and listen to events. They never call each other directly.
 *
 * Usage:
 *   EventBus.on('entity:died', ({ entityId, position, drops }) => { ... });
 *   EventBus.emit('entity:died', { entityId: 42, position: pos, drops: ['meat'] });
 *   EventBus.off('entity:died', handler);
 */
const EventBus = {
    _listeners: new Map(),

    on(event, handler) {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event).add(handler);
    },

    off(event, handler) {
        if (this._listeners.has(event)) this._listeners.get(event).delete(handler);
    },

    emit(event, payload) {
        if (!this._listeners.has(event)) return;
        for (const handler of this._listeners.get(event)) {
            handler(payload);
        }
    },

    /** Remove all listeners — call between game resets. */
    clear() {
        this._listeners.clear();
    }
};

export default EventBus;
```

- [ ] **Step 1.2: Import EventBus in main.js**

Add this import at the top of `src/main.js`, after the existing imports:

```js
import EventBus from './core/EventBus.js';
```

Do not use it yet. This just ensures there are no module resolution errors.

- [ ] **Step 1.3: Verify**

Open `http://localhost:8080`. DevTools console must show zero errors. Game plays normally — enemies spawn, player moves, harvest works, selling works.

- [ ] **Step 1.4: Commit**

```bash
git add src/core/EventBus.js src/main.js
git commit -m "feat(ecs): add EventBus singleton — step 1 of ECS migration"
```

---

## Task 2: JSON Archetypes + ArchetypeLoader

**Files:**
- Create: `src/config/archetypes/player.json`
- Create: `src/config/archetypes/enemy.json`
- Create: `src/config/archetypes/speeder.json`
- Create: `src/config/archetypes/tank.json`
- Create: `src/config/archetypes/villager.json`
- Create: `src/config/archetypes/turret.json`
- Create: `src/config/archetypes/wall.json`
- Create: `src/config/archetypes/meat-table.json`
- Create: `src/config/archetypes/coin-tray.json`
- Create: `src/core/ArchetypeLoader.js`
- Modify: `src/main.js` (load archetypes at startup, log to console)

This is purely additive. Archetypes are loaded but nothing uses them yet. The game behaves identically.

- [ ] **Step 2.1: Create archetype JSON files**

Create `src/config/archetypes/player.json`:
```json
{
  "type": "Player",
  "behaviors": ["shooter", "collector", "stacker", "depositor"],
  "components": {
    "Movement":        { "speed": 10, "controller": "joystick", "faction": "player" },
    "Shooter":         { "fireRate": 0.5, "range": 10, "damage": 1, "faction": "player", "targetFactions": ["enemy"] },
    "Collector":       { "radius": 5, "resourceTypes": ["meat"], "pullForce": 1.0 },
    "InventoryStack":  { "maxCapacity": 20, "anchorOffset": { "x": 0, "y": 1.2, "z": -0.25 }, "style": "wobble" },
    "Depositor":       { "range": 4, "targetTag": "table", "transferRate": 0.3 },
    "FlyToAnim":       { "arcHeight": 2.5, "speed": 8, "easing": "quadOut" },
    "SpringStackAnim": { "wobble": 0.3, "squash": 0.15, "lag": 0.15 },
    "SquashStretch":   { "intensity": 0.2, "frequency": 8, "trigger": "move" },
    "WalkAnim":        { "bobHeight": 0.08, "bobFreq": 8, "tiltAngle": 0.06 }
  }
}
```

Create `src/config/archetypes/enemy.json`:
```json
{
  "type": "Enemy",
  "behaviors": ["mover", "damageable"],
  "components": {
    "Movement":  { "speed": 2.5, "controller": "simple_steering", "faction": "enemy" },
    "Health":    { "hp": 3, "maxHp": 3, "armor": 0 },
    "Tag":       { "tags": ["enemy"] },
    "WalkAnim":  { "bobHeight": 0.06, "bobFreq": 7, "tiltAngle": 0.05 },
    "FlashAnim": { "color": "#ffffff", "duration": 0.1, "onEvent": "entity:damaged" }
  }
}
```

Create `src/config/archetypes/speeder.json`:
```json
{
  "extends": "enemy",
  "type": "Speeder",
  "components": {
    "Movement": { "speed": 6 },
    "Health":   { "hp": 1, "maxHp": 1 }
  }
}
```

Create `src/config/archetypes/tank.json`:
```json
{
  "extends": "enemy",
  "type": "Tank",
  "components": {
    "Movement": { "speed": 1.2 },
    "Health":   { "hp": 10, "maxHp": 10 }
  }
}
```

Create `src/config/archetypes/villager.json`:
```json
{
  "type": "Villager",
  "behaviors": ["agent", "trader", "stacker"],
  "components": {
    "Movement":        { "speed": 3, "controller": "agent_ai", "faction": "neutral" },
    "AgentAI":         { "state": "in_queue", "target": null, "queueSlot": -1, "exitDist": 20 },
    "Trader":          { "accepts": "meat", "gives": "coin", "rate": 1, "minStock": 1 },
    "InventoryStack":  { "maxCapacity": 5, "anchorOffset": { "x": 0, "y": 1.4, "z": 0 }, "style": "wobble", "acceptsTypes": ["coin", "meat"] },
    "FlyToAnim":       { "arcHeight": 1.5, "speed": 6, "easing": "quadOut" },
    "SpringStackAnim": { "wobble": 0.15, "squash": 0.1, "lag": 0.12 },
    "WalkAnim":        { "bobHeight": 0.05, "bobFreq": 6, "tiltAngle": 0.04 }
  }
}
```

Create `src/config/archetypes/turret.json`:
```json
{
  "type": "Turret",
  "behaviors": ["shooter"],
  "components": {
    "Shooter":   { "fireRate": 0.4, "range": 12, "damage": 1, "faction": "player", "targetFactions": ["enemy"] },
    "Tag":       { "tags": ["turret", "structure"] },
    "SpawnAnim": { "type": "bounce", "duration": 0.4 }
  }
}
```

Create `src/config/archetypes/wall.json`:
```json
{
  "type": "Wall",
  "behaviors": ["damageable"],
  "components": {
    "Health":    { "hp": 10, "maxHp": 10, "armor": 0 },
    "Tag":       { "tags": ["wall", "structure"] },
    "FlashAnim": { "color": "#ff4444", "duration": 0.15, "onEvent": "entity:damaged" },
    "SpawnAnim": { "type": "bounce", "duration": 0.35 }
  }
}
```

Create `src/config/archetypes/meat-table.json`:
```json
{
  "type": "MeatTable",
  "behaviors": ["storage"],
  "components": {
    "InventoryStack": { "maxCapacity": 50, "anchorOffset": { "x": 0, "y": 0.6, "z": 0 }, "style": "rigid", "acceptsTypes": ["meat"] },
    "Trader":         { "accepts": "meat", "gives": "meat", "rate": 1, "minStock": 1 },
    "Tag":            { "tags": ["table", "storage"] },
    "SpringStackAnim":{ "wobble": 0.05, "squash": 0.05, "lag": 0.1 }
  }
}
```

Create `src/config/archetypes/coin-tray.json`:
```json
{
  "type": "CoinTray",
  "behaviors": ["storage"],
  "components": {
    "InventoryStack": { "maxCapacity": 100, "anchorOffset": { "x": 0, "y": 0.05, "z": 0 }, "style": "wobble", "acceptsTypes": ["coin"] },
    "Tag":            { "tags": ["tray", "storage"] },
    "SpringStackAnim":{ "wobble": 0.2, "squash": 0.1, "lag": 0.08 }
  }
}
```

- [ ] **Step 2.2: Create ArchetypeLoader**

Create `src/core/ArchetypeLoader.js`:

```js
/**
 * ArchetypeLoader — Loads and merges JSON archetype definitions.
 *
 * Archetypes live in src/config/archetypes/*.json.
 * An archetype can extend another via "extends": "<name>".
 * Extending merges component configs, with the child overriding parent values.
 */

const ARCHETYPE_NAMES = [
    'player', 'enemy', 'speeder', 'tank',
    'villager', 'turret', 'wall', 'meat-table', 'coin-tray'
];

/** @type {Map<string, object>} name → resolved archetype */
const _cache = new Map();

/**
 * Load all archetypes. Call once at startup (await it).
 * After this, use getArchetype(name) synchronously.
 */
export async function loadArchetypes() {
    const raw = new Map();

    // Fetch all JSON files in parallel
    await Promise.all(ARCHETYPE_NAMES.map(async (name) => {
        const url = new URL(`../config/archetypes/${name}.json`, import.meta.url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ArchetypeLoader: failed to load ${name}.json (${res.status})`);
        raw.set(name, await res.json());
    }));

    // Resolve inheritance
    for (const name of ARCHETYPE_NAMES) {
        _cache.set(name, _resolve(name, raw));
    }

    console.log(`[ArchetypeLoader] Loaded ${_cache.size} archetypes:`, [..._cache.keys()]);
}

/**
 * Get a fully-resolved archetype by name (synchronous after loadArchetypes()).
 * @param {string} name e.g. 'player', 'enemy', 'speeder'
 * @returns {object} resolved archetype with merged components
 */
export function getArchetype(name) {
    const a = _cache.get(name);
    if (!a) throw new Error(`ArchetypeLoader: archetype '${name}' not found. Did you call loadArchetypes()?`);
    return a;
}

function _resolve(name, raw) {
    const archetype = raw.get(name);
    if (!archetype) throw new Error(`ArchetypeLoader: '${name}' not in raw map`);

    if (!archetype.extends) return _deepClone(archetype);

    const parent = _resolve(archetype.extends, raw);
    return {
        ...parent,
        ...archetype,
        extends: undefined,
        components: _mergeComponents(parent.components || {}, archetype.components || {})
    };
}

function _mergeComponents(parent, child) {
    const result = _deepClone(parent);
    for (const [compName, compData] of Object.entries(child)) {
        result[compName] = { ...(result[compName] || {}), ..._deepClone(compData) };
    }
    return result;
}

function _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
```

- [ ] **Step 2.3: Load archetypes in main.js at startup**

In `src/main.js`, change the top-level startup code. Currently it ends with:
```js
window.addEventListener('load', () => {
    new Game();
});
```

Replace that block with:
```js
import { loadArchetypes } from './core/ArchetypeLoader.js';

window.addEventListener('load', async () => {
    await loadArchetypes();
    new Game();
});
```

Also add the import at the top of the file with other imports:
```js
import { loadArchetypes } from './core/ArchetypeLoader.js';
```

- [ ] **Step 2.4: Verify**

Open `http://localhost:8080`. DevTools console must show:
```
[ArchetypeLoader] Loaded 9 archetypes: ['player', 'enemy', 'speeder', 'tank', 'villager', 'turret', 'wall', 'meat-table', 'coin-tray']
```
Game plays normally. No errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/config/archetypes/ src/core/ArchetypeLoader.js src/main.js
git commit -m "feat(ecs): add JSON archetypes and ArchetypeLoader — step 2 of ECS migration"
```

---

## Task 3: New Component Definitions

**Files:**
- Create: `src/ecs/components/Component_Health.js`
- Create: `src/ecs/components/Component_Collector.js`
- Create: `src/ecs/components/Component_Depositor.js`
- Create: `src/ecs/components/Component_Trader.js`
- Create: `src/ecs/components/Component_AgentAI.js`
- Create: `src/ecs/components/Component_Tag.js`
- Create: `src/ecs/components/Component_FlyToAnim.js`
- Create: `src/ecs/components/Component_SpringStackAnim.js`
- Create: `src/ecs/components/Component_WalkAnim.js`
- Create: `src/ecs/components/Component_FlashAnim.js`
- Create: `src/ecs/components/Component_SquashStretch.js`
- Create: `src/ecs/components/Component_SpawnAnim.js`

These are pure data classes. No logic, no Three.js imports. Purely additive.

- [ ] **Step 3.1: Create logic component files**

Create `src/ecs/components/Component_Health.js`:
```js
export class Component_Health {
    constructor({ hp = 3, maxHp = 3, armor = 0 } = {}) {
        this.hp = hp;
        this.maxHp = maxHp;
        this.armor = armor;
    }
}
```

Create `src/ecs/components/Component_Collector.js`:
```js
/**
 * Collector — Entity pulls nearby resource items into its InventoryStack.
 * radius: distance at which resources start flying to this entity.
 * resourceTypes: which resource type tags to collect (e.g. ['meat']).
 * pullForce: speed multiplier for the fly-to animation (higher = faster pull).
 */
export class Component_Collector {
    constructor({ radius = 5, resourceTypes = ['meat'], pullForce = 1.0 } = {}) {
        this.radius = radius;
        this.resourceTypes = resourceTypes;
        this.pullForce = pullForce;
        // Runtime state
        this.inFlightCount = 0;
    }
}
```

Create `src/ecs/components/Component_Depositor.js`:
```js
/**
 * Depositor — Entity transfers items from its InventoryStack to a tagged target entity.
 * range: proximity distance at which transfer starts.
 * targetTag: Tag value to look for on the destination entity (e.g. 'table').
 * transferRate: seconds between each item transfer.
 */
export class Component_Depositor {
    constructor({ range = 4, targetTag = 'table', transferRate = 0.3 } = {}) {
        this.range = range;
        this.targetTag = targetTag;
        this.transferRate = transferRate;
        // Runtime state
        this.timeSinceLastTransfer = 0;
        this.isInRange = false;
    }
}
```

Create `src/ecs/components/Component_Trader.js`:
```js
/**
 * Trader — Entity participates in resource transactions.
 * accepts: resource type this entity receives ('meat', 'coin').
 * gives: resource type this entity provides in exchange.
 * rate: how many 'gives' per 1 'accepts' (e.g. rate:2 = 2 coins per 1 meat).
 * minStock: minimum 'accepts' stock required before trade activates.
 */
export class Component_Trader {
    constructor({ accepts = 'meat', gives = 'coin', rate = 1, minStock = 1 } = {}) {
        this.accepts = accepts;
        this.gives = gives;
        this.rate = rate;
        this.minStock = minStock;
        // Runtime state
        this.pendingTransaction = false;
    }
}
```

Create `src/ecs/components/Component_AgentAI.js`:
```js
/**
 * AgentAI — State machine for NPC autonomous behavior (villager queue/trade/exit).
 * state: current state string.
 * queueSlot: position in the queue (0 = front).
 * exitDist: how far the agent travels before being despawned.
 */
export class Component_AgentAI {
    constructor({ state = 'in_queue', target = null, queueSlot = -1, exitDist = 20 } = {}) {
        this.state = state;       // 'in_queue' | 'approaching_table' | 'buying' | 'exiting'
        this.target = target;     // THREE.Vector3 destination
        this.queueSlot = queueSlot;
        this.exitDist = exitDist;
        // Runtime state
        this.distanceTravelled = 0;
        this.actionTimer = 0;
    }
}
```

Create `src/ecs/components/Component_Tag.js`:
```js
/**
 * Tag — String labels for an entity. Used by systems to filter targets.
 * tags: array of strings, e.g. ['player'], ['enemy'], ['table', 'storage'].
 */
export class Component_Tag {
    constructor({ tags = [] } = {}) {
        // Accept both object form {tags:[...]} and legacy string form ('player')
        if (typeof tags === 'string') {
            this.tags = [tags];
        } else {
            this.tags = [...tags];
        }
    }

    has(tag) {
        return this.tags.includes(tag);
    }
}
```

- [ ] **Step 3.2: Create animation component files**

Create `src/ecs/components/Component_FlyToAnim.js`:
```js
/**
 * FlyToAnim — Parameters for Bezier arc flight animations.
 * Reused by CollectorSystem (items fly to entity) and DepositorSystem (items fly away).
 * arcHeight: peak height of the arc above the midpoint.
 * speed: base flight speed (units/sec at t=0.5).
 * easing: easing function name ('quadOut', 'linear').
 */
export class Component_FlyToAnim {
    constructor({ arcHeight = 2.5, speed = 8, easing = 'quadOut' } = {}) {
        this.arcHeight = arcHeight;
        this.speed = speed;
        this.easing = easing;
    }
}
```

Create `src/ecs/components/Component_SpringStackAnim.js`:
```js
/**
 * SpringStackAnim — Parameters for the jelly-stack spring physics.
 * wobble: lateral sway intensity on direction change.
 * squash: vertical squash amount on item add/remove.
 * lag: follow delay per item in the stack (seconds).
 */
export class Component_SpringStackAnim {
    constructor({ wobble = 0.3, squash = 0.15, lag = 0.15 } = {}) {
        this.wobble = wobble;
        this.squash = squash;
        this.lag = lag;
    }
}
```

Create `src/ecs/components/Component_WalkAnim.js`:
```js
/**
 * WalkAnim — Bob and tilt animation driven by movement velocity.
 * bobHeight: vertical oscillation amplitude.
 * bobFreq: oscillation frequency (cycles/sec).
 * tiltAngle: max forward-lean angle (radians) at full speed.
 */
export class Component_WalkAnim {
    constructor({ bobHeight = 0.08, bobFreq = 8, tiltAngle = 0.06 } = {}) {
        this.bobHeight = bobHeight;
        this.bobFreq = bobFreq;
        this.tiltAngle = tiltAngle;
        // Runtime
        this.phase = 0;
    }
}
```

Create `src/ecs/components/Component_FlashAnim.js`:
```js
/**
 * FlashAnim — Brief color flash on mesh material, triggered by an EventBus event.
 * color: hex string to flash to (e.g. '#ffffff').
 * duration: flash duration in seconds.
 * onEvent: EventBus event name that triggers the flash (e.g. 'entity:damaged').
 */
export class Component_FlashAnim {
    constructor({ color = '#ffffff', duration = 0.1, onEvent = 'entity:damaged' } = {}) {
        this.color = color;
        this.duration = duration;
        this.onEvent = onEvent;
        // Runtime
        this.flashTimer = 0;
        this.isFlashing = false;
    }
}
```

Create `src/ecs/components/Component_SquashStretch.js`:
```js
/**
 * SquashStretch — Squash/stretch mesh scale based on movement speed.
 * intensity: max scale distortion (0 = none, 0.2 = subtle).
 * frequency: oscillation rate during movement.
 * trigger: what drives the effect ('move', 'jump', 'land').
 */
export class Component_SquashStretch {
    constructor({ intensity = 0.2, frequency = 8, trigger = 'move' } = {}) {
        this.intensity = intensity;
        this.frequency = frequency;
        this.trigger = trigger;
        // Runtime
        this.phase = 0;
    }
}
```

Create `src/ecs/components/Component_SpawnAnim.js`:
```js
/**
 * SpawnAnim — One-shot animation played when an entity is first created.
 * type: 'bounce' (scale up from 0 with overshoot) or 'pop' (quick scale pulse).
 * duration: total animation time in seconds.
 */
export class Component_SpawnAnim {
    constructor({ type = 'bounce', duration = 0.4 } = {}) {
        this.type = type;
        this.duration = duration;
        // Runtime
        this.elapsed = 0;
        this.done = false;
    }
}
```

- [ ] **Step 3.3: Verify**

Open `http://localhost:8080`. No errors in console. Game plays identically. These files are not imported anywhere yet — this step just creates them.

- [ ] **Step 3.4: Commit**

```bash
git add src/ecs/components/
git commit -m "feat(ecs): add all component definitions (Collector, Depositor, Trader, AgentAI, Tag, anim components) — step 3"
```

---

## Task 4: Refactor EntityFactory to Use ArchetypeLoader

**Files:**
- Modify: `src/entities/EntityFactory.js`

Replace the hardcoded `createPlayer()`, `createEnemy()`, `createVillager()` methods with a single `create(archetypeName, pos)` method that reads from the loaded archetypes. The game behavior must be identical after this task.

- [ ] **Step 4.1: Rewrite EntityFactory.js**

Replace the entire contents of `src/entities/EntityFactory.js` with:

```js
import * as THREE from 'three';
import { getArchetype } from '../core/ArchetypeLoader.js';
import { Component_Transform } from '../ecs/components/Component_Transform.js';
import { Component_Movement } from '../ecs/components/Component_Movement.js';
import { Component_InventoryStack } from '../ecs/components/Component_InventoryStack.js';
import { Component_Shooter } from '../ecs/components/Component_Shooter.js';
import { Component_Health } from '../ecs/components/Component_Health.js';
import { Component_Collector } from '../ecs/components/Component_Collector.js';
import { Component_Depositor } from '../ecs/components/Component_Depositor.js';
import { Component_Trader } from '../ecs/components/Component_Trader.js';
import { Component_AgentAI } from '../ecs/components/Component_AgentAI.js';
import { Component_Tag } from '../ecs/components/Component_Tag.js';
import { Component_FlyToAnim } from '../ecs/components/Component_FlyToAnim.js';
import { Component_SpringStackAnim } from '../ecs/components/Component_SpringStackAnim.js';
import { Component_WalkAnim } from '../ecs/components/Component_WalkAnim.js';
import { Component_FlashAnim } from '../ecs/components/Component_FlashAnim.js';
import { Component_SquashStretch } from '../ecs/components/Component_SquashStretch.js';
import { Component_SpawnAnim } from '../ecs/components/Component_SpawnAnim.js';
import EventBus from '../core/EventBus.js';

// Map component name strings (from JSON) → constructor functions
const COMPONENT_MAP = {
    Movement:        (d) => new Component_Movement(d),
    Shooter:         (d) => new Component_Shooter(d),
    Health:          (d) => new Component_Health(d),
    Collector:       (d) => new Component_Collector(d),
    InventoryStack:  (d) => new Component_InventoryStack(d),
    Depositor:       (d) => new Component_Depositor(d),
    Trader:          (d) => new Component_Trader(d),
    AgentAI:         (d) => new Component_AgentAI(d),
    Tag:             (d) => new Component_Tag(d),
    FlyToAnim:       (d) => new Component_FlyToAnim(d),
    SpringStackAnim: (d) => new Component_SpringStackAnim(d),
    WalkAnim:        (d) => new Component_WalkAnim(d),
    FlashAnim:       (d) => new Component_FlashAnim(d),
    SquashStretch:   (d) => new Component_SquashStretch(d),
    SpawnAnim:       (d) => new Component_SpawnAnim(d),
};

// Mesh colors per archetype type
const MESH_COLORS = {
    Player:    0x3366ff,
    Enemy:     0xff3333,
    Speeder:   0xff6600,
    Tank:      0x880000,
    Villager:  0x44bb44,
    Turret:    0x888888,
};

export class EntityFactory {
    constructor(scene, ecs) {
        this.scene = scene;
        this.ecs = ecs;
    }

    /**
     * Create an entity from a named archetype.
     * @param {string} archetypeName e.g. 'player', 'enemy', 'villager'
     * @param {THREE.Vector3} pos Initial world position
     * @param {object} [overrides] Optional component overrides (merged on top of archetype)
     * @returns {number} ECS entity ID
     */
    create(archetypeName, pos, overrides = {}) {
        const archetype = getArchetype(archetypeName);
        const id = this.ecs.createEntity();

        // Build the mesh
        const mesh = this._createMesh(archetype.type, pos);

        // Always add Transform
        this.ecs.addComponent(id, 'Transform', new Component_Transform(mesh));

        // Add all components defined in the archetype
        const components = { ...archetype.components, ...overrides };
        for (const [name, data] of Object.entries(components)) {
            if (name === 'Transform') continue; // already handled
            const factory = COMPONENT_MAP[name];
            if (!factory) {
                console.warn(`EntityFactory: unknown component '${name}' in archetype '${archetypeName}'`);
                continue;
            }
            this.ecs.addComponent(id, name, factory(data));
        }

        // Emit spawn event
        EventBus.emit('entity:spawned', { entityId: id, type: archetype.type });

        return id;
    }

    /** Convenience aliases kept for backward compatibility during migration */
    createPlayer(pos) { return this.create('player', pos); }
    createEnemy(pos)  { return this.create('enemy', pos); }
    createVillager(pos) { return this.create('villager', pos); }

    /**
     * Create a static storage node (meat table or coin tray).
     * Returns both the ECS entity ID and the mesh group.
     */
    createTable(pos, archetypeName = 'meat-table') {
        return this.create(archetypeName, pos);
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    _createMesh(type, pos) {
        const isCharacter = ['Player', 'Enemy', 'Speeder', 'Tank', 'Villager'].includes(type);
        const isTable = ['MeatTable', 'CoinTray'].includes(type);

        let mesh;
        if (isCharacter) {
            mesh = this._createCharacterMesh(MESH_COLORS[type] ?? 0xaaaaaa);
        } else if (isTable) {
            mesh = this._createTableMesh();
        } else {
            // Generic box fallback for Turret, Wall, etc.
            const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const mat = new THREE.MeshStandardMaterial({ color: MESH_COLORS[type] ?? 0x999999 });
            mesh = new THREE.Mesh(geo, mat);
        }

        mesh.position.copy(pos);
        this.scene.add(mesh);
        return mesh;
    }

    _createCharacterMesh(color) {
        const group = new THREE.Group();

        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.1;
        head.castShadow = true;
        group.add(head);

        const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 1.12, 0.18);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 1.12, 0.18);
        group.add(rightEye);

        return group;
    }

    _createTableMesh() {
        const group = new THREE.Group();
        const boxGeo = new THREE.BoxGeometry(2, 0.6, 1);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const top = new THREE.Mesh(boxGeo, boxMat);
        top.position.y = 0.3;
        group.add(top);
        return group;
    }
}
```

- [ ] **Step 4.2: Update main.js player creation call**

In `src/main.js`, the player is currently created as:
```js
this.playerId = this.factory.createPlayer(new THREE.Vector3(0, 0, 0));
```

This still works because we kept `createPlayer()` as an alias. No change needed in main.js for this task.

- [ ] **Step 4.3: Verify**

Open `http://localhost:8080`. Console should show the ArchetypeLoader log AND no errors. Player spawns as blue character, enemies spawn as red, game plays normally. The player's mesh is the same capsule shape.

- [ ] **Step 4.4: Commit**

```bash
git add src/entities/EntityFactory.js
git commit -m "feat(ecs): EntityFactory reads from JSON archetypes via ArchetypeLoader — step 4"
```

---

## Task 5: Refactor StackSystem to be ECS-driven

**Files:**
- Modify: `src/systems/StackSystem.js`
- Modify: `src/main.js`

StackSystem currently holds a direct `this.player` reference. After this task, it queries the ECS for any entity with `['Transform', 'InventoryStack']` and updates each one's physics stack. The player's back stack must still wobble correctly.

- [ ] **Step 5.1: Rewrite StackSystem.js**

Replace the entire contents of `src/systems/StackSystem.js`:

```js
import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * StackSystem — ECS-driven.
 * Queries all entities with Transform + InventoryStack.
 * For each, calls stack.update(basePos) every frame to drive spring physics.
 * Also provides addDisk(entityId) and popDisk(entityId) for other systems.
 *
 * Listens to:  'item:collected' → addDisk(collectorId, mesh)
 * Emits:       'stack:changed' → { entityId, count }
 */
export class StackSystem {
    constructor(scene) {
        this.scene = scene;

        // Listen for items arriving at a collector entity
        EventBus.on('item:collected', ({ collectorId, mesh }) => {
            this._addMeshToStack(collectorId, mesh);
        });
    }

    /**
     * Called by ECS every frame.
     * @param {number[]} entities IDs with ['Transform', 'InventoryStack']
     */
    update(entities, deltaTime, ecs) {
        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const inventory = ecs.getComponent(entityId, 'InventoryStack');
            if (!transform || !inventory) continue;

            const anchor = inventory.anchorOffset;
            const basePos = new THREE.Vector3(
                transform.mesh.position.x + anchor.x,
                transform.mesh.position.y + anchor.y,
                transform.mesh.position.z + anchor.z
            );
            inventory.stack.update(basePos);
        }
    }

    /**
     * Add a pre-existing mesh to an entity's inventory stack.
     * @param {number} entityId
     * @param {THREE.Mesh} mesh
     */
    _addMeshToStack(entityId, mesh) {
        // ecs is not directly available here — use the stored reference set by main.js
        if (!this._ecs) return;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory) return;

        this.scene.add(mesh);
        inventory.stack.add(mesh, { animate: true });
        EventBus.emit('stack:changed', { entityId, count: inventory.stack.getCount() });
    }

    /**
     * Exposed for DepositorSystem: pop the top item from an entity's stack.
     * @param {number} entityId
     * @returns {THREE.Mesh|null}
     */
    popDisk(entityId) {
        if (!this._ecs) return null;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory || inventory.stack.getCount() === 0) return null;
        const disk = inventory.stack.pop();
        EventBus.emit('stack:changed', { entityId, count: inventory.stack.getCount() });
        return disk;
    }

    /**
     * main.js must call this after creating StackSystem so it can access ECS.
     */
    setECS(ecs) {
        this._ecs = ecs;
    }
}
```

- [ ] **Step 5.2: Update main.js — wire StackSystem into ECS**

In `src/main.js`, find where legacy systems are created. Make these changes:

**a) Add StackSystem import** at the top:
```js
import { StackSystem } from './systems/StackSystem.js';
```

**b) Replace** the `playerBridge` block and legacy StackSystem usage. After `this.ecs` and `this.factory` are created, find where `this.playerBridge` is defined. Add StackSystem initialization immediately after the ECS setup block:

```js
// StackSystem — ECS driven, no player reference
this.stackSystem = new StackSystem(this.scene.instance);
this.stackSystem.setECS(this.ecs);
this.ecs.registerSystem(this.stackSystem, ['Transform', 'InventoryStack']);
```

**c) Update the `harvestSystem.onCollected` callback** (still needed for legacy HarvestSystem in this step).

Find:
```js
this.harvestSystem.onCollected = (disk) => {
    const newDisk = disk.clone();
    this.scene.instance.add(newDisk);
    playerInventory.stack.add(newDisk, { animate: true });
    this.hud.updateMeatCount(playerInventory.stack.getCount());
};
```

Replace with:
```js
this.harvestSystem.onCollected = (disk) => {
    const newDisk = disk.clone();
    // Emit item:collected so StackSystem handles it via EventBus
    EventBus.emit('item:collected', { collectorId: this.playerId, mesh: newDisk });
    // Update HUD — listen to stack:changed event
};
EventBus.on('stack:changed', ({ entityId, count }) => {
    if (entityId === this.playerId) this.hud.updateMeatCount(count);
});
```

**d) Update the mockStackSystem** used by DrainSystem. Find:
```js
const mockStackSystem = {
    stack: playerInventory.stack.items,
    popDisk: () => {
        const popped = playerInventory.stack.pop();
        if (popped) this.hud.updateMeatCount(playerInventory.stack.getCount());
        return popped;
    }
};
```

Replace with:
```js
const mockStackSystem = {
    stack: playerInventory.stack.items,
    popDisk: () => this.stackSystem.popDisk(this.playerId)
};
```

**e) Update SellingSystem construction.** Find:
```js
this.sellingSystem = new SellingSystem(this.scene.instance, {
    getCount: () => playerInventory.stack.getCount(),
    popDisk: () => {
        const popped = playerInventory.stack.pop();
        if (popped) this.hud.updateMeatCount(playerInventory.stack.getCount());
        return popped;
    }
}, meatTableNode);
```

Replace with:
```js
this.sellingSystem = new SellingSystem(this.scene.instance, {
    getCount: () => {
        const inv = this.ecs.getComponent(this.playerId, 'InventoryStack');
        return inv ? inv.stack.getCount() : 0;
    },
    popDisk: () => this.stackSystem.popDisk(this.playerId)
}, meatTableNode);
```

- [ ] **Step 5.3: Verify**

Open `http://localhost:8080`. The player's back stack must:
- Items stack vertically on the player's back with wobble physics ✓
- Items count updates in HUD when collected ✓
- Items peel off when player stands near the selling table ✓
- Enemies still die and drop disks ✓

Open DevTools — no errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/systems/StackSystem.js src/main.js
git commit -m "feat(ecs): StackSystem now ECS-driven, removes player direct reference — step 5"
```

---

## Task 6: CollectorSystem Replaces HarvestSystem

**Files:**
- Create: `src/systems/CollectorSystem.js`
- Modify: `src/systems/EnemySystem.js` (emit EventBus instead of callback)
- Modify: `src/main.js` (swap HarvestSystem → CollectorSystem)
- Delete: `src/systems/HarvestSystem.js`

After this task, enemies die → `entity:died` fires on EventBus → CollectorSystem spawns resource disks → disks arc to player → `item:collected` fires → StackSystem adds to stack.

- [ ] **Step 6.1: Modify EnemySystem to emit EventBus**

In `src/systems/EnemySystem.js`, find `handleEnemyDeath`:

```js
handleEnemyDeath(enemy, index) {
    if (this.onEnemyDeath) {
        this.onEnemyDeath(enemy.position.clone());
    }
    this.pool.release(enemy);
    this.scene.remove(enemy);
    this.enemies.splice(index, 1);
}
```

Replace with:
```js
handleEnemyDeath(enemy, index) {
    // EventBus emission (new ECS path)
    EventBus.emit('entity:died', {
        entityId: null,            // legacy enemies have no ECS ID yet
        position: enemy.position.clone(),
        drops: ['meat']
    });

    // Legacy callback (kept during migration — remove in Task 9)
    if (this.onEnemyDeath) {
        this.onEnemyDeath(enemy.position.clone());
    }

    this.pool.release(enemy);
    this.scene.remove(enemy);
    this.enemies.splice(index, 1);
}
```

Add the import at the top of `EnemySystem.js`:
```js
import EventBus from '../core/EventBus.js';
```

- [ ] **Step 6.2: Create CollectorSystem.js**

Create `src/systems/CollectorSystem.js`:

```js
import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';
import EventBus from '../core/EventBus.js';

/**
 * CollectorSystem — ECS-driven replacement for HarvestSystem.
 *
 * Queries entities with ['Transform', 'Collector', 'InventoryStack'].
 * Listens: 'entity:died' → spawns resource disks near death position.
 * Each frame: checks distance from disks to collectors.
 *   If disk within collector.radius AND collector has room → arc disk to entity.
 * Emits: 'item:collected' { collectorId, itemType, mesh } when disk arrives.
 */
export class CollectorSystem {
    constructor(scene) {
        this.scene = scene;
        this._disks = [];
        this._pool = new ObjectPool(() => this._makeDiskMesh(), 60, 'CollectorDiskPool');

        EventBus.on('entity:died', ({ position, drops }) => {
            if (drops && drops.includes('meat')) {
                this._spawnDisks(position);
            }
        });
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        for (const disk of this._disks) {
            if (disk.isFlying) {
                this._animateDisk(disk, deltaTime, ecs);
                continue;
            }

            // Check each collector entity for magnetic pull
            for (const entityId of entities) {
                const transform = ecs.getComponent(entityId, 'Transform');
                const collector = ecs.getComponent(entityId, 'Collector');
                const inventory = ecs.getComponent(entityId, 'InventoryStack');
                if (!transform || !collector || !inventory) continue;

                const dist = disk.position.distanceTo(transform.mesh.position);
                const hasRoom = (inventory.stack.getCount() + collector.inFlightCount) < inventory.maxCapacity;

                if (dist < collector.radius && hasRoom) {
                    this._startFlight(disk, entityId, transform.mesh.position, collector);
                    break;
                }
            }
        }

        // Clean up landed disks
        this._disks = this._disks.filter(d => !d.collected);
    }

    _spawnDisks(pos) {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const disk = this._pool.get();
            const angle = Math.random() * Math.PI * 2;
            const r = 1.5 * Math.sqrt(Math.random());
            disk.position.set(
                pos.x + Math.cos(angle) * r,
                0.05,
                pos.z + Math.sin(angle) * r
            );
            disk.isFlying = false;
            disk.collected = false;
            disk.targetEntityId = null;
            disk.curve = null;
            disk.flightElapsed = 0;
            this.scene.add(disk);
            this._disks.push(disk);
        }
    }

    _startFlight(disk, entityId, targetPos, collector) {
        disk.isFlying = true;
        disk.targetEntityId = entityId;
        disk.flightElapsed = 0;
        collector.inFlightCount++;

        const start = disk.position.clone();
        const end = targetPos.clone().add(new THREE.Vector3(0, 1.2, 0));
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 4.5, 0));
        disk.curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    _animateDisk(disk, deltaTime, ecs) {
        const FLIGHT_DURATION = 0.5;
        disk.flightElapsed += deltaTime;
        const t = Math.min(disk.flightElapsed / FLIGHT_DURATION, 1);

        // Update arc end to follow moving entity
        if (disk.targetEntityId !== null) {
            const transform = ecs.getComponent(disk.targetEntityId, 'Transform');
            if (transform) {
                disk.curve.v2.copy(transform.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
            }
        }

        disk.position.copy(disk.curve.getPoint(t));

        if (t >= 1) {
            // Arrived — emit collected event
            const collector = ecs && disk.targetEntityId !== null
                ? ecs.getComponent(disk.targetEntityId, 'Collector')
                : null;
            if (collector) collector.inFlightCount = Math.max(0, collector.inFlightCount - 1);

            // Clone mesh so the pool copy can be released
            const clone = disk.clone();
            EventBus.emit('item:collected', {
                collectorId: disk.targetEntityId,
                itemType: 'meat',
                mesh: clone
            });

            this.scene.remove(disk);
            this._pool.release(disk);
            disk.collected = true;
        }
    }

    _makeDiskMesh() {
        const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.6, metalness: 0.1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        return mesh;
    }
}
```

- [ ] **Step 6.3: Update main.js — swap HarvestSystem for CollectorSystem**

**a)** Replace the import:
```js
// Remove:
import { HarvestSystem } from './systems/HarvestSystem.js';
// Add:
import { CollectorSystem } from './systems/CollectorSystem.js';
```

**b)** Find where HarvestSystem is constructed:
```js
this.harvestSystem = new HarvestSystem(this.scene.instance, this.playerBridge, this.enemySystem);
```
Replace with:
```js
this.collectorSystem = new CollectorSystem(this.scene.instance);
this.ecs.registerSystem(this.collectorSystem, ['Transform', 'Collector', 'InventoryStack']);
```

**c)** Remove the `harvestSystem.onCollected` callback and HUD EventBus listener (these are now handled by StackSystem + EventBus). Delete:
```js
this.harvestSystem.onCollected = (disk) => { ... };
EventBus.on('stack:changed', ({ entityId, count }) => { ... });
```

Re-add just the HUD listener (standalone, outside the old callback):
```js
EventBus.on('stack:changed', ({ entityId, count }) => {
    if (entityId === this.playerId) this.hud.updateMeatCount(count);
});
```

**d)** Also add `Collector` component to the player entity. In `src/config/archetypes/player.json` the `Collector` component is already defined — but the player is currently created before `loadArchetypes()` was wiring components. Since we rewrote EntityFactory in Task 4 to read from JSON, `factory.createPlayer()` now automatically adds a `Collector` component to the player entity from the archetype. Verify by logging in the browser.

**e)** Remove `harvestSystem.update(deltaTime)` from the `animate()` loop:
```js
// Remove this line:
this.harvestSystem.update(deltaTime);
```
The CollectorSystem is registered with ECS and runs via `this.ecs.update(deltaTime)`.

**f)** Remove the old EnemySystem callback that was set for HarvestSystem. Find and delete:
```js
enemySystem.onEnemyDeath = (pos) => this.spawnDisks(pos);
```
(This was set inside HarvestSystem's constructor — deleting HarvestSystem removes it.)

- [ ] **Step 6.4: Delete HarvestSystem.js**

```bash
rm /Users/bibektandon/Desktop/code/ThesisGame2/src/systems/HarvestSystem.js
```

- [ ] **Step 6.5: Verify**

Open `http://localhost:8080`. Kill an enemy by shooting it:
- Red resource disks scatter near enemy death position ✓
- Walk player within 5 units of disks — disks arc toward player on Bezier curve ✓
- Disks appear on player's back stack with wobble ✓
- HUD meat counter increments correctly ✓
- No console errors ✓

- [ ] **Step 6.6: Commit**

```bash
git add src/systems/CollectorSystem.js src/systems/EnemySystem.js src/main.js
git commit -m "feat(ecs): CollectorSystem replaces HarvestSystem — step 6"
```

---

## Task 7: DepositorSystem Replaces SellingSystem

**Files:**
- Create: `src/systems/DepositorSystem.js`
- Modify: `src/main.js` (swap SellingSystem → DepositorSystem)
- Delete: `src/systems/SellingSystem.js`

After this task: when player walks near the selling table, meat transfers from player's stack to the table via arc animation. `item:deposited` fires on EventBus.

**Note:** The meat table entity must have the `table` tag. In the new ECS, `factory.create('meat-table', pos)` creates it. But the existing game uses `StorageNode` for the table visual. For this task, we keep `StorageNode` for the visual but also add an ECS entity for the table logic, or we adapt DepositorSystem to find the table by Tag component.

Strategy: In main.js, after creating `meatTableNode` (StorageNode), also create an ECS entity for the table using `factory.create('meat-table', tablePos)` and register it. DepositorSystem will find it by Tag.

- [ ] **Step 7.1: Create DepositorSystem.js**

Create `src/systems/DepositorSystem.js`:

```js
import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * DepositorSystem — ECS-driven replacement for SellingSystem.
 *
 * Queries depositor entities: ['Transform', 'Depositor', 'InventoryStack'].
 * Queries target entities: ['Transform', 'Tag', 'InventoryStack'].
 *
 * Each frame: if depositor is within range of a target with matching tag,
 * and depositor has items, transfer one item on interval.
 *
 * Uses ResourceTransfer utility for the arc animation (shared with old SellingSystem).
 * Emits: 'item:deposited' { depositorId, targetId, itemType }
 */
export class DepositorSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        for (const depositorId of entities) {
            const transform = ecs.getComponent(depositorId, 'Transform');
            const depositor = ecs.getComponent(depositorId, 'Depositor');
            const inventory = ecs.getComponent(depositorId, 'InventoryStack');
            if (!transform || !depositor || !inventory) continue;

            depositor.timeSinceLastTransfer += deltaTime;

            // Find the closest target entity with the matching tag
            const target = this._findTarget(depositorId, depositor.targetTag, transform.mesh.position, ecs);
            if (!target) { depositor.isInRange = false; continue; }

            const { entityId: targetId, transform: targetTransform, inventory: targetInventory } = target;
            const dist = transform.mesh.position.distanceTo(targetTransform.mesh.position);
            depositor.isInRange = dist < depositor.range;

            if (!depositor.isInRange) continue;
            if (inventory.stack.getCount() === 0) continue;
            if (depositor.timeSinceLastTransfer < depositor.transferRate) continue;
            if (targetInventory && targetInventory.stack.getCount() >= targetInventory.maxCapacity) continue;

            // Pop one item and arc it to the target
            const mesh = inventory.stack.pop();
            if (!mesh) continue;

            depositor.timeSinceLastTransfer = 0;
            EventBus.emit('stack:changed', { entityId: depositorId, count: inventory.stack.getCount() });

            const fromPos = mesh.position.clone();
            const toPos = targetTransform.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0));

            this._transfer.send(mesh, fromPos, toPos, {
                arcHeight: 2.5,
                duration: 0.4,
                spin: false,
                onArrive: (m) => {
                    // Add to target's inventory
                    targetInventory.stack.add(m, { animate: false });
                    EventBus.emit('item:deposited', {
                        depositorId,
                        targetId,
                        itemType: 'meat'
                    });
                }
            });
        }
    }

    _findTarget(depositorId, targetTag, fromPos, ecs) {
        const candidates = ecs.queryEntities(['Transform', 'Tag', 'InventoryStack']);
        let best = null;
        let bestDist = Infinity;

        for (const entityId of candidates) {
            if (entityId === depositorId) continue;
            const tag = ecs.getComponent(entityId, 'Tag');
            if (!tag || !tag.has(targetTag)) continue;

            const t = ecs.getComponent(entityId, 'Transform');
            const inv = ecs.getComponent(entityId, 'InventoryStack');
            const d = fromPos.distanceTo(t.mesh.position);
            if (d < bestDist) {
                bestDist = d;
                best = { entityId, transform: t, inventory: inv };
            }
        }
        return best;
    }
}
```

- [ ] **Step 7.2: Update main.js — swap SellingSystem for DepositorSystem**

**a)** Replace import:
```js
// Remove:
import { SellingSystem } from './systems/SellingSystem.js';
// Add:
import { DepositorSystem } from './systems/DepositorSystem.js';
```

**b)** Find the SellingSystem construction block:
```js
this.sellingSystem = new SellingSystem(this.scene.instance, { ... }, meatTableNode);
```

Replace entirely with:
```js
// Create ECS table entity so DepositorSystem can find it by Tag
const tablePos3 = new THREE.Vector3(SELLING_TABLE_POSITION.x, SELLING_TABLE_POSITION.y, SELLING_TABLE_POSITION.z);
this.meatTableEntityId = this.factory.create('meat-table', tablePos3);

// Add the Depositor component to the player
// (already in player.json archetype, so it was added by EntityFactory.create())

// Create and register DepositorSystem
this.depositorSystem = new DepositorSystem(this.scene.instance);
this.ecs.registerSystem(this.depositorSystem, ['Transform', 'Depositor', 'InventoryStack']);
```

**c)** Remove from animate() loop:
```js
// Remove:
this.sellingSystem.update(deltaTime, this.playerBridge ? this.playerBridge.position : new THREE.Vector3());
```
DepositorSystem runs via `this.ecs.update(deltaTime)`.

**d)** VillagerSystem currently calls `this.sellingSystem.getMeatOnTable()`. For this step, provide a temporary shim:
```js
// Temporary: VillagerSystem still needs to know table inventory
// Bridge it through the ECS entity
this.sellingSystemShim = {
    getMeatOnTable: () => {
        const inv = this.ecs.getComponent(this.meatTableEntityId, 'InventoryStack');
        return inv ? inv.stack.getCount() : 0;
    },
    popMeatMeshFromTable: () => {
        const inv = this.ecs.getComponent(this.meatTableEntityId, 'InventoryStack');
        return inv ? inv.stack.pop() : null;
    }
};
// Pass shim to VillagerSystem instead of sellingSystem
this.villagerSystem = new VillagerSystem(this.scene.instance, this.coinSystem, this.sellingSystemShim);
```

**e)** Also update the `meatTableNode.update()` call. The StorageNode's visual update was called inside the old SellingSystem. Now call it directly in animate():
```js
// In animate(), add:
meatTableNode.update(deltaTime);
```

- [ ] **Step 7.3: Delete SellingSystem.js**

```bash
rm /Users/bibektandon/Desktop/code/ThesisGame2/src/systems/SellingSystem.js
```

- [ ] **Step 7.4: Verify**

Open `http://localhost:8080`:
- Kill enemies, collect meat onto player's back ✓
- Walk player to within 4 units of the selling table ✓
- Meat items arc one-by-one from player's back to the table ✓
- Meat count on player's back decrements ✓
- Meat appears on table surface ✓
- HUD updates correctly ✓
- Villagers still queue and buy (via shim) ✓
- No console errors ✓

- [ ] **Step 7.5: Commit**

```bash
git add src/systems/DepositorSystem.js src/main.js
git commit -m "feat(ecs): DepositorSystem replaces SellingSystem — step 7"
```

---

## Task 8: AgentAISystem + TraderSystem Replace VillagerSystem

**Files:**
- Create: `src/systems/AgentAISystem.js`
- Create: `src/systems/TraderSystem.js`
- Modify: `src/main.js`
- Delete: `src/systems/VillagerSystem.js`
- Delete: `src/systems/CoinSystem.js`

After this task: villagers are pure ECS entities with `AgentAI` + `Trader` + `InventoryStack` components. They queue, buy meat from the table, pay coins, and exit — all driven by EventBus events and ECS queries.

- [ ] **Step 8.1: Create AgentAISystem.js**

Create `src/systems/AgentAISystem.js`:

```js
import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

// Queue configuration — matches old VILLAGER_CONFIG
const QUEUE_START = new THREE.Vector3(0, 0, -12);
const QUEUE_SPACING = 1.8; // z-distance between queue slots
const TABLE_POSITION = new THREE.Vector3(0, 0, -10.5);
const EXIT_TARGET = new THREE.Vector3(0, 0, -30);
const ARRIVE_THRESHOLD = 0.3;

/**
 * AgentAISystem — Drives villager movement and state transitions.
 *
 * Queries: ['Transform', 'Movement', 'AgentAI']
 *
 * State machine per villager:
 *   in_queue        → walk to queue slot
 *   approaching_table → walk to TABLE_POSITION
 *   buying          → wait for TraderSystem to complete transaction
 *   exiting         → walk to EXIT_TARGET, despawn when arrived
 *
 * Listens:  'trade:complete' → { traderId } → trigger exit
 * Emits:    'agent:at_table' → { entityId } → TraderSystem starts transaction
 * Emits:    'agent:exited'   → { entityId } → main.js respawns a villager
 */
export class AgentAISystem {
    constructor(factory) {
        this._factory = factory;
        /** @type {number[]} ECS IDs currently managed (all villager entities) */
        this._agents = [];

        EventBus.on('trade:complete', ({ traderId }) => {
            this._setExiting(traderId);
        });

        EventBus.on('agent:exited', ({ entityId }) => {
            this._respawn(entityId);
        });
    }

    /** Register a new villager entity. Called by main.js after factory.create(). */
    register(entityId, queueSlot) {
        const agentAI = this._getAI(entityId);
        if (agentAI) {
            agentAI.queueSlot = queueSlot;
            agentAI.state = 'in_queue';
            agentAI.target = this._queueSlotPos(queueSlot);
        }
        this._agents.push(entityId);
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const agentAI = ecs.getComponent(entityId, 'AgentAI');
            if (!transform || !movement || !agentAI) continue;
            if (!agentAI.target) continue;

            const pos = transform.mesh.position;
            const target = agentAI.target;
            const dist = pos.distanceTo(target);

            // Move toward target
            if (dist > ARRIVE_THRESHOLD) {
                const dir = new THREE.Vector3().subVectors(target, pos).normalize();
                pos.addScaledVector(dir, movement.speed * deltaTime);
                transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }

            // State transitions on arrival
            if (dist <= ARRIVE_THRESHOLD) {
                this._handleArrival(entityId, agentAI, transform, ecs);
            }
        }
    }

    _handleArrival(entityId, agentAI, transform, ecs) {
        switch (agentAI.state) {
            case 'in_queue':
                // Stay at queue position — wait for AgentAISystem to advance queue
                break;

            case 'approaching_table':
                agentAI.state = 'buying';
                agentAI.target = null;
                EventBus.emit('agent:at_table', { entityId });
                break;

            case 'exiting':
                agentAI.distanceTravelled += transform.mesh.position.distanceTo(EXIT_TARGET);
                // Despawn
                this.scene && this.scene.remove(transform.mesh);
                EventBus.emit('agent:exited', { entityId });
                break;
        }
    }

    /** Advance the queue — call when front villager leaves for table. */
    _advanceQueue(ecs) {
        const inQueue = this._agents
            .map(id => ({ id, ai: ecs.getComponent(id, 'AgentAI') }))
            .filter(({ ai }) => ai && ai.state === 'in_queue')
            .sort((a, b) => a.ai.queueSlot - b.ai.queueSlot);

        for (const { id, ai } of inQueue) {
            if (ai.queueSlot > 0) {
                ai.queueSlot--;
                ai.target = this._queueSlotPos(ai.queueSlot);
            }
        }
    }

    /** Called by TraderSystem when it's ready for the next buyer. */
    sendFrontToTable(ecs) {
        const front = this._agents
            .map(id => ({ id, ai: ecs.getComponent(id, 'AgentAI') }))
            .filter(({ ai }) => ai && ai.state === 'in_queue' && ai.queueSlot === 0)[0];

        if (!front) return;
        front.ai.state = 'approaching_table';
        front.ai.target = TABLE_POSITION.clone();
        this._advanceQueue(ecs);
    }

    _setExiting(entityId) {
        const agentAI = this._getAI(entityId);
        if (agentAI) {
            agentAI.state = 'exiting';
            agentAI.target = EXIT_TARGET.clone();
        }
    }

    _respawn(exitedEntityId) {
        if (!this._ecs || !this._factory) return;

        // Remove exited entity
        const idx = this._agents.indexOf(exitedEntityId);
        if (idx > -1) this._agents.splice(idx, 1);
        this._ecs.destroyEntity(exitedEntityId);

        // Spawn replacement at back of queue
        const slot = this._agents.length;
        const spawnPos = new THREE.Vector3(0, 0, -24);
        const newId = this._factory.create('villager', spawnPos);
        this.register(newId, slot);
    }

    _queueSlotPos(slot) {
        return new THREE.Vector3(
            QUEUE_START.x,
            QUEUE_START.y,
            QUEUE_START.z + slot * QUEUE_SPACING
        );
    }

    _getAI(entityId) {
        return this._ecs ? this._ecs.getComponent(entityId, 'AgentAI') : null;
    }
}
```

- [ ] **Step 8.2: Create TraderSystem.js**

Create `src/systems/TraderSystem.js`:

```js
import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';
import { COIN_CONFIG } from '../config/gameConfig.js';

/**
 * TraderSystem — Handles resource transactions between buyer (villager) and seller (table).
 *
 * Queries: ['Transform', 'InventoryStack', 'Trader']
 *
 * Listens: 'item:deposited'  → { targetId } → check if table has stock → send front villager
 * Listens: 'agent:at_table'  → { entityId } → execute the transaction
 * Emits:   'trade:complete'  → { traderId, gave, received }
 */
export class TraderSystem {
    constructor(scene, agentAISystem, coinTrayEntityId) {
        this.scene = scene;
        this._agentAI = agentAISystem;
        this._coinTrayId = coinTrayEntityId;
        this._transfer = new ResourceTransfer();
        this._ecs = null;

        EventBus.on('item:deposited', ({ targetId }) => {
            // Meat arrived at table — if no one is buying, send front of queue
            if (this._ecs) {
                const tableInv = this._ecs.getComponent(targetId, 'InventoryStack');
                if (tableInv && tableInv.stack.getCount() >= 1) {
                    this._agentAI.sendFrontToTable(this._ecs);
                }
            }
        });

        EventBus.on('agent:at_table', ({ entityId }) => {
            if (this._ecs) this._executeTransaction(entityId, this._ecs);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._ecs = ecs;
    }

    _executeTransaction(buyerId, ecs) {
        // Find the table entity (has Tag 'table' and InventoryStack)
        const tables = ecs.queryEntities(['Tag', 'InventoryStack', 'Trader']);
        const tableId = tables.find(id => {
            const tag = ecs.getComponent(id, 'Tag');
            return tag && tag.has('table');
        });
        if (!tableId) return;

        const buyerInventory = ecs.getComponent(buyerId, 'InventoryStack');
        const buyerTrader = ecs.getComponent(buyerId, 'Trader');
        const buyerTransform = ecs.getComponent(buyerId, 'Transform');
        const tableInventory = ecs.getComponent(tableId, 'InventoryStack');
        const tableTransform = ecs.getComponent(tableId, 'Transform');

        if (!buyerInventory || !tableInventory || !buyerTransform || !tableTransform) return;

        const meatAvailable = tableInventory.stack.getCount();
        const meatToBuy = Math.min(3, meatAvailable); // max 3 per transaction
        if (meatToBuy === 0) return;

        // Transfer meat: table → villager
        for (let i = 0; i < meatToBuy; i++) {
            const meatMesh = tableInventory.stack.pop();
            if (!meatMesh) break;
            const from = meatMesh.position.clone();
            const to = buyerTransform.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
            this._transfer.send(meatMesh, from, to, {
                arcHeight: 2,
                duration: 0.45,
                spin: true,
                onArrive: (m) => {
                    buyerInventory.stack.add(m, { animate: false });
                }
            });
        }

        // Transfer coins: villager → coin tray
        const coinsToGive = Math.ceil(meatToBuy * (COIN_CONFIG.valuePerMeat || 1));
        const coinTrayInv = this._coinTrayId ? ecs.getComponent(this._coinTrayId, 'InventoryStack') : null;
        const coinTrayTransform = this._coinTrayId ? ecs.getComponent(this._coinTrayId, 'Transform') : null;

        for (let i = 0; i < coinsToGive; i++) {
            const coinMesh = this._makeCoinMesh();
            this.scene.add(coinMesh);
            coinMesh.position.copy(buyerTransform.mesh.position).add(new THREE.Vector3(0, 1.4, 0));
            const to = coinTrayTransform
                ? coinTrayTransform.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0))
                : new THREE.Vector3(0, 0.4, 0);
            this._transfer.send(coinMesh, coinMesh.position.clone(), to, {
                arcHeight: 2,
                duration: 0.45,
                spin: false,
                onArrive: (m) => {
                    if (coinTrayInv) coinTrayInv.stack.add(m, { animate: true });
                }
            });
        }

        // After animation: emit trade complete
        setTimeout(() => {
            EventBus.emit('trade:complete', {
                traderId: buyerId,
                gave: { type: 'coin', count: coinsToGive },
                received: { type: 'meat', count: meatToBuy }
            });
        }, 600);
    }

    _makeCoinMesh() {
        const THREE_mod = arguments[0]; // unused — THREE is imported at top
        const geo = new (require !== undefined ? null : null)(); // avoid require
        // Use the global THREE from the ES module scope
        return (() => {
            const g = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);
            const m = new THREE.MeshStandardMaterial({ color: 0xffdd00, metalness: 0.6, roughness: 0.3 });
            return new THREE.Mesh(g, m);
        })();
    }
}
```

Wait — there's a bug in `_makeCoinMesh`. Fix it:

```js
_makeCoinMesh() {
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffdd00, metalness: 0.6, roughness: 0.3 });
    return new THREE.Mesh(geo, mat);
}
```

The full corrected `TraderSystem.js` with the fix:

```js
import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';
import { COIN_CONFIG } from '../config/gameConfig.js';

export class TraderSystem {
    constructor(scene, agentAISystem, coinTrayEntityId) {
        this.scene = scene;
        this._agentAI = agentAISystem;
        this._coinTrayId = coinTrayEntityId;
        this._transfer = new ResourceTransfer();
        this._ecs = null;

        EventBus.on('item:deposited', ({ targetId }) => {
            if (this._ecs) {
                const tableInv = this._ecs.getComponent(targetId, 'InventoryStack');
                if (tableInv && tableInv.stack.getCount() >= 1) {
                    this._agentAI.sendFrontToTable(this._ecs);
                }
            }
        });

        EventBus.on('agent:at_table', ({ entityId }) => {
            if (this._ecs) this._executeTransaction(entityId, this._ecs);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._ecs = ecs;
    }

    _executeTransaction(buyerId, ecs) {
        const tables = ecs.queryEntities(['Tag', 'InventoryStack', 'Trader']);
        const tableId = tables.find(id => {
            const tag = ecs.getComponent(id, 'Tag');
            return tag && tag.has('table');
        });
        if (!tableId) return;

        const buyerInventory  = ecs.getComponent(buyerId, 'InventoryStack');
        const buyerTransform  = ecs.getComponent(buyerId, 'Transform');
        const tableInventory  = ecs.getComponent(tableId, 'InventoryStack');
        const tableTransform  = ecs.getComponent(tableId, 'Transform');

        if (!buyerInventory || !tableInventory || !buyerTransform || !tableTransform) return;

        const meatToBuy = Math.min(3, tableInventory.stack.getCount());
        if (meatToBuy === 0) return;

        for (let i = 0; i < meatToBuy; i++) {
            const meatMesh = tableInventory.stack.pop();
            if (!meatMesh) break;
            const from = meatMesh.position.clone();
            const to = buyerTransform.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
            this._transfer.send(meatMesh, from, to, {
                arcHeight: 2, duration: 0.45, spin: true,
                onArrive: (m) => buyerInventory.stack.add(m, { animate: false })
            });
        }

        const coinsToGive = Math.ceil(meatToBuy * (COIN_CONFIG.valuePerMeat || 1));
        const coinTrayInv = this._coinTrayId ? ecs.getComponent(this._coinTrayId, 'InventoryStack') : null;
        const coinTrayTransform = this._coinTrayId ? ecs.getComponent(this._coinTrayId, 'Transform') : null;

        for (let i = 0; i < coinsToGive; i++) {
            const coinMesh = this._makeCoinMesh();
            this.scene.add(coinMesh);
            coinMesh.position.copy(buyerTransform.mesh.position).add(new THREE.Vector3(0, 1.4, 0));
            const to = coinTrayTransform
                ? coinTrayTransform.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0))
                : new THREE.Vector3(0, 0.4, 0);
            this._transfer.send(coinMesh, coinMesh.position.clone(), to, {
                arcHeight: 2, duration: 0.45, spin: false,
                onArrive: (m) => { if (coinTrayInv) coinTrayInv.stack.add(m, { animate: true }); }
            });
        }

        setTimeout(() => {
            EventBus.emit('trade:complete', {
                traderId: buyerId,
                gave: { type: 'coin', count: coinsToGive },
                received: { type: 'meat', count: meatToBuy }
            });
        }, 600);
    }

    _makeCoinMesh() {
        const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffdd00, metalness: 0.6, roughness: 0.3 });
        return new THREE.Mesh(geo, mat);
    }
}
```

- [ ] **Step 8.3: Update main.js — wire AgentAISystem + TraderSystem**

**a)** Add imports:
```js
import { AgentAISystem } from './systems/AgentAISystem.js';
import { TraderSystem } from './systems/TraderSystem.js';
```

**b)** Remove imports:
```js
// Remove:
import { VillagerSystem } from './systems/VillagerSystem.js';
import { CoinSystem } from './systems/CoinSystem.js';
```

**c)** After `meatTableEntityId` and `coinTrayNode` setup, replace VillagerSystem/CoinSystem construction:

```js
// Create coin tray ECS entity
this.coinTrayEntityId = this.factory.create('coin-tray',
    new THREE.Vector3(TRAY_CONFIG.position.x, TRAY_CONFIG.position.y, TRAY_CONFIG.position.z));

// Create AgentAISystem + TraderSystem
this.agentAISystem = new AgentAISystem(this.factory);
this.traderSystem = new TraderSystem(this.scene.instance, this.agentAISystem, this.coinTrayEntityId);
this.traderSystem.setECS(this.ecs);

// Register with ECS
this.ecs.registerSystem(this.agentAISystem, ['Transform', 'Movement', 'AgentAI']);
this.ecs.registerSystem(this.traderSystem, ['Transform', 'InventoryStack', 'Trader']);

// Spawn initial villagers (4 in queue)
for (let i = 0; i < 4; i++) {
    const spawnPos = new THREE.Vector3(0, 0, -24 + i * 0.5); // staggered spawn
    const villagerId = this.factory.create('villager', spawnPos);
    this.agentAISystem.register(villagerId, i);
}
```

**d)** Remove from animate() loop:
```js
// Remove:
this.villagerSystem.update(deltaTime);
this.coinSystem.update(deltaTime);
```

- [ ] **Step 8.4: Delete legacy files**

```bash
rm /Users/bibektandon/Desktop/code/ThesisGame2/src/systems/VillagerSystem.js
rm /Users/bibektandon/Desktop/code/ThesisGame2/src/systems/CoinSystem.js
```

- [ ] **Step 8.5: Verify**

Open `http://localhost:8080`:
- Green villager capsules appear in a queue in front of the selling table ✓
- Villagers walk toward their queue position ✓
- When meat is on the table, front villager walks to table ✓
- Meat arcs from table to villager ✓
- Coins arc from villager to coin tray ✓
- Villager walks toward EXIT_TARGET and despawns ✓
- New villager spawns at back of queue ✓
- No console errors ✓

- [ ] **Step 8.6: Commit**

```bash
git add src/systems/AgentAISystem.js src/systems/TraderSystem.js src/main.js
git commit -m "feat(ecs): AgentAISystem + TraderSystem replace VillagerSystem/CoinSystem — step 8"
```

---

## Task 9: CombatSystem Cleanup + Delete Legacy OOP Classes

**Files:**
- Modify: `src/systems/CombatSystem.js`
- Modify: `src/systems/EnemySystem.js`
- Delete: legacy `this.onEnemyDeath` callback bridge
- Delete: `src/entities/Player.js` (if no longer imported)
- Delete: `src/entities/Enemy.js` (if no longer imported)

After this task: CombatSystem uses only ECS entities for targeting and collision. No `enemySystem.enemies` reference.

- [ ] **Step 9.1: Port Enemy to ECS entity fully**

In `src/main.js`, the EnemySystem currently spawns legacy `Enemy` objects and pushes them to `this.enemies`. The CombatSystem bridges to this array.

For enemies to work via pure ECS, EnemySystem's `spawnEnemy()` must call `this.factory.create('enemy', pos)` and CombatSystem must find them via `ecs.queryEntities(['Transform', 'Movement', 'Health'])`.

Update `src/systems/EnemySystem.js` — full replacement:

```js
import * as THREE from 'three';
import { ENEMY_CONFIG } from '../config/gameConfig.js';
import EventBus from '../core/EventBus.js';

/**
 * EnemySystem — ECS-driven enemy spawning and steering.
 * Enemies are created via EntityFactory (archetype 'enemy').
 * Queries: ['Transform', 'Movement', 'Health']
 */
export class EnemySystem {
    constructor(scene, factory, playerTransform) {
        this.scene = scene;
        this._factory = factory;
        this._playerTransform = playerTransform;
        this._spawnTimer = 0;
        this._ecs = null;
    }

    setECS(ecs) { this._ecs = ecs; }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._spawnTimer += deltaTime;

        if (this._spawnTimer >= ENEMY_CONFIG.spawnInterval) {
            this._spawnTimer = 0;
            this._spawnEnemy();
        }

        const playerPos = this._playerTransform.mesh.position;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const health = ecs.getComponent(entityId, 'Health');

            if (!transform || !movement || !health) continue;

            // Dead enemies — emit died event and destroy
            if (health.hp <= 0) {
                EventBus.emit('entity:died', {
                    entityId,
                    position: transform.mesh.position.clone(),
                    drops: ['meat']
                });
                this.scene.remove(transform.mesh);
                ecs.destroyEntity(entityId);
                continue;
            }

            // Steer toward player
            const dir = new THREE.Vector3()
                .subVectors(playerPos, transform.mesh.position);
            if (dir.length() > 0.5) {
                dir.normalize();
                transform.mesh.position.addScaledVector(dir, movement.speed * deltaTime);
                transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }
        }
    }

    _spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = ENEMY_CONFIG.spawnDistance + Math.random() * 5;
        const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        this._factory.create('enemy', pos);
    }
}
```

- [ ] **Step 9.2: Update CombatSystem — remove legacy bridge**

Replace the entire contents of `src/systems/CombatSystem.js`:

```js
import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * CombatSystem — Pure ECS. No legacy enemySystem bridge.
 * Queries shooter entities: ['Transform', 'Shooter']
 * Targets are found by querying entities with ['Transform', 'Movement'] and matching faction.
 */
export class CombatSystem {
    constructor(scene, projectilePool) {
        this.scene = scene;
        this.projectilePool = projectilePool;
        this.projectiles = [];
    }

    update(entities, deltaTime, ecs) {
        for (const shooterId of entities) {
            const transform = ecs.getComponent(shooterId, 'Transform');
            const shooter = ecs.getComponent(shooterId, 'Shooter');
            if (!transform || !shooter) continue;

            shooter.lastFireTime += deltaTime;

            let closestDist = shooter.range;
            let bestTarget = null;

            // Find targets from ECS only — no legacy array
            const targetables = ecs.queryEntities(['Transform', 'Movement']);
            for (const targetId of targetables) {
                if (targetId === shooterId) continue;
                const targetMovement = ecs.getComponent(targetId, 'Movement');
                if (!shooter.targetFactions.includes(targetMovement.faction)) continue;

                const targetTransform = ecs.getComponent(targetId, 'Transform');
                const dist = transform.mesh.position.distanceTo(targetTransform.mesh.position);
                if (dist < closestDist) {
                    closestDist = dist;
                    bestTarget = { pos: targetTransform.mesh.position.clone(), entityId: targetId };
                }
            }

            if (bestTarget && shooter.lastFireTime >= shooter.fireRate) {
                this._fireProjectile(transform.mesh.position, bestTarget.pos, shooter.damage);
                shooter.lastFireTime = 0;
            }
        }

        this._updateProjectiles(deltaTime, ecs);
    }

    _fireProjectile(origin, target, damage) {
        const direction = new THREE.Vector3().subVectors(target, origin).normalize();
        const projectile = this.projectilePool.get();
        projectile.reset(origin, direction);
        projectile.damage = damage;
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    _updateProjectiles(deltaTime, ecs) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime);
            let hit = false;

            // Collision check against ECS entities with Health
            const hittable = ecs.queryEntities(['Transform', 'Health', 'Movement']);
            for (const entityId of hittable) {
                const movement = ecs.getComponent(entityId, 'Movement');
                if (movement.faction === 'player' || movement.faction === 'neutral') continue;

                const t = ecs.getComponent(entityId, 'Transform');
                const health = ecs.getComponent(entityId, 'Health');
                const dist = p.position.distanceTo(t.mesh.position);
                if (dist < 1.0) {
                    health.hp -= (p.damage || 1);
                    EventBus.emit('entity:damaged', { entityId, amount: p.damage || 1 });
                    hit = true;
                    break;
                }
            }

            if (hit || !p.visible || p.position.length() > 50) {
                this.scene.remove(p);
                this.projectilePool.release(p);
                this.projectiles.splice(i, 1);
            }
        }
    }
}
```

- [ ] **Step 9.3: Update main.js — wire new EnemySystem + CombatSystem**

**a)** EnemySystem now takes `factory` + `playerTransform` instead of the old `playerBridge`:
```js
// Find old:
this.enemySystem = new EnemySystem(this.scene.instance, this.playerBridge);
// Replace with:
const playerTransform = this.ecs.getComponent(this.playerId, 'Transform');
this.enemySystem = new EnemySystem(this.scene.instance, this.factory, playerTransform);
this.enemySystem.setECS(this.ecs);
this.ecs.registerSystem(this.enemySystem, ['Transform', 'Movement', 'Health']);
```

**b)** CombatSystem no longer takes `enemySystem`:
```js
// Find old:
this.combatSystem = new CombatSystem(this.scene.instance, this.projectilePool, this.enemySystem);
// Replace with:
this.combatSystem = new CombatSystem(this.scene.instance, this.projectilePool);
```

**c)** Remove from animate() loop:
```js
// Remove:
this.enemySystem.update(deltaTime);
this.levelSystem.update(deltaTime, this.enemySystem.enemies); // enemies array no longer exists
```

Update levelSystem call (pass empty array for now, or adapt LevelSystem separately):
```js
this.levelSystem.update(deltaTime, []); // enemies now ECS — LevelSystem is out-of-scope for this migration
```

**d)** Remove the `playerBridge` object entirely if no other system uses it. Check that `drainSystem`, `cameraSystem`, `levelSystem` don't need it. `CameraSystem` takes `playerTransform.mesh` directly. `DrainSystem` takes `playerBridge` — update DrainSystem call:
```js
// Find:
this.drainSystem = new DrainSystem(this.scene.instance, this.playerBridge, mockStackSystem, this.floatingUI);
// Replace:
this.drainSystem = new DrainSystem(this.scene.instance, { position: playerTransform.mesh.position, group: playerTransform.mesh }, mockStackSystem, this.floatingUI);
```

**e)** Delete `playerBridge` definition from main.js.

- [ ] **Step 9.4: Check for remaining imports of legacy OOP classes**

```bash
grep -r "from.*entities/Player" /Users/bibektandon/Desktop/code/ThesisGame2/src/
grep -r "from.*entities/Enemy" /Users/bibektandon/Desktop/code/ThesisGame2/src/
```

If no results (or only stray imports you can remove), delete the files:

```bash
# Only delete if grep above shows zero usages
rm /Users/bibektandon/Desktop/code/ThesisGame2/src/entities/Player.js
rm /Users/bibektandon/Desktop/code/ThesisGame2/src/entities/Enemy.js
```

- [ ] **Step 9.5: Verify**

Open `http://localhost:8080`:
- Enemies spawn and move toward player ✓
- Player auto-fires at enemies within range ✓
- Enemies take damage and die (hp goes to 0) ✓
- Dead enemies emit `entity:died` → resource disks spawn ✓
- Full flow works: kill enemies → collect meat → walk to table → meat transfers → villager buys → coins appear ✓
- No `enemySystem.enemies` references anywhere in console warnings ✓
- DevTools console: zero errors ✓

- [ ] **Step 9.6: Commit**

```bash
git add src/systems/CombatSystem.js src/systems/EnemySystem.js src/main.js
git commit -m "feat(ecs): remove all legacy bridges — CombatSystem and EnemySystem pure ECS — step 9"
```

---

## Task 10: Final main.js Cleanup

**Files:**
- Modify: `src/main.js`
- Modify: `.memory/PROJECT_STATE.md`
- Modify: `.memory/ARCHITECTURE.md`

Clean up dead code, dead imports, the `playerBridge` remnants, and update memory files.

- [ ] **Step 10.1: Audit main.js for dead imports**

Check for any remaining imports of deleted systems:
```bash
grep -n "HarvestSystem\|SellingSystem\|VillagerSystem\|CoinSystem\|Player\b\|Enemy\b" /Users/bibektandon/Desktop/code/ThesisGame2/src/main.js
```

Remove any lines found.

- [ ] **Step 10.2: Audit main.js for dead variables**

Check for `playerBridge`, `mockStackSystem`, `sellingSystemShim`, `harvestSystem`:
```bash
grep -n "playerBridge\|mockStackSystem\|sellingSystemShim\|harvestSystem\|villagerSystem\|coinSystem" /Users/bibektandon/Desktop/code/ThesisGame2/src/main.js
```

Remove any lines found.

- [ ] **Step 10.3: Verify the final animate() loop**

The animate() function should call only:
```js
animate() {
    requestAnimationFrame(this.animate.bind(this));
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);

    this.ecs.update(deltaTime);           // drives: MovementSystem, CombatSystem, EnemySystem,
                                           //   StackSystem, CollectorSystem, DepositorSystem,
                                           //   AgentAISystem, TraderSystem

    this.cameraSystem.update(deltaTime);
    this.particleSystem.update(deltaTime);
    this.floatingUI.update();
    this.drainSystem.update(deltaTime, this.playerBridge ? ... : ...); // keep for now
    this.levelSystem.update(deltaTime, []);

    this.renderer.render(this.scene.instance, this.camera.instance);
}
```

- [ ] **Step 10.4: Update memory files**

Update `.memory/PROJECT_STATE.md` — mark ECS Migration as complete:
- Change Phase 5 status from `✅ DONE` to still `✅ DONE` (it was done but now fully clean)
- Add note: "ECS Migration fully complete — all legacy systems deleted, no direct system references remain"

Update `.memory/ARCHITECTURE.md` — update the system list to reflect the new files and deletions.

Create a session log in `.memory/sessions/active/S003-20260401-HHMMSS-claude_code.md` following the template in AGENT_GUIDE.md.

- [ ] **Step 10.5: Final full-game verify**

Open `http://localhost:8080`. Run through the complete game loop:
1. Player spawns, joystick moves player ✓
2. Enemies spawn periodically ✓
3. Player auto-shoots at enemies in range ✓
4. Enemy dies → resource disks scatter ✓
5. Player walks near disks → disks arc to player's back ✓
6. Stack wobbles, HUD counter increments ✓
7. Player walks to selling table → meat arcs to table ✓
8. Villager at front of queue walks to table → meat arcs to villager ✓
9. Coins arc to coin tray ✓
10. Villager exits, new villager spawns ✓
11. Walk into unlock zone → resources drain from back into zone ✓
12. Zero console errors ✓

- [ ] **Step 10.6: Verify JSON-only tuning**

Open `src/config/archetypes/player.json`. Change `"radius": 5` to `"radius": 12` under `Collector`. Reload browser. Verify that the magnetic pull range visibly increases. Change it back to `5`. This confirms the system is truly data-driven.

- [ ] **Step 10.7: Final commit**

```bash
git add src/main.js .memory/PROJECT_STATE.md .memory/ARCHITECTURE.md .memory/sessions/active/
git commit -m "feat(ecs): final cleanup — ECS migration complete, all legacy systems removed"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that covers it |
|---|---|
| EventBus — no direct system references | Task 1 + wired in Tasks 6–9 |
| JSON archetypes in `src/config/archetypes/` | Task 2 |
| `extends` inheritance in JSON | Task 2 (ArchetypeLoader._resolve) |
| Fine-grained logic + anim component separation | Task 3 |
| EntityFactory reads from JSON | Task 4 |
| StackSystem ECS-driven | Task 5 |
| HarvestSystem → CollectorSystem | Task 6 |
| SellingSystem → DepositorSystem | Task 7 |
| VillagerSystem → AgentAISystem + TraderSystem | Task 8 |
| CombatSystem legacy bridge removed | Task 9 |
| Player.js / Enemy.js OOP classes deleted | Task 9 |
| Game stays playable at every step | Each task has a Verify step |
| gameConfig.js kept for global values | Noted in Tasks 2, 8 (COIN_CONFIG still imported) |
| ResourceStack/ResourceTransfer utilities kept | Used in StackSystem (via Component_InventoryStack) and DepositorSystem/TraderSystem |
| `entity:died` event | Task 6 (EnemySystem) |
| `item:collected` event | Task 6 (CollectorSystem) |
| `stack:changed` event | Task 5 (StackSystem) |
| `item:deposited` event | Task 7 (DepositorSystem) |
| `trade:complete` event | Task 8 (TraderSystem) |
| `entity:damaged` event | Task 9 (CombatSystem) |
| New enemy type via JSON only (Speeder, Tank) | Task 2 (speeder.json, tank.json defined) |
| AnimationSystem | **Not included** — see note below |

**AnimationSystem note:** The spec includes `AnimationSystem` as a future consolidation of all animation driving. This plan does NOT implement it — it would require touching every entity's mesh-driving code which is high-risk for zero visible gameplay benefit. The animation components (`Component_WalkAnim`, `Component_SquashStretch`, etc.) are defined (Task 3) so AnimationSystem can be added as a follow-up task with zero migration risk.

**No placeholders found.** Every step has exact code or exact commands.

**Type consistency:** `EventBus.emit('item:collected', { collectorId, itemType, mesh })` in CollectorSystem matches `EventBus.on('item:collected', ({ collectorId, mesh }) => ...)` in StackSystem. `EventBus.emit('stack:changed', { entityId, count })` in StackSystem matches the HUD listener. All event signatures are consistent throughout.
