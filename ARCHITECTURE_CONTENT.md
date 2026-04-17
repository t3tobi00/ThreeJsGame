# Content Architecture — Base Defense Tycoon

Status: LOCKED 2026-04-06. This is the architecture every future content addition must conform to. Future sessions execute against this spec; they do not redesign it.

## Why this exists

The shipped target is roughly 30 enemy types, 50 NPC types, 50 auto-weapon types, 50 auto-factory types, with hundreds of entities on screen at peak. The current `EntityFactory` has a silent pool/Group fallback (`src/entities/EntityFactory.js` ~line 93), `ArchetypeLoader` has a hardcoded archetype list (`src/core/ArchetypeLoader.js` line 9), `Component_WalkAnim` is dead data with no system reading it, and archetype JSON is flat in `src/config/archetypes/`. None of that scales to the target. This document locks the migration target.

**Authoring model.** New assets (enemies, NPCs, factories, weapons, props, anything) are designed in **standalone Three.js HTML preview files** with zero project context. Each preview is a self-contained scene where you iterate freely on geometry, animation, and effects. When an asset is ready, Claude Code reformats it into project structure by following `CONTENT_FORMAT.md`. The architecture is **agnostic to which preview file the asset came from** — `zombie-preview.html` and `resources-preview.html` exist in the repo today as the first two design boards, but every future asset will live in its own preview file (named whatever you want), and the same conversion recipe applies. The migration's job is to move preview-quality visuals into the ECS without losing them, regardless of source file.

## The three render tiers

Every entity in the game lives in exactly one of three tiers. The tier is **declared** in the archetype JSON via `renderTier`. There is no auto-detection and no runtime tier promotion.

### `crowd`
Animated entities that appear in groups. Enemies AND friendly NPCs that walk around — villagers, customers, workers, all crowd-tier. Rendered via per-variant `InstancedCharacterPool` (today's pattern in `src/rendering/InstancedCharacterPool.js`, scaled out — one pool per archetype). Animation is driven by a shader uniform tick (single `uTime` per pool), not per-entity FSM. This is what makes it cheap.

Soft cap: ~15 distinct active crowd archetypes simultaneously, each pool sized 100-200 instances. The cap is **enforced by wave design**, not by code. If a wave needs more than 15 variants, that is a wave design problem, not an architecture problem. There is no runtime check, no warning, no log line.

A distant LOD billboard fallback is planned but **not v1**. It gets added the first time a real wave breaks the cap.

### `hero`
Unique characters: bosses, story NPCs (trader, elder, quest-givers), the player. Rendered as a real `THREE.Group` per entity. Full per-entity animation FSM via `Component_Anim`, interpreted by a single shared `HeroAnimSystem`. Cull-radius gating (sparse animation when off-screen) is planned but **not v1**.

Cap: ~12 simultaneous hero entities. Bosses are separate hero archetypes from their crowd-tier base creature — the wave director picks which archetype to spawn.

### `prop`
Anything that doesn't have AI and doesn't walk: auto-factories, auto-weapons, walls, gates, trees, rocks, decor. Rendered as static `InstancedMesh` per type, allocate-on-place / free-on-destroy. Animation is shader loops only — smoke puffs, conveyor scroll, glow pulse, gentle bob — never per-entity FSM. Effectively uncapped: 50 prop types × hundreds of instances ≈ 50 steady-state draw calls.

## ECS shape

### New components

- `Component_RenderTier { tier: "crowd"|"hero"|"prop", handle: any }` — the branch point. Replaces the silent pool/Group fallback in `EntityFactory.js`.
- `Component_CrowdInstance { poolId: string, idx: int }` — handle into a per-variant `InstancedCharacterPool`. Crowd tier only.
- `Component_HeroMesh { group: THREE.Group, partRefs: object }` — formalizes the existing Group path. Hero tier only. `partRefs` exposes named sub-meshes the FSM animates.
- `Component_PropInstance { poolId: string, idx: int }` — handle into a static prop pool. Prop tier only.
- `Component_Anim { fsmModuleId: string, state: string, stateTime: number, params: object }` — data-oriented FSM state for hero tier. The FSM logic ships as a data module (see `<name>.fsm.js` below). `params` carries combo counters etc., so transitions can branch on `params.comboCount % 4 === 0`.
- `Component_Sound { slot: null }` — RESERVED placeholder. No system, no behavior. It exists so future sound work can drop in without touching every archetype. Documented, not implemented.

### Components removed

- `Component_WalkAnim` — DELETE. Currently dead data: no `WalkAnimSystem` exists. Crowd walk cycles are driven by the shader uniform, not by per-entity components.

### New systems

- `CrowdAnimSystem` — bumps `uTime` on each crowd pool's shader. O(num_pools), not O(num_entities). This is the entire system. The shader does the animation work.
- `HeroAnimSystem` — interprets `Component_Anim`. Per-variant FSMs are data modules exporting `{ initial, states, transitions }`. The system ticks `stateTime`, runs `state.onUpdate(entity, dt, params)`, evaluates transitions (both timed and event-driven via EventBus), and dispatches `onEnter`/`onExit`. EventBus integration covers `entity:hit`, `entity:died`, `combo:finisher`, etc.

### Existing systems that change

- `EntityFactory.create()` (~line 93): the silent fallback becomes an explicit branch on `archetype.renderTier`. Three branches — crowd allocates from a per-variant `InstancedCharacterPool`; hero builds a `THREE.Group` by calling the archetype's `<name>.mesh.js` `build()`; prop allocates from a static prop pool.
- `ArchetypeLoader` (line 9): the hardcoded archetype list is replaced by reading from `src/content/manifest.js`.

## Folder layout

```
src/content/
  manifest.js                  # explicit registry: archetypeId → { json, mesh, fsm, effects }
  creatures/
    shambler/
      shambler.json
      shambler.mesh.js
      shambler.fsm.js          # OPTIONAL — hero-tier only
      shambler.effects.js      # OPTIONAL
    crawler/
      ...
  actors/
    villager/                  # crowd-tier walking NPC
      villager.json
      villager.mesh.js
    trader/                    # hero-tier unique NPC
      trader.json
      trader.mesh.js
      trader.fsm.js
  props/
    factory_basic/
      factory_basic.json
      factory_basic.mesh.js
    auto_turret/ ...
    tree/ ...
```

`src/config/archetypes/` is retained only for legacy archetypes during migration. Once Step 9 is done it goes away.

## Module contract

Concrete templates live in `CONTENT_FORMAT.md`. Summary:

- `<name>.json` — archetype, JSON-first config. Always declares `renderTier`. Supports `extends` for inheritance.
- `<name>.mesh.js` — exports `build(opts)` returning a `THREE.Group` (hero) OR `{ geometries, materials, shaderParams }` (crowd/prop). Optional named exports: `shaderParams`, `anchors` (named local-space points like `healthBar`, `muzzle`).
- `<name>.fsm.js` — hero tier only. Data-oriented FSM with `initial`, `states`, `transitions`. Transitions can be timed, event-triggered (`on: 'entity:hit'`), or predicate-gated (`when: (e, params) => ...`). Combo counters and finisher branching are first-class via `params`.
- `<name>.effects.js` — optional. Declares particle/sound hook names that `EffectSystem` maps to existing `ParticleSystem` calls. Keeps effects out of mesh and FSM modules.

## Migration path

Ordered. Each step is independently shippable. Do not skip ahead.

- **Step 0** — Write `ARCHITECTURE_CONTENT.md` and `CONTENT_FORMAT.md`. (This step.)
- **Step 1** — Create `src/content/` + empty `manifest.js` + the three category folders. No code changes.
- **Step 2** — Add the new components (`RenderTier`, `CrowdInstance`, `HeroMesh`, `PropInstance`, `Anim`, `Sound` placeholder). Register in the component map. Don't wire to anything yet.
- **Step 3** — Write `HeroAnimSystem` and `CrowdAnimSystem`. Don't wire yet. Design the crowd shader walk cycle here — this is the first concrete shader-code step.
- **Step 4** — **Pilot Shambler.** The Shambler currently lives in `zombie-preview.html` (the first preview file in the repo); extract it into `src/content/creatures/shambler/`, register in manifest, archetype JSON with `renderTier: "crowd"`. Spawn it **alongside** (not replacing) existing enemies via a debug key. Verify it visually matches the preview, that 50 instances cost ~4 draw calls, and frame time is stable. (This is one specific pilot — the same recipe will later apply to assets you build in any other preview file.)
- **Step 5** — Migrate `EntityFactory.create()` to branch on `renderTier`. Old archetypes still work because they lack the field — treat missing `renderTier` as the legacy path.
- **Step 6** — Migrate the existing enemy archetype to the new system. Delete `Component_WalkAnim` and the dead path.
- **Step 7** — Pilot a hero-tier boss. This is the combo FSM proof-of-concept. The Phase 4 melee combat work already exercises combo finishers in the player; the boss reuses the same pattern.
- **Step 8** — Pilot a prop-tier factory. Static instancing proof-of-concept with a shader-driven smoke puff loop.
- **Step 9** — Port existing entities (villager, turret, wall, gate, tree, rock) to their correct tiers. `src/config/archetypes/` is emptied.
- **Step 10** — Add LOD billboard fallback and hero sparse-animation cull radius **only when actual perf issues appear**. Not before.

## Pilot specification (Shambler end-to-end)

This is a one-shot pilot to validate the architecture against a real asset. Shambler is the chosen pilot **only because** its source already exists in `zombie-preview.html`. Any future asset (regardless of which preview file it came from) follows the exact same steps via `CONTENT_FORMAT.md` — there is nothing Shambler-specific or `zombie-preview.html`-specific about the architecture itself.

Source for the pilot: `zombie-preview.html`, the Shambler variant closure.

1. Create `src/content/creatures/shambler/shambler.mesh.js`. Copy the geometry-building code from the preview's Shambler closure. Wrap as `export function build(opts)`. Drop scene-setup code; keep only geometry creation.
2. Create `src/content/creatures/shambler/shambler.json`: `id: "shambler"`, `renderTier: "crowd"`, stats placeholder.
3. Add to `src/content/manifest.js` an entry: `shambler: { mesh: () => import('./creatures/shambler/shambler.mesh.js'), json: () => import('./creatures/shambler/shambler.json') }`.
4. In `EntityFactory.create()`, add a temporary `if archetype.id === "shambler"` branch that allocates from a per-variant `InstancedCharacterPool` configured with the Shambler geometry.
5. Add a debug key in `main.js` that spawns 50 shamblers at random positions.
6. Verify: visual match with `zombie-preview.html`, 50 instances ≈ 4 draw calls, stable frame time.
7. Only after step 6 passes does the migration proceed past the pilot.

## Risks and open questions

- **Crowd shader walk cycle is undesigned.** Concrete shader code lives in Step 3. Until then, the crowd-tier animation story is on paper only. This is the biggest unknown.
- **`InstancedCharacterPool` is hardcoded** to capsule + sphere geometry today. The pool class needs to be parameterized to accept arbitrary geometries from a `<name>.mesh.js`. This is the largest engineering lift in the migration and lands in Step 4.
- **LOD billboard fallback is deferred.** If late-game waves push past the soft 15-variant cap, this becomes urgent. Document when it bites.
- **Sound is reserved.** `Component_Sound` slot and the `sound` JSON fields are placeholders so a future sound system drops in cleanly. Until that system exists, the field is ignored.
- **Manual `manifest.js` registration.** If maintaining it becomes painful, swap to a build-time codegen that scans `src/content/`. Not v1.
- **The 15-variant soft cap has no enforcement.** Intentional. Discipline lives in wave design docs, not in code.

## Out of scope for this document

UI editor for archetypes, networked play, save/load of placed props, runtime hot-reload of mesh modules. Those come later, after the migration ships and the format proves itself.
