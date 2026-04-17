# Content Format — Conversion Recipe

This is the procedural recipe Claude follows when the user points at **any standalone Three.js preview HTML file** in the project (e.g. `zombie-preview.html`, `resources-preview.html`, or any new preview file the user creates later — `factories-preview.html`, `crab-zombie-preview.html`, `auto-weapons-preview.html`, etc.) and says **"convert this asset to project format."** Architecture rationale lives in `ARCHITECTURE_CONTENT.md`. This doc is the how-to.

The recipe is **source-file-agnostic.** It does not care what the preview HTML is named or how many assets it contains. It cares about the *pattern* inside: a function (or closure) that builds geometry, an optional per-frame animate function, and optional particle calls. Wherever you find that pattern in any preview file, the recipe applies.

The recipe is unambiguous on purpose. Follow it in order. Do not improvise.

---

## Step 1 — Identify the tier

Decision tree, in order. Stop at the first match.

1. Does it have AI, walk around, AND appear in groups (multiple instances at once)? → **`crowd`**
   - Examples: zombie variants, villagers, customers, worker NPCs.
2. Is it a unique character — boss, story NPC, the player, a quest-giver, a trader? → **`hero`**
   - Examples: trader, elder, named bosses, the player avatar.
3. Does it sit still, or is it decor / a building / a static weapon emplacement? → **`prop`**
   - Examples: auto-factories, auto-turrets, walls, gates, trees, rocks, crates.

If still unsure: ask the user. Do not guess.

## Step 2 — Identify the category folder

| Tier | Category folder |
|---|---|
| crowd creature (enemy or neutral mob) | `src/content/creatures/<name>/` |
| crowd NPC (friendly walker) | `src/content/actors/<name>/` |
| hero NPC or boss | `src/content/actors/<name>/` |
| hero creature boss | `src/content/creatures/<name>/` |
| prop (anything not walking) | `src/content/props/<name>/` |

`<name>` is the snake_case archetype id.

## Step 3 — Extract the geometry

Find the build/create function in the preview HTML. It is usually a closure or a `function createX()` returning a `THREE.Group`. Copy the body that **builds geometry**. Drop:

- scene setup, camera, renderer code
- light additions to a global scene
- the `requestAnimationFrame` loop
- HTML/CSS/UI

Wrap the kept code as a single exported `build(opts)` function in `<name>.mesh.js`. Tier matters here:

### Hero tier — return a `THREE.Group`

```js
// src/content/actors/trader/trader.mesh.js
import * as THREE from 'three';

export function build(opts = {}) {
  const group = new THREE.Group();

  // ---- copy geometry construction from the preview here ----
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xc08060 })
  );
  body.name = 'body';
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffd9a8 })
  );
  head.name = 'head';
  head.position.y = 0.7;
  group.add(head);
  // ----------------------------------------------------------

  return group;
}

// Named local-space anchors the gameplay code attaches things to.
export const anchors = {
  healthBar: [0, 1.6, 0],
  nameTag:   [0, 1.9, 0],
  hand:      [0.25, 0.6, 0]
};
```

`partRefs` for the FSM are looked up by `group.getObjectByName(...)`, so name every animated sub-mesh.

### Crowd tier — return geometry + materials + shader params

The crowd pool needs raw geometries to instance, not a Group. Return a description object.

```js
// src/content/creatures/shambler/shambler.mesh.js
import * as THREE from 'three';

export function build(opts = {}) {
  return {
    parts: [
      {
        name: 'body',
        geometry: new THREE.CapsuleGeometry(0.3, 0.6, 4, 8),
        material: new THREE.MeshStandardMaterial({ color: 0x4a6b3a }),
        offset: [0, 0.4, 0]
      },
      {
        name: 'head',
        geometry: new THREE.SphereGeometry(0.22, 10, 8),
        material: new THREE.MeshStandardMaterial({ color: 0x6a8b5a }),
        offset: [0, 1.05, 0]
      }
    ]
  };
}

export const shaderParams = {
  walkSpeed: 1.2,    // shader cycle rate
  bobHeight: 0.08,   // vertical bob amplitude
  swayAmount: 0.15   // side-to-side sway
};
```

`InstancedCharacterPool` reads `parts[]` and `shaderParams` to allocate one `InstancedMesh` per part, sharing a `uTime` uniform driven by `CrowdAnimSystem`.

### Prop tier — return geometry + materials + optional shader loop

Static props use the same return shape as crowd, minus the `shaderParams` cycle (or with a different shader loop hook like `pulse`, `smoke`, `scroll`).

```js
// src/content/props/factory_basic/factory_basic.mesh.js
import * as THREE from 'three';

export function build(opts = {}) {
  return {
    parts: [
      {
        name: 'base',
        geometry: new THREE.BoxGeometry(1.2, 0.6, 1.2),
        material: new THREE.MeshStandardMaterial({ color: 0x707080 }),
        offset: [0, 0.3, 0]
      },
      {
        name: 'chimney',
        geometry: new THREE.CylinderGeometry(0.1, 0.12, 0.6, 8),
        material: new THREE.MeshStandardMaterial({ color: 0x404048 }),
        offset: [0.3, 0.9, 0.3]
      }
    ]
  };
}

export const shaderParams = {
  pulseRate: 0.8,
  smokeAnchor: [0.3, 1.2, 0.3]
};
```

## Step 4 — Extract animation (HERO TIER ONLY)

Crowd and prop tiers do **not** get an FSM file — they animate via shader uniforms only. Skip this step for them.

For hero tier: find the per-frame animate function in the preview. It usually does things like `body.rotation.x = Math.sin(t * 2) * 0.1`. Decompose those behaviors into named states. Write `<name>.fsm.js` in the data-oriented format.

```js
// src/content/actors/trader/trader.fsm.js
import { EventBus } from '../../../core/EventBus.js';

export const fsm = {
  initial: 'idle',

  states: {
    idle: {
      duration: null,
      onUpdate: (entity, dt, params) => {
        const body = entity.heroMesh.group.getObjectByName('body');
        body.rotation.y = Math.sin(params._t = (params._t || 0) + dt) * 0.1;
      }
    },
    greet: {
      duration: 0.6,
      onEnter: (entity, params) => { /* play wave gesture setup */ },
      onUpdate: (entity, dt, params) => { /* wave anim */ }
    },
    trade: {
      duration: 0.8,
      onEnter: (entity, params) => EventBus.emit('trader:transaction', entity)
    },
    hit: { duration: 0.2 },
    die: {
      duration: 1.0,
      onExit: (entity) => EventBus.emit('entity:despawn', entity)
    }
  },

  transitions: [
    { from: 'idle',  to: 'greet', on: 'agent:at_table' },
    { from: 'greet', to: 'trade', when: (e, p, stateTime) => stateTime >= 0.6 },
    { from: 'trade', to: 'idle',  when: (e, p, stateTime) => stateTime >= 0.8 },
    { from: '*',     to: 'hit',   on: 'entity:hit' },
    { from: '*',     to: 'die',   on: 'entity:died' }
  ]
};
```

Combo example (boss with finisher every 4th hit):

```js
{ from: 'attack', to: 'attack_finisher',
  when: (e, p) => (p.comboCount = (p.comboCount || 0) + 1) % 4 === 0 },
{ from: 'attack', to: 'idle',
  when: (e, p) => p.comboCount % 4 !== 0 }
```

`HeroAnimSystem` interprets this. Do not write a custom system per FSM.

## Step 5 — Extract effects (optional)

If the preview spawned particles on hit/death/attack, declare them in `<name>.effects.js` as data hooks. The runtime `EffectSystem` (existing or planned) maps hook names to `ParticleSystem` calls.

```js
// src/content/creatures/shambler/shambler.effects.js
export const effects = {
  onHit:    { particle: 'blood_puff',  sound: null },
  onDeath:  { particle: 'blood_burst', sound: null },
  onAttack: { particle: 'swing_arc',   sound: null }
};
```

Particle hook names must match strings already registered in `ParticleSystem`. If a needed particle doesn't exist yet, leave the hook name in place and note it in the commit message — the gap is on the particle side, not the content side.

## Step 6 — Write the archetype JSON

Always include `id` and `renderTier`. Use `extends` to inherit shared stats from a base archetype.

### Crowd template

```json
{
  "id": "shambler",
  "renderTier": "crowd",
  "extends": "enemy_base",
  "stats": { "hp": 30, "damage": 5, "speed": 1.2 },
  "ai":    { "behavior": "walker", "aggroRadius": 12 },
  "effects": { "onHit": "blood_puff", "onDeath": "blood_burst" },
  "sound":   { "onHit": null, "onDeath": null }
}
```

### Hero template

```json
{
  "id": "trader",
  "renderTier": "hero",
  "extends": "npc_base",
  "stats": { "hp": 200 },
  "ai":    { "behavior": "stationary_trader" },
  "fsm":   "trader_fsm",
  "effects": { "onHit": "spark_puff" },
  "sound":   { "onHit": null }
}
```

### Prop template

```json
{
  "id": "factory_basic",
  "renderTier": "prop",
  "extends": "prop_base",
  "stats":    { "hp": 100, "produces": "meat", "rate": 1.0 },
  "shader":   { "loop": "pulse", "smoke": true },
  "effects":  { "onPlace": "dust_puff", "onDestroy": "debris_burst" }
}
```

`extends` resolves through `ArchetypeLoader`. Base archetypes (`enemy_base`, `npc_base`, `prop_base`) live in `src/content/_base/` and are also registered in the manifest.

## Step 7 — Register in `src/content/manifest.js`

The manifest is the explicit registry. Add one entry per new archetype. Lazy imports keep startup cheap.

```js
// src/content/manifest.js
export const manifest = {
  shambler: {
    json:    () => import('./creatures/shambler/shambler.json'),
    mesh:    () => import('./creatures/shambler/shambler.mesh.js'),
    effects: () => import('./creatures/shambler/shambler.effects.js')
  },
  trader: {
    json: () => import('./actors/trader/trader.json'),
    mesh: () => import('./actors/trader/trader.mesh.js'),
    fsm:  () => import('./actors/trader/trader.fsm.js')
  },
  factory_basic: {
    json: () => import('./props/factory_basic/factory_basic.json'),
    mesh: () => import('./props/factory_basic/factory_basic.mesh.js')
  }
};
```

Omit keys that don't apply (`fsm` for crowd, `effects` if none, etc.).

## Step 8 — Smoke test

1. Add or reuse a debug spawn key in `main.js` that spawns this archetype at a known position.
2. Run the game. Verify:
   - The entity appears.
   - Crowd: 50 instances cost roughly `parts.length × 1` draw calls (no per-entity overhead).
   - Hero: the FSM transitions correctly on `entity:hit` and `entity:died`.
   - Prop: it sits where placed and the shader loop ticks.
3. Compare against the source preview side-by-side. If it doesn't visually match, the geometry extraction in Step 3 is wrong — fix that first, not the JSON.

## Step 9 — Commit checklist

Before committing, confirm:

- [ ] `src/content/<category>/<name>/<name>.json` exists with `renderTier` set.
- [ ] `src/content/<category>/<name>/<name>.mesh.js` exists and exports `build()`.
- [ ] `<name>.fsm.js` exists IFF tier is `hero`.
- [ ] `<name>.effects.js` exists IFF the source preview had particle hooks.
- [ ] `src/content/manifest.js` has a new entry.
- [ ] No source files outside `src/content/` and `manifest.js` were modified, **except** for an optional debug spawn key in `main.js`.
- [ ] Smoke test passed.

If any box is unchecked, do not commit. Ask the user.

---

## Quick reference: which files per tier

| Tier | `.json` | `.mesh.js` | `.fsm.js` | `.effects.js` |
|---|---|---|---|---|
| crowd | required | required (returns `parts[]`) | NEVER | optional |
| hero  | required | required (returns `THREE.Group`) | required | optional |
| prop  | required | required (returns `parts[]`) | NEVER | optional |

## What NOT to do

- Do not write a per-archetype animation system. Use `HeroAnimSystem` (hero) or shader uniforms (crowd/prop).
- Do not import other content modules from inside a content module. Each archetype is self-contained.
- Do not add a `Group` per crowd entity "for convenience." The point of crowd tier is instancing.
- Do not auto-detect the tier. The JSON declares it.
- Do not set up scenes, cameras, or renderers in `<name>.mesh.js`. Geometry only.
- Do not call `EventBus.on(...)` from inside a state's `onUpdate`. Use the `transitions[].on` field.
