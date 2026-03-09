# Changelog — Systems (`src/systems/`)

> Append new entries at the bottom. See AGENT_GUIDE.md Section 5b for format.
> Compact entries older than 15 days when this file exceeds 150 lines.

---

## Compacted History (Phase 1-3 initial build)
- `MovementSystem.js`: Joystick→3D vector conversion, frame-rate independent movement.
- `CameraSystem.js`: Isometric rubber-band lerp follow with configurable delay.
- `EnemySystem.js`: Spawn outside safe zone, basic steering AI toward player/base.
- `CombatSystem.js`: Auto-fire with distance checks, pooled projectiles, multi-owner support (player + turrets).
- `HarvestSystem.js`: Magnetic pull within range, Bezier parabolic arc flight to player.
- `StackSystem.js`: Vertical jelly stack with lerp trail, sway on direction change, squash-stretch on add.
- `DrainSystem.js`: Reverse vacuum — locks movement, peels resources off stack into zone, scale-pulse feedback.
- `LevelSystem.js`: Zone→Structure replacement with bouncy scale-overshoot spawn animation.

---

<!-- NEW ENTRIES BELOW THIS LINE -->

### 2025-06-10 14:30 — claude_code — Session S001
**File**: `src/systems/SellingSystem.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `SellingSystem` | Handles player-to-table meat transfer                      |
| ADDED    | `update()`             | Checks player distance, transfers meat one by one to table    |
| ADDED    | `getMeatOnTable()`     | Returns current meat count on table                         |
| ADDED    | `removeMeatFromTable()` | Removes specified meat count for villager purchase            |

**Why**: Selling mechanism needs dedicated system to coordinate player proximity, meat transfer timing, and table state.

**File**: `src/systems/VillagerSystem.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `VillagerSystem`| Manages villager spawning, queue, transactions, exits        |
| ADDED    | `spawnInitialVillagers()` | Creates 4 initial villagers in queue positions            |
| ADDED    | `spawnNewVillagerAtBack()` | Spawns new villager at end of queue (replaces exited) |
| ADDED    | `handleTransaction()` | Transfers meat from table to villager, coins to tray         |
| ADDED    | `update()`             | Advances queue, triggers transactions, removes exiting vill.  |

**Why**: Complex villager behavior (queue, buying, exiting, respawning) requires dedicated system management.

**File**: `src/systems/CoinSystem.js` (NEW)
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | Class `CoinSystem`    | Manages coin economy and tray updates                      |
| ADDED    | `addCoin()`            | Adds single coin to tray                                   |
| ADDED    | `addCoins()`           | Adds multiple coins                                       |
| ADDED    | `getCoinCount()`       | Returns total coin count                                   |
| ADDED    | `update()`             | Delegates to coinTray.update() for stack animation          |

**Why**: Coin economy needs centralized management with tray integration for animation.

### 2026-03-09 00:00 — claude_code — Session S002
**File**: `src/systems/StackSystem.js` (REFACTORED)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| REMOVED  | Inline stacking loop in `update()`  | Replaced by ResourceStack.update()                                          |
| REMOVED  | `animatePop()`                      | Replaced by ResourceStack._pop() via add({animate:true})                   |
| ADDED    | `_resourceStack` (ResourceStack)    | Internal ResourceStack instance drives all position math                    |
| MODIFIED | `update()`                          | Computes basePos, calls `_resourceStack.update()`, syncs rotation           |
| MODIFIED | `addDisk()`                         | Uses `_resourceStack.add(disk, {animate:true})`                             |
| MODIFIED | `popDisk()`                         | Uses `_resourceStack.pop()`                                                 |

**Note**: `this.stack` is set to `this._resourceStack.items` (same array reference). SellingSystem reads `.stack.length` — no change needed there.

**Why**: StackSystem had the canonical stacking loop. Moved to ResourceStack so all consumers share one implementation.

**File**: `src/systems/VillagerSystem.js` (BUGFIXED)
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| MODIFIED | `update()` line 82                  | Condition `nextInQueue.canBuy()` → `meatOnTable > 0 && nextInQueue.coinsHeld > 0` |
| MODIFIED | `update()`                          | Now calls `this.advanceQueue()` immediately after `setApproachingTable()`   |

**Why**: `canBuy()` requires `state === 'approaching_table'` but villager is still `'in_queue'` at check time → always false → villager never approached table. Also, queue wasn't advancing when a villager was sent forward, causing the next villager to never reach position 0.
