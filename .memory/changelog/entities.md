# Changelog — Entities (`src/entities/`)

> Append new entries at the bottom. See AGENT_GUIDE.md Section 5b for format.
> Compact entries older than 15 days when this file exceeds 150 lines.

---

## Compacted History (Phase 1-3 initial build)
- `Player.js`: Created player capsule with squash-stretch scaling. Exports mesh, velocity, stackCount.
- `Enemy.js`: Red cylinder entity with HP, active flag, speed. Pool-compatible.
- `Projectile.js`: Pooled projectile with velocity vector. Used by CombatSystem.
- `ResourceDisk.js`: "Meat" drop with Bezier arc flight state. Pool-compatible.
- `UnlockZone.js`: Square build zone with dashed border, CanvasTexture cost display.
- `Turret.js`: Sentry turret, modular mesh, hooks into CombatSystem via registerOwner().
- `Wall.js`: Physical barrier with HP, damage flash material effect.

---

<!-- NEW ENTRIES BELOW THIS LINE -->

### 2025-06-10 14:30 — claude_code — Session S001
**File**: `src/entities/CoinTray.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `CoinTray`      | Coin storage tray with vertical jelly-stack animation           |
| ADDED    | `createVisuals()`      | Creates tray mesh (box) at config position                   |
| ADDED    | `addCoin()`            | Creates gold coin, adds to stack with pop animation            |
| ADDED    | `removeCoin()`         | Removes and disposes top coin from stack                     |
| ADDED    | `update()`             | Animates coin stack with wobble/lag (similar to player)      |

**Why**: Coin storage needs visual representation with satisfying stack animation matching game's "jelly" aesthetic.

**File**: `src/entities/MeatTable.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `MeatTable`     | Manages meat on selling table with capacity limit             |
| ADDED    | `addMeatToTable()`     | Positions meat in grid slots on table                        |
| ADDED    | `removeMeatFromTable()`| Removes and disposes specified meat count                     |
| ADDED    | `transferMeat()`       | Creates animated meat flying via bezier curve to table         |
| ADDED    | `update()`             | Updates in-transit meat animations                          |

**Why**: Table needs to display meat visually and handle transfer animations with satisfying arc physics.

**File**: `src/entities/Villager.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `Villager`      | NPC entity with queue behavior and economy participation       |
| ADDED    | `createVisuals()`      | Creates humanoid (capsule + head + eyes) with coin display     |
| ADDED    | `moveTo()`             | Smooth movement toward target with rotation                   |
| ADDED    | `receiveMeat()`        | Adds meat to villager's stack, updates visual                |
| ADDED    | `giveCoins()`           | Removes coins, updates visual display                        |
| ADDED    | `setApproachingTable()` | Sets state to approach table for transaction                 |
| ADDED    | `setExiting()`         | Sets state to exit right, tracks distance for deletion        |

**Why**: Villagers need distinct appearance, state machine, and visual feedback for coins/meat held.

**File**: `src/entities/Road.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `Road`          | Paved road visual in front of selling table                 |
| ADDED    | `createVisuals()`      | Creates plane with procedural stone tile CanvasTexture        |
| ADDED    | (texture generation)   | Generates 256x256 stone pattern with variety and edge lines |

**Why**: Road provides visual context for villager movement and selling area.

### 2026-03-09 00:00 — claude_code — Session S002
**File**: `src/entities/MeatTable.js` (REFACTORED + BUGFIXED)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| REMOVED  | `addMeatToTable()`                  | Replaced by ResourceStack.add() via onArrive callback                       |
| REMOVED  | `calculateBezierPoint()`            | Replaced by ResourceTransfer                                                |
| REMOVED  | `inTransitMeat` array               | Replaced by ResourceTransfer instance `_transfer`                           |
| ADDED    | `_stackBase` (Vector3)              | Table top surface world position; base for ResourceStack                    |
| ADDED    | `_stack` (ResourceStack)            | Vertical stack of meat on table surface — fixes horizontal spread bug       |
| ADDED    | `_transfer` (ResourceTransfer)      | Handles bezier arc from player to table                                     |
| MODIFIED | `transferMeat()`                    | Fixed `const→let` bug; now uses ResourceTransfer + onArrive→ResourceStack   |
| MODIFIED | `removeMeatFromTable()`             | Now pops from ResourceStack instead of manual array                         |
| MODIFIED | `getMeatCount()`                    | Returns `_stack.getCount()`                                                 |
| MODIFIED | `update(deltaTime)`                 | Calls `_transfer.update()` + `_stack.update(_stackBase)` each frame         |

**Why**: Meat was spreading horizontally in a grid instead of stacking vertically. Fixed by replacing manual slot positioning with ResourceStack. Also fixed `const transferred = 0` which silently prevented any transfers from registering.

**File**: `src/entities/CoinTray.js` (REFACTORED)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| REMOVED  | Inline stacking loop in `update()`  | Replaced by ResourceStack.update()                                          |
| REMOVED  | `animatePop()`                      | Replaced by ResourceStack._pop() via add({animate:true})                   |
| ADDED    | `_stack` (ResourceStack)            | Manages coin stack positioning                                              |
| MODIFIED | `addCoin()`                         | Uses `_stack.add(coin, {animate:true})` instead of inline push              |
| MODIFIED | `removeCoin()`                      | Uses `_stack.pop()` instead of manual array pop                             |
| MODIFIED | `update(deltaTime)`                 | Calls `_stack.update(basePos)` + adds wobble rotation loop                  |

**Why**: CoinTray had duplicate stacking loop identical to StackSystem. Eliminated duplication.

**File**: `src/entities/Villager.js` (REFACTORED + BUGFIXED)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| REMOVED  | `updateMeatStack()`                 | Replaced by incremental `receiveMeat()` + per-frame `_meatStack.update()`  |
| REMOVED  | `meatStack` array                   | Replaced by `_meatStack` (ResourceStack)                                    |
| REMOVED  | `createVisuals()` (public)          | Renamed to `_createVisuals()` (private convention)                          |
| ADDED    | `_meatStack` (ResourceStack)        | Manages meat carried on back in group local space                           |
| MODIFIED | `receiveMeat(count)`                | Incremental: adds count meshes to `_meatStack` rather than full rebuild     |
| MODIFIED | `getQueuePosition()`                | Renamed `_getQueuePosition()`; fixed spread direction X→Z                  |
| MODIFIED | `setExiting()`                      | Exit target changed from `(999,0,z)` to `(0,0,-30)` (along road)           |
| MODIFIED | `update()`                          | Calls `_meatStack.update(localBase)` each frame for carried meat            |
| MODIFIED | `dispose()`                         | Uses `_meatStack.clear(this.group)` for clean group-local disposal          |

**Why**: Queue spread along X-axis (horizontal) instead of Z-axis (along road). Villagers exited to the right instead of down the road. Meat rebuild-on-every-receive caused geometry thrash.
