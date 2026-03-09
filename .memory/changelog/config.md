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
