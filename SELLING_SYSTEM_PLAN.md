# Selling System Implementation Plan

## Overview
Implement a meat selling system with NPCs (villagers), a coin storage tray, and a paved road in front of the selling table.

---

## Feature Requirements

### 1. Coin Storage Tray
- **Position**: 3 units left, 2 units back from selling table → (-3, 0, -11.2)
- **Visual**: A tray (flat platform)
- **Function**: Stores coins earned from selling meat
- **Coin Stack**: Vertical stack with jelly-like animation (same as player's stack)

### 2. Selling Table Mechanics
- When player approaches selling table area (detection range: ~3-4 units)
- Meat flies off player's stack one by one to the table
- Meat sits on the table until bought by villager

### 3. Road
- Paved/stone road in front of selling table
- Straight path from spawn point to table
- Path extends rightward for villager exit

### 4. NPCs (Villagers)
- **Visual**: Villager shape (humanoid or distinct from enemies)
- **Behavior**:
  - Fixed number initially standing in line (e.g., 3-5)
  - Spawn from x point, walk to line position
  - Approach table one at a time (queue)
  - Hold random amount of coins (e.g., 2-10 coins)
  - Buy meat: 1 coin = 2 meat
  - After buying, walk right and delete after distance (~20 units)
- **Spawn**: When one NPC leaves, new one spawns and joins line

### 5. Buying Sequence
1. Player approaches table → meat flies to table one by one
2. Villager at front of line approaches table
3. Meat transfers from table to villager's back
4. Coins transfer from villager's back to coin tray
5. Villager walks right and exits
6. New villager spawns and joins line

### 6. Visuals
- **Coins**: Gold disks (like meat disks but gold color #ffd700)
- **Coin Stack**: Vertical stacking with wobble/lag animation
- **Meat on Table**: Visible stack on table

---

## Technical Implementation

### New Files to Create

| File | Purpose |
|------|---------|
| `src/entities/CoinTray.js` | Coin storage tray entity with stack system |
| `src/entities/Villager.js` | NPC entity with movement, coin holding, meat holding |
| `src/entities/Road.js` | Paved road visual |
| `src/systems/SellingSystem.js` | Player-to-table meat transfer logic |
| `src/systems/VillagerSystem.js` | NPC spawning, movement, queue management, transactions |
| `src/systems/CoinSystem.js` | Coin management and stack updates |

### Configuration Updates (`src/config/gameConfig.js`)

```javascript
export const COIN_CONFIG = {
    color: 0xffd700,           // Gold
    size: 0.15,
    stackOffset: 0.15,
    followLag: 0.1,
    wobbleIntensity: 0.2,
    valuePerMeat: 0.5          // 1 coin = 2 meat (0.5 coin per meat)
};

export const TRAY_CONFIG = {
    position: { x: -3, y: 0, z: -11.2 },
    size: { x: 1.5, y: 0.1, z: 1.0 },
    color: 0x8b4513            // Wood color
};

export const VILLAGER_CONFIG = {
    spawnPoint: { x: -15, z: -9 },     // Spawn far left of table
    queueStart: { x: -4, z: -8 },       // Start of line
    tablePosition: { x: 0, z: -7.5 },   // In front of table
    speed: 2.5,
    initialCount: 4,
    minCoins: 2,
    maxCoins: 10,
    exitDistance: 20                   // Units before deletion
};

export const SELLING_CONFIG = {
    detectionRange: 4.0,
    transferSpeed: 0.3,         // Seconds between each meat transfer
    tableCapacity: 10           // Max meat on table
};

export const ROAD_CONFIG = {
    width: 3.0,
    length: 30,                 // From spawn to exit
    color: 0x999999,           // Gray stone
    texture: 'paved'
};
```

---

## Implementation Phases

### Phase 1: Coin Tray & Coin System
**File**: `src/entities/CoinTray.js`
- Create tray mesh (flat box)
- Implement coin stack system (similar to StackSystem)
- Coins stack vertically with wobble/lag animation
- Gold color coins

**File**: `src/systems/CoinSystem.js`
- Manage coin count
- Add coins to tray stack
- Update coin positions with animation
- Sync with main loop

**Config**: Add `COIN_CONFIG` and `TRAY_CONFIG`

---

### Phase 2: Road Visual
**File**: `src/entities/Road.js`
- Create paved road geometry
- Position: In front of selling table (z ~ -7.5 to -15)
- Texture: Stone/paved pattern using CanvasTexture
- Width: ~3 units

**Config**: Add `ROAD_CONFIG`

---

### Phase 3: Villager Entity
**File**: `src/entities/Villager.js`
- Villager visual (capsule + head = simple humanoid)
- Properties:
  - `coinsHeld`: Random number (2-10)
  - `meatHeld`: 0 initially
  - `state`: 'in_queue' | 'approaching_table' | 'buying' | 'exiting'
  - `queuePosition`: Index in line
- Methods:
  - `moveTo(target, dt)`: Move toward position
  - `receiveMeat(count)`: Receive meat, update stack
  - `giveCoins(count)`: Remove coins
  - `update(dt)`: Update position, animation

---

### Phase 4: Villager System
**File**: `src/systems/VillagerSystem.js`
- Spawn initial villagers in queue
- Manage queue (FIFO)
- Spawn new villager when one exits
- Move villager at front to table when:
  - Meat is available on table
  - Villager has coins
- Handle transaction:
  - Transfer meat from table to villager
  - Transfer coins from villager to tray
  - Update villager state to 'exiting'
- Delete exiting villagers after distance

**Config**: Add `VILLAGER_CONFIG`

---

### Phase 5: Selling System (Player to Table)
**File**: `src/systems/SellingSystem.js`
- Detect when player is near selling table (`SELLING_CONFIG.detectionRange`)
- When detected and player has meat:
  - Transfer meat one by one to table
  - Animate meat flying from player to table
  - Rate: `SELLING_CONFIG.transferSpeed`
- Max meat on table: `SELLING_CONFIG.tableCapacity`
- Keep track of table's meat stack

**Config**: Add `SELLING_CONFIG`

---

### Phase 6: Integration
**File**: `src/main.js`
- Import and initialize new systems
- Add to update loop:
  - `sellingSystem.update(dt, player, table)`
  - `villagerSystem.update(dt, table, coinTray)`

**File**: `src/entities/Environment.js`
- Add road to scene (or create separately in main.js)

---

## Data Flow Diagram

```
Player
  │ (approaches table)
  ▼
SellingSystem
  │ (meat flies one by one)
  ▼
Table (holds meat stack)
  │ (villager approaches)
  ▼
VillagerSystem
  │ (transaction)
  ├──────► Villager (receives meat)
  │          (exits right)
  ▼
  └──────► CoinTray (receives coins)
              (stacks coins vertically)
```

---

## Key Mechanics Details

### Villager Queue Positions
```
Spawn (-15, -9)  →  Queue 1 (-4, -8)  →  Queue 2 (-6, -8)  →  ...
                                                      ↓
                                                  Table (0, -7.5)
```

### Transfer Animations
- **Meat → Table**: Parabolic arc (same as magnetic harvest)
- **Table → Villager**: Fly to villager's position
- **Coins → Tray**: Fly to tray and stack

### Stack Animation
Use same physics as player's jelly stack:
- Each item lags behind the one below
- Wobble on direction changes
- Squash/stretch when added

---

## Testing Checklist

- [ ] Coin tray appears at correct position (-3, 0, -11.2)
- [ ] Coins stack vertically with animation
- [ ] Road appears in front of table with stone texture
- [ ] Villagers spawn and stand in line
- [ ] Villagers have random coin amounts
- [ ] Player meat transfers to table one by one
- [ ] Villager approaches table when meat available
- [ ] Meat transfers from table to villager
- [ ] Coins transfer from villager to tray
- [ ] Villager exits right and gets deleted
- [ ] New villager spawns to replace exiting one
- [ ] All animations are smooth (60 FPS)

---

## Notes & Considerations

1. **Performance**: Villagers are persistent objects, not pooled (limited count ~5-10 active)
2. **Visual Consistency**: Use same animation library as StackSystem
3. **Game Balance**: Adjust transfer speeds and villager spawn rates based on testing
4. **Coin Economy**: 1 coin = 2 meat means player gets good value, adjust if needed
5. **Table Meat Limit**: Prevent infinite meat accumulation with `tableCapacity`
6. **Villager Despawn**: Use safe distance check before deletion to avoid visual pop-in
