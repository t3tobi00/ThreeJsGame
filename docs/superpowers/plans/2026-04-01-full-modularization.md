# Full Game Modularization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all remaining hardcoded systems to data-driven ECS architecture so new content requires only JSON, no code changes.

**Architecture:** 3-layer build — foundations (MeshPresets + ResourceRegistry), refactors (Trading + Structures), new architecture (Grid + SceneLoader + UnlockZones). Each layer is self-contained and testable.

**Tech Stack:** Three.js (ES modules via CDN, no bundler), pure ECS, JSON archetypes, EventBus pub/sub.

**Testing:** No test framework — this is a browser game served via `python3 -m http.server 8080`. Each task ends with browser verification steps. Open DevTools console to check for errors.

**Spec:** `docs/superpowers/specs/2026-04-01-full-modularization-design.md`

---

## Layer 1: Foundations

### Task 1: Create MeshPresets registry

**Files:**
- Create: `src/core/MeshPresets.js`

- [ ] **Step 1: Create `src/core/MeshPresets.js`**

```js
import * as THREE from 'three';

const _presets = new Map();

const MeshPresets = {
    register(name, builderFn) {
        _presets.set(name, builderFn);
    },

    create(name, options = {}) {
        const builder = _presets.get(name);
        if (!builder) {
            console.warn(`MeshPresets: unknown preset '${name}', using fallback box`);
            const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
            return new THREE.Mesh(geo, mat);
        }
        return builder(options);
    },

    has(name) {
        return _presets.has(name);
    }
};

// --- Built-in Presets ---

MeshPresets.register('character', ({ color = 0xaaaaaa } = {}) => {
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
});

MeshPresets.register('table', ({ color = 0x8B4513 } = {}) => {
    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(2, 0.6, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color });
    const top = new THREE.Mesh(boxGeo, boxMat);
    top.position.y = 0.3;
    group.add(top);
    return group;
});

MeshPresets.register('disk', ({ color = 0xff3333, radius = 0.3, height = 0.1 } = {}) => {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
});

MeshPresets.register('coin', ({ color = 0xffdd00, radius = 0.15, height = 0.05 } = {}) => {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    return new THREE.Mesh(geo, mat);
});

MeshPresets.register('rock', ({ color = 0x999999, scale = 1.0 } = {}) => {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(
        (0.5 + Math.random()) * scale,
        (0.3 + Math.random() * 0.5) * scale,
        (0.5 + Math.random()) * scale
    );
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
});

MeshPresets.register('dead-tree', ({ color = 0x5d4037 } = {}) => {
    const trunkMat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
    const tree = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 3, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.rotation.x = (Math.random() - 0.5) * 0.2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    for (let j = 0; j < 3; j++) {
        const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.1, 1.5, 4),
            trunkMat
        );
        branch.position.y = 1.5 + j * 0.5;
        branch.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random());
        branch.rotation.y = Math.random() * Math.PI * 2;
        tree.add(branch);
    }

    return tree;
});

MeshPresets.register('fence-log', ({ color = 0x8b4513 } = {}) => {
    const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const log = new THREE.Mesh(geo, mat);
    log.scale.y = 0.8 + Math.random() * 0.4;
    log.rotation.y = Math.random() * Math.PI;
    log.rotation.x = (Math.random() - 0.5) * 0.1;
    log.rotation.z = (Math.random() - 0.5) * 0.1;
    log.castShadow = true;
    log.receiveShadow = true;
    return log;
});

MeshPresets.register('wall', ({ color = 0x888888, size = { x: 2, y: 1.5, z: 0.8 } } = {}) => {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = size.y / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Top cap detail
    const capGeo = new THREE.BoxGeometry(size.x + 0.2, 0.2, size.z + 0.2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = size.y;
    group.add(cap);

    return group;
});

MeshPresets.register('turret', ({ color = 0xaaaaaa } = {}) => {
    const group = new THREE.Group();

    // Base
    const baseGeo = new THREE.BoxGeometry(1.5, 0.4, 1.5);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Tower body
    const towerGeo = new THREE.CylinderGeometry(0.5, 0.7, 1.2, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const head = new THREE.Mesh(towerGeo, towerMat);
    head.position.y = 1.0;
    head.castShadow = true;
    group.add(head);

    // Cannon
    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.z = 0.5;
    cannon.position.y = 0.2;
    head.add(cannon);

    return group;
});

MeshPresets.register('unlock-zone', ({ color = 0x00aaff, size = 1.6 } = {}) => {
    const group = new THREE.Group();

    // Base plane
    const baseGeo = new THREE.PlaneGeometry(size, size);
    const baseMat = new THREE.MeshBasicMaterial({
        color: 0x224422,
        transparent: true,
        opacity: 0.3
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.01;
    group.add(base);

    // Simple dashed border (4 thin box edges instead of shader for simplicity)
    const edgeMat = new THREE.MeshBasicMaterial({ color });
    const half = size / 2;
    const thickness = 0.04;
    const edgeGeo = new THREE.BoxGeometry(size, thickness, thickness);

    const topEdge = new THREE.Mesh(edgeGeo, edgeMat);
    topEdge.position.set(0, 0.02, -half);
    group.add(topEdge);
    const bottomEdge = new THREE.Mesh(edgeGeo, edgeMat);
    bottomEdge.position.set(0, 0.02, half);
    group.add(bottomEdge);

    const sideGeo = new THREE.BoxGeometry(thickness, thickness, size);
    const leftEdge = new THREE.Mesh(sideGeo, edgeMat);
    leftEdge.position.set(-half, 0.02, 0);
    group.add(leftEdge);
    const rightEdge = new THREE.Mesh(sideGeo, edgeMat);
    rightEdge.position.set(half, 0.02, 0);
    group.add(rightEdge);

    return group;
});

export default MeshPresets;
```

- [ ] **Step 2: Commit**

```bash
git add src/core/MeshPresets.js
git commit -m "feat: add MeshPresets registry with all built-in presets"
```

---

### Task 2: Add `mesh` field to all archetypes + refactor EntityFactory

**Files:**
- Modify: `src/config/archetypes/player.json`
- Modify: `src/config/archetypes/enemy.json`
- Modify: `src/config/archetypes/speeder.json`
- Modify: `src/config/archetypes/tank.json`
- Modify: `src/config/archetypes/villager.json`
- Modify: `src/config/archetypes/turret.json`
- Modify: `src/config/archetypes/wall.json`
- Modify: `src/config/archetypes/meat-table.json`
- Modify: `src/config/archetypes/coin-tray.json`
- Modify: `src/entities/EntityFactory.js`

- [ ] **Step 1: Add `mesh` field to every archetype JSON**

Add a top-level `"mesh"` field to each archetype. The `"mesh"` field sits alongside `"type"` and `"components"`.

**player.json** — add: `"mesh": { "preset": "character", "color": "0x3366ff" }`
**enemy.json** — add: `"mesh": { "preset": "character", "color": "0xff3333" }`
**speeder.json** — add: `"mesh": { "preset": "character", "color": "0xff6600" }` (inherits from enemy, but override mesh)
**tank.json** — add: `"mesh": { "preset": "character", "color": "0x880000" }`
**villager.json** — add: `"mesh": { "preset": "character", "color": "0x44bb44" }`
**turret.json** — add: `"mesh": { "preset": "turret", "color": "0xaaaaaa" }`
**wall.json** — add: `"mesh": { "preset": "wall", "color": "0x888888" }`
**meat-table.json** — add: `"mesh": { "preset": "table", "color": "0x8B4513" }`
**coin-tray.json** — add: `"mesh": { "preset": "table", "color": "0x8b4513" }`

For archetypes with `"extends"`, the mesh field in the child overrides the parent. ArchetypeLoader's `_resolve` already does shallow merge on top-level fields.

- [ ] **Step 2: Refactor EntityFactory to use MeshPresets**

Replace `_createMesh`, `_createCharacterMesh`, `_createTableMesh`, and `MESH_COLORS` with a single MeshPresets.create call.

In `src/entities/EntityFactory.js`:

1. Add import: `import MeshPresets from '../core/MeshPresets.js';`
2. Delete the `MESH_COLORS` constant (lines 41-48)
3. Replace `_createMesh(type, pos)` method with:

```js
_createMesh(archetype, pos) {
    let mesh;
    if (archetype.mesh && archetype.mesh.preset) {
        // Parse color string to number if needed
        const opts = { ...archetype.mesh };
        if (typeof opts.color === 'string') {
            opts.color = parseInt(opts.color, 16);
        }
        mesh = MeshPresets.create(opts.preset, opts);
    } else {
        // Fallback for archetypes without mesh field
        const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
        mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.copy(pos);
    this.scene.add(mesh);
    return mesh;
}
```

4. Delete `_createCharacterMesh(color)` method entirely
5. Delete `_createTableMesh()` method entirely
6. Update the `create()` method call from `this._createMesh(archetype.type, pos)` to `this._createMesh(archetype, pos)`

- [ ] **Step 3: Verify in browser**

Run: `python3 -m http.server 8080` and open `http://localhost:8080`
Expected: All entities (player, enemies, villagers, table, tray) look exactly the same as before. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/archetypes/*.json src/entities/EntityFactory.js
git commit -m "feat: EntityFactory uses MeshPresets, mesh field in all archetypes"
```

---

### Task 3: Create ResourceRegistry + resources.json

**Files:**
- Create: `src/config/resources.json`
- Create: `src/core/ResourceRegistry.js`

- [ ] **Step 1: Create `src/config/resources.json`**

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

- [ ] **Step 2: Create `src/core/ResourceRegistry.js`**

```js
import MeshPresets from './MeshPresets.js';

let _resources = {};

const ResourceRegistry = {
    async load(path = './src/config/resources.json') {
        const response = await fetch(path);
        _resources = await response.json();
    },

    get(type) {
        const def = _resources[type];
        if (!def) {
            console.warn(`ResourceRegistry: unknown resource type '${type}'`);
            return null;
        }
        return def;
    },

    createMesh(type) {
        const def = this.get(type);
        if (!def) {
            // Fallback: small gray disk
            return MeshPresets.create('disk', { color: 0x999999 });
        }
        const opts = { ...def.mesh };
        if (typeof opts.color === 'string') {
            opts.color = parseInt(opts.color, 16);
        }
        const mesh = MeshPresets.create(opts.preset, opts);
        mesh.userData.resourceType = type;
        return mesh;
    },

    types() {
        return Object.keys(_resources);
    }
};

export default ResourceRegistry;
```

- [ ] **Step 3: Commit**

```bash
git add src/config/resources.json src/core/ResourceRegistry.js
git commit -m "feat: add ResourceRegistry + resources.json for data-driven resource meshes"
```

---

### Task 4: Wire ResourceRegistry into CollectorSystem + TraderSystem + main.js

**Files:**
- Modify: `src/systems/CollectorSystem.js`
- Modify: `src/systems/TraderSystem.js`
- Modify: `src/main.js`

- [ ] **Step 1: Update main.js to load ResourceRegistry at startup**

In `src/main.js`, add import at the top:
```js
import ResourceRegistry from './core/ResourceRegistry.js';
```

In the `window.addEventListener('load', ...)` block, add ResourceRegistry load after archetype loading:
```js
window.addEventListener('load', async () => {
    await loadArchetypes();
    await ResourceRegistry.load();
    new Game();
});
```

- [ ] **Step 2: Update CollectorSystem to use ResourceRegistry**

In `src/systems/CollectorSystem.js`:

1. Add import: `import ResourceRegistry from '../core/ResourceRegistry.js';`
2. Replace the ObjectPool factory function in constructor from:
```js
this._pool = new ObjectPool(() => this._makeDiskMesh(), 60, 'CollectorDiskPool');
```
to:
```js
this._pool = new ObjectPool(() => ResourceRegistry.createMesh('meat'), 60, 'CollectorDiskPool');
```
3. Delete the `_makeDiskMesh()` method entirely (lines 125-131)

- [ ] **Step 3: Update TraderSystem to use ResourceRegistry**

In `src/systems/TraderSystem.js`:

1. Add import: `import ResourceRegistry from '../core/ResourceRegistry.js';`
2. In `_executeTransaction`, replace coin mesh creation. Change:
```js
const coinMesh = this._makeCoinMesh();
```
to:
```js
const coinMesh = ResourceRegistry.createMesh('coin');
```
3. Delete the `_makeCoinMesh()` method entirely (lines 101-105 in current file)

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8080`
Expected: Meat disks still spawn when enemies die, coins still appear during trades. Visuals identical. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/systems/CollectorSystem.js src/systems/TraderSystem.js
git commit -m "feat: CollectorSystem + TraderSystem use ResourceRegistry for mesh creation"
```

---

## Layer 2: Refactor Existing Systems

### Task 5: Trading system cleanup — TraderSystem reads Trader component

**Files:**
- Modify: `src/systems/TraderSystem.js`
- Modify: `src/config/gameConfig.js`

- [ ] **Step 1: Update TraderSystem._executeTransaction to read Trader component**

In `src/systems/TraderSystem.js`, replace the hardcoded trade logic inside `_executeTransaction`. Change:

```js
const meatToBuy = Math.min(3, tableInventory.stack.getCount());
```
to:
```js
const trader = ecs.getComponent(buyerId, 'Trader');
const meatToBuy = Math.min(trader ? trader.rate : 3, tableInventory.stack.getCount());
```

Change:
```js
const coinsToGive = Math.ceil(meatToBuy * (COIN_CONFIG.valuePerMeat || 1));
```
to:
```js
const givesType = trader ? trader.gives : 'coin';
const givesDef = ResourceRegistry.get(givesType);
const coinsToGive = Math.ceil(meatToBuy * (givesDef ? givesDef.value : 1));
```

Update coin creation to use the trader's `gives` type:
```js
const coinMesh = ResourceRegistry.createMesh(givesType);
```

Remove the `COIN_CONFIG` import from TraderSystem (no longer needed). Keep only `ResourceRegistry` import.

- [ ] **Step 2: Update the `item:deposited` listener to use Trader.minStock**

In the `item:deposited` EventBus listener, change:
```js
if (tableInv && tableInv.stack.getCount() >= 1) {
```
to:
```js
const tableMeta = targetId ? this._ecs.getComponent(targetId, 'Trader') : null;
const minStock = tableMeta ? tableMeta.minStock : 1;
if (tableInv && tableInv.stack.getCount() >= minStock) {
```

- [ ] **Step 3: Verify in browser**

Expected: Trading still works — villager buys meat (rate=1 from villager.json Trader component), pays coins. Same behavior as before since the JSON values match the old hardcoded ones.

- [ ] **Step 4: Commit**

```bash
git add src/systems/TraderSystem.js
git commit -m "feat: TraderSystem reads Trader component data instead of hardcoded values"
```

---

### Task 6: AgentAISystem queue config to gameConfig

**Files:**
- Modify: `src/config/gameConfig.js`
- Modify: `src/systems/AgentAISystem.js`
- Modify: `src/main.js`

- [ ] **Step 1: Add QUEUE_CONFIG to gameConfig.js**

In `src/config/gameConfig.js`, add after `VILLAGER_CONFIG`:

```js
export const QUEUE_CONFIG = {
    start: { x: 0, z: -12 },
    spacing: 1.8,
    tableApproach: { x: 0, z: -10.5 },
    exitTarget: { x: 0, z: -30 },
    arriveThreshold: 0.3
};
```

- [ ] **Step 2: Update AgentAISystem to import QUEUE_CONFIG**

In `src/systems/AgentAISystem.js`:

1. Add import: `import { QUEUE_CONFIG } from '../config/gameConfig.js';`
2. Replace the top-level constants:

```js
// DELETE these lines:
const QUEUE_START = new THREE.Vector3(0, 0, -12);
const QUEUE_SPACING = 1.8;
const TABLE_POSITION = new THREE.Vector3(0, 0, -10.5);
const EXIT_TARGET = new THREE.Vector3(0, 0, -30);
const ARRIVE_THRESHOLD = 0.3;
```

3. Update `_queueSlotPos`:
```js
_queueSlotPos(slot) {
    return new THREE.Vector3(
        QUEUE_CONFIG.start.x,
        0,
        QUEUE_CONFIG.start.z - slot * QUEUE_CONFIG.spacing
    );
}
```

4. Update `sendFrontToTable` — replace `TABLE_POSITION.clone()` with:
```js
new THREE.Vector3(QUEUE_CONFIG.tableApproach.x, 0, QUEUE_CONFIG.tableApproach.z)
```

5. Update `_setExiting` — replace `EXIT_TARGET.clone()` with:
```js
new THREE.Vector3(QUEUE_CONFIG.exitTarget.x, 0, QUEUE_CONFIG.exitTarget.z)
```

6. Update all `ARRIVE_THRESHOLD` references to `QUEUE_CONFIG.arriveThreshold`

- [ ] **Step 3: Update main.js to use VILLAGER_CONFIG.initialCount**

In `src/main.js`, change the villager spawn loop from:
```js
for (let i = 0; i < 4; i++) {
```
to:
```js
import { VILLAGER_CONFIG } from './config/gameConfig.js';
// ... (already imported, just add VILLAGER_CONFIG to the import)

for (let i = 0; i < VILLAGER_CONFIG.initialCount; i++) {
```

Note: `VILLAGER_CONFIG` already has `initialCount: 4` defined in gameConfig.js.

- [ ] **Step 4: Verify in browser**

Expected: Villagers queue, trade, and respawn exactly as before. No visual changes.

- [ ] **Step 5: Commit**

```bash
git add src/config/gameConfig.js src/systems/AgentAISystem.js src/main.js
git commit -m "feat: AgentAISystem reads QUEUE_CONFIG from gameConfig, uses VILLAGER_CONFIG.initialCount"
```

---

### Task 7: Create HealthSystem

**Files:**
- Create: `src/systems/HealthSystem.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/systems/HealthSystem.js`**

```js
import EventBus from '../core/EventBus.js';

/**
 * HealthSystem — Tracks entity HP, emits death events.
 *
 * Queries: ['Transform', 'Health']
 * Listens: 'entity:damaged' { entityId, damage }
 * Emits: 'entity:died' { entityId, position, drops }
 */
export class HealthSystem {
    constructor(scene) {
        this.scene = scene;
        this._pending = [];

        EventBus.on('entity:damaged', ({ entityId, damage }) => {
            this._pending.push({ entityId, damage });
        });
    }

    update(entities, deltaTime, ecs) {
        // Process pending damage
        for (const { entityId, damage } of this._pending) {
            const health = ecs.getComponent(entityId, 'Health');
            if (!health) continue;

            const actualDamage = Math.max(0, damage - health.armor);
            health.hp -= actualDamage;

            if (health.hp <= 0) {
                health.hp = 0;
                const transform = ecs.getComponent(entityId, 'Transform');
                const pos = transform ? transform.mesh.position.clone() : null;

                // Determine drops based on entity tags
                const tag = ecs.getComponent(entityId, 'Tag');
                const drops = [];
                if (tag && tag.has('enemy')) drops.push('meat');

                // Remove mesh from scene
                if (transform && transform.mesh) {
                    this.scene.remove(transform.mesh);
                }

                EventBus.emit('entity:died', {
                    entityId,
                    position: pos,
                    drops
                });

                ecs.destroyEntity(entityId);
            }
        }
        this._pending = [];
    }
}
```

- [ ] **Step 2: Register HealthSystem in main.js**

In `src/main.js`:

1. Add import: `import { HealthSystem } from './systems/HealthSystem.js';`
2. After the ParticleSystem creation, add:
```js
this.healthSystem = new HealthSystem(this.scene.instance);
this.ecs.registerSystem(this.healthSystem, ['Transform', 'Health']);
```

- [ ] **Step 3: Verify in browser**

Expected: Game works as before. HealthSystem is registered but the existing CombatSystem and EnemySystem already handle enemy death directly. HealthSystem will become the primary death handler after Structure ECS conversion. No visual changes yet.

- [ ] **Step 4: Commit**

```bash
git add src/systems/HealthSystem.js src/main.js
git commit -m "feat: add HealthSystem for HP tracking and entity death events"
```

---

### Task 8: Structure ECS conversion — Wall + Turret archetypes

**Files:**
- Modify: `src/config/archetypes/wall.json`
- Modify: `src/config/archetypes/turret.json`
- Modify: `src/systems/LevelSystem.js`
- Modify: `src/main.js`
- Delete: `src/entities/Wall.js`
- Delete: `src/entities/Turret.js`

- [ ] **Step 1: Rewrite wall.json**

Replace `src/config/archetypes/wall.json` entirely:
```json
{
    "type": "Wall",
    "mesh": { "preset": "wall", "color": "0x888888" },
    "components": {
        "Health": { "hp": 100, "maxHp": 100 },
        "Tag": { "tags": ["wall", "structure", "static"] },
        "FlashAnim": { "color": "0xff0000", "duration": 0.15 }
    }
}
```

- [ ] **Step 2: Rewrite turret.json**

Replace `src/config/archetypes/turret.json` entirely:
```json
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

- [ ] **Step 3: Refactor LevelSystem to use EntityFactory**

In `src/systems/LevelSystem.js`:

1. Remove imports for `Wall`, `Turret`:
```js
// DELETE: import { Wall } from '../entities/Wall.js';
// DELETE: import { Turret } from '../entities/Turret.js';
```

2. Add `factory` parameter to constructor:
```js
constructor(scene, drainSystem, particleSystem, combatSystem, player, factory) {
    this.scene = scene;
    this.drainSystem = drainSystem;
    this.particleSystem = particleSystem;
    this.combatSystem = combatSystem;
    this.player = player;
    this.factory = factory;
    this.activeStructures = [];
    this.gates = [];
}
```

3. Replace `onStructureBuilt` method:
```js
onStructureBuilt(position, type) {
    this.particleSystem.createBurst(position);

    if (type === 'Turret') {
        this.factory.create('turret', position);
    } else if (type === 'Wall') {
        this.factory.create('wall', position);
    }
    // CombatSystem auto-discovers turrets via ['Transform', 'Shooter'] query
    // HealthSystem auto-discovers walls via ['Transform', 'Health'] query
}
```

4. Remove the turret `onFire` wiring and `activeStructures` update logic. Simplify the `update` method to only handle gates:
```js
update(deltaTime, enemies) {
    for (const gate of this.gates) {
        gate.update(deltaTime, this.player.position);
    }
}
```

- [ ] **Step 4: Update main.js — pass factory to LevelSystem**

Change the LevelSystem construction in `src/main.js` from:
```js
this.levelSystem = new LevelSystem(this.scene.instance, this.drainSystem, this.particleSystem, this.combatSystem, { position: playerTransform.mesh.position, group: playerTransform.mesh });
```
to:
```js
this.levelSystem = new LevelSystem(this.scene.instance, this.drainSystem, this.particleSystem, this.combatSystem, { position: playerTransform.mesh.position, group: playerTransform.mesh }, this.factory);
```

- [ ] **Step 5: Delete legacy files**

Delete `src/entities/Wall.js` and `src/entities/Turret.js`.

- [ ] **Step 6: Delete dead code**

Delete `src/ecs/components/Component_TransactionLogic.js` (unused since ECS migration).

- [ ] **Step 7: Verify in browser**

Expected: When an unlock zone is funded, the structure (turret or wall) spawns using the ECS archetype. Turrets auto-fire at enemies via CombatSystem. No console errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Wall + Turret are now ECS entities, delete legacy classes + dead code"
```

---

## Layer 3: New Architecture

### Task 9: Create GridSystem

**Files:**
- Create: `src/core/GridSystem.js`

- [ ] **Step 1: Create `src/core/GridSystem.js`**

```js
import * as THREE from 'three';

/**
 * GridSystem — 2D grid mapping numbered cells to world positions.
 *
 * Cell numbering: left-to-right, top-to-bottom.
 *   0  1  2  3  4
 *   5  6  7  8  9
 *  10 11 12 13 14
 *
 * "Top" = most negative Z, "Bottom" = most positive Z.
 */
export class GridSystem {
    /**
     * @param {Object} config
     * @param {Object} config.origin  { x, z } — world position of cell 0 center
     * @param {number} config.cellSize — side length of each cell in world units
     * @param {number} config.cols — number of columns
     * @param {number} config.rows — number of rows
     */
    constructor({ origin, cellSize, cols, rows }) {
        this.origin = origin;
        this.cellSize = cellSize;
        this.cols = cols;
        this.rows = rows;
        this.totalCells = cols * rows;
    }

    /** Get the row index for a cell ID. */
    getRow(cellId) {
        return Math.floor(cellId / this.cols);
    }

    /** Get the column index for a cell ID. */
    getCol(cellId) {
        return cellId % this.cols;
    }

    /** Convert a cell ID to a world-space Vector3 (center of cell, y=0). */
    cellToWorld(cellId) {
        const row = this.getRow(cellId);
        const col = this.getCol(cellId);
        return new THREE.Vector3(
            this.origin.x + col * this.cellSize + this.cellSize / 2,
            0,
            this.origin.z + row * this.cellSize + this.cellSize / 2
        );
    }

    /** Convert a world position to the nearest cell ID. */
    worldToCell(pos) {
        const col = Math.floor((pos.x - this.origin.x) / this.cellSize);
        const row = Math.floor((pos.z - this.origin.z) / this.cellSize);
        const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
        const clampedRow = Math.max(0, Math.min(row, this.rows - 1));
        return clampedRow * this.cols + clampedCol;
    }

    /** Get orthogonal neighbor cell IDs (up, down, left, right). Returns only valid cells. */
    getNeighbors(cellId) {
        const row = this.getRow(cellId);
        const col = this.getCol(cellId);
        const neighbors = [];

        if (row > 0) neighbors.push(cellId - this.cols);                // up
        if (row < this.rows - 1) neighbors.push(cellId + this.cols);    // down
        if (col > 0) neighbors.push(cellId - 1);                        // left
        if (col < this.cols - 1) neighbors.push(cellId + 1);            // right

        return neighbors;
    }

    /** Check if two cells are orthogonally adjacent. */
    areAdjacent(a, b) {
        return this.getNeighbors(a).includes(b);
    }

    /** Get detailed info for multiple cells. */
    getCells(ids) {
        return ids.map(id => ({
            id,
            row: this.getRow(id),
            col: this.getCol(id),
            pos: this.cellToWorld(id)
        }));
    }

    /**
     * Create a debug overlay mesh (semi-transparent grid with cell numbers).
     * Add to scene for development, remove for production.
     * @returns {THREE.Group}
     */
    createDebugOverlay() {
        const group = new THREE.Group();

        for (let i = 0; i < this.totalCells; i++) {
            const pos = this.cellToWorld(i);
            const s = this.cellSize;

            // Cell border
            const geo = new THREE.PlaneGeometry(s * 0.95, s * 0.95);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide
            });
            const plane = new THREE.Mesh(geo, mat);
            plane.rotation.x = -Math.PI / 2;
            plane.position.copy(pos);
            plane.position.y = 0.03;
            group.add(plane);

            // Cell number label
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toString(), 32, 32);

            const tex = new THREE.CanvasTexture(canvas);
            const labelGeo = new THREE.PlaneGeometry(s * 0.5, s * 0.5);
            const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.rotation.x = -Math.PI / 2;
            label.position.copy(pos);
            label.position.y = 0.04;
            group.add(label);
        }

        return group;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/GridSystem.js
git commit -m "feat: add GridSystem with cell numbering, adjacency, debug overlay"
```

---

### Task 10: Create SceneLoader + level-1.json

**Files:**
- Create: `src/core/SceneLoader.js`
- Create: `src/config/levels/level-1.json`
- Modify: `src/main.js`
- Modify: `src/config/gameConfig.js`

- [ ] **Step 1: Create `src/config/levels/level-1.json`**

This recreates the current game layout as a level JSON. The grid covers the safe zone area.

```json
{
    "name": "Lone Outpost",
    "grid": {
        "origin": { "x": -9, "z": -9 },
        "cellSize": 2,
        "cols": 9,
        "rows": 9
    },
    "ground": {
        "safeZone": {
            "size": 18,
            "color": "0x66cc66",
            "texture": "turf"
        },
        "dangerZone": {
            "size": 100,
            "color": "0xe6c280"
        }
    },
    "props": {
        "rocks": 20,
        "deadTrees": 20,
        "spawnRadius": { "min": 12.6, "max": 37.6 }
    },
    "fence": {
        "enabled": true,
        "halfSize": 9,
        "gapFractions": {
            "top": { "start": 0.33, "end": 0.67 },
            "bottom": { "start": 0.4, "end": 0.6 }
        }
    },
    "entities": [
        { "archetype": "meat-table", "position": { "x": 0, "y": 0.3, "z": -9.2 } },
        { "archetype": "coin-tray", "position": { "x": -3, "y": 0, "z": -11.2 } }
    ],
    "spawners": {
        "player": { "position": { "x": 0, "y": 0, "z": 0 } },
        "villagers": {
            "spawnPoint": { "x": 0, "z": -24 },
            "initialCount": 4
        },
        "enemies": {
            "spawnDistance": 35,
            "spawnInterval": 2
        }
    },
    "unlockZones": [
        {
            "position": { "x": -5, "y": 0, "z": 7 },
            "type": "build",
            "cost": { "meat": 20 },
            "builds": "turret"
        }
    ],
    "gate": {
        "position": { "x": 0, "y": 0, "z": 9 },
        "width": 3.0
    },
    "road": {
        "position": { "x": 0, "z": -16.7 },
        "width": 3.0,
        "length": 15
    },
    "debug": {
        "showGrid": false
    }
}
```

- [ ] **Step 2: Create `src/core/SceneLoader.js`**

```js
import * as THREE from 'three';
import { GridSystem } from './GridSystem.js';
import MeshPresets from './MeshPresets.js';

/**
 * SceneLoader — Reads a level JSON and spawns environment.
 *
 * Handles: ground planes, fence, props (rocks/trees), road, debug grid overlay.
 * Returns level config for main.js to wire up ECS entities and systems.
 */
export class SceneLoader {
    /**
     * Load a level JSON and build the environment.
     * @param {string} path — path to level JSON
     * @param {THREE.Scene} scene
     * @returns {Object} { grid, levelData } — grid instance + raw level data for system wiring
     */
    static async load(path, scene) {
        const response = await fetch(path);
        const levelData = await response.json();

        const grid = levelData.grid
            ? new GridSystem(levelData.grid)
            : null;

        // Build environment
        SceneLoader._buildGround(scene, levelData.ground);
        if (levelData.fence) SceneLoader._buildFence(scene, levelData.fence);
        if (levelData.props) SceneLoader._buildProps(scene, levelData.props);
        if (levelData.road) SceneLoader._buildRoad(scene, levelData.road);

        // Debug grid overlay
        if (grid && levelData.debug && levelData.debug.showGrid) {
            const overlay = grid.createDebugOverlay();
            scene.add(overlay);
        }

        return { grid, levelData };
    }

    static _buildGround(scene, ground) {
        if (!ground) return;

        // Safe zone
        if (ground.safeZone) {
            const sz = ground.safeZone;
            const halfSize = sz.size / 2;

            const shape = new THREE.Shape();
            shape.moveTo(-halfSize, halfSize);
            shape.lineTo(-halfSize, -halfSize);
            shape.lineTo(-7, -halfSize);
            shape.lineTo(-7, -5);
            shape.lineTo(-3, -5);
            shape.lineTo(-3, -halfSize);
            shape.lineTo(3, -halfSize);
            shape.lineTo(3, -5);
            shape.lineTo(7, -5);
            shape.lineTo(7, -halfSize);
            shape.lineTo(halfSize, -halfSize);
            shape.lineTo(halfSize, halfSize);
            shape.closePath();

            const safeGeo = new THREE.ShapeGeometry(shape);

            // Fix UVs
            const pos = safeGeo.attributes.position;
            const bnd = new THREE.Box3().setFromBufferAttribute(pos);
            const uvs = safeGeo.attributes.uv;
            for (let i = 0; i < pos.count; i++) {
                uvs.setXY(i, (pos.getX(i) - bnd.min.x) / 1, (pos.getY(i) - bnd.min.y) / 1);
            }

            // Procedural grid texture
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const color = typeof sz.color === 'string' ? '#' + sz.color.replace('0x', '') : '#66cc66';
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = 'rgba(0, 50, 0, 0.05)';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillRect(64, 64, 64, 64);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(64, 0, 64, 64);
            ctx.fillRect(0, 64, 64, 64);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 128, 128);

            const gridTex = new THREE.CanvasTexture(canvas);
            gridTex.wrapS = THREE.RepeatWrapping;
            gridTex.wrapT = THREE.RepeatWrapping;

            const safeMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.8, metalness: 0.2 });
            const safePlane = new THREE.Mesh(safeGeo, safeMat);
            safePlane.rotation.x = -Math.PI / 2;
            safePlane.receiveShadow = true;
            scene.add(safePlane);
        }

        // Danger zone
        if (ground.dangerZone) {
            const dz = ground.dangerZone;
            const color = typeof dz.color === 'string' ? parseInt(dz.color, 16) : dz.color;
            const dangerGeo = new THREE.PlaneGeometry(dz.size, dz.size);
            const dangerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.1 });
            const dangerPlane = new THREE.Mesh(dangerGeo, dangerMat);
            dangerPlane.rotation.x = -Math.PI / 2;
            dangerPlane.position.y = -0.01;
            dangerPlane.receiveShadow = true;
            scene.add(dangerPlane);
        }
    }

    static _buildFence(scene, fence) {
        const halfSize = fence.halfSize;
        const logHeight = 0.5;
        const spacing = 0.35;
        const fenceGroup = new THREE.Group();

        const spawnLogsAlongLine = (start, end, skipStart = 0, skipEnd = 0) => {
            const dist = start.distanceTo(end);
            const count = Math.floor(dist / spacing);
            for (let i = 0; i <= count; i++) {
                const t = i / count;
                if (t >= skipStart && t <= skipEnd && (skipStart !== 0 || skipEnd !== 0)) continue;

                const pos = new THREE.Vector3().lerpVectors(start, end, t);
                const log = MeshPresets.create('fence-log');
                log.position.copy(pos);
                log.position.y = logHeight / 2;
                fenceGroup.add(log);
            }
        };

        // Fence path points (same layout as original Environment.js)
        const p1  = new THREE.Vector3(-halfSize, 0, -halfSize);
        const p2  = new THREE.Vector3(-halfSize, 0, halfSize);
        const p3  = new THREE.Vector3(-7, 0, halfSize);
        const p4  = new THREE.Vector3(-7, 0, 5);
        const p5  = new THREE.Vector3(-3, 0, 5);
        const p6  = new THREE.Vector3(-3, 0, halfSize);
        const p7  = new THREE.Vector3(3, 0, halfSize);
        const p8  = new THREE.Vector3(3, 0, 5);
        const p9  = new THREE.Vector3(7, 0, 5);
        const p10 = new THREE.Vector3(7, 0, halfSize);
        const p11 = new THREE.Vector3(halfSize, 0, halfSize);
        const p12 = new THREE.Vector3(halfSize, 0, -halfSize);

        spawnLogsAlongLine(p1, p2);
        spawnLogsAlongLine(p2, p3);
        spawnLogsAlongLine(p3, p4);
        spawnLogsAlongLine(p4, p5);
        spawnLogsAlongLine(p5, p6);
        const gapB = fence.gapFractions.bottom;
        spawnLogsAlongLine(p6, p7, gapB.start, gapB.end);
        spawnLogsAlongLine(p7, p8);
        spawnLogsAlongLine(p8, p9);
        spawnLogsAlongLine(p9, p10);
        spawnLogsAlongLine(p10, p11);
        spawnLogsAlongLine(p11, p12);
        const gapT = fence.gapFractions.top;
        spawnLogsAlongLine(p12, p1, gapT.start, gapT.end);

        scene.add(fenceGroup);

        // Selling table visual (from Environment.createSellingTable)
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1.2), tableMat);
        table.position.set(0, 0.3, -9.2);
        table.castShadow = true;
        scene.add(table);
    }

    static _buildProps(scene, props) {
        const total = (props.rocks || 0) + (props.deadTrees || 0);
        const rockCount = props.rocks || 0;
        const minDist = props.spawnRadius.min;
        const maxDist = props.spawnRadius.max;

        for (let i = 0; i < total; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDist + Math.random() * (maxDist - minDist);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            let prop;
            if (i < rockCount) {
                prop = MeshPresets.create('rock');
            } else {
                prop = MeshPresets.create('dead-tree');
            }
            prop.position.set(x, 0, z);
            scene.add(prop);
        }
    }

    static _buildRoad(scene, road) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#999999';
        ctx.fillRect(0, 0, 128, 128);

        // Stone tile pattern
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 2;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const offset = (r % 2) * 16;
                ctx.strokeRect(c * 32 + offset, r * 32, 32, 32);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, road.length / road.width);

        const geo = new THREE.PlaneGeometry(road.width, road.length);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(road.position.x, 0.005, road.position.z);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
}
```

- [ ] **Step 3: Add DEBUG_GRID to gameConfig**

In `src/config/gameConfig.js`, add at the bottom:
```js
export const DEBUG_GRID = false;
```

- [ ] **Step 4: Wire SceneLoader into main.js**

In `src/main.js`:

1. Add imports:
```js
import { SceneLoader } from './core/SceneLoader.js';
```

2. Remove imports for `Environment` and `Road`:
```js
// DELETE: import { Environment } from './entities/Environment.js';
// DELETE: import { Road } from './entities/Road.js';
```

3. Replace these lines in `init()`:
```js
// DELETE:
// this.environment = new Environment(this.scene.instance);
// this.road = new Road(this.scene.instance);
```
With:
```js
// Environment is built by SceneLoader (called before Game constructor)
// this.levelData is set by the async init
```

4. Make the Game class use an async init pattern. Change the startup code from:
```js
window.addEventListener('load', async () => {
    await loadArchetypes();
    await ResourceRegistry.load();
    new Game();
});
```
to:
```js
window.addEventListener('load', async () => {
    await loadArchetypes();
    await ResourceRegistry.load();
    const game = new Game();
    await game.loadLevel('./src/config/levels/level-1.json');
    game.animate();
});
```

5. Add `loadLevel` method to Game class (before `animate`):
```js
async loadLevel(path) {
    const { grid, levelData } = await SceneLoader.load(path, this.scene.instance);
    this.grid = grid;
    this.levelData = levelData;
}
```

6. Remove the `this.animate()` call from the end of `init()` (it's now called from the load event).

- [ ] **Step 5: Verify in browser**

Expected: The game looks identical — same ground, fence, props, road. Environment is now driven by level-1.json + SceneLoader instead of Environment.js + Road.js.

- [ ] **Step 6: Delete legacy environment files**

Delete: `src/entities/Environment.js`, `src/entities/Road.js`

Also delete unused legacy files: `src/entities/StorageNode.js`, `src/entities/CoinTray.js`, `src/entities/MeatTable.js`, `src/entities/Villager.js`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: SceneLoader + level-1.json replaces hardcoded Environment + Road"
```

---

### Task 11: Create Component_UnlockZone + UnlockZoneSystem

**Files:**
- Create: `src/ecs/components/Component_UnlockZone.js`
- Create: `src/systems/UnlockZoneSystem.js`

- [ ] **Step 1: Create `src/ecs/components/Component_UnlockZone.js`**

```js
/**
 * Component_UnlockZone — Data for unlock zones that accept resources.
 *
 * type: 'build' (one-time, spawns building + zone removed)
 *       'spawner' (repeatable, spawns units + zone resets)
 */
export class Component_UnlockZone {
    constructor({
        type = 'build',
        cost = {},
        drainRate = 0.15,
        range = 3.0,
        builds = null,
        spawns = null,
        spawnCount = 1
    } = {}) {
        this.type = type;
        this.cost = cost;
        this.drainRate = drainRate;
        this.range = range;
        this.builds = builds;
        this.spawns = spawns;
        this.spawnCount = spawnCount;

        // Runtime state
        this.progress = {};
        for (const key of Object.keys(cost)) {
            this.progress[key] = 0;
        }
        this.timeSinceLastDrain = 0;
    }
}
```

- [ ] **Step 2: Register Component_UnlockZone in EntityFactory**

In `src/entities/EntityFactory.js`:

1. Add import:
```js
import { Component_UnlockZone } from '../ecs/components/Component_UnlockZone.js';
```

2. Add to COMPONENT_MAP:
```js
UnlockZone:      (d) => new Component_UnlockZone(d),
```

- [ ] **Step 3: Create `src/systems/UnlockZoneSystem.js`**

```js
import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * UnlockZoneSystem — Drains matching resources from nearby carriers into zones.
 *
 * Queries: ['Transform', 'UnlockZone']
 * Emits: 'zone:funded' { zoneId, type, builds, spawns, spawnCount }
 *        'stack:changed' { entityId, count }
 */
export class UnlockZoneSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
        this._ecs = null;
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._ecs = ecs;

        // Find all carriers (entities with Transform + InventoryStack)
        const carriers = ecs.queryEntities(['Transform', 'InventoryStack']);

        for (const zoneId of entities) {
            const zoneTransform = ecs.getComponent(zoneId, 'Transform');
            const zone = ecs.getComponent(zoneId, 'UnlockZone');
            if (!zoneTransform || !zone) continue;

            zone.timeSinceLastDrain += deltaTime;

            // Check if zone is already fully funded
            if (this._isFunded(zone)) continue;

            // Find closest carrier in range
            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = zoneTransform.mesh.position.distanceTo(carrierTransform.mesh.position);
                if (dist > zone.range) continue;
                if (zone.timeSinceLastDrain < zone.drainRate) continue;

                // Drain all matching resource types simultaneously
                let drained = false;
                for (const [resourceType, needed] of Object.entries(zone.cost)) {
                    if (zone.progress[resourceType] >= needed) continue;

                    // Find a matching mesh in the carrier's stack
                    const meshIndex = this._findResourceInStack(carrierInventory.stack, resourceType);
                    if (meshIndex === -1) continue;

                    // Pop this specific mesh from the stack
                    const mesh = this._popResourceAtIndex(carrierInventory.stack, meshIndex);
                    if (!mesh) continue;

                    drained = true;
                    zone.progress[resourceType]++;

                    // Arc visual
                    const fromPos = mesh.position.clone();
                    const toPos = zoneTransform.mesh.position.clone();
                    toPos.y = 0.5;
                    this._transfer.send(mesh, fromPos, toPos, {
                        arcHeight: 3,
                        duration: 0.5,
                        spin: true,
                        onArrive: (m) => {
                            this.scene.remove(m);
                            if (m.geometry) m.geometry.dispose();
                            if (m.material) m.material.dispose();
                        }
                    });

                    EventBus.emit('stack:changed', {
                        entityId: carrierId,
                        count: carrierInventory.stack.getCount()
                    });
                }

                if (drained) {
                    zone.timeSinceLastDrain = 0;
                }

                // Check if now fully funded
                if (this._isFunded(zone)) {
                    EventBus.emit('zone:funded', {
                        zoneId,
                        type: zone.type,
                        builds: zone.builds,
                        spawns: zone.spawns,
                        spawnCount: zone.spawnCount
                    });
                }
            }
        }
    }

    _isFunded(zone) {
        for (const [type, needed] of Object.entries(zone.cost)) {
            if ((zone.progress[type] || 0) < needed) return false;
        }
        return true;
    }

    _findResourceInStack(stack, resourceType) {
        for (let i = stack.items.length - 1; i >= 0; i--) {
            if (stack.items[i].userData && stack.items[i].userData.resourceType === resourceType) {
                return i;
            }
        }
        return -1;
    }

    _popResourceAtIndex(stack, index) {
        if (index < 0 || index >= stack.items.length) return null;
        const [mesh] = stack.items.splice(index, 1);
        return mesh;
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ecs/components/Component_UnlockZone.js src/systems/UnlockZoneSystem.js src/entities/EntityFactory.js
git commit -m "feat: add Component_UnlockZone + UnlockZoneSystem for multi-resource drain"
```

---

### Task 12: Create BuildSystem + unlock zone archetypes

**Files:**
- Create: `src/systems/BuildSystem.js`
- Create: `src/config/archetypes/unlock-turret.json`

- [ ] **Step 1: Create `src/systems/BuildSystem.js`**

```js
import EventBus from '../core/EventBus.js';

/**
 * BuildSystem — Listens to zone:funded events and spawns buildings or units.
 *
 * Build type: spawns the building, removes the zone entity.
 * Spawner type: spawns units, resets the zone progress, zone stays.
 */
export class BuildSystem {
    constructor(scene, factory, particleSystem) {
        this.scene = scene;
        this.factory = factory;
        this.particleSystem = particleSystem;
        this._ecs = null;

        EventBus.on('zone:funded', (data) => {
            this._handleFunded(data);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
    }

    _handleFunded({ zoneId, type, builds, spawns, spawnCount }) {
        if (!this._ecs) return;

        const transform = this._ecs.getComponent(zoneId, 'Transform');
        const pos = transform ? transform.mesh.position.clone() : null;
        if (!pos) return;

        // Particle burst
        if (this.particleSystem) {
            this.particleSystem.createBurst(pos);
        }

        if (type === 'build') {
            // Spawn the building
            if (builds) {
                this.factory.create(builds, pos);
            }
            // Remove the zone
            if (transform.mesh) this.scene.remove(transform.mesh);
            this._ecs.destroyEntity(zoneId);

            EventBus.emit('zone:built', { zoneId, archetype: builds, position: pos });

        } else if (type === 'spawner') {
            // Spawn units
            const count = spawnCount || 1;
            for (let i = 0; i < count; i++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                );
                if (spawns) {
                    this.factory.create(spawns, pos.clone().add(offset));
                }
            }

            // Reset progress
            const zone = this._ecs.getComponent(zoneId, 'UnlockZone');
            if (zone) {
                for (const key of Object.keys(zone.progress)) {
                    zone.progress[key] = 0;
                }
            }

            EventBus.emit('zone:spawned', { zoneId, archetype: spawns, count });
        }
    }
}
```

Add `import * as THREE from 'three';` at the top of BuildSystem.js.

- [ ] **Step 2: Create `src/config/archetypes/unlock-turret.json`**

```json
{
    "type": "UnlockZone",
    "mesh": { "preset": "unlock-zone", "color": "0x00aaff", "size": 1.6 },
    "components": {
        "UnlockZone": {
            "type": "build",
            "cost": { "meat": 20 },
            "drainRate": 0.15,
            "range": 3.0,
            "builds": "turret"
        },
        "Tag": { "tags": ["unlock-zone"] }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/systems/BuildSystem.js src/config/archetypes/unlock-turret.json
git commit -m "feat: add BuildSystem + unlock-turret archetype for zone:funded handling"
```

---

### Task 13: Wire everything together in main.js — final integration

**Files:**
- Modify: `src/main.js`
- Delete: `src/entities/UnlockZone.js`
- Delete: `src/systems/DrainSystem.js`

- [ ] **Step 1: Update main.js imports**

Remove old imports:
```js
// DELETE: import { DrainSystem } from './systems/DrainSystem.js';
// DELETE: import { LevelSystem } from './systems/LevelSystem.js';
```

Add new imports:
```js
import { UnlockZoneSystem } from './systems/UnlockZoneSystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
```

- [ ] **Step 2: Replace DrainSystem + LevelSystem setup with UnlockZoneSystem + BuildSystem**

In `init()`, remove the mockStackSystem, DrainSystem, and LevelSystem creation:
```js
// DELETE the mockStackSystem block
// DELETE: this.drainSystem = new DrainSystem(...)
// DELETE: this.levelSystem = new LevelSystem(...)
```

Replace with:
```js
// Unlock Zone System (replaces DrainSystem)
this.unlockZoneSystem = new UnlockZoneSystem(this.scene.instance);
this.ecs.registerSystem(this.unlockZoneSystem, ['Transform', 'UnlockZone']);

// Build System (replaces LevelSystem structure spawning)
this.buildSystem = new BuildSystem(this.scene.instance, this.factory, this.particleSystem);
this.buildSystem.setECS(this.ecs);
this.ecs.registerSystem(this.buildSystem, ['Transform', 'Tag']);
```

- [ ] **Step 3: Create unlock zones from level data**

After the `loadLevel` method populates `this.levelData`, create unlock zones:

In the `loadLevel` method, after the SceneLoader.load call, add:
```js
// Spawn unlock zones from level data
if (levelData.unlockZones) {
    for (const zoneDef of levelData.unlockZones) {
        const pos = new THREE.Vector3(zoneDef.position.x, zoneDef.position.y, zoneDef.position.z);
        // Create a dynamic archetype override
        this.factory.create('unlock-turret', pos, {
            UnlockZone: {
                type: zoneDef.type,
                cost: zoneDef.cost,
                builds: zoneDef.builds || null,
                spawns: zoneDef.spawns || null,
                spawnCount: zoneDef.count || 1
            }
        });
    }
}
```

- [ ] **Step 4: Update the animate loop**

Remove the old LevelSystem update call:
```js
// DELETE: this.levelSystem.update(deltaTime, []);
```

The Gate still needs updating. Keep gate handling if it exists, or move gate into the loadLevel flow.

For now, keep the Gate import and creation in `loadLevel`:
```js
import { Gate } from './entities/Gate.js';

// In loadLevel, after SceneLoader.load:
if (levelData.gate) {
    const gatePos = levelData.gate.position;
    this.gate = new Gate(
        this.scene.instance,
        new THREE.Vector3(gatePos.x, gatePos.y, gatePos.z),
        levelData.gate.width
    );
}
```

In `animate()`, add gate update:
```js
if (this.gate) {
    const playerTransform = this.ecs.getComponent(this.playerId, 'Transform');
    this.gate.update(deltaTime, playerTransform.mesh.position);
}
```

- [ ] **Step 5: Delete legacy files**

Delete: `src/entities/UnlockZone.js`, `src/systems/DrainSystem.js`, `src/systems/LevelSystem.js`

- [ ] **Step 6: Verify in browser**

Expected:
1. Game loads — ground, fence, trees, road all visible (from SceneLoader)
2. Player moves, kills enemies, collects meat
3. Unlock zone visible at (-5, 0, 7) with blue border
4. Standing on zone drains meat from player stack with arc animation
5. After 20 meat drained → turret spawns, zone disappears
6. Turret auto-fires at enemies
7. Villagers still queue, trade, drop coins
8. No console errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: full integration — UnlockZoneSystem + BuildSystem replace DrainSystem + LevelSystem"
```

---

### Deferred: WallConnectorSystem

The spec includes a `WallConnectorSystem` that auto-selects wall presets (corner, straight, T-junction) based on grid adjacency. This is purely cosmetic and depends on walls being placed via grid cells, which requires level-1.json to define walls by cell number. Since the current level recreates the existing layout using absolute positions, WallConnectorSystem adds no value yet. It should be implemented when the first grid-based level is designed with wall placements by cell number.

---

### Task 14: Cleanup and documentation

**Files:**
- Modify: `PROJECT_DOCS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update PROJECT_DOCS.md**

Add a Phase 6 section documenting the full modularization:
- New files created (MeshPresets, ResourceRegistry, GridSystem, SceneLoader, etc.)
- Deleted files
- Updated architecture description
- Updated file map

- [ ] **Step 2: Update CLAUDE.md**

Update project structure to reflect new files and deleted files.

- [ ] **Step 3: Final browser verification**

Full playthrough:
1. Kill enemies → meat drops → magnetic collect → stack on back
2. Walk to table → meat arcs to table
3. Villager walks to table → takes meat → drops coins → exits → new villager spawns
4. Walk to unlock zone → meat drains → turret spawns
5. Turret fires at enemies
6. Repeat cycle

All features working = modularization complete.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update PROJECT_DOCS + CLAUDE.md for full modularization (Phase 6)"
```
