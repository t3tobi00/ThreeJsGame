# Changelog — Utils (`src/utils/`)

> Append new entries at the bottom. See AGENT_GUIDE.md Section 5b for format.
> Compact entries older than 15 days when this file exceeds 150 lines.

---

## Compacted History (Phase 1-3 initial build)
- `ObjectPool.js`: Generic object pool. Constructor takes factory function. Methods: acquire(), release(obj), preWarm(count). Used by projectiles, enemies, resource disks.

---

<!-- NEW ENTRIES BELOW THIS LINE -->

### 2026-03-09 00:00 — claude_code — Session S002
**File**: `src/utils/ResourceStack.js` (NEW)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| ADDED    | Class `ResourceStack`               | Reusable vertical stacking with spring/wobble physics                       |
| ADDED    | `add(mesh, {animate})`              | Push item to stack; optional pop-in scale animation                         |
| ADDED    | `pop()`                             | Remove and return top item                                                  |
| ADDED    | `peek()`                            | Return top item without removing                                            |
| ADDED    | `getCount()`                        | Number of items in stack                                                    |
| ADDED    | `update(basePosition)`              | Drive spring-physics positions each frame; works in world or local space    |
| ADDED    | `clear(parent)`                     | Remove all from parent (scene or Group) and dispose GPU resources           |
| ADDED    | `static _pop(mesh)`                 | Private: 1.5× scale-down pop animation via rAF                             |

**Why**: StackSystem, CoinTray, MeatTable, and Villager all had identical stacking loops. Extracted to single source of truth. Works in world space (scene children) and local space (group children) — caller decides which parent to use.

**File**: `src/utils/ResourceTransfer.js` (NEW)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| ADDED    | Class `ResourceTransfer`            | Reusable Bezier-arc flight animation between two world positions            |
| ADDED    | `send(mesh, from, to, options)`     | Launch mesh on arc; options: arcHeight, duration, spin, onArrive callback   |
| ADDED    | `update(deltaTime)`                 | Advance all in-flight animations; auto-removes on arrival                   |
| ADDED    | `getInFlightCount()`                | Number of meshes currently in flight                                        |
| ADDED    | `dispose()`                         | Cancel all flights (does not remove meshes from scene)                      |

**Why**: MeatTable had its own `inTransitMeat` array + `calculateBezierPoint`. HarvestSystem has similar arc logic. Extracted to single reusable pattern. Caller owns the mesh lifecycle; ResourceTransfer only animates.
