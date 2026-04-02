# Phase B: Economy Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the kill → collect → sell → buy game loop with multiple zombie drop types, a market zone that converts drops to coins, and a shop zone that lets players spend coins on effects.

**Architecture:** Four incremental tasks. Task 1 adds new resource definitions. Task 2 wires enemy archetypes to configurable drop tables so different zombies drop different loot. Task 3 adds a MarketSystem with a physical stall where players trade resources for coins. Task 4 adds a ShopSystem for repeatable coin-based purchases (starting with a health pack).

**Tech Stack:** Three.js (ES modules, no bundler), pure ECS, JSON archetypes, EventBus pub/sub.

---

## File Structure

| File | Responsibility | Task |
|------|---------------|------|
| `src/config/resources.json` | Add bio-matter, zombie-teeth, mutant-core definitions | 1 |
| `src/ui/HUD.js` | Add emoji mappings for new resource types | 1 |
| `src/config/archetypes/player.json` | Update Collector resourceTypes to accept new drops | 1 |
| `src/ecs/components/Component_Drops.js` | **NEW** — configurable drop table per entity | 2 |
| `src/systems/HealthSystem.js` | Read Drops component instead of hardcoded `'meat'` | 2 |
| `src/entities/EntityFactory.js` | Register Drops, Market, Shop components | 2, 3, 4 |
| `src/config/archetypes/enemy.json` | Add Drops component | 2 |
| `src/config/archetypes/speeder.json` | Add Drops component | 2 |
| `src/config/archetypes/tank.json` | Add Drops component | 2 |
| `src/ecs/components/Component_Market.js` | **NEW** — market config (accepts, pay rates) | 3 |
| `src/systems/MarketSystem.js` | **NEW** — drains resources from player, gives coins | 3 |
| `src/config/archetypes/market.json` | **NEW** — market stall archetype | 3 |
| `src/core/MeshPresets.js` | Add 'stall' mesh preset | 3 |
| `src/core/ArchetypeLoader.js` | Register market, health-shop archetypes | 3, 4 |
| `src/main.js` | Register MarketSystem, ShopSystem | 3, 4 |
| `src/config/levels/level-1.json` | Add market + shop entities | 3, 4 |
| `src/ecs/components/Component_Shop.js` | **NEW** — shop config (cost, effect, cooldown) | 4 |
| `src/systems/ShopSystem.js` | **NEW** — drains coins, applies effect (heal, etc.) | 4 |
| `src/config/archetypes/health-shop.json` | **NEW** — health shop archetype | 4 |

---

## Task 1: New Resource Types

Add three zombie-themed resource types to the registry, HUD, and player collector.

**Files:**
- Modify: `src/config/resources.json`
- Modify: `src/ui/HUD.js:1-8`
- Modify: `src/config/archetypes/player.json:9`

- [ ] **Step 1: Add resource definitions to resources.json**

Replace the entire file with:

```json
{
    "meat": {
        "mesh": { "preset": "disk", "color": "0xff3333", "radius": 0.3, "height": 0.1 },
        "stackOffset": 0.22,
        "value": 1
    },
    "bio-matter": {
        "mesh": { "preset": "disk", "color": "0x44cc44", "radius": 0.25, "height": 0.1 },
        "stackOffset": 0.20,
        "value": 1
    },
    "zombie-teeth": {
        "mesh": { "preset": "disk", "color": "0xeeddcc", "radius": 0.18, "height": 0.08 },
        "stackOffset": 0.16,
        "value": 3
    },
    "mutant-core": {
        "mesh": { "preset": "disk", "color": "0xaa44ff", "radius": 0.22, "height": 0.12 },
        "stackOffset": 0.20,
        "value": 10
    },
    "coin": {
        "mesh": { "preset": "coin", "color": "0xffdd00", "radius": 0.25, "height": 0.08 },
        "stackOffset": 0.16,
        "value": 1
    },
    "wood": {
        "mesh": { "preset": "disk", "color": "0x8B4513", "radius": 0.25, "height": 0.12 },
        "stackOffset": 0.20,
        "value": 1
    }
}
```

Notes:
- `meat` is kept for backward compat with the villager trading loop.
- `bio-matter` is green (zombie goo), common drop.
- `zombie-teeth` is bone-white, rarer drop.
- `mutant-core` is purple, boss/tank drop.

- [ ] **Step 2: Add emoji mappings in HUD.js**

In `src/ui/HUD.js`, replace the `RESOURCE_EMOJI` object (lines 3-8) with:

```js
const RESOURCE_EMOJI = {
    meat: '\u{1F356}',
    'bio-matter': '\u{1F9EA}',
    'zombie-teeth': '\u{1F9B7}',
    'mutant-core': '\u{1F52E}',
    coin: '\u{1FA99}',
    wood: '\u{1FAB5}',
    stone: '\u{1FAA8}'
};
```

- [ ] **Step 3: Update player Collector to accept new types**

In `src/config/archetypes/player.json`, change the Collector line:

```json
"Collector": { "radius": 5, "resourceTypes": ["meat", "bio-matter", "zombie-teeth", "mutant-core", "coin", "wood"], "pullForce": 1.0, "collectFromTags": ["tray"], "pickupRate": 0.25 }
```

- [ ] **Step 4: Verify in browser**

Run the dev server and confirm:
- HUD shows the meat emoji on startup (existing behavior intact)
- No console errors about unknown resource types
- Game plays normally (enemies still drop meat — Task 2 changes this)

- [ ] **Step 5: Commit**

```bash
git add src/config/resources.json src/ui/HUD.js src/config/archetypes/player.json
git commit -m "feat(economy): add bio-matter, zombie-teeth, mutant-core resource types — B1"
```

---

## Task 2: Configurable Drop Tables

Replace the hardcoded `drops.push('meat')` in HealthSystem with a data-driven Drops component. Each enemy archetype specifies its own drop table with type, chance, and quantity range.

**Files:**
- Create: `src/ecs/components/Component_Drops.js`
- Modify: `src/entities/EntityFactory.js:1-45`
- Modify: `src/systems/HealthSystem.js:34-42`
- Modify: `src/config/archetypes/enemy.json`
- Modify: `src/config/archetypes/speeder.json`
- Modify: `src/config/archetypes/tank.json`

- [ ] **Step 1: Create Component_Drops**

Create `src/ecs/components/Component_Drops.js`:

```js
/**
 * Drops — Configurable loot table for entity death.
 *
 * table: Array of { type, chance, min, max }
 *   type: resource type string (matches resources.json keys)
 *   chance: 0-1 probability of this drop occurring (default 1.0)
 *   min: minimum disk count when drop triggers (default 2)
 *   max: maximum disk count when drop triggers (default 4)
 */
export class Component_Drops {
    constructor({ table = [] } = {}) {
        this.table = table.map(entry => ({
            type: entry.type || 'meat',
            chance: entry.chance ?? 1.0,
            min: entry.min ?? 2,
            max: entry.max ?? 4
        }));
    }

    /**
     * Roll the drop table and return an array of { type, count } results.
     * Each entry in the table is rolled independently.
     */
    roll() {
        const results = [];
        for (const entry of this.table) {
            if (Math.random() <= entry.chance) {
                const count = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
                results.push({ type: entry.type, count });
            }
        }
        return results;
    }
}
```

- [ ] **Step 2: Register Drops in EntityFactory**

In `src/entities/EntityFactory.js`, add the import at the top (after the ContactDamage import):

```js
import { Component_Drops } from '../ecs/components/Component_Drops.js';
```

Add to the `COMPONENT_MAP` object:

```js
    Drops:           (d) => new Component_Drops(d),
```

- [ ] **Step 3: Update HealthSystem to use Drops component**

In `src/systems/HealthSystem.js`, replace lines 39-41 (the hardcoded drops logic):

```js
                const tag = ecs.getComponent(entityId, 'Tag');
                const drops = [];
                if (tag && tag.has('enemy')) drops.push('meat');
```

with:

```js
                const tag = ecs.getComponent(entityId, 'Tag');
                const dropsComp = ecs.getComponent(entityId, 'Drops');
                const drops = [];
                if (dropsComp) {
                    const rolled = dropsComp.roll();
                    for (const { type, count } of rolled) {
                        for (let i = 0; i < count; i++) {
                            drops.push(type);
                        }
                    }
                } else if (tag && tag.has('enemy')) {
                    drops.push('meat'); // fallback for enemies without Drops component
                }
```

This keeps backward compatibility: enemies without a Drops component still drop meat.

- [ ] **Step 4: Add Drops to enemy archetypes**

**enemy.json** — Add Drops to the components object:

```json
{
  "type": "Enemy",
  "mesh": { "preset": "character", "color": "0xff3333" },
  "behaviors": ["mover", "damageable"],
  "components": {
    "Movement":  { "speed": 3.8, "controller": "simple_steering", "faction": "enemy" },
    "Health":    { "hp": 4, "maxHp": 4, "armor": 0 },
    "Tag":       { "tags": ["enemy"] },
    "WalkAnim":  { "bobHeight": 0.06, "bobFreq": 7, "tiltAngle": 0.05 },
    "FlashAnim": { "color": "#ffffff", "duration": 0.1, "onEvent": "entity:damaged" },
    "ContactDamage": { "damage": 1, "cooldown": 0.8, "range": 1.2, "targetFactions": ["player", "structure"] },
    "Drops": { "table": [
      { "type": "bio-matter", "chance": 1.0, "min": 2, "max": 4 }
    ]}
  }
}
```

**speeder.json** — Add Drops (inherits from enemy, override the drop table):

```json
{
  "extends": "enemy",
  "mesh": { "preset": "character", "color": "0xff6600" },
  "type": "Speeder",
  "components": {
    "Movement": { "speed": 7 },
    "Health":   { "hp": 2, "maxHp": 2 },
    "ContactDamage": { "damage": 1, "cooldown": 0.5, "range": 1.0, "targetFactions": ["player", "structure"] },
    "Drops": { "table": [
      { "type": "bio-matter", "chance": 1.0, "min": 1, "max": 2 },
      { "type": "zombie-teeth", "chance": 0.3, "min": 1, "max": 1 }
    ]}
  }
}
```

**tank.json** — Add Drops (tanks drop more loot):

```json
{
  "extends": "enemy",
  "mesh": { "preset": "character", "color": "0x880000" },
  "type": "Tank",
  "components": {
    "Movement": { "speed": 1.8 },
    "Health":   { "hp": 12, "maxHp": 12, "armor": 1 },
    "ContactDamage": { "damage": 3, "cooldown": 1.2, "range": 1.5, "targetFactions": ["player", "structure"] },
    "Drops": { "table": [
      { "type": "bio-matter", "chance": 1.0, "min": 3, "max": 5 },
      { "type": "zombie-teeth", "chance": 0.6, "min": 1, "max": 2 },
      { "type": "mutant-core", "chance": 0.2, "min": 1, "max": 1 }
    ]}
  }
}
```

- [ ] **Step 5: Verify in browser**

Run the game and confirm:
- Kill a base zombie → green bio-matter disks scatter (2-4 count)
- Kill a speeder → bio-matter disks + occasional white zombie-teeth
- Kill a tank → bio-matter + teeth + rare purple mutant-core
- Disks get magnetically pulled to player
- HUD shows counts for each collected resource type with correct emojis
- Player can carry multiple resource types in separate inventory slots

- [ ] **Step 6: Commit**

```bash
git add src/ecs/components/Component_Drops.js src/entities/EntityFactory.js src/systems/HealthSystem.js src/config/archetypes/enemy.json src/config/archetypes/speeder.json src/config/archetypes/tank.json
git commit -m "feat(economy): configurable drop tables per enemy archetype — B2"
```

---

## Task 3: Market System (Sell Resources for Coins)

Add a market stall where the player can trade collected resources for coins. Player walks into range, resources drain one-by-one, coins are added to player inventory with a visual arc.

**Files:**
- Create: `src/ecs/components/Component_Market.js`
- Create: `src/systems/MarketSystem.js`
- Create: `src/config/archetypes/market.json`
- Modify: `src/core/MeshPresets.js` (add 'stall' preset)
- Modify: `src/entities/EntityFactory.js` (register Market)
- Modify: `src/core/ArchetypeLoader.js:9-13` (add 'market')
- Modify: `src/main.js` (register MarketSystem)
- Modify: `src/config/levels/level-1.json` (add market entity)

- [ ] **Step 1: Create Component_Market**

Create `src/ecs/components/Component_Market.js`:

```js
/**
 * Market — Converts resources to coins when a player is nearby.
 *
 * accepts: array of resource types this market buys (e.g. ["bio-matter", "zombie-teeth"])
 * payRate: object mapping resource type → coin value (e.g. { "bio-matter": 1, "zombie-teeth": 5 })
 * range: proximity radius for interaction
 * drainRate: seconds between each resource drain
 */
export class Component_Market {
    constructor({
        accepts = ['bio-matter', 'zombie-teeth', 'mutant-core'],
        payRate = { 'bio-matter': 1, 'zombie-teeth': 5, 'mutant-core': 15 },
        range = 3.0,
        drainRate = 0.3
    } = {}) {
        this.accepts = accepts;
        this.payRate = payRate;
        this.range = range;
        this.drainRate = drainRate;
        this.timeSinceLastDrain = 999;
    }
}
```

- [ ] **Step 2: Create MarketSystem**

Create `src/systems/MarketSystem.js`:

```js
import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import EventBus from '../core/EventBus.js';

/**
 * MarketSystem — Sells player resources for coins at market zones.
 *
 * Queries: ['Transform', 'Market']
 * Finds nearby carriers with ['Transform', 'InventoryStack']
 * Drains accepted resources, spawns coin meshes into carrier inventory.
 *
 * Emits: 'stack:changed', 'item:collected'
 */
export class MarketSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        const carriers = ecs.queryEntities(['Transform', 'Collector', 'InventoryStack']);

        for (const marketId of entities) {
            const marketTransform = ecs.getComponent(marketId, 'Transform');
            const market = ecs.getComponent(marketId, 'Market');
            if (!marketTransform || !market) continue;

            market.timeSinceLastDrain += deltaTime;

            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = carrierTransform.mesh.position.distanceTo(marketTransform.mesh.position);
                if (dist > market.range) continue;

                if (market.timeSinceLastDrain < market.drainRate) continue;

                // Find a sellable resource in the carrier
                let sold = false;
                for (const type of market.accepts) {
                    if (carrierInventory.getCountByType(type) === 0) continue;

                    const mesh = carrierInventory.popFromSlot(type);
                    if (!mesh) continue;

                    sold = true;
                    market.timeSinceLastDrain = 0;

                    const coinValue = market.payRate[type] || 1;

                    // Animate resource flying to market stall
                    const fromPos = mesh.position.clone();
                    const toPos = marketTransform.mesh.position.clone();
                    toPos.y += 1.0;

                    this._transfer.send(mesh, fromPos, toPos, {
                        arcHeight: 2.5,
                        duration: 0.4,
                        spin: true,
                        onArrive: (m) => {
                            this.scene.remove(m);
                            if (m.geometry) m.geometry.dispose();
                            if (m.material) m.material.dispose();

                            // Spawn coins back to carrier
                            this._spawnCoins(coinValue, marketTransform.mesh.position, carrierId, ecs);
                        }
                    });

                    // Update carrier HUD
                    EventBus.emit('stack:changed', {
                        entityId: carrierId,
                        type,
                        count: carrierInventory.getCountByType(type),
                        totalCount: carrierInventory.getTotalCount()
                    });

                    break; // one resource per drain tick
                }
            }
        }
    }

    /**
     * Spawn coin meshes that fly to the carrier's inventory.
     */
    _spawnCoins(count, fromPos, carrierId, ecs) {
        const carrierTransform = ecs.getComponent(carrierId, 'Transform');
        if (!carrierTransform) return;

        for (let i = 0; i < count; i++) {
            const coinMesh = ResourceRegistry.createMesh('coin');
            const startPos = fromPos.clone();
            startPos.x += (Math.random() - 0.5) * 0.5;
            startPos.y += 1.0 + i * 0.1;
            startPos.z += (Math.random() - 0.5) * 0.5;

            coinMesh.position.copy(startPos);
            this.scene.add(coinMesh);

            const toPos = carrierTransform.mesh.position.clone();
            toPos.y += 1.2;

            // Stagger coin arrivals
            setTimeout(() => {
                this._transfer.send(coinMesh, startPos.clone(), toPos, {
                    arcHeight: 2.0,
                    duration: 0.35,
                    spin: true,
                    onArrive: (m) => {
                        EventBus.emit('item:collected', {
                            collectorId: carrierId,
                            itemType: 'coin',
                            mesh: m
                        });
                    }
                });
            }, i * 80);
        }
    }
}
```

- [ ] **Step 3: Add 'stall' mesh preset**

In `src/core/MeshPresets.js`, add this preset registration before the `export default` line:

```js
MeshPresets.register('stall', ({ color = 0x8b6914, width = 2.5, depth = 1.5 } = {}) => {
    const group = new THREE.Group();

    // Counter
    const counterGeo = new THREE.BoxGeometry(width, 0.6, depth);
    const counterMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = 0.3;
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    // Awning posts (4 corners)
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const positions = [
        [-width / 2 + 0.1, 0.9, -depth / 2 + 0.1],
        [width / 2 - 0.1, 0.9, -depth / 2 + 0.1],
        [-width / 2 + 0.1, 0.9, depth / 2 - 0.1],
        [width / 2 - 0.1, 0.9, depth / 2 - 0.1]
    ];
    for (const [x, y, z] of positions) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, y, z);
        post.castShadow = true;
        group.add(post);
    }

    // Awning (flat roof)
    const awningGeo = new THREE.BoxGeometry(width + 0.4, 0.08, depth + 0.4);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.9 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.y = 1.8;
    awning.castShadow = true;
    awning.receiveShadow = true;
    group.add(awning);

    return group;
});
```

- [ ] **Step 4: Create market archetype**

Create `src/config/archetypes/market.json`:

```json
{
  "type": "Market",
  "mesh": { "preset": "stall", "color": "0x8b6914", "width": 2.5, "depth": 1.5 },
  "behaviors": ["market"],
  "components": {
    "Market": {
      "accepts": ["bio-matter", "zombie-teeth", "mutant-core"],
      "payRate": { "bio-matter": 1, "zombie-teeth": 5, "mutant-core": 15 },
      "range": 3.0,
      "drainRate": 0.3
    },
    "Tag": { "tags": ["market"] }
  }
}
```

- [ ] **Step 5: Register Market in EntityFactory**

In `src/entities/EntityFactory.js`, add the import:

```js
import { Component_Market } from '../ecs/components/Component_Market.js';
```

Add to `COMPONENT_MAP`:

```js
    Market:          (d) => new Component_Market(d),
```

- [ ] **Step 6: Register archetype in ArchetypeLoader**

In `src/core/ArchetypeLoader.js`, update the `ARCHETYPE_NAMES` array to include `'market'`:

```js
const ARCHETYPE_NAMES = [
    'player', 'enemy', 'speeder', 'tank',
    'villager', 'turret', 'wall', 'meat-table', 'coin-tray',
    'unlock-turret', 'gate', 'market'
];
```

- [ ] **Step 7: Register MarketSystem in main.js**

In `src/main.js`, add the import:

```js
import { MarketSystem } from './systems/MarketSystem.js';
```

In the `init()` method, register the system after the ContactDamageSystem registration (around line 76):

```js
        this.marketSystem = new MarketSystem(this.scene.instance);
        this.ecs.registerSystem(this.marketSystem, ['Transform', 'Market']);
```

- [ ] **Step 8: Add market to level-1.json**

In `src/config/levels/level-1.json`, add a market entity to the `entities` array. Place it inside the base, opposite side from the meat table (cell [15, 14], roughly x: 2, z: 2):

```json
{ "archetype": "market", "cell": [15, 14], "position": { "x": 2, "y": 0, "z": 2 } }
```

The `entities` array should now look like:

```json
"entities": [
    { "archetype": "meat-table", "cell": [10, 14], "gridSpan": [1, 2], "position": { "x": 0, "y": 0.3, "z": -9 } },
    { "archetype": "coin-tray", "cell": [9, 13], "position": { "x": -3, "y": 0, "z": -11 } },
    { "archetype": "market", "cell": [15, 14], "position": { "x": 2, "y": 0, "z": 2 } }
]
```

- [ ] **Step 9: Verify in browser**

Run the game and confirm:
- A stall mesh appears at the market position inside the base
- Kill zombies → collect bio-matter / zombie-teeth / mutant-core
- Walk near the market stall → resources drain one-by-one from player's back
- Resources fly to the stall, coins fly back to the player
- HUD updates: resource counts decrease, coin count increases
- 1 bio-matter = 1 coin, 1 zombie-teeth = 5 coins, 1 mutant-core = 15 coins
- Player can collect coins in their inventory (uses a slot)

- [ ] **Step 10: Commit**

```bash
git add src/ecs/components/Component_Market.js src/systems/MarketSystem.js src/config/archetypes/market.json src/core/MeshPresets.js src/entities/EntityFactory.js src/core/ArchetypeLoader.js src/main.js src/config/levels/level-1.json
git commit -m "feat(economy): market stall — sell resources for coins — B3"
```

---

## Task 4: Shop System (Buy with Coins)

Add a shop zone where players spend coins on repeatable effects. Start with a "Health Shop" that restores player HP for 5 coins. Uses flat-on-ground UI (same visual style as unlock zones) showing cost and output.

**Files:**
- Create: `src/ecs/components/Component_Shop.js`
- Create: `src/systems/ShopSystem.js`
- Create: `src/config/archetypes/health-shop.json`
- Modify: `src/entities/EntityFactory.js` (register Shop)
- Modify: `src/core/ArchetypeLoader.js` (add 'health-shop')
- Modify: `src/main.js` (register ShopSystem)
- Modify: `src/config/levels/level-1.json` (add shop entity)

- [ ] **Step 1: Create Component_Shop**

Create `src/ecs/components/Component_Shop.js`:

```js
/**
 * Shop — Repeatable purchase zone. Player spends coins, receives an effect.
 *
 * cost: number of coins per purchase
 * effect: string key — what happens on purchase ("heal", "speed_boost", etc.)
 * effectValue: numeric value for the effect (e.g. HP to restore)
 * range: proximity radius for interaction
 * drainRate: seconds between each coin drain
 * cooldown: seconds after purchase before next purchase allowed
 * label: display name for the shop
 */
export class Component_Shop {
    constructor({
        cost = 5,
        effect = 'heal',
        effectValue = 10,
        range = 3.0,
        drainRate = 0.25,
        cooldown = 2.0,
        label = 'Health'
    } = {}) {
        this.cost = cost;
        this.effect = effect;
        this.effectValue = effectValue;
        this.range = range;
        this.drainRate = drainRate;
        this.cooldown = cooldown;
        this.label = label;

        // Runtime state
        this.coinsDrained = 0;
        this.timeSinceLastDrain = 999;
        this.cooldownTimer = 0;
    }
}
```

- [ ] **Step 2: Create ShopSystem**

Create `src/systems/ShopSystem.js`:

```js
import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * ShopSystem — Drains coins from nearby players, applies effects on purchase.
 *
 * Queries: ['Transform', 'Shop']
 * Finds nearby carriers with ['Transform', 'InventoryStack', 'Tag'] (player tag)
 *
 * Effects:
 *   "heal" — restores effectValue HP to the buyer
 *
 * Emits: 'stack:changed', 'entity:hp_changed', 'shop:purchased'
 */
export class ShopSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        const players = ecs.queryEntities(['Transform', 'InventoryStack', 'Tag']);

        for (const shopId of entities) {
            const shopTransform = ecs.getComponent(shopId, 'Transform');
            const shop = ecs.getComponent(shopId, 'Shop');
            if (!shopTransform || !shop) continue;

            shop.timeSinceLastDrain += deltaTime;

            // Cooldown after a completed purchase
            if (shop.cooldownTimer > 0) {
                shop.cooldownTimer -= deltaTime;
                continue;
            }

            for (const playerId of players) {
                const playerTag = ecs.getComponent(playerId, 'Tag');
                if (!playerTag || !playerTag.has('player')) continue;

                const playerTransform = ecs.getComponent(playerId, 'Transform');
                const playerInventory = ecs.getComponent(playerId, 'InventoryStack');
                if (!playerTransform || !playerInventory) continue;

                const dist = playerTransform.mesh.position.distanceTo(shopTransform.mesh.position);
                if (dist > shop.range) continue;

                // Check if player has coins
                if (playerInventory.getCountByType('coin') === 0) continue;

                if (shop.timeSinceLastDrain < shop.drainRate) continue;

                // Check if purchase would be useful
                if (!this._isEffectUseful(shop, playerId, ecs)) continue;

                // Drain one coin
                const coinMesh = playerInventory.popFromSlot('coin');
                if (!coinMesh) continue;

                shop.coinsDrained++;
                shop.timeSinceLastDrain = 0;

                // Animate coin flying to shop
                const fromPos = coinMesh.position.clone();
                const toPos = shopTransform.mesh.position.clone();
                toPos.y += 1.0;

                this._transfer.send(coinMesh, fromPos, toPos, {
                    arcHeight: 2.0,
                    duration: 0.35,
                    spin: true,
                    onArrive: (m) => {
                        this.scene.remove(m);
                        if (m.geometry) m.geometry.dispose();
                        if (m.material) m.material.dispose();
                    }
                });

                EventBus.emit('stack:changed', {
                    entityId: playerId,
                    type: 'coin',
                    count: playerInventory.getCountByType('coin'),
                    totalCount: playerInventory.getTotalCount()
                });

                // Check if purchase is complete
                if (shop.coinsDrained >= shop.cost) {
                    this._applyEffect(shop, playerId, ecs);
                    shop.coinsDrained = 0;
                    shop.cooldownTimer = shop.cooldown;

                    EventBus.emit('shop:purchased', {
                        shopId,
                        playerId,
                        effect: shop.effect,
                        effectValue: shop.effectValue
                    });
                }

                break; // one coin per tick
            }
        }
    }

    _isEffectUseful(shop, playerId, ecs) {
        if (shop.effect === 'heal') {
            const health = ecs.getComponent(playerId, 'Health');
            if (!health) return false;
            return health.hp < health.maxHp;
        }
        return true;
    }

    _applyEffect(shop, playerId, ecs) {
        switch (shop.effect) {
            case 'heal': {
                const health = ecs.getComponent(playerId, 'Health');
                if (!health) return;
                health.hp = Math.min(health.maxHp, health.hp + shop.effectValue);
                EventBus.emit('entity:hp_changed', {
                    entityId: playerId,
                    hp: health.hp,
                    maxHp: health.maxHp
                });
                break;
            }
            default:
                console.warn(`ShopSystem: unknown effect '${shop.effect}'`);
        }
    }
}
```

- [ ] **Step 3: Create health-shop archetype**

Create `src/config/archetypes/health-shop.json`:

```json
{
  "type": "HealthShop",
  "mesh": { "preset": "stall", "color": "0x44aa44", "width": 2.0, "depth": 1.2 },
  "behaviors": ["shop"],
  "components": {
    "Shop": {
      "cost": 5,
      "effect": "heal",
      "effectValue": 10,
      "range": 3.0,
      "drainRate": 0.25,
      "cooldown": 2.0,
      "label": "Health"
    },
    "Tag": { "tags": ["shop", "health-shop"] }
  }
}
```

- [ ] **Step 4: Register Shop in EntityFactory**

In `src/entities/EntityFactory.js`, add the import:

```js
import { Component_Shop } from '../ecs/components/Component_Shop.js';
```

Add to `COMPONENT_MAP`:

```js
    Shop:            (d) => new Component_Shop(d),
```

- [ ] **Step 5: Register archetype in ArchetypeLoader**

In `src/core/ArchetypeLoader.js`, update `ARCHETYPE_NAMES`:

```js
const ARCHETYPE_NAMES = [
    'player', 'enemy', 'speeder', 'tank',
    'villager', 'turret', 'wall', 'meat-table', 'coin-tray',
    'unlock-turret', 'gate', 'market', 'health-shop'
];
```

- [ ] **Step 6: Register ShopSystem in main.js**

In `src/main.js`, add the import:

```js
import { ShopSystem } from './systems/ShopSystem.js';
```

Register after MarketSystem in `init()`:

```js
        this.shopSystem = new ShopSystem(this.scene.instance);
        this.ecs.registerSystem(this.shopSystem, ['Transform', 'Shop']);
```

- [ ] **Step 7: Add health shop to level-1.json**

In `src/config/levels/level-1.json`, add a health shop entity. Place it near the market but distinct (cell [16, 12], roughly x: -4, z: 4):

```json
{ "archetype": "health-shop", "cell": [16, 12], "position": { "x": -4, "y": 0, "z": 4 } }
```

The `entities` array should now be:

```json
"entities": [
    { "archetype": "meat-table", "cell": [10, 14], "gridSpan": [1, 2], "position": { "x": 0, "y": 0.3, "z": -9 } },
    { "archetype": "coin-tray", "cell": [9, 13], "position": { "x": -3, "y": 0, "z": -11 } },
    { "archetype": "market", "cell": [15, 14], "position": { "x": 2, "y": 0, "z": 2 } },
    { "archetype": "health-shop", "cell": [16, 12], "position": { "x": -4, "y": 0, "z": 4 } }
]
```

- [ ] **Step 8: Verify in browser**

Full game loop verification:
1. Game starts — market stall (brown/red awning) and health shop (green awning) visible inside base
2. Kill zombies → collect bio-matter, zombie-teeth, mutant-core (different colors)
3. Walk to market → resources drain, coins fly back to player
4. Take some zombie damage (let a zombie hit you)
5. Walk to health shop → coins drain one by one (5 total), HP bar restores to full
6. Health shop does nothing when player is at full HP
7. After purchase, 2-second cooldown before next purchase is possible
8. HUD correctly shows all resource types with proper emojis and counts
9. No console errors

- [ ] **Step 9: Commit**

```bash
git add src/ecs/components/Component_Shop.js src/systems/ShopSystem.js src/config/archetypes/health-shop.json src/entities/EntityFactory.js src/core/ArchetypeLoader.js src/main.js src/config/levels/level-1.json
git commit -m "feat(economy): shop system — buy health with coins — B4"
```

---

## Verification Checklist (Post All Tasks)

After all four tasks are complete, run through the full game loop:

1. **Resource variety:** Base zombie drops green bio-matter. Speeder drops bio-matter + rare white teeth. Tank drops bio-matter + teeth + rare purple core.
2. **Collection:** All drop types magnetically fly to player. Player back shows colored stacks side-by-side. HUD shows counts with emojis.
3. **Selling:** Walk to market stall → resources drain one-by-one → coins fly back. Pay rates: bio-matter=1, teeth=5, core=15.
4. **Buying:** Walk to health shop with coins and less than full HP → coins drain (5 total) → HP restores. Full HP = shop does nothing.
5. **Existing systems intact:** Villager trading loop still works (meat table, coin tray). Unlock zones still work. Gate still opens. Combat feels the same.
