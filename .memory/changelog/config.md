# Changelog — Config (`src/config/`)

> Append new entries at the bottom. See AGENT_GUIDE.md Section 5b for format.
> Compact entries older than 15 days when this file exceeds 150 lines.

---

## Compacted History (Phase 1-3 initial build)
- `gameConfig.js`: Established all tunable values — PLAYER (speed, size), ENEMY (speed, hp, spawnRate), COMBAT (aggroRange, projectileSpeed, damage), HARVEST (pullRange, arcHeight), STACK (maxCount, sway), DRAIN (rate, interval), TURRET (range, fireRate, damage), WALL (hp, size), ZONES (costs, positions).

---

<!-- NEW ENTRIES BELOW THIS LINE -->

### 2025-06-10 14:30 — claude_code — Session S001
**File**: `src/config/gameConfig.js`
| Action   | Target                | Detail                                                    |
|----------|-----------------------|-----------------------------------------------------------|
| ADDED    | `COIN_CONFIG`         | Gold coin color, size, stack offset, value per meat          |
| ADDED    | `TRAY_CONFIG`          | Coin tray position, size, color                             |
| ADDED    | `VILLAGER_CONFIG`      | Spawn point, queue positions, speed, coin range, exit dist    |
| ADDED    | `SELLING_CONFIG`       | Detection range, transfer speed, table capacity                |
| ADDED    | `ROAD_CONFIG`          | Road width, length, color, position                         |

**Why**: Selling system requires all new tunable parameters for coins, villagers, road, and selling mechanics.

### 2026-03-09 00:00 — claude_code — Session S002
**File**: `src/config/gameConfig.js`
| Action   | Target                              | Detail                                                                      |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| ADDED    | `SELLING_TABLE_POSITION`            | `{x:0, y:0.3, z:-9.2}` — single source of truth; used by Environment, main.js, MeatTable |
| MODIFIED | `ROAD_CONFIG.length`                | 30 → 15 (was extending through entire base)                                 |
| MODIFIED | `ROAD_CONFIG.position.z`            | -8.5 → -16.7 (center of road: table z(-9.2) minus half-length(-7.5))       |
| MODIFIED | `VILLAGER_CONFIG.spawnPoint`        | `{x:-15,z:-9}` → `{x:0,z:-24}` (far end of road)                          |
| MODIFIED | `VILLAGER_CONFIG.queueStart`        | `{x:-4,z:-8}` → `{x:0,z:-12}` (aligned on road, close to table)           |
| MODIFIED | `VILLAGER_CONFIG.tablePosition`     | `{x:0,z:-7.5}` → `{x:0,z:-10.5}` (buying spot just outside table)         |

**Why**: Three different files used three different Z values for the table position. Road was too long (30 units), cutting through the entire base interior. Villager spawn, queue, and exit were all misaligned with the road axis.
