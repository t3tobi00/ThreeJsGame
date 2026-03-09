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
