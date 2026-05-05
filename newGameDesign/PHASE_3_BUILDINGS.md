# Phase 3 — Buildings

> Detail file for Phase 3 of the V1 build plan. See `IMPLEMENTATION_PLAN.md` for the cross-phase index and `GAME_DESIGN.md` for the master V1 design.
>
> **Cross-references** — bare `§N.x` = within this file; `[PHASE_M_*.md §M.y]` = sibling phase doc; `[GAME_DESIGN.md §N.M]` = master design.
>
> **Status (2026-04-28):** ✓ Phase 3 fully drafted with all 11 building cards. Acceptance criteria locked.

---

## 3.1 Building Roster (V1)

11 buildings total. Numbers per `[GAME_DESIGN.md §13.5]`.

**Economy (5):**

| # | Name | HP | Cost (W/S/A) | Build | Capacity |
|---|---|---|---|---|---|
| 3.3.2 | Wood Silo | 150 | 15/10/0 | 20s | 200 wood |
| 3.3.3 | Stone Silo | 150 | 15/10/0 | 20s | 200 stone |
| 3.3.4 | Apple Silo | 150 | 15/10/0 | 20s | 100 apples + aura heal |
| 3.3.5 | Essence Vault | 150 | 15/10/0 | 20s | 200 essence |
| 3.3.6 | Apple Farm Plot | 80 | 10/0/1 | 15s (Farmer) | infinite cycles |

**Defense (4):**

| # | Name | HP | Cost (W/S/A) | Build | Notes |
|---|---|---|---|---|---|
| 3.3.7 | Wood Wall (1 tile) | 200 | 5/0/0 | 3s | drag-snap chain |
| 3.3.8 | Stone Wall (1 tile) | 400 | 0/8/0 | 5s | drag-snap chain |
| 3.3.9 | Gate | 150 | 10/5/0 | 5s | opens for friendlies |
| 3.3.10 | Roof | 100 | 5/5/0 | 5s | blocks arcs; sense-block via tech |

**Central / Tech (2):**

| # | Name | HP | Cost (W/S/A) | Build | Notes |
|---|---|---|---|---|---|
| 3.3.1 | Flag | ∞ | — (free) | — | 1 per base, indestructible, 3 spawn queues |
| 3.3.11 | Research Hut | 200 | 40/20/2 | 30s | queues techs (1 at a time) |

---

## 3.2 Shared Building Behavior (LOCKED — applies to all)

**Construction flow** (per `[GAME_DESIGN.md §8.7]`):

```
1. SELECT       Pick building from the top UI bar.
2. PLACE/DRAW   Walls: drag to draw a chain (tiles auto-snap).
                Point buildings: click a tile.
3. GHOST        Transparent placeholder appears. Resources deducted (cancel = refund).
4. DISPATCH     Idle Builders walk to the ghost site.
                EXCEPTION: Apple Farm Plot is built by Farmer, not Builder (§3.3.6).
5. CONSTRUCT    Building rises tile-by-tile. Multiple builders speed it up.
6. DONE         Building activates.
```

**Builder stack curve (construction + repair):**

| Builders | Speed multiplier |
|---|---|
| 1 | 1.0× (base) |
| 2 | 1.7× |
| 3 | 2.3× |
| 4 | 2.8× |
| 5+ | 3.0× (cap) |

**Placement rules (locked Q-B2 = A):**
- Anywhere on a ground tile (per `[PHASE_1_ENVIRONMENT.md §1.11.5]`).
- NOT on water tiles, live trees, live stone nodes, the boundary wall, or other buildings.
- One building per tile (no stacking — V1 simplification).

**Footprint sizes (locked Q-B1 = B):**

| Footprint | Buildings |
|---|---|
| 1×1 | Wood Wall, Stone Wall, Gate, Roof, Apple Farm Plot |
| 2×2 | Wood Silo, Stone Silo, Apple Silo, Essence Vault, Research Hut |
| 3×3 (+1-tile spawn platform halo) | Flag |

**Damage rules (locked Q-B3 = A):**

| Buildings | Damageable by zombies | Damageable by competitors |
|---|---|---|
| Wood Wall, Stone Wall, Gate, Roof | Yes (3 dmg/hit per zombie wall-hammer rule) | Yes |
| Wood Silo, Stone Silo, Apple Silo, Essence Vault, Apple Farm Plot, Research Hut | **No** — invulnerable to zombies (zombies path around) | Yes |
| Flag | **No — indestructible** | **No — indestructible** |

Zombies don't sense buildings (per `[§3.5]`); they only break walls/gates/roofs in their path to a sensed living being. Silos and economy buildings are invisible. Competitors can deliberately attack any non-indestructible building.

**Repair (per `[GAME_DESIGN.md §11.6]`):**
- Damaged buildings auto-detected by idle Builders, who walk and repair at **5 HP/sec**.
- Materials cost = (½ × original build cost) × (HP_missing / HP_max), rounded up.
- Apple cost = HP_missing / 50, rounded up — 1 apple = 50 HP for non-living repair (per `[§13.10]` master).
- Multi-Builder stack curve (same as construction).

**Hunger:** buildings do not eat or starve. The `hunger` field is `null` in their JSON archetypes.

**Animation states (building-specific, supplements `[PHASE_2_ENTITIES.md §2.7]`):**

| State | Behavior | Trigger |
|---|---|---|
| **constructing** | translucent → opaque tile-by-tile reveal | during ghost-build phase |
| **idle** | static (most buildings); subtle gear / steam / flag-wave for animated ones | once active |
| **damaged** | brief flicker + smoke particle on hit | each damage event |
| **destroyed** | crumble animation, becomes rubble visual; despawns after 5s | HP=0 |

The Flag's `destroyed` state never fires (indestructible).

---

## 3.3 Building Cards

---

### 3.3.1 Flag

The central indestructible spawn point. **1 per base, free at game start, cannot be moved or rebuilt.** All units (workers, soldiers, vehicles) spawn here via 3 parallel queues.

**Visual:** 3×3 footprint with a tall central pole + colored kingdom flag. 1-tile spawn platform halo around the building (effectively 5×5 visual area). Each kingdom (player + rivals) has a distinct flag color.

```
+---+---+---+---+---+
|   | P | P | P |   |   P = spawn platform (walkable, not buildable)
+---+---+---+---+---+
| P |   |   |   | P |
+---+---+---+---+---+
| P |   | F |   | P |   F = Flag center (3×3)
+---+---+---+---+---+
| P |   |   |   | P |
+---+---+---+---+---+
|   | P | P | P |   |
+---+---+---+---+---+
```

**Stats:**

| HP | Cost | Build | Footprint | Capacity |
|---|---|---|---|---|
| ∞ (indestructible) | — (free at game start) | — | 3×3 + 1-tile platform halo | 3 parallel queues |

**Behavior:**
- Click Flag → menu opens with 3 sub-menus: **[Workers]** / **[Soldiers]** / **[Vehicles]**.
- Selecting a unit adds it to that queue (FIFO within queue).
- The 3 queues run **simultaneously** (a Heavy Carrier 60s does NOT block a Worker 5s).
- Spawned units emerge on the spawn platform tiles, then idle until the player drags them.

**Rules:**
- Cannot be placed manually — exists at game start at the player's base center.
- Cannot be moved, rebuilt, or duplicated. 1 per base for V1.
- Spawn platform is walkable (any unit can pass through) but cannot be built on.
- Indestructible — no damage source can destroy it (zombies, competitors, fire — all noop).

**JSON archetype:**
```json
{
  "type": "flag",
  "stats": { "hp": null, "indestructible": true },
  "footprint": { "tilesL": 3, "tilesW": 3, "platformHaloTiles": 1 },
  "buildCost": null,
  "buildTime": null,
  "spawnAtGameStart": true,
  "spawnLocation": "base_center",
  "queues": {
    "workers":  { "concurrent": false },
    "soldiers": { "concurrent": false },
    "vehicles": { "concurrent": false }
  },
  "concurrentQueueCount": 3,
  "destructibleBy": [],
  "hunger": null,
  "visual": {
    "footprintTiles": 9,
    "platformTiles": 16,
    "kingdomColorFlag": true,
    "poleHeight": 4
  }
}
```

---

### 3.3.2 Wood Silo

Stores up to 200 wood. Workers auto-deliver here.

**Visual:** 2×2 brown wooden crate with sloped roof. `#8B4513` body. Visual cargo level rises as silo fills.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Capacity |
|---|---|---|---|---|
| 150 | 0 / 15 / 10 / 0 | 20s | 2×2 | 200 wood |

**Behavior:**
- Workers carrying wood deliver here (or to nearest Storage Cart, whichever closer).
- Visual cargo level fills as resources accumulate.
- Multiple silos additive (3 silos = 600 wood capacity).
- Overflow refused — if silo is full, worker walks to next-nearest container.

**Rules:**
- Damageable by competitors (150 HP). **Invulnerable to zombies.**
- Repairable by Builders at 5 HP/sec.
- Cannot be relocated (must be destroyed and rebuilt).

**JSON archetype:**
```json
{
  "type": "wood_silo",
  "stats": { "hp": 150 },
  "footprint": { "tilesL": 2, "tilesW": 2 },
  "buildCost": { "essence": 0, "wood": 15, "stone": 10, "apple": 0 },
  "buildTime": 20,
  "capacity": { "resource": "wood", "max": 200 },
  "zombieDamageable": false,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#8B4513",
    "shape": "wood_crate_sloped_roof",
    "fillLevelVisible": true
  }
}
```

---

### 3.3.3 Stone Silo

Stores up to 200 stone. Workers auto-deliver here.

**Visual:** 2×2 gray stone block with masonry texture. `#708090` body. Visual cargo level rises as silo fills.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Capacity |
|---|---|---|---|---|
| 150 | 0 / 15 / 10 / 0 | 20s | 2×2 | 200 stone |

**Behavior / Rules:** identical to Wood Silo (§3.3.2), except resource = stone.

**JSON archetype:**
```json
{
  "type": "stone_silo",
  "stats": { "hp": 150 },
  "footprint": { "tilesL": 2, "tilesW": 2 },
  "buildCost": { "essence": 0, "wood": 15, "stone": 10, "apple": 0 },
  "buildTime": 20,
  "capacity": { "resource": "stone", "max": 200 },
  "zombieDamageable": false,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#708090",
    "shape": "stone_block_masonry",
    "fillLevelVisible": true
  }
}
```

---

### 3.3.4 Apple Silo

Stores up to 100 apples + emits a **5-tile passive-heal aura** for friendly living units.

**Visual:** 2×2 wooden crate with apple basket on top, soft warm glow when stocked. `#A0522D` body, `#FF6347` apple accent.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Capacity | Aura |
|---|---|---|---|---|---|
| 150 | 0 / 15 / 10 / 0 | 20s | 2×2 | 100 apples | 5-tile passive heal |

**Behavior:**
- Stores up to 100 apples; visual fill level visible.
- **Aura (locked Q-B4 = A):** any friendly living unit (worker, soldier, King) within 5 tiles passively regenerates **+1 HP/sec**. The silo consumes **1 apple per 10 HP healed** (per `[§13.10]` master rate of 1 apple = 10 HP for living).
- If silo is empty, no aura — units in range get no passive heal.
- Aura is **independent** of `[PHASE_2_ENTITIES.md §2.8]` Apple Feeding System — both can fire concurrently (passive aura + explicit eat events).

**Rules:**
- Damageable by competitors. Invulnerable to zombies.
- Apples consumed by aura ARE deducted from stock; workers can top it up.
- Aura affects ONLY friendly living units (no allies in V1, so just the player's own).
- Aura does NOT heal vehicles or buildings.

**JSON archetype:**
```json
{
  "type": "apple_silo",
  "stats": { "hp": 150 },
  "footprint": { "tilesL": 2, "tilesW": 2 },
  "buildCost": { "essence": 0, "wood": 15, "stone": 10, "apple": 0 },
  "buildTime": 20,
  "capacity": { "resource": "apple", "max": 100 },
  "aura": {
    "radiusTiles": 5,
    "healPerSec": 1,
    "applesPerHpHealed": 0.1,
    "targets": "friendly_living_only"
  },
  "zombieDamageable": false,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#A0522D",
    "shape": "wood_crate_with_basket",
    "appleAccentColor": "#FF6347",
    "glowWhenStocked": true,
    "fillLevelVisible": true
  }
}
```

---

### 3.3.5 Essence Vault

Stores up to 200 essence. Essence Collectors (`[PHASE_2_ENTITIES.md §2.2.4]`) auto-deliver here.

**Visual:** 2×2 dark stone vault with glowing purple rune accents. `#2F2F2F` body, `#9370DB` rune glow.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Capacity |
|---|---|---|---|---|
| 150 | 0 / 15 / 10 / 0 | 20s | 2×2 | 200 essence |

**Behavior / Rules:** identical to Wood Silo (§3.3.2), except resource = essence.

**JSON archetype:**
```json
{
  "type": "essence_vault",
  "stats": { "hp": 150 },
  "footprint": { "tilesL": 2, "tilesW": 2 },
  "buildCost": { "essence": 0, "wood": 15, "stone": 10, "apple": 0 },
  "buildTime": 20,
  "capacity": { "resource": "essence", "max": 200 },
  "zombieDamageable": false,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#2F2F2F",
    "shape": "dark_stone_vault",
    "runeAccentColor": "#9370DB",
    "fillLevelVisible": true
  }
}
```

---

### 3.3.6 Apple Farm Plot

Permanent infrastructure where Farmers grow apples in infinite cycles. **Built by Farmers (NOT Builders)** — this is the only building with this exception. See Conflict-C reconciliation in the changelog.

**Visual:** 1×1 plowed earth tile (`#8B4513` brown soil) with a sapling. Visual changes through 3 stages each cycle: planted seed → growing sapling → ripe with red apples.

**Stats:**

| HP | Cost (E/W/S/A) | Build (by Farmer) | Footprint | Capacity |
|---|---|---|---|---|
| 80 | 0 / 10 / 0 / 1 | **15s (Farmer tilling)** | 1×1 | infinite cycles |

**Construction flow (special — Farmer-built):**
1. Player places a ghost on a ground tile (resources deducted).
2. Idle Farmer walks to the ghost (NOT Builder — Builders ignore Apple Farm Plot ghosts).
3. Farmer tills for 15s on arrival.
4. Plot becomes active.
5. Farmer immediately starts the plant→grow→ripe cycle (30s) per `[PHASE_2_ENTITIES.md §2.2.3]`.

**Behavior:**
- Once active, the Farmer tends to the plot in 30s cycles → 5 apples per cycle.
- Multiple plots can share a Farmer (Farmer rotates between adjacent plots).
- Plot is permanent — does not deplete (infinite cycles).
- Damageable by competitors. Invulnerable to zombies.

**Rules:**
- ONLY built by Farmers. Builders ignore the ghost.
- Ghost can be placed on any ground tile (per locked `tillable: true` in `[PHASE_1_ENVIRONMENT.md §1.11.5]`).
- Cannot be placed on water, live trees, live stones, or other buildings.
- 80 HP — fragile; protect with walls.

**JSON archetype:**
```json
{
  "type": "apple_farm_plot",
  "stats": { "hp": 80 },
  "footprint": { "tilesL": 1, "tilesW": 1 },
  "buildCost": { "essence": 0, "wood": 10, "stone": 0, "apple": 1 },
  "buildTime": 15,
  "constructedBy": "farmer",
  "constructionType": "till",
  "cycleSec": 30,
  "applesPerCycle": 5,
  "infiniteCycles": true,
  "zombieDamageable": false,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#8B4513",
    "shape": "plowed_earth_with_sapling",
    "growthStages": ["planted", "growing", "ripe"]
  }
}
```

---

### 3.3.7 Wood Wall

Modular defense — drag-snap chain. The first line of base defense.

**Visual:** 1×1 vertical wooden plank wall, `#8B4513` brown.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Notes |
|---|---|---|---|---|
| 200 | 0 / 5 / 0 / 0 | 3s | 1×1 | drag-snap chain |

**Behavior:**
- Player click + drag on ground → wall tiles auto-snap into a continuous line (per `[§8.7]` Wall-specific drag rules).
- Cost is computed per-tile, deducted at place-time as a single batch.
- Each tile blocks all entity movement (zombies, soldiers, workers, vehicles cannot pass).
- Tiles in a chain are **independently destroyable** — one broken tile = a 1-tile gap.
- Gates / Roofs can replace individual wall tiles after the chain is built (click → upgrade menu).

**Rules:**
- Damageable by zombies (3 dmg/hit per zombie wall-hammer — `[§9.6]`). 1 zombie takes ~67s to break a wall tile.
- Damageable by competitors (no special damage modifier).
- Repairable by Builders.

**JSON archetype:**
```json
{
  "type": "wood_wall",
  "stats": { "hp": 200 },
  "footprint": { "tilesL": 1, "tilesW": 1 },
  "buildCost": { "essence": 0, "wood": 5, "stone": 0, "apple": 0 },
  "buildTime": 3,
  "placement": "drag_snap_chain",
  "blocksMovement": true,
  "zombieDamageable": true,
  "zombieDmgPerHit": 3,
  "competitorDamageable": true,
  "indestructible": false,
  "upgradableTo": ["gate", "roof"],
  "hunger": null,
  "visual": {
    "color": "#8B4513",
    "shape": "vertical_wood_planks"
  }
}
```

---

### 3.3.8 Stone Wall

Tougher modular defense. Same drag-snap behavior as Wood Wall, double the HP.

**Visual:** 1×1 stone-block wall, `#708090` gray.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Notes |
|---|---|---|---|---|
| 400 | 0 / 0 / 8 / 0 | 5s | 1×1 | drag-snap chain |

**Behavior / Rules:** identical to Wood Wall (§3.3.7), except:
- 400 HP (1 zombie takes ~134s to break — twice as long).
- Costs stone instead of wood.
- 5s build time vs 3s.

**JSON archetype:**
```json
{
  "type": "stone_wall",
  "stats": { "hp": 400 },
  "footprint": { "tilesL": 1, "tilesW": 1 },
  "buildCost": { "essence": 0, "wood": 0, "stone": 8, "apple": 0 },
  "buildTime": 5,
  "placement": "drag_snap_chain",
  "blocksMovement": true,
  "zombieDamageable": true,
  "zombieDmgPerHit": 3,
  "competitorDamageable": true,
  "indestructible": false,
  "upgradableTo": ["gate", "roof"],
  "hunger": null,
  "visual": {
    "color": "#708090",
    "shape": "stone_block_wall"
  }
}
```

---

### 3.3.9 Gate

Wall replacement that opens for friendlies. Lets your units through; blocks enemies.

**Visual:** 1×1 reinforced wooden gate with iron bands, `#8B4513` body, `#444444` iron accents. Animates open / closed.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Notes |
|---|---|---|---|---|
| 150 | 0 / 10 / 5 / 0 | 5s | 1×1 | replaces a wall tile |

**Behavior:**
- Replaces a single wall tile via "upgrade" menu (click an existing wall → select Gate).
- **Auto-opens** when a friendly unit (worker, soldier, King, vehicle) is within 1 tile and approaching.
- **Auto-closes** when no friendly is within 1 tile.
- Closed gate blocks zombies + enemy units (treat as wall).
- Open gate allows zombies + enemies to pass through (during the open window — risk).

**Rules:**
- Weaker than a wall — only 150 HP. Easier to destroy.
- Damageable by zombies (3 dmg/hit) and competitors.
- Cannot be placed standalone — must replace an existing wall tile.

**JSON archetype:**
```json
{
  "type": "gate",
  "stats": { "hp": 150 },
  "footprint": { "tilesL": 1, "tilesW": 1 },
  "buildCost": { "essence": 0, "wood": 10, "stone": 5, "apple": 0 },
  "buildTime": 5,
  "placement": "replace_wall_tile",
  "openTriggerRadiusTiles": 1,
  "openTrigger": "friendly_approaching",
  "closeTrigger": "no_friendly_within_radius",
  "openBlocksZombies": false,
  "closedBlocksZombies": true,
  "zombieDamageable": true,
  "zombieDmgPerHit": 3,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#8B4513",
    "shape": "wood_gate_iron_bands",
    "ironAccent": "#444444",
    "animateOpenClose": true
  }
}
```

---

### 3.3.10 Roof

Tile-cover that blocks projectile arcs from above. Tech-gated for sense-blocking.

**Visual:** 1×1 sloped wooden roof on stilts, `#8B4513` body, `#5C4033` shadow underneath.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Notes |
|---|---|---|---|---|
| 100 | 0 / 5 / 5 / 0 | 5s | 1×1 | always blocks arcs; sense-block via tech |

**Behavior:**
- Covers a single tile from above.
- **Always blocks projectile arcs** — Slinger lobs and Heavy Carrier AoE splash cannot land on a roofed tile.
- **Pre-tech:** zombies CAN sense living beings under a roof (no sense-block).
- **Post-tech (Roof Sense Block, see `[GAME_DESIGN.md §12]`):** zombies CANNOT sense living beings under a roof from above. Useful for hidden corridors.

**Rules:**
- Always buildable — does NOT require a wall under it (V1 lock: roof can stand alone, per `[§8.9]` deferred).
- Damageable by zombies + competitors.
- Can replace a wall tile via upgrade menu (per `[§8.7]`).
- Cheapest defense building — only 100 HP, fragile.

**JSON archetype:**
```json
{
  "type": "roof",
  "stats": { "hp": 100 },
  "footprint": { "tilesL": 1, "tilesW": 1 },
  "buildCost": { "essence": 0, "wood": 5, "stone": 5, "apple": 0 },
  "buildTime": 5,
  "placement": "any_ground_tile_or_replace_wall",
  "blocksProjectileArcs": true,
  "blocksZombieSenseFromAbove": false,
  "techUpgrades": {
    "roof_sense_block": { "blocksZombieSenseFromAbove": true }
  },
  "zombieDamageable": true,
  "zombieDmgPerHit": 3,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "color": "#8B4513",
    "shape": "sloped_wood_on_stilts",
    "shadowColor": "#5C4033"
  }
}
```

---

### 3.3.11 Research Hut

Queues techs from the §12 tech tree. One queue per Hut. No prereqs (cost gates only).

**Visual:** 2×2 stone-and-wood hybrid building with chimney + steam puffing. `#708090` stone base, `#8B4513` wood roof, `#FFFFFF` steam particles.

**Stats:**

| HP | Cost (E/W/S/A) | Build | Footprint | Capacity |
|---|---|---|---|---|
| 200 | 0 / 40 / 20 / 2 | 30s | 2×2 | 1 active tech queue |

**Behavior:**
- Click Hut → tech tree menu (see `[GAME_DESIGN.md §12]`).
- Player picks a tech → cost deducted → tech goes into the queue → research time elapses → tech unlocks.
- ONE tech researches at a time per Hut. No parallel research per Hut.
- **Multiple Huts allowed** — each runs its own queue. A player can run 2+ techs simultaneously by building multiple Huts.
- V1: research is per-level — starts fresh each level (per `[§12.1]`).

**Rules:**
- 200 HP. Damageable by competitors. **Invulnerable to zombies.**
- Required to start research — no Hut, no tech progression.
- Research costs / times per `[§12.4]`.
- Repairable by Builders.

**JSON archetype:**
```json
{
  "type": "research_hut",
  "stats": { "hp": 200 },
  "footprint": { "tilesL": 2, "tilesW": 2 },
  "buildCost": { "essence": 0, "wood": 40, "stone": 20, "apple": 2 },
  "buildTime": 30,
  "queue": { "concurrent": false, "maxQueueLength": 1 },
  "techProgression": "per_level_v1",
  "zombieDamageable": false,
  "competitorDamageable": true,
  "indestructible": false,
  "hunger": null,
  "visual": {
    "stoneBaseColor": "#708090",
    "woodRoofColor": "#8B4513",
    "shape": "stone_wood_hybrid_with_chimney",
    "steamParticles": true,
    "steamColor": "#FFFFFF"
  }
}
```

---

## 3.4 Phase 3 Acceptance Criteria (LOCKED)

- [ ] All 11 building types render with their distinct shapes + colors + size (1×1 / 2×2 / 3×3).
- [ ] Flag exists at game start at the player's base center; cannot be placed manually, cannot be destroyed.
- [ ] Click Flag → 3 sub-menus appear (Workers / Soldiers / Vehicles); each queues a unit on selection.
- [ ] All 3 Flag queues run simultaneously (test: queue Heavy Carrier + Worker; both progress in parallel).
- [ ] Spawned units emerge on the spawn-platform halo, then go idle.
- [ ] Wall drag-snap works: drag a line on the ground → wall tiles snap into a chain → cost batch-deducted.
- [ ] Gate auto-opens when a friendly approaches within 1 tile; auto-closes when away.
- [ ] Apple Farm Plot ghost is built by a Farmer (not Builder) in 15s; Builders ignore it.
- [ ] Apple Silo aura: friendly living units within 5 tiles regen 1 HP/sec; silo apple stock decreases (1 per 10 HP).
- [ ] Roof blocks projectile arcs (tested with a Slinger lob into a roofed tile — projectile blocked).
- [ ] Builder construction stack curve works: 1× / 1.7× / 2.3× / 2.8× / 3.0× cap at 5+ Builders.
- [ ] Builder repair: damaged building auto-detected; nearby Builder walks and repairs at 5 HP/sec.
- [ ] Damage rules: zombie can hammer Walls/Gates/Roofs (3 dmg/hit); cannot damage Silos / Vault / Hut / Plot / Flag.
- [ ] Building placement validates: cannot place on water, live trees, live stones, boundary wall, other buildings.
- [ ] No regressions in existing entity / environment systems.

---

## Changelog (Phase 3 only)

- **2026-04-28** — Phase 3 (Buildings) opened. All 11 cards drafted in one batch using `[GAME_DESIGN.md §13.5, §8.2, §8.3, §8.7, §13.9, §11.6]` master numbers. Shared Building Behavior block locked: construction flow (ghost → Builder walk → build), placement rules (anywhere on ground, no overlap), footprints (1×1 walls/gates/roofs/farm plot, 2×2 silos/vault/hut, 3×3 Flag with 1-tile platform halo), damage rules (only walls/gates/roofs damageable by zombies; silos/vault/hut/plot invulnerable to zombies but damageable by competitors; Flag indestructible). Per-card highlights: Flag (3 parallel queues + spawn platform halo), Apple Silo (5-tile passive heal aura at 1 HP/sec, 1 apple per 10 HP), Apple Farm Plot (Farmer-built in 15s — only building NOT built by Builder), Roof (always blocks arcs, sense-block via §12 tech), Research Hut (1 tech queue per Hut, multiple Huts = parallel research). Acceptance criteria checklist added at §3.4.
- **2026-04-28 (reconciliation)** — During Phase 3 setup, reconciled 3 master-doc conflicts: (A) apple heal amount → **10 HP/apple for living** per `[§13.10]` (was 20 in PHASE_2_ENTITIES §2.8). (B) Soldier mid-combat eating → no carry, no eating in combat (overrode the `[§13.10]` line about "troops carry 2 apples / auto-eat in combat"). (C) Apple Farm Plot construction → ghost + Farmer-built (NOT Builder) in 15s, reconciling `[§13.5]`'s "12s" with `[PHASE_2_ENTITIES §2.2.3]`'s "Farmer tills 15s." All three fixes propagated.
