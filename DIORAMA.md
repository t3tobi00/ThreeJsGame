# Cardboard Diorama — Parallel World Mode

A non-destructive parallel scene mode for Base Defense Tycoon. Built alongside the existing legacy scene so the world layout, defensive narrative, and zone identities can be iterated in isolation. Toggle on with a URL query param. The legacy scene remains the default and is fully untouched in code.

## How to access

- **Legacy (default):** `http://localhost:8080/`
- **Diorama:** `http://localhost:8080/?diorama`

To make diorama the default for everyone (final promotion):
```js
// src/config/gameConfig.js
export const SCENE_CONFIG = { mode: 'diorama' };
```

## Why it exists

The 4-corner game pillar (NW Jungle / NE Business / SE Factory / SW Combat + Hive) is locked in `design/00-pillars.md`, but the legacy scene is just a green safe zone on a sandy plane — there's no spatial language that tells the player which zone is which or where the threat comes from. The diorama is the visual world layer for those pillars, built without disrupting any in-progress legacy gameplay work.

## Locked design decisions (2026-04-09)

1. **No biome cubes.** No framed quadrant pads with threshold borders. Nature sprawls organically; the world is a continuous space, not a child's playmat.
2. **Defensive walls tell the story.** The town defends against zombies. The wall is a heavy razor-wire chain-link line, not cute log fencing.
3. **Key locations are CLOSE.** Restaurant is one step out the north gate. Factory is one step out the east gate. The Hive is the only deliberately distant landmark — it's the doom-timer you walk *toward*, not visit casually.
4. **One front, one wall.** A single long razor-wire wall runs full map width E↔W along z=14, with a 4-unit central gap occupied by a heavy reinforced fortress gate. Player walks through the gap to fight; zombies (eventually) push north against it.
5. **The Hive is always visible.** It pulses red in the SW from the moment you spawn. The whole map composition points at it.

## Current state of the diorama

```
                       NW                                                
              ⛰️ mountains receding                                       
       🌴 jungle sprawl (no border)                                       
         🌴  🌴       🌴                                                  
              🌴 🪨        ┌──────────┐                                  
                           │RESTAURANT│  ← neon arch + patio + queue rope
                           │  (NE)    │                                  
                           └────┬─────┘                                  
              🌴 🪨            │                                          
                          ┌────┴─────┐    ┌───────────┐                   
                          │ BASECAMP │────│  FACTORY  │  ← smokestack    
       🌴 🌴               │ (no fence)│   │   (E)    │    + crates +    
                          └────┬─────┘    └───────────┘    locked plinths
                               │                                          
   ━━━━━━━━━━━━━━━━━━━━━━━━━┃▓▓┃━━━━━━━━━━━━━━━━━━━━━━━━  ← BIG WALL    
              ↑              FORTRESS GATE              ↑    razor wire   
              full map width — z=14                                       
                                                                          
               🩠 watchtower                                              
            broken cars / sandbags                                        
                  🩸 HIVE (pulsing, SW)                                   
                       SW                                                
```

### Built so far

- **Scene mode toggle** (URL param + optional config flag) — `src/core/SceneMode.js`
- **Tinted dusk sky + fog** — `src/core/SceneDiorama.js`
- **Sun + 4 corner-tinted point lights** (cool green NW / neon pink NE / sodium yellow SE / hive red SW) — `src/core/LightingDiorama.js`
- **30+ procedural mesh presets** (`dio-*` namespace) — `src/core/MeshPresetsDiorama.js`
  - Landmarks: `dio-hive` (pulsing emissive blob with onBeforeRender animation), `dio-neon-arch`, `dio-smokestack` (with drifting smoke puffs), `dio-watchtower`, `dio-fortress-gate`
  - Wall: `dio-fence-panel` (chain link + barbed wire + razor coil)
  - Backdrop: `dio-mountain` (low-poly cone + snow cap)
  - Jungle: `dio-palm-tree`, `dio-fern`, `dio-mossy-boulder`
  - Restaurant dressing: `dio-patio-table`, `dio-queue-rope`, `dio-awning-stripe`
  - Factory dressing: `dio-pipe-arch`, `dio-crate-stack`, `dio-conveyor-stub`, `dio-locked-plinth`
  - Combat dressing: `dio-sandbag-stack`, `dio-broken-car`
- **Loader extension** — `src/core/SceneLoaderDiorama.js` (wraps `SceneLoader.load()`, adds `dioramaWorld` and `bigFence` blocks on top)
- **Diorama level data** — `src/config/levels/level-1-diorama.json`
- **Big wall + central gate** — z=14, full map width, 4-unit central gap, fortress gate centerpiece
- **Removed for the diorama**: basecamp perimeter fence (no colliders, no invisible walls), all 4 wooden gates (no entities), the "4 gates alive = safe zone" logic. Done by stripping the `fence` / `gates` / `safeZone` blocks from the level JSON. The underlying ECS systems are intact.

## Future plan (next sessions)

These three are queued for the next diorama session:

### 1. Spawn enemies from the Hive
Currently enemies spawn from random angles around the player at radius 35 (`spawners.enemies.spawnDistance` in the level JSON, consumed by `EnemySystem`). For the diorama, change the spawn point to be **the Hive position** (`-24, 0, 28`), so the horde literally streams up out of the SW corner toward the wall and the central gate. Likely needs a new `spawners.enemies.spawnFromTag` or `spawnFromPoint` field and a small change in `EnemySystem.js` (or a diorama-specific override).

### 2. Make the SW combat zone look like hell
Currently the SW area is just earthy ground (`dangerZone` color `0x4d6633`). Make it look dangerous: dirty cracked dirt, blood splatters, bones, dragged-corpse drag marks, scorched patches, broken concrete, ash haze. Possible approaches:
- A south-only ground overlay mesh that paints over the area south of the wall
- Per-pixel canvas texture variant (grass north of wall, hellscape south)
- A new `dio-hellground` ground tile that gets placed as scenery in the SW
Plus more themed scatter: bones, blood pools, smashed cars, corpse piles.

### 3. Polish basecamp / restaurant / factory visuals
- **Basecamp**: needs an actual feel of a town square — paving, props, a flag pole, a fountain, a bulletin board (preset already exists), the player tent (preset already exists), villager activity hooks. Currently it's just bright green grass.
- **Factory**: more depth — the smokestack is good, but the area needs an actual factory shed/hangar silhouette around the locked plinths. Conveyor belts that connect machine pads. A loading dock.
- **Restaurant**: this is the **big one**. The user wants a precise dedicated redesign pass — kitchen, customer entry flow, ordering counter, seating, serving — modeled like a real Burger King interior. Treat as its own multi-step task, not scenery. See `feedback_world_design.md` in user memory for the exact requirement.

### Eventually
When all three above are done and the user is happy:
- Promote diorama to default (`SCENE_CONFIG.mode = 'diorama'`)
- Optionally migrate `level-1.json` to match (or replace it with the diorama version)
- Delete the legacy `Scene.js` / `Lighting.js` / `level-1.json` (separate cleanup commit so it's reversible)

## File map for future sessions

| Goal | Look at / edit |
|---|---|
| Add a new prop | Register a `dio-*` preset in `src/core/MeshPresetsDiorama.js`, then place it in `src/config/levels/level-1-diorama.json` `dioramaWorld.scatter` (or `landmarks` for hero props) |
| Move the wall | Edit `dioramaWorld.bigFence` in `src/config/levels/level-1-diorama.json` (`z`, `xStart`, `xEnd`, `gap.center`, `gap.width`) |
| Move a landmark | Edit `dioramaWorld.landmarks[]` in the level JSON |
| Change zone tint | `LightingDiorama.js` — `cornerLights[]` array (color, intensity, position) |
| Change sky/fog | `SceneDiorama.js` — `background` and `fog` constructor params |
| Change spawn behavior | `src/systems/EnemySystem.js` (legacy) — add diorama-specific behavior gated on `isDioramaMode()` from `src/core/SceneMode.js` |
| Change ground color | `ground.dangerZone.color` in the level JSON |
| Add a new dioramaWorld field type | Extend `_buildDiorama` in `src/core/SceneLoaderDiorama.js` |
| Toggle diorama default | `SCENE_CONFIG.mode` in `src/config/gameConfig.js` |

## Architecture rules to keep

- **Never edit `Scene.js`, `Lighting.js`, `MeshPresets.js`, `SceneLoader.js`, or `level-1.json` for diorama work.** Diorama is parallel by construction. Add new `dio-*` files instead.
- `SceneLoaderDiorama` wraps `SceneLoader.load()` and only adds — never replaces — its return value. The diorama is purely additive on top of the legacy ground/fence/road/road builders.
- All diorama mesh presets are namespaced with `dio-` prefix. They register into the same global `MeshPresets` registry but can never collide with legacy preset names.
- Anything *visual* that needs animation should use `mesh.onBeforeRender = () => {...}` instead of registering a new ECS system. See `dio-hive` and `dio-smokestack` for examples. This keeps `main.js` untouched for new presets.

## Rollback

- Remove `?diorama` from the URL → instant legacy
- OR set `SCENE_CONFIG.mode = 'legacy'` in gameConfig → permanent legacy

The diorama files can sit indefinitely without affecting legacy gameplay. To delete the diorama entirely (if you ever want to), remove every file matching `**/SceneDiorama*`, `**/LightingDiorama*`, `**/MeshPresetsDiorama*`, `**/SceneLoaderDiorama*`, `**/SceneMode*`, `**/level-1-diorama.json`, `DIORAMA.md`, plus revert the `main.js` boot branches and the `SCENE_CONFIG` constant in `gameConfig.js`.

## Known visual oddities to flag for next session

- The ground south of the big wall is the same earthy color as everywhere else. **It should look hellish.** Queued as todo #2 above.
- Combat zone scatter (sandbags / broken cars / watchtower) is sparse. Once spawn is moved to the Hive (todo #1), the volume of zombies will help fill the space, but adding bones/corpses/blood pools (todo #2) is still important.
- Basecamp interior is just green grass with some existing trees and coin trays. Town-square dressing pass needed (todo #3).
- The fortress gate has no collider. The wall has no colliders. Anything south of the wall is currently free-traversable. This is intentional for now — gameplay revisited later.
