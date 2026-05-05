# Phase 1 — Environment

> Detail file for Phase 1 of the V1 build plan. See `IMPLEMENTATION_PLAN.md` for the cross-phase index and `GAME_DESIGN.md` for the master V1 design.
>
> **Cross-references** — bare `§N.x` = within this file; `[PHASE_M_*.md §M.y]` = sibling phase doc; `[GAME_DESIGN.md §N.M]` = master design.
>
> **Status:** ✓ Phase 1 fully locked (2026-04-28). Map size, generation, boundary, visual specs, acceptance criteria, AND per-element Environment Cards all defined. See §1.11 for the 6 cards (Tree, Stone Node, Water, Grass, Ground, Boundary Wall) at the same depth as Worker Cards in `[PHASE_2_ENTITIES.md §2.2]`.

---

## 1.1 Visual elements (proposed look)

| Element | Visual | Three.js approach |
|---|---|---|
| **Ground** | Flat green plane with subtle color variation | PlaneGeometry + vertex color noise |
| **Trees** | Brown cylinder trunk + green sphere/cone foliage | Cylinder + Icosahedron / Cone |
| **Stones** | Cluster of 2-4 gray icosahedrons, varied scale | IcosahedronGeometry instances |
| **Water** | Blue semi-transparent plane, optional wave shader | PlaneGeometry |
| **Grass tufts (decor)** | Tiny green sprites/crosses scattered | InstancedMesh |
| **Cliffs / borders** | TBD — see §1.4 below |

## 1.2 Map size — LOCKED

**Per-level sizing.** 1 tile = 1 world unit.

| Level | Map size | Total tiles | Notes |
|---|---|---|---|
| L1 | 80 × 80 | 6,400 | Tutorial-feeling; small map, 3 bases close-ish |
| L2 | 120 × 120 | 14,400 | Medium; 5 bases, more wilderness |
| L3 | 160 × 160 | 25,600 | Large; 7 bases, longest sessions |

## 1.3 Generation — LOCKED

**Hybrid.** Hand-placed must-haves + procedural decoration.

**Hand-placed per level:**
- Player base center (1)
- Rival base centers (2 / 4 / 6 for L1 / L2 / L3)
- Zombie spawn points (2 / 3 / 4)
- 1–2 main rivers (Bezier curves) cutting across the map for chokepoint geography

**Procedurally scattered (seeded random):**
- Tree clusters (5–15 clusters/map, 5–15 trees each)
- Stone clusters (3–8 clusters/map, 3–8 stones each)
- Grass tufts (decorative, dense)
- Density falls off near base centers (more resources further out — pushes player to expand)

**Seed:** random per playthrough, stored in game state for reload reproducibility.

## 1.4 Map boundary — LOCKED

**Natural water moat ring** surrounding the playable area.

```
     +-----------------------+
     |  WATER (5 tiles wide) |
     | +-------------------+ |
     | |                   | |
     | |   PLAYABLE MAP    | |
     | |   (80x80 / etc)   | |
     | |                   | |
     | +-------------------+ |
     |  WATER (5 tiles wide) |
     +-----------------------+
            ^  hard invisible wall
               just past the outer moat edge
```

- Visible water moat = 5 tiles thick, all sides.
- Vehicles + Scout/Slinger can wade into the moat but bounce off the hard wall just past its outer edge.
- Visual: water fades to dark/grey at the outer edge to feel like a real boundary, not a stop sign.

## 1.5 Tile model

- Underlying integer-tile grid for collision, walls, pathfinding (1 tile = 1 unit).
- Buildings free-place visually, but snap to tile footprint.
- Walls drag-snap to tile grid.

## 1.6 Resource cluster placement (procedural side of hybrid generation)

```
Trees:    clusters of 5-15 nodes, random count and rotation
Stones:   clusters of 3-8 nodes
Rivers:   1-2 hand-placed Bezier curves across map (varying width)
Lakes:    2-4 procedural inland lakes (5-15 tiles wide each)  <-- LOCKED
Grass:    scattered everywhere as visual decoration

Density rule: lower near base spawn locations, higher further out.
This pushes the player to expand outward as nearby supply depletes.
```

## 1.7 All Phase 1 questions resolved

- ✓ Map size — per-level (1.2)
- ✓ Generation — hybrid (1.3)
- ✓ Boundary — water moat (1.4)
- ✓ Inland lakes — yes, 2-4 procedural per map (1.6)
- ✓ Phase 1 acceptance criteria — confirmed (see §1.9)

## 1.8 File structure proposal

```
src/
├── world/                      <-- NEW
│   ├── WorldGenerator.js       seeded generation entry point
│   ├── TerrainSystem.js        ground mesh + vertex colors
│   ├── ResourceScatter.js      tree + stone cluster placement
│   ├── WaterSystem.js          rivers, moat, water mesh
│   └── BoundarySystem.js       hard wall just past outer moat
├── config/
│   └── worldConfig.js          per-level sizes, density, seed
└── ...existing dirs unchanged
```

## 1.9 Phase 1 acceptance criteria (LOCKED)

- [ ] Load `?level=1`, `?level=2`, `?level=3` URL params and generate the corresponding map size.
- [ ] Ground plane visible with green color + subtle vertex noise.
- [ ] 1-2 rivers visibly cross the map (Bezier curves).
- [ ] Water moat ring around the whole playable area.
- [ ] 2-4 inland lakes scattered procedurally.
- [ ] Tree clusters scattered procedurally (visually noisy, like nature).
- [ ] Stone clusters scattered procedurally.
- [ ] Grass tufts as dense decoration.
- [ ] Hard invisible wall stops camera/test object just past outer moat.
- [ ] Two-finger pan works (already exists — verify still functions).
- [ ] Two-finger pinch zoom works (already exists — verify).
- [ ] No regressions in existing camera/render setup.

## 1.10 Per-element visual specs

| Element | Geometry | Size | Color | Notes |
|---|---|---|---|---|
| **Ground** | PlaneGeometry, segmented for vertex colors | full map size × 1 tile depth | base #4A8B3A green; vertex noise ±15% lightness | flat shading, no normals tricks |
| **Tree trunk** | CylinderGeometry | 0.3 dia × 1.5 tall | #6B3F1A brown | random rotation Y per tree |
| **Tree foliage** | IcosahedronGeometry or ConeGeometry | 1.0 sphere or 1.5 cone | #2E7D32 green | ±20% scale variation per tree |
| **Stone** | IcosahedronGeometry | 0.5–0.8 each, 2–4 per cluster | #8B8989 gray | random rotation + scale per stone |
| **Water (rivers/moat/lakes)** | PlaneGeometry | 1 tile = 1 unit | #4A90E2 with 0.7 alpha | optional sine-wave displacement shader |
| **Grass tuft** | InstancedMesh of small crossed planes | 0.15 × 0.3 each | #7CB342 lighter green | ~5 instances per tile, random offset |
| **Boundary wall** | invisible BoxGeometry collider | 1 tile thick, 5 tall | none (invisible) | placed just past outer moat edge |

## 1.11 Environment Element Cards (LOCKED — 2026-04-28)

Each Phase 1 element gets a full card at the same depth as the Worker Cards in `[PHASE_2_ENTITIES.md §2.2]`. Format: **Visual + Stats + Interaction + Pathfinding + Rules + JSON archetype.**

- [x] **1.11.1 Tree**
- [x] **1.11.2 Stone Node**
- [x] **1.11.3 Water Tile**
- [x] **1.11.4 Grass Tuft**
- [x] **1.11.5 Ground Tile**
- [x] **1.11.6 Boundary Wall**

---

### 1.11.1 Tree

**Visual:** see §1.10 — brown cylinder trunk + green icosahedron/cone foliage. Depleted state = **stump** (short brown cylinder, no foliage), permanent visual marker that "this area was harvested."

**Stats:**

| Yield/trip | Trips total | Yield total | Time/trip (1 worker) | Respawn |
|---|---|---|---|---|
| 5 wood | 4 | 20 wood | ~20s | none |

**Interaction:**
- Wood Worker walks adjacent → swings axe 1×/sec for 5s → trip counter -1 → walks back to drop 5 wood.
- Tree dies when trip counter hits 0 → mesh swapped to stump.
- **1 worker per tree at a time.** Other workers pick the next nearest live tree.
- Not a combat target — projectiles do not damage trees, only chop trips deplete them.

**Pathfinding:**
- **Live tree:** blocks walking + blocks projectiles (full collider).
- **Stump:** blocks nothing (walked over freely; arrows pass through).

**Rules:**
- No regrowth — locked V1 design pillar.
- No HP semantics — depletes by trip counter only.
- Tree placement = procedural cluster scatter per §1.3 (5–15 clusters, 5–15 trees each).

**JSON archetype:**
```json
{
  "type": "tree",
  "yield": { "resource": "wood", "perTrip": 5, "tripsTotal": 4 },
  "depletedState": "stump",
  "blocks":              { "walking": true,  "projectiles": true  },
  "blocksWhenDepleted":  { "walking": false, "projectiles": false },
  "respawn": false,
  "concurrentHarvesters": 1,
  "combatTarget": false,
  "visual": {
    "alive":    { "trunk": "see §1.10", "foliage": "see §1.10" },
    "depleted": { "stump": "short brown cylinder, no foliage" }
  }
}
```

---

### 1.11.2 Stone Node

**Visual:** see §1.10 — cluster of 2–4 gray icosahedrons. Depleted state = **rubble** (smaller, cracked icosahedrons, same footprint), permanent.

**Stats:**

| Yield/trip | Trips total | Yield total | Time/trip (1 worker) | Respawn |
|---|---|---|---|---|
| 5 stone | 10 | 50 stone | ~30s | none |

**Cluster vs node:** the **whole cluster** = 1 node. The 2–4 visible rocks share one trip counter (not 50 stone per rock).

**Interaction:**
- Stone Worker walks adjacent → swings pickaxe 1×/sec for 5s → trip counter -1 → drops 5 stone.
- Node depletes → mesh swapped to rubble.
- **1 worker per node at a time.**
- Not a combat target — only mining trips deplete.

**Pathfinding:**
- **Live node:** blocks walking + blocks projectiles.
- **Rubble:** blocks nothing.

**Rules:**
- No respawn — locked V1 design pillar (scarcity drives outward expansion).
- No HP — trip counter only.
- Procedural cluster scatter per §1.3 (3–8 clusters, each cluster = 1 node with 2–4 visible rocks).

**JSON archetype:**
```json
{
  "type": "stone_node",
  "yield": { "resource": "stone", "perTrip": 5, "tripsTotal": 10 },
  "depletedState": "rubble",
  "blocks":              { "walking": true,  "projectiles": true  },
  "blocksWhenDepleted":  { "walking": false, "projectiles": false },
  "respawn": false,
  "concurrentHarvesters": 1,
  "combatTarget": false,
  "visual": {
    "alive":    "see §1.10 (2–4 icosahedrons #8B8989)",
    "depleted": "smaller cracked icosahedrons, same footprint"
  }
}
```

---

### 1.11.3 Water Tile

**Visual:** see §1.10 — PlaneGeometry, #4A90E2 with 0.7 alpha. **Single tile type** — rivers, the outer moat, and inland lakes all share the same water tile. Visual variation comes from neighbor count (shore edges) and the optional sine-wave displacement, not from sub-types.

**Stats:** none — water has no yield, no HP, no depletion.

**Interaction:**
- **Blocks** all living beings (workers, soldiers, King, zombies) **except Scout and Slinger**.
- **Allows** all 4 vehicles (Buggy, War Truck, Heavy Carrier, Storage Cart).
- **Swimmers** (Scout, Slinger) move at **0.5× speed** while inside a water tile.
- **Vehicles** move at **1.0× speed** in water (no penalty — vehicles are the "owns water" answer).
- **Side-effect (locked):** zombies are living beings → cannot swim → water is a strategic retreat zone for Scout/Slinger when chased. This emerges from the rule, no special-casing.

**Pathfinding:**
- **Non-swimmers:** tile is impassable (treated as wall during path search; pathfinder must route around).
- **Swimmers:** tile is passable with 0.5× speed multiplier.
- **Vehicles:** tile is passable with 1.0× speed multiplier.
- **Projectiles:** ignore water tiles entirely. Slinger arcs and Sharpshooter straight shots fly over.
- **Buildings:** cannot be placed on water tiles.

**Rules:**
- Indestructible.
- Not tillable — Farmer cannot create an Apple Farm Plot on water.
- Map placement: outer 5-tile moat ring (§1.4) + 2–4 inland lakes (§1.6) + 1–2 hand-placed Bezier rivers (§1.3).
- The hard invisible `boundary_wall` lives just past the outer moat edge — see §1.11.6.

**JSON archetype:**
```json
{
  "type": "water_tile",
  "passable": {
    "scout":   { "speedMul": 0.5 },
    "slinger": { "speedMul": 0.5 },
    "vehicle": { "speedMul": 1.0 },
    "default": false
  },
  "blocks": { "projectiles": false, "buildings": true },
  "tillable": false,
  "indestructible": true,
  "visual": "see §1.10 (PlaneGeometry, #4A90E2 alpha 0.7, optional sine displacement)"
}
```

---

### 1.11.4 Grass Tuft

**Visual:** see §1.10 — InstancedMesh of small crossed planes, #7CB342, ~5 instances per tile. Pure visual texture for the world.

**Stats:** none.

**Interaction:** **none.** No worker harvests it. No combat target. No resource value. Walked over freely.

**Pathfinding:**
- Zero collider — does not block walking, swimming, vehicles, or projectiles.
- Pathfinder ignores grass entirely.

**Rules:**
- Indestructible — no per-tuft state machine. Stays visible permanently even when units walk through it.
- Procedurally scattered everywhere on ground tiles (§1.10).
- Density falls off near base centers, denser further out (§1.6 density rule applies for visual atmosphere too).

**JSON archetype:**
```json
{
  "type": "grass_tuft",
  "decoration": true,
  "yield": null,
  "blocks": { "walking": false, "projectiles": false },
  "destructible": false,
  "trampled": false,
  "visual": "see §1.10 (InstancedMesh of crossed planes, #7CB342, ~5/tile)"
}
```

---

### 1.11.5 Ground Tile

**Visual:** see §1.10 — PlaneGeometry, #4A8B3A base green with vertex-color noise ±15% lightness. The visual variation is purely cosmetic; gameplay-wise every ground tile is identical.

**Stats:** none.

**Interaction:**
- Walkable by every living being and every vehicle (no speed modifier).
- Building footprints **snap-place** onto ground tiles (one tile = one footprint unit).
- Any ground tile is **tillable** by a Farmer → becomes a permanent Apple Farm Plot (see `[PHASE_2_ENTITIES.md §2.2.3]`). No hidden "fertile" flag — if it's ground and not water, it can be tilled.

**Pathfinding:**
- Fully passable for all entity types.
- No speed modifier.
- Projectiles ignore.

**Rules:**
- Indestructible — cannot be dug, excavated, or destroyed.
- Vertex noise is generated once at world-gen and stored in the seed; not a per-tile gameplay attribute.

**JSON archetype:**
```json
{
  "type": "ground_tile",
  "walkable": true,
  "buildable": true,
  "tillable": true,
  "blocks": { "walking": false, "projectiles": false },
  "speedMul": 1.0,
  "indestructible": true,
  "visual": "see §1.10 (PlaneGeometry, #4A8B3A, vertex noise ±15%)"
}
```

---

### 1.11.6 Boundary Wall

**Visual:** see §1.10 — invisible BoxGeometry collider, 1 tile thick, 5 units tall. No mesh material is applied; the player never sees it directly. Visual feedback comes from the water moat fading dark/grey at its outer edge (§1.4).

**Stats:** none.

**Interaction:** none — entities walking, swimming, or driving into it simply stop. Projectiles striking it are absorbed (no leaving the map).

**Pathfinding:**
- **Blocks all entities:** workers, soldiers, King, zombies, vehicles, swimmers.
- **Blocks all projectiles:** Slinger arcs, Sharpshooter shots, mounted vehicle weapons.
- Treated as a hard wall by every pathfinder query.

**Rules:**
- Indestructible.
- Spawned procedurally by `BoundarySystem` at world-gen — not authored per tile by a designer.
- Placed exactly 1 tile past the outer moat edge on all 4 sides (§1.4 ring layout).
- Single archetype, one instance per side (4 segments total per map), each segment sized to map width/height.

**JSON archetype** (per-side, not per-tile):
```json
{
  "type": "boundary_wall",
  "visible": false,
  "geometry": { "thicknessTiles": 1, "heightUnits": 5 },
  "blocks": {
    "walking": true,
    "swimming": true,
    "vehicles": true,
    "projectiles": true
  },
  "destructible": false,
  "spawnedBy": "BoundarySystem",
  "instancesPerMap": 4
}
```

---

## Changelog (Phase 1 only)

- **2026-04-27** — Phase 1 (Environment) opened for design discussion.
- **2026-04-27 (later)** — Phase 1 locks: map size **per-level** (L1 80², L2 120², L3 160²), generation **hybrid** (hand-placed bases + zombie spawns + 1–2 rivers; procedural trees/stones/grass), boundary **water moat** (5 tiles thick, hard wall just past outer edge). File structure proposal added.
- **2026-04-27 (eve)** — **Phase 1 fully locked**: inland lakes yes (2–4 procedural per map), acceptance criteria confirmed, per-element visual specs (geometry/size/color) tabulated in §1.10.
- **2026-04-28** — TODO flagged: Environment Element Cards needed at the same depth as Worker Cards in `[PHASE_2_ENTITIES.md §2.2]`.
- **2026-04-28 (later 2)** — **Phase 1.11 backfill LOCKED.** All 6 Environment Element Cards written: §1.11.1 Tree (trip-counter not HP, 4 trips × 5 wood, stump remains, blocks walking + projectiles), §1.11.2 Stone Node (cluster = 1 node, 10 trips × 5 stone, rubble remains), §1.11.3 Water Tile (single type, 0.5× swim for Scout/Slinger, 1.0× vehicles, projectiles fly over — emergent side-effect: zombies can't swim → water = strategic retreat zone), §1.11.4 Grass Tuft (indestructible decor, no collider), §1.11.5 Ground Tile (any non-water tile is tillable, no hidden fertile flag), §1.11.6 Boundary Wall (invisible BoxGeometry, blocks entities + projectiles, 4 segments per map).
- **2026-04-28 (split)** — Phase 1 content extracted from `IMPLEMENTATION_PLAN.md` into this file. §1.10 reordered to precede §1.11 (was inverted in the source). Cross-refs to Phase 2 sections updated to `[PHASE_2_ENTITIES.md §X]` form.
