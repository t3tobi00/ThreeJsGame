# Phase 2 — Entities (Living Beings + Vehicles)

> Detail file for Phase 2 of the V1 build plan. See `IMPLEMENTATION_PLAN.md` for the cross-phase index and `GAME_DESIGN.md` for the master V1 design.
>
> **Cross-references** — bare `§N.x` = within this file; `[PHASE_M_*.md §M.y]` = sibling phase doc; `[GAME_DESIGN.md §N.M]` = master design.
>
> **Status (2026-04-28): ✓ PHASE 2 FULLY LOCKED.**
> - §2.1 base anatomy — ✓ LOCKED.
> - §2.2 Worker Entity Cards — ✓ 5/5 LOCKED.
> - §2.3 Soldier Entity Cards — ✓ 5/5 LOCKED.
> - §2.4 King Entity Card — ✓ LOCKED.
> - §2.5 Zombie Entity Card — ✓ LOCKED.
> - §2.6 Vehicle Entity Cards — ✓ 4/4 LOCKED.
> - §2.7 Animation states — ✓ LOCKED.
> - §2.8 Apple Feeding System — ✓ LOCKED.
>
> Phase 2 acceptance criteria (§2.10) ready for implementation. Up next: open Phase 3 (Buildings) → create `PHASE_3_BUILDINGS.md`.
>
> Scope: visual entities only — geometry + colors + animations. **No movement, no AI yet.** Drag-to-waypoint comes in Phase 4. This phase produces visible, animated, stationary placeholders we can wire up later.

---

## 2.1 Stick-man Base Anatomy (LOCKED — shared by all living beings)

```
         O          <- head: sphere, 0.5 dia, center y=2.5
        /|\         
       / | \        <- body: cylinder, 0.5 dia, 1.5 tall, center y=1.5
      /  |  \       
     /   |   \      <- arms: 2 thin cylinders (0.15 × 0.8), y=1.5
    /         \     
                    <- legs: 2 thin cylinders (0.15 × 0.8), y=0.4
   |    |
```

- Total height: **2.7 units** (1 unit = 1 tile).
- Default head/skin color: **#F5DEB3** (wheat/beige).
- All living beings share this template; differentiation is body color + hat/accessory + weapon prop.

## 2.2 Worker Entity Cards

Each worker is fully specified below: visual + stats + behavior + rules + JSON archetype.

---

### 2.2.1 Wood Worker

**Visual:** stick-man base, `#8B4513` brown shirt, brown cap, axe (small box on cylinder shaft) held in right hand.

**Stats:**

| HP | DMG | Atk/sec | RNG | SPD | Cost (E/A) | Build |
|---|---|---|---|---|---|---|
| 30 | 2 | 1.0 | 1 (last-resort melee) | 1.0 | 5 / 1 | 5s |

**Behavior loop:**
1. Walk to nearest live tree within sight.
2. Chop the tree (1 attack swing per second). Yields 5 wood per trip.
3. Walk to nearest Wood Silo OR Storage Cart (whichever closer).
4. Drop 5 wood there.
5. Return to nearest live tree.
6. Loop forever until trees deplete or zombie threat.

**Rules:**
- Fixed-role for life — cannot be reassigned to another worker type.
- Cannot cross water (no swim).
- Carries 5 wood per trip on back (jelly-stack visual).
- A tree dies after 4 trips total (20 wood).

**Hunger:** 1 apple per 200s; auto-eats from nearest source. 1 HP/sec starvation if no apple. **Full mechanics: see §2.8 Apple Feeding System.**

**Combat:** flees toward nearest wall/building when zombie within 6 tiles. Fights only if cornered (DMG 2 — very weak).

**Animation triggers:** `idle` (no task), `walk` (moving), `attack` (cornered only), `eat` (auto-eating), `die` (HP=0).

**JSON archetype:**
```json
{
  "type": "wood_worker",
  "stats": { "hp": 30, "dmg": 2, "atkSpeed": 1.0, "range": 1, "moveSpeed": 1.0 },
  "carry": { "capacity": 5, "type": "wood" },
  "spawnCost": { "essence": 5, "apple": 1 },
  "buildTime": 5,
  "fleeRadius": 6,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "fixedRole": true,
  "visual": {
    "bodyColor": "#8B4513",
    "hatType": "cap", "hatColor": "#8B4513",
    "toolType": "axe"
  }
}
```

---

### 2.2.2 Stone Worker

**Visual:** stick-man base, `#696969` dark gray shirt, gray hat, pickaxe held in right hand.

**Stats:**

| HP | DMG | Atk/sec | RNG | SPD | Cost (E/A) | Build |
|---|---|---|---|---|---|---|
| 30 | 2 | 1.0 | 1 | 1.0 | 5 / 1 | 5s |

**Behavior loop:**
1. Walk to nearest live stone node within sight.
2. Mine the node (1 swing per second). Yields 5 stone per trip.
3. Walk to nearest Stone Silo OR Storage Cart.
4. Drop 5 stone.
5. Return to nearest live stone node.
6. Loop. A stone node fully depletes after 10 trips (50 stone) — **no respawn**.

**Rules:** fixed-role; cannot swim; carries 5 stone per trip.

**Hunger / Combat / Animation:** identical to Wood Worker (200s hunger, flee radius 6, last-resort melee, all 5 animations).

**JSON archetype:**
```json
{
  "type": "stone_worker",
  "stats": { "hp": 30, "dmg": 2, "atkSpeed": 1.0, "range": 1, "moveSpeed": 1.0 },
  "carry": { "capacity": 5, "type": "stone" },
  "spawnCost": { "essence": 5, "apple": 1 },
  "buildTime": 5,
  "fleeRadius": 6,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "fixedRole": true,
  "visual": {
    "bodyColor": "#696969",
    "hatType": "hat", "hatColor": "#696969",
    "toolType": "pickaxe"
  }
}
```

---

### 2.2.3 Farmer

**Visual:** stick-man base, `#228B22` green shirt, cone-shaped straw hat (`#DAA520`), basket on hip (small box).

**Stats:**

| HP | DMG | Atk/sec | RNG | SPD | Cost (E/A) | Build |
|---|---|---|---|---|---|---|
| 30 | 2 | 1.0 | 1 | 1.0 | 5 / 1 | 5s |

**Behavior loop:**
1. Player places an Apple Farm Plot **ghost** on plain land (resources deducted at placement). See `[PHASE_3_BUILDINGS.md §3.3.6]`.
2. Farmer auto-detects the nearest ghost → walks to it.
3. **Tills for 15s on arrival** — this is the construction step. The Apple Farm Plot is built by the Farmer, NOT a Builder. Plot becomes active.
4. Plants seed at the Plot.
5. Waits for cycle (30s total: plant → grow → ripe).
6. Harvests 5 apples.
7. Walks to nearest Apple Silo OR Storage Cart.
8. Drops 5 apples.
9. Returns to the same Plot, replants.
10. Loops forever — Plot is infinite cycles.

After all assigned plots are built and growing, the Farmer rotates between adjacent plots harvesting in cycle.

**Rules:** fixed-role; cannot swim; carries 5 apples per trip; plot is permanent infrastructure (does not deplete).

**Hunger / Combat / Animation:** identical to other workers.

**JSON archetype:**
```json
{
  "type": "farmer",
  "stats": { "hp": 30, "dmg": 2, "atkSpeed": 1.0, "range": 1, "moveSpeed": 1.0 },
  "carry": { "capacity": 5, "type": "apple" },
  "spawnCost": { "essence": 5, "apple": 1 },
  "buildTime": 5,
  "fleeRadius": 6,
  "tillTime": 15,
  "farmCycleTime": 30,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "fixedRole": true,
  "visual": {
    "bodyColor": "#228B22",
    "hatType": "straw_cone", "hatColor": "#DAA520",
    "toolType": "basket"
  }
}
```

---

### 2.2.4 Essence Collector

**Visual:** stick-man base, `#663399` purple shirt, purple hood (cone covering head), glowing tube (cylinder with emissive material) held in right hand.

**Stats:**

| HP | DMG | Atk/sec | RNG | SPD | Cost (E/A) | Build |
|---|---|---|---|---|---|---|
| 30 | 2 | 1.0 | 1 | 1.0 | 5 / 1 | 5s |

**Behavior loop:**
1. Scan map for **liquid essence pools** (zombie kill drops within their 10s decay window).
2. Walk to closest pool (race against decay).
3. Pick up 1 essence (instant on contact).
4. Walk to nearest Essence Vault OR Storage Cart.
5. Drop the 1 essence.
6. Return to scanning.
7. Loop. If no liquid essence on map, idle near Essence Vault.

**Rules:** fixed-role; cannot swim; carries 1 essence per trip (small amount because pools are abundant). Race against 10s decay.

**Hunger / Combat / Animation:** identical to other workers.

**JSON archetype:**
```json
{
  "type": "essence_collector",
  "stats": { "hp": 30, "dmg": 2, "atkSpeed": 1.0, "range": 1, "moveSpeed": 1.0 },
  "carry": { "capacity": 1, "type": "essence" },
  "spawnCost": { "essence": 5, "apple": 1 },
  "buildTime": 5,
  "fleeRadius": 6,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "fixedRole": true,
  "visual": {
    "bodyColor": "#663399",
    "hatType": "hood", "hatColor": "#663399",
    "toolType": "glow_tube"
  }
}
```

---

### 2.2.5 Builder

**Visual:** stick-man base, `#DAA520` yellow-gold shirt, sphere-shaped hardhat, hammer held in right hand.

**Stats:**

| HP | DMG | Atk/sec | RNG | SPD | Cost (E/A) | Build |
|---|---|---|---|---|---|---|
| 30 | 2 | 1.0 | 1 | 1.0 | 5 / 1 | 5s |

**Behavior loop:**
1. Scan map for ghost building sites (placed by player, awaiting construction).
2. Walk to nearest ghost site.
3. Construct: deals 5 HP/sec to the building's "construction progress" until complete.
4. **Multi-Builder stacking:** when multiple Builders work on the same site, speed scales (1× → 1.7× → 2.3× → 2.8× → 3.0× cap at 5+).
5. After complete, scan for next ghost site OR damaged building (HP < max).
6. If damaged building exists, walk and repair at 5 HP/sec (per `[GAME_DESIGN.md §11.6]`).
7. Loop. Idles near Flag if no construction or repair needed.

**Rules:** fixed-role; cannot swim; carries no resource physically (resources are deducted from stockpile when player places ghost, not carried).

**Hunger / Combat / Animation:** identical to other workers.

**JSON archetype:**
```json
{
  "type": "builder",
  "stats": { "hp": 30, "dmg": 2, "atkSpeed": 1.0, "range": 1, "moveSpeed": 1.0 },
  "carry": { "capacity": 0, "type": null },
  "spawnCost": { "essence": 5, "apple": 1 },
  "buildTime": 5,
  "fleeRadius": 6,
  "buildSpeed": 5,
  "repairSpeed": 5,
  "stackCurve": [1.0, 1.7, 2.3, 2.8, 3.0],
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "fixedRole": true,
  "visual": {
    "bodyColor": "#DAA520",
    "hatType": "hardhat", "hatColor": "#DAA520",
    "toolType": "hammer"
  }
}
```

## 2.3 Soldier Entity Cards

5 soldiers in the counter pentagon (locked design pillar): **Scout, Slinger, Sharpshooter, Bruiser, Biker**. Stats from `[GAME_DESIGN.md §13.2]`. Visuals embedded per card.

---

### Shared Soldier Behavior (LOCKED — applies to all 5)

**Spawn → idle:**
- Soldier spawns at the **Flag** (central indestructible spawn — see locked pillars in `CLAUDE.md`).
- Stays idle at the Flag until the player **drags them to a waypoint**.

**Drag-to-waypoint behavior:**
- Player drags soldier → soldier walks to the waypoint → plants feet there.
- At the waypoint, soldier watches a **6-tile sense circle**.
- If an enemy (zombie or rival soldier) enters the circle → soldier walks toward enemy → fights → returns to the waypoint when target is dead or steps out of the circle.
- Soldier **never wanders past their sense circle**. To move them further, drag again.

**Movement vs combat priority:**
- While walking to a new waypoint, soldier **does NOT detour** for enemies they pass — movement wins.
- Exception: if attacked en-route, soldier engages the attacker, then resumes movement after the attacker dies or moves out of range.

**Combat rules:**
- Counter pentagon (`[GAME_DESIGN.md §13.2]`): counter unit deals **1.5× damage**. **Applies only vs enemy soldiers**, NOT zombies (zombies always take base DMG).
- No friendly fire.
- **No flee.** Soldier fights to the death; does not retreat at low HP.
- On death, **drops nothing** — no essence, no resources.

**Hunger** (full mechanics in §2.8 Apple Feeding System):
- 1 apple per 200s. Auto-eats from nearest apple source. 1 HP/sec starvation if no apple.
- `combatModeGate: true` — eats **only between fights**. Will not eat while an enemy is in the sense circle, even if hunger is critical.

**Apple healing** (per `[GAME_DESIGN.md §11]`):
- Auto-eats apples to heal injuries. Same rule as hunger — only between fights.

**Animation triggers:** standard 5-state set per §2.7 — `idle`, `walk`, `attack`, `eat`, `die`.

---

### 2.3.1 Scout

**Visual:** stick-man base, `#D2B48C` tan shirt, thin white bandana on head, dagger (small triangle blade) in right hand.

**Stats:**

| HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 40 | 5 | 1.5 | 7.5 | 1 (melee) | 1.5 (fast) | 10 / 0 / 0 / 1 | 8s |

**Counter math (vs enemy soldiers only):**

| Scout vs … | DMG modifier |
|---|---|
| **Biker** | **1.5×** (Scout counters Biker) |
| **Slinger** | 0.5× (Slinger counters Scout — Slinger gets the 1.5× bonus) |
| Sharpshooter, Bruiser, other Scouts | 1.0× |
| **Zombies** | 1.0× (counter bonus does NOT apply) |

**Special / Water:**
- **Swims water tiles** at 0.5× speed (per `[PHASE_1_ENVIRONMENT.md §1.11.3]`).
- Emergent edge: zombies can't swim — Scout can retreat into water when overwhelmed.

**JSON archetype:**
```json
{
  "type": "scout",
  "stats": { "hp": 40, "dmg": 5, "atkSpeed": 1.5, "range": 1, "moveSpeed": 1.5 },
  "spawnCost": { "essence": 10, "wood": 0, "stone": 0, "apple": 1 },
  "buildTime": 8,
  "senseRadius": 6,
  "fleesAtLowHP": false,
  "deathDrops": null,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": true,
  "swimSpeedMul": 0.5,
  "counters": ["biker"],
  "counteredBy": ["slinger"],
  "counterDmgMul": 1.5,
  "counterAppliesVsZombies": false,
  "visual": {
    "bodyColor": "#D2B48C",
    "hatType": "bandana", "hatColor": "#FFFFFF",
    "weaponType": "dagger"
  }
}
```

---

### 2.3.2 Slinger

**Visual:** stick-man base, `#4F4F4F` dark gray shirt, simple cap (`#4F4F4F`), Y-shape slingshot held in right hand.

**Stats:**

| HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 35 | 8 | 0.8 | 6.4 | 4 (ranged) | 1.3 | 12 / 0 / 0 / 1 | 8s |

**Counter math (vs enemy soldiers only):**

| Slinger vs … | DMG modifier |
|---|---|
| **Scout** | **1.5×** (Slinger counters Scout) |
| **Sharpshooter** | 0.5× (Sharpshooter counters Slinger) |
| **Biker** | 0.5× (Biker counters Slinger) |
| Bruiser, other Slingers | 1.0× |
| **Zombies** | 1.0× |

**Special / Water:**
- **Arc projectile** — pebble travels in a parabola; can clear **low obstacles up to 1 tile high** (e.g., short fences, stumps). Blocked by full walls and live trees.
- **Swims water tiles** at 0.5× speed (per `[PHASE_1_ENVIRONMENT.md §1.11.3]`).

**JSON archetype:**
```json
{
  "type": "slinger",
  "stats": { "hp": 35, "dmg": 8, "atkSpeed": 0.8, "range": 4, "moveSpeed": 1.3 },
  "spawnCost": { "essence": 12, "wood": 0, "stone": 0, "apple": 1 },
  "buildTime": 8,
  "senseRadius": 6,
  "fleesAtLowHP": false,
  "deathDrops": null,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": true,
  "swimSpeedMul": 0.5,
  "projectile": { "type": "arc", "clearsObstaclesUpToTilesHigh": 1 },
  "counters": ["scout"],
  "counteredBy": ["sharpshooter", "biker"],
  "counterDmgMul": 1.5,
  "counterAppliesVsZombies": false,
  "visual": {
    "bodyColor": "#4F4F4F",
    "hatType": "cap", "hatColor": "#4F4F4F",
    "weaponType": "slingshot"
  }
}
```

---

### 2.3.3 Sharpshooter

**Visual:** stick-man base, `#355E3B` dark green shirt, feathered cap (cone + small feather), bow (curved cylinder + string line) held in right hand.

**Stats:**

| HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 50 | 14 | 0.6 | 8.4 | 8 (long ranged) | 1.0 | 20 / 5 / 0 / 2 | 12s |

**Counter math (vs enemy soldiers only):**

| Sharpshooter vs … | DMG modifier |
|---|---|
| **Bruiser** | **1.5×** (Sharpshooter counters Bruiser) |
| **Biker** | 0.5× (Biker counters Sharpshooter) |
| Scout, Slinger, other Sharpshooters | 1.0× |
| **Zombies** | 1.0× |

**Special / Water:**
- **Straight shot** — arrow travels horizontally. **Blocked by line-of-sight obstacles**: walls, live trees, buildings, boundary walls. Flies over water tiles and grass tufts freely.
- **Cannot swim** — water tiles are impassable for Sharpshooter.

**JSON archetype:**
```json
{
  "type": "sharpshooter",
  "stats": { "hp": 50, "dmg": 14, "atkSpeed": 0.6, "range": 8, "moveSpeed": 1.0 },
  "spawnCost": { "essence": 20, "wood": 5, "stone": 0, "apple": 2 },
  "buildTime": 12,
  "senseRadius": 6,
  "fleesAtLowHP": false,
  "deathDrops": null,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "projectile": { "type": "straight", "blockedBy": ["wall", "tree", "building", "boundary_wall"] },
  "counters": ["bruiser"],
  "counteredBy": ["biker"],
  "counterDmgMul": 1.5,
  "counterAppliesVsZombies": false,
  "visual": {
    "bodyColor": "#355E3B",
    "hatType": "feathered_cap", "hatColor": "#355E3B",
    "weaponType": "bow"
  }
}
```

---

### 2.3.4 Bruiser

**Visual:** stick-man base, `#800000` dark red shirt, metal helm (gray sphere on head), sledgehammer (cube head + cylinder handle) held in both hands.

**Stats:**

| HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 110 (tank) | 18 | 0.7 | 12.6 | 1 (melee) | 0.8 (slow) | 35 / 0 / 5 / 3 | 15s |

**Counter math (vs enemy soldiers only):**

| Bruiser vs … | DMG modifier |
|---|---|
| **Slinger** | **1.5×** (Bruiser counters Slinger) |
| **Scout** | **1.5×** (Bruiser counters Scout) |
| **Sharpshooter** | 0.5× (Sharpshooter counters Bruiser) |
| Biker, other Bruisers | 1.0× |
| **Zombies** | 1.0× |

**Special / Water:**
- **Knockback** — every successful hit pushes the target **1 tile backward** (away from the Bruiser). Useful for pinning zombies against walls or breaking enemy formations.
- **Cannot swim** — water tiles are impassable.

**JSON archetype:**
```json
{
  "type": "bruiser",
  "stats": { "hp": 110, "dmg": 18, "atkSpeed": 0.7, "range": 1, "moveSpeed": 0.8 },
  "spawnCost": { "essence": 35, "wood": 0, "stone": 5, "apple": 3 },
  "buildTime": 15,
  "senseRadius": 6,
  "fleesAtLowHP": false,
  "deathDrops": null,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "onHit": { "knockback": { "tiles": 1, "direction": "away_from_self" } },
  "counters": ["slinger", "scout"],
  "counteredBy": ["sharpshooter"],
  "counterDmgMul": 1.5,
  "counterAppliesVsZombies": false,
  "visual": {
    "bodyColor": "#800000",
    "hatType": "metal_helm", "hatColor": "#888888",
    "weaponType": "sledgehammer"
  }
}
```

---

### 2.3.5 Biker

**Visual:** stick-man base, `#1C1C1C` black shirt, round helmet (sphere), motorcycle prop under body (2 thin wheel cylinders + frame box). Biker is permanently mounted in V1 — no separate "dismount" state.

**Stats:**

| HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 90 | 22 | 0.9 | 19.8 | 1 (melee) | 2.0 (fastest) | 40 / 10 / 5 / 3 | 18s |

**Counter math (vs enemy soldiers only):**

| Biker vs … | DMG modifier |
|---|---|
| **Sharpshooter** | **1.5×** (Biker counters Sharpshooter) |
| **Slinger** | **1.5×** (Biker counters Slinger) |
| **Scout** | 0.5× (Scout counters Biker) |
| Bruiser, other Bikers | 1.0× |
| **Zombies** | 1.0× |

**Special / Water:**
- **Charge ×2 first hit** — first attack against a fresh target deals **2× damage**. Subsequent hits on the same target deal normal damage. Resets when Biker disengages and engages a different target.
- Combined with high SPD (2.0), Biker is the bursty ambusher of the pentagon.
- **Cannot swim** — motorcycle does NOT cross water. Locked V1 trade-off — Buggy / War Truck / Heavy Carrier are the water-crossing vehicles.

**JSON archetype:**
```json
{
  "type": "biker",
  "stats": { "hp": 90, "dmg": 22, "atkSpeed": 0.9, "range": 1, "moveSpeed": 2.0 },
  "spawnCost": { "essence": 40, "wood": 10, "stone": 5, "apple": 3 },
  "buildTime": 18,
  "senseRadius": 6,
  "fleesAtLowHP": false,
  "deathDrops": null,
  "hunger": { "rate": 1.0, "max": 200, "applesPerMeal": 1, "starveDmgPerSec": 1 },
  "canSwim": false,
  "onFirstHitPerTarget": { "damageMul": 2.0 },
  "counters": ["sharpshooter", "slinger"],
  "counteredBy": ["scout"],
  "counterDmgMul": 1.5,
  "counterAppliesVsZombies": false,
  "visual": {
    "bodyColor": "#1C1C1C",
    "hatType": "round_helmet", "hatColor": "#1C1C1C",
    "weaponType": "melee_charge",
    "vehicleProp": { "type": "motorcycle", "wheels": 2, "frame": "box" }
  }
}
```

## 2.4 King Entity Card (LOCKED — 2026-04-28)

The King is the **only loss target**. King death = game over. Locked design pillar.

---

### 2.4.1 Visual

Stick-man base, but **scaled to 3.0 units tall** (vs 2.7 for everyone else — visually distinct as the leader).

| Part | Value |
|---|---|
| Body height | **3.0 units** |
| Body color | `#4B0082` royal indigo |
| Skin / head | `#F5DEB3` wheat (same as the base anatomy) |
| Crown | gold spiked ring on head, `#FFD700` |
| Weapon | long sword (longer than Bruiser's sledgehammer haft, with crossguard), `#FFD700` |
| Accent | small gold trim line down the body front |
| Optional | subtle additive glow light below feet (off by default; toggle in JSON) |

### 2.4.2 Stats — TANK profile

| HP | DMG | Atk/sec | DPS | RNG | SPD | Cost | Build |
|---|---|---|---|---|---|---|---|
| **500** | 30 | 1.0 | 30 | 1 (melee) | 0.7 | — (exists from t=0) | — |

Numbers per `[GAME_DESIGN.md §13.3]` (master balance table). The King is **not built or spawned on demand** — he exists at game start. No essence / wood / stone / apple cost. No build time.

### 2.4.3 Behavior — Retaliate Only

**Spawn:**
- King exists from the very start of the level, placed at the Flag (the central indestructible spawn).
- No `spawnCost` and no `buildTime`.

**Idle:**
- Drag-to-waypoint applies — player can drag King anywhere walkable.
- Default position: at the Flag.
- At any waypoint, King watches a **6-tile sense circle** (same as soldiers).

**Combat:**
- King **does NOT initiate combat.** Even if a zombie or enemy soldier walks into his sense circle, he stands still.
- King **retaliates only if attacked**: if an enemy deals damage to him, he engages that attacker — walks toward it (within the sense circle), fights to kill, then returns to the waypoint.
- He **never wanders past the sense circle.** If the attacker flees beyond 6 tiles, King returns to his waypoint and resumes idle.
- **No flee at low HP.** Fights to the death. The player must drag King to safety to keep him alive.

**Counter math:**
- King is **NOT in the pentagon.** He gives and receives **standard 1.0× damage** vs every opponent (including soldiers and zombies).
- No 1.5× counter bonus given or received.

**No leader aura.** King's mere presence does NOT buff nearby soldiers in V1 (locked KQ3 — keep V1 simple).

### 2.4.4 Hunger & Healing

Standard — see §2.8 Apple Feeding System. Two overrides per `[GAME_DESIGN.md §11.11]`:

1. **`combatModeGate: true`** — won't eat with an enemy in the 6-tile sense circle (same gate as soldiers).
2. **`applesPerMeal: 3`** — King eats 3 apples per meal (vs 1 for everyone else). Heals 30 HP per meal at 10 HP/apple. Matches the King's ~3× HP scale (500 vs ~150 average other-unit) — he's worth more food.

If apple supply runs out, King takes -1 HP/sec passive starvation damage (§2.8.7). Enough hunger ticks with no apple → **game over via starvation.**

### 2.4.5 Special rules

- **Cannot swim.** Water tiles are impassable. (King is a living being, not Scout / Slinger.)
- **Death = game over.** No respawn. The level ends with a loss screen.
- **No drop on death.** King leaves no essence or resources.
- **Zombie sense vs King = 8 tiles** (per `[GAME_DESIGN.md §9.6]`) — same as any other living being. King has no special sense profile.

### 2.4.6 Animation triggers

Standard 5-state set per §2.7: `idle`, `walk`, `attack`, `eat`, `die`.

The `die` animation transitions into the game-over screen (handled by Phase 6 polish).

### 2.4.7 JSON archetype

```json
{
  "type": "king",
  "stats": { "hp": 500, "dmg": 30, "atkSpeed": 1.0, "range": 1, "moveSpeed": 0.7 },
  "spawnAtGameStart": true,
  "spawnLocation": "flag",
  "isLossTarget": true,
  "deathTriggersGameOver": true,
  "deathDrops": null,
  "behaviorMode": "retaliate_only",
  "senseRadius": 6,
  "fleesAtLowHP": false,
  "leaderAura": null,
  "counterDmgMul": 1.0,
  "counterAppliesVsZombies": false,
  "hunger": {
    "rate": 1.0, "max": 200, "applesPerMeal": 3, "starveDmgPerSec": 1,
    "combatModeGate": true
  },
  "canSwim": false,
  "visual": {
    "bodyHeight": 3.0,
    "bodyColor": "#4B0082",
    "skinColor": "#F5DEB3",
    "hatType": "gold_crown", "hatColor": "#FFD700",
    "weaponType": "long_sword", "weaponColor": "#FFD700",
    "accents": ["gold_trim_line"],
    "optionalGlow": false
  }
}
```

## 2.5 Zombie Entity Card (LOCKED — 2026-04-28)

V1 has **one zombie type — the Shambler.** Zombies are the third pressure of the locked three (alongside competitors + hunger). Stats per `[GAME_DESIGN.md §13.6]`. Behavior per `[GAME_DESIGN.md §3.5, §9.3, §9.6]`.

---

### 2.5.1 Visual

| Part | Value |
|---|---|
| Posture | base stick-man **with head tilted forward** (hunched) |
| Body height | 2.7 (same as base anatomy) |
| Body color | `#556B2F` dark olive |
| Head | `#2F4F2F` darker green |
| Limbs tint | `#707030` sickly green |
| Clothing detail | dark patches (random spots — placement varies per zombie, generated at spawn) |
| Weapon | none — uses fists |

### 2.5.2 Stats

| HP | DMG vs living | DMG vs wall | Atk/sec | RNG | SPD | Sense | Drop |
|---|---|---|---|---|---|---|---|
| 30 | 8 | 3 | 1.0 | 1 (melee) | 1.0 | 8 tiles | 1 essence (10s decay) |

Counter pentagon: zombies are **NOT in the pentagon.** They give and receive 1.0× damage. Soldier counter bonuses do NOT apply vs zombies (per §2.3 shared block, locked Q-shared.2).

### 2.5.3 Spawn

- **Spawn points** are hand-placed per level (2 / 3 / 4 for L1 / L2 / L3 per `[GAME_DESIGN.md §13.12]`). Visible, indestructible.
- **Global spawn cap ramps over time** (per `[GAME_DESIGN.md §13.6]`):

| `X₀` initial | `+Y` per `N`s | `X_max` |
|---|---|---|
| 15 | +5 per 60s | 60 |

- The cap is **global to the map** — 60 zombies maximum at any time, regardless of how many spawn points exist on that level. Bigger maps spread the same total threat across more spawn points (predictable threat geography per level).
- New zombies emerge from a **randomly-chosen active spawn point** whenever the live zombie count drops below the current cap.
- Spawn cadence: 1 zombie every 5–10s while under cap (tunable in JSON; final values fixed in Phase 5 AI tuning).

### 2.5.4 Behavior

**Sensing (the heart of world tension — `[GAME_DESIGN.md §3.5]`):**
- 8-tile sense circle around each zombie.
- Senses **only living beings** — workers, soldiers, King, rival villagers, and troops aboard a vehicle.
- Does NOT sense: walls, buildings, empty vehicles, stored apples, dropped resources, trees, stones.

**Wandering (no target sensed):**
- Random walk **within ~10 tiles of their spawn point** — stays clustered around the visible danger zone, keeping threat geography predictable.
- Picks a new direction every 3–5s while wandering.
- Wandering interrupts instantly when a living being enters the sense circle.

**Aggro priority (per `[GAME_DESIGN.md §9.3]`):**
1. **Closest** living being wins.
2. On tie: prefer **workers** (lower HP, easier kill).
3. If a wall blocks the path: attack the wall directly (3 DMG/hit) until it breaks, then resume the target.
4. If target leaves the 8-tile sense radius: zombie returns to wandering at its current location.

**Stacking on a target:**
- Up to **4 zombies** attack the same target at once (one per adjacent melee tile).
- Additional zombies queue up — walk to the target and wait for an attack slot to open.
- Zombies do **not overlap** on the same tile.

**Pathfinding:**
- Walks straight toward the sensed target.
- **Walls in path:** hammered through (3 DMG/hit). No A*-around-walls — locked V1 pillar (`§9.6`).
- **Natural obstacles in path** (trees, stones, water): routed around. Zombies cannot enter water (not swimmers — workers/zombies are not in the swim-pass set).
- **Boundary wall:** hard block, impassable (per `[PHASE_1_ENVIRONMENT.md §1.11.6]`).

**Vehicle interaction:**
- **Empty vehicle:** invisible to zombies (no living being aboard → not sensed).
- **Manned vehicle** (troops aboard): sensed as a target. Zombie attacks the vehicle hull at **3 DMG/hit** (treated as a moving wall) until the hull breaks, then engages the troops inside. Vehicle HP defined in `§2.6`.

### 2.5.5 Hunger / Healing

**No hunger system.** Zombies don't eat, don't starve, don't heal. Each zombie's HP is fixed until killed (per the §2.8 Apple Feeding System table — zombies are listed as `hunger: n/a`).

### 2.5.6 Death

- On death, **drops 1 liquid essence** at the death tile.
- Liquid essence has a **10-second decay timer** — an Essence Collector (§2.2.4) must pick it up before it disappears.
- Dropped essence is **invisible to zombies** (sensing rule = living beings only).
- No corpse persists — zombie despawns on `die` animation completion.

### 2.5.7 Animation triggers

Standard 5-state set per §2.7 — `idle`, `walk`, `attack`, `eat` (unused for zombies), `die`.

`die` triggers the essence-drop side effect (1 liquid essence appears at the death tile; 10s decay clock starts).

### 2.5.8 JSON archetype

```json
{
  "type": "zombie_shambler",
  "stats": { "hp": 30, "dmg": 8, "dmgVsWall": 3, "atkSpeed": 1.0, "range": 1, "moveSpeed": 1.0 },
  "senseRadius": 8,
  "sensesOnly": ["living_beings"],
  "wander": { "leashTilesFromSpawn": 10, "directionChangeIntervalSec": 4 },
  "aggroPriority": ["closest", "prefer_worker_on_tie"],
  "wallHammer": { "enabled": true, "dmgPerHit": 3 },
  "pathfinding": "straight_line_no_astar_around_walls",
  "concurrentAttackersPerTarget": 4,
  "vehicleInteraction": "treat_manned_as_wall",
  "fleesAtLowHP": false,
  "hunger": null,
  "canSwim": false,
  "deathDrops": [{ "type": "liquid_essence", "amount": 1, "decaySec": 10 }],
  "counterDmgMul": 1.0,
  "isCounterTarget": false,
  "spawnConfig": {
    "scope": "global",
    "initialCap": 15,
    "rampPerSec": 5,
    "rampInterval": 60,
    "maxCap": 60,
    "spawnIntervalSecRange": [5, 10],
    "emergeFrom": "spawn_points"
  },
  "visual": {
    "bodyHeight": 2.7,
    "posture": "hunched",
    "bodyColor": "#556B2F",
    "headColor": "#2F4F2F",
    "limbsColor": "#707030",
    "clothingDetail": "dark_patches_random",
    "weaponType": "fists"
  }
}
```

## 2.6 Vehicle Entity Cards (LOCKED — 2026-04-28)

4 vehicles in V1 — locked design pillar. Stats per `[GAME_DESIGN.md §13.4]`. Roles per `[§7]`: **war** (auto-attack), **carrier** (troop transport), **storage** (resource ferry).

Wheels are thin cylinders rotated 90° to align with the chassis (visual standard).

---

### Shared Vehicle Behavior (LOCKED — applies to all 4)

**Spawn & control:**
- All vehicles spawn at the **Flag** (per `[GAME_DESIGN.md §7.7]`). No separate Vehicle Yard in V1.
- **No driver slot** — vehicles auto-pilot via universal drag-to-waypoint. Drag the vehicle to a destination, it drives there. (Same input as the King.)
- All 4 vehicles **cross water** at 1.0× speed (per `[PHASE_1_ENVIRONMENT.md §1.11.3]`).
- Vehicles route around natural obstacles (trees, stones). They cannot enter the boundary wall.

**Boarding & disembarking:**
- **Drag a soldier or worker onto a vehicle** → unit boards if a seat is open. The unit disappears from the world; the vehicle UI shows the count.
- **Drag from a vehicle's troop slot outward** → unit disembarks at the drag-end point at full HP.
- Capacity is hard — extra boarders wait near the vehicle until a slot opens.

**Mounted weapons:**
- Each vehicle except Storage Cart has an auto-firing mounted weapon.
- **Auto-targets the nearest enemy** (zombie or rival soldier) within mounted range.
- Fires while idle at the waypoint AND while driving — no movement gating.
- Counter pentagon: vehicles are **NOT in the pentagon**. Mounted weapons deal 1.0× damage to all targets (no counter bonus given or received).

**Boarded-troop combat (per `[GAME_DESIGN.md §7.3]`):**
- Each boarded troop fires their own normal attack (their own DMG / atk-sec / range) from the vehicle's position.
- Total vehicle DPS = mounted gun DPS + sum of boarded troops' DPS.
- Example: War Truck (12 mounted DPS) + 4 Sharpshooters (8.4 DPS each, 8-tile range) ≈ **45 DPS rolling fortress**.

**Wreck behavior (HP=0):**
- Wreck animation plays.
- **All boarded troops dropped at the wreck site at full HP** (per `[§7.3]`). They survive — you don't lose them.
- **Cargo resources are LOST.** Not salvageable in V1.
- Wreck visual lingers ~5s (smoking pile of metal) then despawns. Cosmetic only — no debris collider.

**Sensing by zombies (per `[§3.5]`, see §2.5):**
- **Empty vehicle:** invisible to zombies — not sensed.
- **Manned vehicle** (≥1 troop aboard): sensed via the troops. Zombies hammer the hull at 3 DMG/hit until it breaks, then engage the troops.
- **Storage Cart with cargo but no troops:** invisible to zombies (cargo isn't living).

**Repair (per `[GAME_DESIGN.md §11.6]`):**
- Builders repair damaged vehicles at **5 HP/sec**.
- Cost = (½ × build cost) × (HP_missing / HP_max), plus apples (HP_missing / 50, rounded up).
- Multi-Builder stack curve same as buildings (1× → 1.7× → 2.3× → 2.8× → 3.0× cap at 5+ Builders).

**Animation states (vehicle-specific, supplements §2.7):**

| State | Behavior | Duration | Trigger |
|---|---|---|---|
| **idle** | engine bob ±0.02y, wheels stationary | 1.0s loop | parked at waypoint |
| **drive** | wheels rotate (SPD-scaled), body bob ±0.05y, dust trail | continuous while moving | drag-to-waypoint movement |
| **attack** | mounted weapon flash + slight recoil bump | 0.15s per shot | mounted weapon fires |
| **wreck** | smoke particles, body sag, wheels collapse, alpha 1→0 | 5s active | HP=0 trigger |

Vehicles do NOT have `eat` or `die` (those are living-being states). They have `wreck`.

**Hunger:** vehicles do not eat or starve. The `hunger` field is `null` in their JSON archetypes.

---

### 2.6.1 Buggy

**Visual:** 2.0 × 1.0 × 0.5 box chassis, 4 small wheels, `#B22222` red. Small cylinder gun on top. 2 platforms behind the cabin (visible passengers when boarded).

**Role:** fast scout / harassment.

**Stats:**

| HP | SPD | Mounted DPS | Mounted Range | Personnel | Cargo | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 80 | **2.0 (fastest)** | 5 | 4 tiles | 2 | 0 | 0 / 30 / 10 / 0 | 25s |

**Special:**
- Fastest vehicle — outruns all soldiers except the Biker (also 2.0 SPD).
- No cargo bay — pure combat / scouting role.
- Mounted weapon = small cylinder gun, single-target.

**JSON archetype:**
```json
{
  "type": "buggy",
  "stats": { "hp": 80, "moveSpeed": 2.0 },
  "personnel": { "capacity": 2, "displayPlatforms": 2 },
  "cargo": { "capacity": 0, "resource": null, "lockedType": false },
  "mountedWeapon": { "type": "small_cylinder_gun", "dps": 5, "range": 4, "aoe": null },
  "spawnCost": { "essence": 0, "wood": 30, "stone": 10, "apple": 0 },
  "buildTime": 25,
  "spawnLocation": "flag",
  "canCrossWater": true,
  "waterSpeedMul": 1.0,
  "wreck": { "dropsTroopsAtFullHP": true, "wreckLingerSec": 5 },
  "hunger": null,
  "counterDmgMul": 1.0,
  "isCounterTarget": false,
  "visual": {
    "chassisL": 2.0, "chassisW": 1.0, "chassisH": 0.5,
    "chassisColor": "#B22222",
    "wheels": { "count": 4, "size": "small" },
    "mountedWeaponVisual": "small_cylinder_gun",
    "platformLayout": "2_behind_cabin"
  }
}
```

---

### 2.6.2 War Truck

**Visual:** 3.0 × 1.5 × 0.8 box chassis, 4 medium wheels, `#556B2F` olive. Box turret on top. 5 platforms in the cargo bed (visible passengers).

**Role:** workhorse mobile fortress.

**Stats:**

| HP | SPD | Mounted DPS | Mounted Range | Personnel | Cargo | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| 200 | 1.5 | 12 | 5 tiles | 5 | 10 res (mixed) | 5 / 60 / 30 / 2 | 40s |

**Special:**
- Cargo bay carries up to 10 resource units (any mix of essence / wood / stone / apple).
- Fits 5 troops — the standard offensive push.
- Mounted weapon = box turret, 12 DPS, 5-tile range.

**JSON archetype:**
```json
{
  "type": "war_truck",
  "stats": { "hp": 200, "moveSpeed": 1.5 },
  "personnel": { "capacity": 5, "displayPlatforms": 5 },
  "cargo": { "capacity": 10, "resource": "mixed", "lockedType": false },
  "mountedWeapon": { "type": "box_turret", "dps": 12, "range": 5, "aoe": null },
  "spawnCost": { "essence": 5, "wood": 60, "stone": 30, "apple": 2 },
  "buildTime": 40,
  "spawnLocation": "flag",
  "canCrossWater": true,
  "waterSpeedMul": 1.0,
  "wreck": { "dropsTroopsAtFullHP": true, "wreckLingerSec": 5 },
  "hunger": null,
  "counterDmgMul": 1.0,
  "isCounterTarget": false,
  "visual": {
    "chassisL": 3.0, "chassisW": 1.5, "chassisH": 0.8,
    "chassisColor": "#556B2F",
    "wheels": { "count": 4, "size": "medium" },
    "mountedWeaponVisual": "box_turret",
    "platformLayout": "5_in_cargo_bed"
  }
}
```

---

### 2.6.3 Heavy Carrier

**Visual:** 4.0 × 2.0 × 1.2 box chassis, 6 large wheels, `#2F4F4F` gunmetal. Turret + secondary cannon on top. 10 platforms on the deck with railings.

**Role:** ultimate mobile fortress.

**Stats:**

| HP | SPD | Mounted DPS | Mounted Range | AoE | Personnel | Cargo | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|---|
| 400 | 1.0 | 20 | 6 tiles | **1-tile splash** | 10 | 50 res (mixed) | 10 / 100 / 60 / 5 | 60s |

**Special:**
- Mounted weapon = primary turret + secondary cannon. 20 combined DPS at 6-tile range with **1-tile splash radius** around the primary target — hits multiple zombies in tight clusters.
- Carries 10 troops — full squad.
- Cargo bay carries up to 50 resource units (mixed types).
- Slow at SPD 1.0 — the price for being a city on wheels.

**JSON archetype:**
```json
{
  "type": "heavy_carrier",
  "stats": { "hp": 400, "moveSpeed": 1.0 },
  "personnel": { "capacity": 10, "displayPlatforms": 10 },
  "cargo": { "capacity": 50, "resource": "mixed", "lockedType": false },
  "mountedWeapon": { "type": "turret_plus_cannon", "dps": 20, "range": 6, "aoe": { "splashTiles": 1 } },
  "spawnCost": { "essence": 10, "wood": 100, "stone": 60, "apple": 5 },
  "buildTime": 60,
  "spawnLocation": "flag",
  "canCrossWater": true,
  "waterSpeedMul": 1.0,
  "wreck": { "dropsTroopsAtFullHP": true, "wreckLingerSec": 5 },
  "hunger": null,
  "counterDmgMul": 1.0,
  "isCounterTarget": false,
  "visual": {
    "chassisL": 4.0, "chassisW": 2.0, "chassisH": 1.2,
    "chassisColor": "#2F4F4F",
    "wheels": { "count": 6, "size": "large" },
    "mountedWeaponVisual": "turret_plus_secondary_cannon",
    "platformLayout": "10_on_deck_with_railings"
  }
}
```

---

### 2.6.4 Storage Cart

**Visual:** 2.0 × 1.5 × 0.6 open-box chassis, 4 small wheels, `#A0522D` wood brown. **No mounted weapon.** Open cargo bay with **visible stacked resources** (the player sees what's loaded).

**Role:** mobile silo. Cross-base resource ferry.

**Stats:**

| HP | SPD | Mounted DPS | Personnel | Cargo | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|
| 100 | **0.8 (slowest)** | — | 0 | 50 res (one type, locked at spawn) | 0 / 30 / 10 / 0 | 30s |

**Special:**
- **Locked to ONE resource type at spawn.** Player picks essence / wood / stone / apple from a UI prompt when issuing the build command. Per `[GAME_DESIGN.md §4.5]`.
- **No mounted weapon. No personnel slots.** The cart is defenseless.
- **The cart is functionally a silo on wheels.** Identical behavior to a static silo (§3.3.2–§3.3.5) except: relocatable via drag, locked to one resource type, smaller capacity (50 vs 100/200).
- Workers auto-deliver to the nearest Storage Cart over an Apple/Wood/Stone Silo when the cart is closer (per worker behavior loops in §2.2).
- **Drag-to-waypoint moves it manually. No auto-route mode in V1** (override of `[GAME_DESIGN.md §4.5]`'s earlier "assigned a route between two points" line — see `[PHASE_4_SYSTEMS.md §4.8.3]`). Player drags the cart strategically (e.g., parks at a distant tree cluster during harvest; drags back to base when full). Auto-route would be a V2 enhancement.
- Slowest of the 4 vehicles — the price for being a logistics specialist.

**JSON archetype:**
```json
{
  "type": "storage_cart",
  "stats": { "hp": 100, "moveSpeed": 0.8 },
  "personnel": { "capacity": 0, "displayPlatforms": 0 },
  "cargo": { "capacity": 50, "resource": null, "lockedType": true, "lockedAtSpawn": true },
  "mountedWeapon": null,
  "spawnCost": { "essence": 0, "wood": 30, "stone": 10, "apple": 0 },
  "buildTime": 30,
  "spawnLocation": "flag",
  "canCrossWater": true,
  "waterSpeedMul": 1.0,
  "wreck": { "dropsTroopsAtFullHP": true, "wreckLingerSec": 5 },
  "hunger": null,
  "counterDmgMul": 1.0,
  "isCounterTarget": false,
  "spawnUI": { "requiresResourceTypeSelection": true, "options": ["essence", "wood", "stone", "apple"] },
  "routeMode": null,
  "behaviorModel": "relocatable_silo",
  "visual": {
    "chassisL": 2.0, "chassisW": 1.5, "chassisH": 0.6,
    "chassisColor": "#A0522D",
    "wheels": { "count": 4, "size": "small" },
    "mountedWeaponVisual": null,
    "openCargoBay": true,
    "showStackedResources": true
  }
}
```

## 2.7 Animation States (LOCKED minimum set)

| State | Behavior | Duration | Notes |
|---|---|---|---|
| **idle** | breathing scale Y ±2% | 1.5s loop | played when stationary and no task |
| **walk** | body bob ±0.05y, alternating leg/arm rotation | 0.4s cycle | playback rate scales with SPD stat |
| **attack** | lunge 0.2 forward, weapon arm swing, white flash | 0.15s | triggered per attack, syncs with Atk/sec |
| **eat** | hold apple at mouth, body squash -10%/+5% | 0.5s | played when consuming an apple |
| **die** | rotate body Z 90° (fall), alpha 1→0 fade | 1.0s active, despawn at 1.5s | stops all other systems on the entity |

Optional carry visual: jelly-stack on worker's back (already implemented for King's resource pickup; reuse).

## 2.8 Apple Feeding System (LOCKED — 2026-04-28)

> Foundational shared rule for hunger, healing, and starvation. **Applies to every living being** in the game. Each Entity Card's "Hunger" block defers to this section for the full mechanics.

### 2.8.1 What 1 apple does

- Resets the eater's hunger timer (back to 0 of 200s).
- Heals **+10 HP** (capped at max HP). Tunable per archetype. Per `[GAME_DESIGN.md §13.10]` (1 apple = 10 HP for living; 1 apple = 50 HP for non-living repair).

### 2.8.2 Eating triggers

The eat sequence fires when EITHER condition becomes true:

| Trigger | Condition |
|---|---|
| **Hunger tick** | 200s have elapsed since last meal |
| **Critical health** | HP drops below 30% of max |

If both fire simultaneously, only **one apple** is consumed — it resets hunger AND heals in the same bite.

### 2.8.3 Apple sources & range cap

Auto-eat searches for the **nearest valid container**:

- **Storage Cart** (mobile, deployed by player)
- **Apple Silo** (fixed, base building)

Whichever is closer wins.

**Range cap: 10 tiles.** If no source is within 10 tiles, the trigger is **suppressed** until the player drags the entity within range OR builds forward supply (a Storage Cart in the field).

**Not eat sources:**
- Apple Farm Plots produce apples but aren't storage. Farmer must deliver to Silo/Cart first.
- A worker's own carry is in-transit cargo — untouchable until delivered.

### 2.8.4 Eat sequence

1. Entity stops current task.
2. Pathfinds to the nearest qualifying container within the range cap.
3. Plays `eat` animation (0.5s, see §2.7).
4. On animation end: container -1 apple; eater's hunger timer resets; +10 HP heal applied (capped at max).
5. Entity resumes prior task.

### 2.8.5 Interruption rule

If the entity takes damage during the 0.5s eat animation:

- Animation cancels immediately.
- Apple is **still consumed** from the container (-1) but **no benefits apply** — no hunger reset, no heal.
- Entity transitions to its combat / flee response.

Prevents "eating = invuln frame" exploits.

### 2.8.6 Combat-mode gate (soldiers + King only)

Soldiers and the King have an extra gate on top of §2.8.2:

> Auto-eat fires **only if no enemy is in the entity's 6-tile sense circle.**
>
> If an enemy is present, the trigger is **suppressed** (queued). Hunger keeps ticking; HP keeps bleeding. Entity continues fighting or standing.
>
> When the sense circle clears, the queued eat fires immediately.

**Consequence:** soldiers and the King CAN bleed out or starve mid-combat. The player must drag them to safety to let them eat.

Workers do **not** have this gate — they flee to a wall first (per their flee rule, §2.2.1), then auto-eat once safe.

### 2.8.7 Starvation damage

If the 200s hunger timer expires AND no eat fires (no apple in stock OR no source in range OR combat gate is suppressing):

- Entity takes **-1 HP/sec passive damage**.
- Continues every second until the entity successfully eats OR dies.
- Applies in **all** states (idle, walking, fighting, fleeing).

### 2.8.8 JSON archetype hunger block

Every living being archetype has a `hunger` field. Full schema with defaults:

```json
{
  "hunger": {
    "rate": 1.0,
    "max": 200,
    "applesPerMeal": 1,
    "starveDmgPerSec": 1,
    "criticalHealthPct": 0.30,
    "healPerApple": 10,
    "rangeCapTiles": 10,
    "combatModeGate": false
  }
}
```

Per-archetype overrides used in V1:

| Archetype | `combatModeGate` | Notes |
|---|---|---|
| All workers | `false` | Flee first → eat from safety. |
| All soldiers | `true` | No eating with enemy in 6-tile sense circle. |
| King | `true` | Same as soldiers. |
| Zombie | n/a | Zombies don't eat apples (TBD when zombie card is written). |

Fields omitted from a card's `hunger` block fall back to the defaults above.

---

## 2.9 File Structure (additions to existing `src/entities/`)

```
src/entities/
├── livingBeings/                  <-- NEW
│   ├── StickManBase.js            shared base anatomy builder
│   ├── KingFactory.js             special tall variant + crown
│   ├── workers/
│   │   ├── WoodWorker.js
│   │   ├── StoneWorker.js
│   │   ├── Farmer.js
│   │   ├── EssenceCollector.js
│   │   └── Builder.js
│   ├── soldiers/
│   │   ├── Scout.js
│   │   ├── Slinger.js
│   │   ├── Sharpshooter.js
│   │   ├── Bruiser.js
│   │   └── Biker.js
│   └── Zombie.js
├── vehicles/                      <-- NEW
│   ├── Buggy.js
│   ├── WarTruck.js
│   ├── HeavyCarrier.js
│   └── StorageCart.js
├── animations/                    <-- NEW
│   ├── idle.js
│   ├── walk.js
│   ├── attack.js
│   ├── eat.js
│   └── die.js
└── ...existing files
```

## 2.10 Phase 2 Acceptance Criteria (LOCKED)

- [ ] All 5 worker types render with their distinct colors + hats + tool props.
- [ ] All 5 soldier types render with their distinct colors + accessories + weapons.
- [ ] King renders with crown + sword + slightly taller body (3.0 vs 2.7).
- [ ] Zombie renders with hunched head + sickly green tones.
- [ ] All 4 vehicles render with correct chassis + wheels + mounted weapons.
- [ ] **idle** animation plays automatically when an entity is stationary.
- [ ] **walk** animation plays when entity is moved (test via debug-only hardcoded vector).
- [ ] **attack** animation plays when triggered (debug button).
- [ ] **eat** animation plays when triggered (debug button).
- [ ] **die** animation plays on HP=0 then despawns the entity.
- [ ] Test scene `?phase=2-test`: places 1 of each entity at fixed positions; all visible and animating correctly.
- [ ] FPS stays at 60+ on desktop with all entity types on screen simultaneously.
- [ ] No regressions in the existing King visuals (current King re-built from new base anatomy).

---

## Changelog (Phase 2 only)

- **2026-04-27 (eve)** — Phase 2 (Living Beings) opened for design.
- **2026-04-27 (night)** — Phase 2 fully drafted at visual-spec depth: stick-man shared anatomy (2.7 unit body, sphere head, cylinder body + thin limbs); per-entity visual specs for 5 workers, 5 soldiers, King (3.0 unit royal indigo + crown + sword), Zombie (hunched, olive), 4 vehicles (chassis L×W×H + wheels + mounted weapons + personnel display); 5-state animation set (idle / walk / attack / eat / die); file structure under `src/entities/`. Phase 2 acceptance criteria checklist defined.
- **2026-04-28** — §2.2 expanded into **5 full Worker Entity Cards** (visual + stats + behavior loop + rules + hunger + combat + animation triggers + JSON archetype). Soldiers, King, Zombie, Vehicles cards next.
- **2026-04-28 (split)** — Phase 2 content extracted from `IMPLEMENTATION_PLAN.md` into this file. §2.2.5 Builder cross-ref harmonized to `[GAME_DESIGN.md §11.6]`.
- **2026-04-28 (later 3)** — **§2.3 Soldier Entity Cards LOCKED.** All 5 cards written with a Shared Soldier Behavior block (drag-to-waypoint → 6-tile sense circle → engage in circle → return; no flee, no death drops; counter 1.5× vs enemy soldiers only, never vs zombies; eats only between fights) plus per-soldier specials: Scout (swims water 0.5×), Slinger (arc projectile clears 1-tile-high obstacles, swims), Sharpshooter (straight shot, line-of-sight blocked by walls/trees/buildings), Bruiser (1-tile knockback per hit), Biker (charge ×2 first hit per fresh target). §2.3 status flipped from "visual-only" to ✓ 5/5 LOCKED. Up next: §2.4 King + §2.5 Zombie + §2.6 Vehicles full cards.
- **2026-04-28 (later 4)** — **§2.8 Apple Feeding System LOCKED.** Universal shared rule covering hunger ticks (200s), critical-health auto-eat (<30% HP), apple sources (Silo OR Storage Cart, whichever closer; 10-tile range cap), eat sequence (0.5s anim), damage-interrupt rule (apple consumed but no benefits), combat-mode gate (soldiers + King don't eat with enemy in sense circle), starvation damage (-1 HP/sec). 1 apple = hunger reset + 20 HP heal. Existing Worker (§2.2.1) and Soldier (§2.3 shared block) cards now cross-reference §2.8. Sections renumbered: old §2.8 File Structure → §2.9; old §2.9 Acceptance Criteria → §2.10.
- **2026-04-28 (later 5)** — **§2.4 King Entity Card LOCKED.** Initially drafted with proposed TANK numbers (150/15/0.9), then reconciled to `[GAME_DESIGN.md §13.3]` master balance: **500 HP / 30 DMG / 0.7 SPD / melee** — way tankier (loss-target = bigger HP buffer for player reaction). Exists at game start at the Flag (no spawn cost, no build time). Retaliate-only behavior (does not initiate combat — only fights enemies who attack him first). No leader aura. Not in counter pentagon (1.0× damage in/out). Cannot swim. King death = game over. Hunger via §2.8 with `combatModeGate: true`. Up next: §2.5 Zombie + §2.6 Vehicles full cards (5 cards remaining in Phase 2).
- **2026-04-28 (later 6)** — **§2.5 Zombie Entity Card (Shambler) LOCKED.** Stats per `[GAME_DESIGN.md §13.6]`: 30 HP / 8 DMG vs living / 3 DMG vs wall / 1.0 atk-sec / 1.0 SPD / 8-tile sense / 1 essence drop with 10s decay. Senses living beings only (per §3.5). Spawn: global cap of 60 zombies, ramps 15 → +5/60s → 60, emerging from hand-placed indestructible spawn points (2/3/4 per L1/L2/L3). Wandering leash = 10 tiles from spawn point (predictable threat geography). Aggro: closest target → workers preferred on tie → hammer walls in path at 3 DMG (no A*). Up to 4 zombies attack same target at once (one per adjacent tile, rest queue). Manned vehicles treated as moving walls (3 DMG/hit until hull breaks, then engage troops). No hunger, no flee, no overlap. Up next: §2.6 — 4 Vehicle Entity Cards.
- **2026-04-28 (later 7)** — **§2.6 Vehicle Entity Cards LOCKED. ✓ PHASE 2 FULLY LOCKED.** All 4 vehicles written with a Shared Vehicle Behavior block (spawn at Flag, no driver / drag-to-waypoint, all cross water at 1.0×, drag-to-board / drag-from-slot to disembark, mounted weapons auto-target nearest enemy in range, boarded troops add their own DPS at their own range, wreck drops troops at full HP and resources are lost, repair via Builders at 5 HP/sec) plus 4 individual cards using `[§13.4]` master numbers: **Buggy** (80 HP / SPD 2.0 / 5 DPS / range 4 / 2 troops), **War Truck** (200 HP / SPD 1.5 / 12 DPS / range 5 / 5 troops + 10 cargo), **Heavy Carrier** (400 HP / SPD 1.0 / 20 DPS + 1-tile AoE splash / range 6 / 10 troops + 50 cargo), **Storage Cart** (100 HP / SPD 0.8 / no weapon / 50 cargo locked to ONE resource type at spawn; auto-route deferred to Phase 4). Vehicle-specific 4-state animation set (idle / drive / attack / wreck) supplements §2.7. Up next: open Phase 3 (Buildings) → create `PHASE_3_BUILDINGS.md`.
- **2026-04-28 (reconciliation)** — Three master-doc conflicts patched while opening Phase 3: (A) §2.8.1 heal: 20 HP → **10 HP** per `[GAME_DESIGN.md §13.10]` (master). Also patched §2.8.4 step-4 heal mention and §2.8.8 JSON `healPerApple: 20 → 10`. (B) Soldier mid-combat eating: stood by locked Q3=B (no eat in combat) by overriding `[§13.10]`'s "troops carry up to 2 apples / auto-eat in combat" line — that line is now removed from `GAME_DESIGN.md §13.10`. (C) Apple Farm Plot construction: §2.2.3 Farmer behavior loop rewritten to ghost + Farmer-build flow (player places ghost → Farmer tills 15s → plot active). `[GAME_DESIGN.md §13.5]` and `[§8.2]` Apple Farm Plot row updated 12s → "15s (Farmer)".
- **2026-04-28 (reconciliation 2)** — Fourth master-doc conflict patched while opening Phase 4: King `applesPerMeal: 1 → 3` per `[GAME_DESIGN.md §11.11]` ("King eats 3 apples per meal; everyone else eats 1"). King heals 30 HP per meal at 10 HP/apple — matches his ~3× HP scale (500 HP vs ~150 average). §2.4.4 prose + §2.4.7 JSON updated. Also discovered + patched two more places where the deprecated "troops carry apples" line existed in `GAME_DESIGN.md` (§11.9 and §11.11) — both overridden inline with cross-refs to §2.8.
