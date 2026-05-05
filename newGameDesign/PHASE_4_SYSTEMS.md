# Phase 4 — Game Systems

> Detail file for Phase 4 of the V1 build plan. See `IMPLEMENTATION_PLAN.md` for the cross-phase index and `GAME_DESIGN.md` for the master V1 design.
>
> **Cross-references** — bare `§N.x` = within this file; `[PHASE_M_*.md §M.y]` = sibling phase doc; `[GAME_DESIGN.md §N.M]` = master design.
>
> **Status (2026-04-28): ✓ PHASE 4 FULLY LOCKED.** All 8 system categories (~25 individual systems) specced with mechanics + acceptance criteria. Phase 4 closes the design layer for V1; remaining phases are AI (§5 Competitor AI) and Polish (§6 UI/sounds/juice).

---

## 4.1 What This Phase Covers

The **live-mechanics layer** that brings the entity, environment, and building cards to life. Every Entity Card (Phase 2) and Building Card (Phase 3) defined WHAT a thing is; Phase 4 systems define HOW the world simulates them.

Each system produces a card at the same depth as Entity / Building cards: **Trigger / Inputs / State Machine / Outputs / JSON Config / Acceptance.**

---

## 4.2 System Roster

| # | Category | Systems planned |
|---|---|---|
| 4.3 | Input | Drag-to-Waypoint Controller |
| 4.4 | Movement | Pathfinding · Water Crossing · Vehicle Drive |
| 4.5 | Sensing | Zombie Sense · Soldier Sense · Worker Flee · Apple Silo Aura · Gate Auto-Open |
| 4.6 | Combat | Targeting · Attack Patterns · Projectile Flight · Counter Math · Knockback · Biker Charge · AoE Splash · Multi-Attacker Stacking |
| 4.7 | Lifecycle | Flag Spawn Queues · Construction · Repair · Eat · Starve · Die · Wreck |
| 4.8 | Economy | Worker Harvest Loop · Delivery Routing · Storage Cart Route Mode · Overflow Handling |
| 4.9 | AI Behaviors | Zombie Wander/Aggro · Worker Behavior Loops · Soldier Idle/Engage · Builder/Farmer Construction Loops |
| 4.10 | Apple Feeding (impl of §2.8) | Hunger Tick · Critical-HP Trigger · Eat Sequence · Interruption · Combat Gate · Starvation Damage |

**Design dependency order** (we'll fill system cards in this order):

```
Input → Movement → Sensing → Combat → Lifecycle → Economy → AI → Apple Feeding
```

Each later category builds on earlier ones (e.g., Combat needs Movement + Sensing; AI needs all of them).

---

## 4.3 Drag-to-Waypoint Controller (LOCKED — 2026-04-28)

The **universal input system.** Drag-to-release is the ONLY way the player commands entities — no joystick, no WASD, no click-to-move (locked design pillar in `CLAUDE.md`).

### 4.3.1 Two modes

**Mode A — Single-entity drag (1-step):**

```
[player presses on entity tile] ──drag──▶ [release at destination]
                                            │
                                            ▼
                              entity auto-pathfinds shortest walkable path
                              and walks there.
```

Used for: King, individual workers/soldiers, single vehicle.

**Mode B — Multi-entity group drag (2-step):**

```
Step 1: [player selects multiple entities — box-drag / tap-add per existing impl]
Step 2: [drag from any selected entity OR the group center] ──▶ [release]
                                                                  │
                                                                  ▼
                                              ALL selected entities auto-pathfind
                                              to release point. Each takes its own
                                              optimal path. Arrival order = speed.
```

Used for: moving a squad of soldiers, sending multiple workers to a new harvest area, etc.

### 4.3.2 Path interpretation

The drag-end is the **TARGET**, not the path. Entity does NOT trace the drawn line.

- Auto-pathfinds the **shortest walkable connected path** from current position to drag-end.
- Pathfinder routes around natural obstacles (trees, stone nodes, water for non-swimmers).
- For zombies and walls: per §2.5 (zombies hammer walls, no A* around them). For everything else: walls are routed around (find a Gate, or the nearest open path).

### 4.3.3 Drag-end on impassable tile

If the drag-end is on a tile the entity cannot walk to (e.g., water for non-swimmer, inside a wall, on a tree):

- **Pathfinder searches for any connected walkable path to the drag-end.**
  - If found (e.g., entity can route around the river via a bridge or the long way): entity takes it, even if longer.
- **If no connected path exists** (drag-end is genuinely unreachable):
  - Entity walks along the shortest unobstructed line toward the drag-end.
  - Stops at the **first blocker** (1 tile before water edge, in front of wall, beside tree, etc.).
  - No teleport, no retry — just stops where it hit the wall.

```
Example — Worker dragged across river with no bridge nearby:

    [Worker] ───────▶  ░░░░░░ RIVER ░░░░░░  ← drag-end here
              walks                            (impassable)
              this far                       
              ──────▶ [STOP]                  ← stops at river edge
```

```
Example — Worker dragged across river WITH a bridge:

    [Worker] ───────▶  ░░░ RIVER ░░░  ← drag-end here
                       bridge ↓
                                       ← pathfinder finds the bridge,
                                         entity walks the long way.
```

### 4.3.4 Drag interruption / overrides

| Event | Behavior |
|---|---|
| Entity dies mid-drag | Drag cancelled cleanly. No ghost destination. |
| New drag issued on a walking entity | New destination overrides immediately. |
| One unit of a group drag dies | The rest continue to their destination. |
| Player aborts drag (release before any movement) | No-op. Entity keeps prior task. |

### 4.3.5 Camera behavior during long-distance drag

When the drag finger reaches the screen edge, the camera **pans to follow** the drag position. Allows commands beyond the current viewport without a separate camera move (per existing commit `00ed3bc` — "draggable command for long distance working").

Two-finger pan / pinch-zoom is a **separate gesture** (per existing commit `34c74a8` — "two finger touch map navigation"). The drag-to-waypoint single-finger drag does NOT conflict with the two-finger camera control.

### 4.3.6 Visual feedback

- Glowing line from entity (or group center) to current drag-finger position while drag is active.
- Color / style per existing implementation.
- On release: line fades out; entity transitions to `walk` animation per §2.7.

### 4.3.7 What can be dragged

| Entity type | Draggable? | Mode |
|---|---|---|
| King | Yes | both |
| All workers (5 types) | Yes | both |
| All soldiers (5 types) | Yes | both |
| Zombies | No (player doesn't control) | — |
| All vehicles (4 types, including Storage Cart) | Yes | both |
| Buildings | No | — |
| Environment elements (trees, stones, water, etc.) | No | — |
| Flag | No (cannot be moved per §3.3.1) | — |

Vehicles boarded with troops: dragging the vehicle moves it; troops aboard come along automatically.

### 4.3.8 JSON config (per archetype)

Every entity archetype gets a `drag` block:

```json
{
  "drag": {
    "draggable": true,
    "selectMode": "both",
    "pathfind": "shortest_walkable_connected",
    "impassableFallback": "walk_until_first_blocker",
    "newDragOverridesPrevious": true,
    "cancelOnDeath": true
  }
}
```

Defaults per category:
- Living beings (workers, soldiers, King): `draggable: true, selectMode: "both"`.
- Vehicles: `draggable: true, selectMode: "both"`.
- Zombies: `draggable: false` (AI-controlled).
- Buildings, environment, Flag: `draggable: false`.

### 4.3.9 Existing implementation references

- `00ed3bc` — draggable command for long-distance working (camera follow during long drag).
- `084813c2` — feat(player): enable drag-to-waypoint, disable joystick / WASD input.
- `34c74a8` — two-finger touch map navigation first version.
- `72e98ca` — map zoom in/out with navigation.

When implementing Phase 4, **document existing behavior first**, then design any gaps (multi-entity group drag, zombie wall-hammer pathfind exception, etc.).

### 4.3.10 Acceptance criteria

- [ ] Single-entity drag: drag from entity → entity walks shortest path to release point.
- [ ] Multi-entity drag: select group → drag → all walk to release point along their own optimal paths.
- [ ] Drag-end on impassable tile (water, wall, tree): entity walks as far as it can; if a connected detour exists, takes it; if not, stops at first blocker.
- [ ] Pathfinder routes around natural obstacles (trees, stones, water for non-swimmers).
- [ ] New drag overrides previous destination immediately.
- [ ] Drag cancelled cleanly if entity dies mid-walk.
- [ ] Camera follows drag finger near screen edge (long-distance drag works).
- [ ] Joystick / WASD / click-to-move are disabled.
- [ ] Drag works on touch + mouse.
- [ ] Two-finger pan / pinch-zoom does NOT conflict with single-finger drag.
- [ ] Buildings, Flag, environment, zombies are NOT draggable.
- [ ] Boarded troops travel with their vehicle on drag.

---

---

## 4.4 Movement (LOCKED — 2026-04-28)

3 sub-systems: pathfinding, water crossing, vehicle drive.

### 4.4.1 Pathfinding

**Algorithm:** **Grid A*** on the tile grid (1 tile = 1 node, per `[PHASE_1_ENVIRONMENT.md §1.5]`).

**Per-tile walkability table** (the predicate the pathfinder calls per tile):

| Tile / object | Default | Per-entity overrides |
|---|---|---|
| Ground | walkable | always |
| Grass tuft | walkable | always (pure decor) |
| Stump / rubble | walkable | always (depleted nodes don't block) |
| Spawn platform halo (around Flag) | walkable | always |
| Roof | walkable (passing under) | always |
| Water | impassable | Scout/Slinger 0.5× speed; vehicles 1.0× speed |
| Live tree | impassable | universal blocker (incl. zombies route around) |
| Live stone node | impassable | universal blocker |
| Wood / Stone Wall | impassable | **Zombies hammer through** at 3 DMG/hit (per §2.5); non-zombies route around |
| Gate (closed) | impassable | friendly approach triggers auto-open (§4.5); enemies hammer like a wall |
| Gate (open) | walkable | only during the friendly-approach window |
| Boundary wall | impassable | universal hard block |
| Silo / Vault / Hut / Farm Plot | impassable | route around (per §3.2) |
| Flag center (3×3) | impassable | only the 1-tile platform halo is walkable |

**Recompute trigger (event-driven, locked MP-2 = C):**

A path is re-checked **only when** one of these events fires:
- A wall / gate / roof in the entity's current path is **destroyed**.
- A new wall / gate / roof is **built across** the path.
- For chasing entities (zombies aggro on a living being): the target has **moved > 2 tiles** since the last compute.
- The entity gets a **new drag-to-waypoint** (overrides previous path immediately).

Otherwise the entity walks its original path uninterrupted. No periodic recompute, no per-frame check.

**Group movement (locked MP-3 = A):**

Multi-selected entities pathfind **independently**. Each finds its own optimal path to the same drag-end. Arrival order = each entity's `moveSpeed`. They fan out at the destination, settling into adjacent walkable tiles. No formation logic in V1.

**Performance budget (locked MP-4 = B):**

- **Cap of 8 concurrent pathfind computations per frame.**
- Excess pathfind requests **queue FIFO** and process on later frames.
- Practical impact: when 30 zombies need to recompute (e.g., a key wall just broke), the work spreads over ~4 frames at 60 FPS — imperceptible.

**Dynamic-obstacle handling (baked default):**

- The pathfinder treats only **static blockers** as walls (terrain, water, walls/gates/roofs, boundaries, buildings, live trees/stones).
- Other moving / stationary **entities are NOT pathfind obstacles** — pathfinder sees right through them.
- Tile-occupancy collisions (e.g., §2.5 "zombies don't overlap on same tile") are resolved by **local steering** at the render layer — entities gently nudge apart when they would overlap.
- Tradeoff: an entity may path through a tile that's currently occupied, then nudge around on arrival. Acceptable for V1; cleaner solution deferred to V2.

**JSON config (per-archetype `pathfind` block):**

```json
{
  "pathfind": {
    "algorithm": "grid_a_star",
    "walkable": {
      "ground": true,
      "grass": true,
      "stump": true,
      "rubble": true,
      "platformHalo": true,
      "rooftop": true,
      "water": false,
      "treeAlive": false,
      "stoneAlive": false,
      "wall": false,
      "gateClosed": false,
      "boundary": false,
      "building": false,
      "flagCenter": false
    },
    "speedMul": {
      "ground": 1.0,
      "water": 0
    },
    "wallBehavior": "route_around"
  }
}
```

Per-archetype overrides:
- **Scout / Slinger:** `walkable.water: true`, `speedMul.water: 0.5`.
- **All vehicles:** `walkable.water: true`, `speedMul.water: 1.0`.
- **Zombies:** `wallBehavior: "hammer_through"` instead of `"route_around"`. Per `[PHASE_2_ENTITIES.md §2.5]`.

### 4.4.2 Water Crossing

Applies the rules from `[PHASE_1_ENVIRONMENT.md §1.11.3]` at pathfind-time. No new logic — the pathfinder consults each entity's `pathfind.walkable.water` and `pathfind.speedMul.water` fields.

| Entity | Water passable? | Speed multiplier |
|---|---|---|
| Workers (5 types), Bruiser, Sharpshooter, Biker, King, Zombie | No | — |
| **Scout, Slinger** | Yes | **0.5×** |
| **All 4 vehicles** | Yes | **1.0×** |

Projectiles fly freely over water — they're not pathfinding entities and are unaffected.

### 4.4.3 Vehicle Drive

**Auto-pilot:** vehicles share the standard pathfinder (no driver slot, no separate driving logic). Drag-to-waypoint command → A* → vehicle walks the path. Per-archetype overrides handle the "all vehicles cross water at 1.0×" rule.

**Stop behavior at waypoint (locked MV-1 = A):**
- Vehicle stops **dead** at the destination tile.
- Wheels stop instantly. No deceleration curve, no inertia tail.
- Engine transitions to `idle` animation per §2.6 animation table.

V1 simplicity. Realistic deceleration deferred to Phase 6 polish.

**Mounted weapon during movement:**
- Already locked in `[PHASE_2_ENTITIES.md §2.6]` shared block — fires at nearest enemy in range while idle AND while driving.
- Boarded troops also fire from their own range during travel.

**Wheel rotation:**
- Rate scales with current `moveSpeed`.
- Stops instantly when the vehicle stops (no inertia decay).

**Dust trail:**
- Particle effect spawns behind the vehicle while moving; stops on stop.
- Cosmetic — can be skipped in initial impl, added in Phase 6 polish.

### 4.4.4 Acceptance criteria

- [ ] A* pathfinder routes around live trees, live stone nodes, water (for non-swimmers), walls (for non-zombies).
- [ ] Scout / Slinger walk into water at 0.5× speed; reach the other side.
- [ ] All 4 vehicles drive through water at 1.0× speed.
- [ ] Workers, non-swimmer soldiers, King, zombies stop at the water edge.
- [ ] Zombies hammer walls at 3 DMG/hit instead of routing around (per §2.5).
- [ ] Non-zombies route around walls (find a Gate or the long way around).
- [ ] Path recomputes when a wall in the path is destroyed (test: zombie breaks worker's escape wall → worker re-routes).
- [ ] Path recomputes when a new wall is built across the path.
- [ ] Path recomputes when a chase target has moved > 2 tiles.
- [ ] No path recompute on every frame (CPU profile clean).
- [ ] Group drag of 5 entities — all reach destination, fan out into adjacent tiles in arrival order.
- [ ] Concurrent pathfind cap of 8 prevents frame spikes (test: destroy a key wall while 30 zombies are pathfinding).
- [ ] Vehicles stop hard at the waypoint tile (no easing in V1).
- [ ] Wheel rotation scales with SPD; stops instantly on vehicle stop.
- [ ] Local steering nudges overlapping entities apart at render time (no pathfinder slowdown from dynamic obstacles).

---

## 4.5 Sensing (LOCKED — 2026-04-28)

5 radius-based detection sub-systems. All target/action behaviors are locked in their source entity/building cards; this section specs only the **detection mechanics** layer.

### 4.5.1 Shared Detection Mechanics

**Tick rate (locked S-1 = A):**
- All sensors poll at **10 Hz** (every 6 frames at 60 FPS).
- 100 ms latency — imperceptible for combat, sense, aura, and gate behaviors.

**Detection method (locked S-2 = A):**
- **Naive O(n × m)** — for each active sensor, iterate all entities of the target type, distance-check.
- With ≤200 active entities (60 zombies + 50 friendlies + buildings), max 40 k checks/tick × 10 Hz = ~400 k checks/sec. CPU budget acceptable for V1.
- Spatial-grid bucketing is a V2 optimization if profiling shows need.

**Range shape (locked S-3 = A):**
- **Circular (Euclidean):** target is within range when `sqrt(dx² + dy²) ≤ radius`.
- All "X-tile sense radius" / "X-tile aura" values in the design docs are interpreted this way.
- Edge case: target tile center vs sensor tile center (no half-tile rounding).

**On detection:**
- Sensor fires its action (aggro / engage / flee / heal / open). Action specifics are per-sub-system below.
- Multiple sensors can detect the same target (e.g., 5 zombies all sense the same worker). Each sensor independently triggers its action.

**Sensor lifecycle:**
- Sensors come online when the entity/building is **active** (after construction, after spawn).
- Sensors are paused while the entity is in `die`/`wreck`/`destroyed` state.
- The Apple Silo aura is **paused** when the silo is empty (zero apples in stock) — no heal ticks until restocked.

### 4.5.2 Zombie Sense

Per `[PHASE_2_ENTITIES.md §2.5]` and `[GAME_DESIGN.md §3.5]`.

| Property | Value |
|---|---|
| Radius | **8 tiles** circular |
| Target type | living beings only — workers, soldiers, King, troops aboard a manned vehicle, rival villagers |
| Action on detect | switch zombie state from `wander` to `aggro_target`; pathfind to the target |
| Action on lose | target leaves 8-tile radius → return to `wander` at current location |
| Aggro priority on multiple targets | 1) closest; 2) prefer worker on tie |
| Manned vehicle handling | sensed via troops aboard; treat hull as wall (3 DMG/hit) until breached |
| What zombies do NOT sense | walls, buildings, empty vehicles, dropped resources, stored apples, trees, stones |

### 4.5.3 Soldier Sense

Per `[PHASE_2_ENTITIES.md §2.3 Shared Soldier Behavior]`.

| Property | Value |
|---|---|
| Radius | **6 tiles** circular, centered on soldier's current waypoint |
| Target type | enemies — zombies + rival soldiers |
| Action on detect | walk toward target → engage → fight per attack pattern (§4.6) |
| Action on target down or out of circle | **return to waypoint** (not pursue further) |
| Active condition | only when soldier is **idle at waypoint** (not en route) — see §4.3.4 movement-vs-combat priority |
| En-route exception | soldier engages an attacker if attacked en-route (defensive), but does not detour for sensed enemies |

### 4.5.4 Worker Flee

Per `[PHASE_2_ENTITIES.md §2.2.1]` and `[GAME_DESIGN.md §13.9]`.

| Property | Value |
|---|---|
| Radius | **6 tiles** circular |
| Target type | zombies (only — workers don't flee from rival soldiers in V1; they're not aware of PvP) |
| Action on detect | switch worker state to `flee` → walk toward nearest wall/building/Flag for cover |
| Action on safe | when no zombie is in 6 tiles → resume work loop from where left off (re-pathfind to nearest live tree / stone / pool / ghost) |
| Last-resort melee | if cornered (no flee path), worker fights with DMG 2 (per §2.2.1) |

### 4.5.5 Apple Silo Aura

Per `[PHASE_3_BUILDINGS.md §3.3.4]`.

| Property | Value |
|---|---|
| Radius | **5 tiles** circular, centered on silo |
| Target type | friendly living units only — workers, soldiers, King |
| Action per tick | for each target with `HP < maxHP`: heal **+0.1 HP per tick** (1 HP/sec at 10 Hz) |
| Cost | **0.01 apple per tick** per target healing (1 apple per 10 HP — 1 silo apple per second of full healing) |
| Aura inactive when | silo apple stock is 0 |
| Excludes | vehicles, buildings, zombies, rival units |

**Per-tick math:**
- 10 friendly units in aura, all wounded → 10 × 0.1 HP = 1 HP/tick distributed; silo loses 10 × 0.01 = 0.1 apple/tick = 1 apple/sec.
- Numbers small enough that fractional accumulators are safe (V1).

### 4.5.6 Gate Auto-Open

Per `[PHASE_3_BUILDINGS.md §3.3.9]`.

| Property | Value |
|---|---|
| Radius | **1 tile** Euclidean (effectively the 4 orthogonally-adjacent + 4 diagonally-adjacent tiles within `sqrt(2) ≈ 1.41`, so radius 1 catches orthogonal only — gate opens when a friendly is in any orthogonal-adjacent tile and approaching toward the gate) |
| Target type | friendly entities — workers, soldiers, King, friendly vehicles |
| Action on detect | trigger `open` animation; set tile `walkable: true`; allow any unit (incl. zombies) to pass during the open window |
| Action on lose | when no friendly is in 1 tile → trigger `close` animation; set tile `walkable: false` (blocks movement, attackable as wall) |
| Detection cadence | 10 Hz uniform — opens / closes within 100 ms of approach |
| Risk | open gate lets enemies through too — strategic tradeoff for the player |

### 4.5.7 Acceptance criteria

- [ ] Zombies aggro on living beings within 8-tile circular radius (test: place worker 8 tiles from zombie spawn → zombie picks worker as target).
- [ ] Zombies do NOT aggro on walls, empty vehicles, silos, or dropped resources (test: zombie passes by an empty Buggy without attacking).
- [ ] Soldiers engage enemies within 6-tile circle of their waypoint, return after target down (test: drop Sharpshooter at waypoint → zombie enters 6-tile range → Sharpshooter shoots → zombie dies → Sharpshooter returns).
- [ ] Workers flee zombies at 6 tiles, run to nearest wall/building (test: worker chopping tree → zombie enters 6 tiles → worker drops chop, runs to nearest wall).
- [ ] Apple Silo aura heals friendlies within 5 tiles at 1 HP/sec; consumes 1 apple per 10 HP healed.
- [ ] Aura turns off when silo apple stock = 0; resumes when restocked.
- [ ] Gate opens within 100 ms of friendly entering 1-tile radius; closes within 100 ms of leaving.
- [ ] All sensors run at 10 Hz uniform tick rate.
- [ ] Sensor tick CPU stays under budget with 200 entities + 60 buildings (profile check).

---

## 4.6 Combat (LOCKED — 2026-04-28)

8 combat sub-systems. Most behaviors are locked in `[PHASE_2_ENTITIES.md §2.2–§2.6]` cards; this section fills in the **system mechanics** layer.

### 4.6.1 Targeting

Each unit type has its own targeting priority:

| Unit | Priority order |
|---|---|
| **Zombie** | 1) closest living being in 8-tile sense; 2) prefer worker on tie; 3) entity ID tiebreak |
| **Soldier** (idle at waypoint) | 1) closest enemy in 6-tile sense; 2) **prefer counter-target on tie** (locked C-1=B); 3) entity ID tiebreak |
| **Soldier** (en-route to new waypoint) | does NOT detour; engages only if attacked, target = the attacker |
| **Vehicle mounted weapon** | 1) closest enemy in mounted range; 2) entity ID tiebreak |
| **Boarded troop** | each troop fires their own attack at THEIR own range, target picked individually using soldier rules from the vehicle's position |
| **Worker** (cornered melee, last-resort only) | the cornering zombie |
| **King** (retaliate-only) | the entity that last attacked the King |

### 4.6.2 Attack Patterns

| Pattern | Used by | Range | Notes |
|---|---|---|---|
| **Melee** | Scout, Bruiser, Biker, King, Worker (last-resort), Zombie | 1 tile | mid-swing impact, animation in §2.7 |
| **Arc projectile** | Slinger | 4 tiles | parabolic; clears 1-tile obstacles |
| **Straight projectile** | Sharpshooter, Buggy mount, War Truck mount | 4–8 tiles per unit | line-of-sight; blocked by walls/trees/buildings |
| **AoE splash** | Heavy Carrier mount | 6 tiles | 1-tile splash around primary; no falloff; no friendly fire |

**Attack tick:**
- Each unit has a private cooldown timer = `1.0 / atkSpeed` seconds.
- On cooldown reset, if a target exists in range, fire the attack:
  1. Trigger `attack` animation (0.15s — see §2.7).
  2. **At mid-swing impact frame (locked C-2=A)**: compute and apply damage (or fire projectile).
  3. Reset cooldown.
- Cooldown halts when no target in range; resumes when one re-enters.

### 4.6.3 Projectile Flight

**Speed (locked C-3=B): 10 tiles / second** for all projectiles (arc + straight + mounted).

**Targeting (locked C-4=B): fire-and-forget.**
- At fire time, the projectile is launched along the line/arc from shooter to **target's position at fire moment**.
- Projectile flies the locked trajectory regardless of where the target moves.
- If the target sidesteps, projectile misses (passes through the empty tile and dies on the first wall/blocker or after max range).

**Arc projectile (Slinger):**
- Parabolic trajectory from shooter to fire-time target tile.
- Apex height = ~1.5 tiles (clears 1-tile obstacles per §2.3.2).
- Hits the first valid target on the descent into the destination tile.
- Blocked by full-height walls and live trees. Clears low fences (V2 — none in V1).

**Straight projectile (Sharpshooter, vehicle mounts):**
- Horizontal line from shooter to target tile.
- Hits the **first blocker** along the line: wall, gate, tree, building, boundary wall, OR target unit.
- Passes through water tiles, grass tufts, stumps, rubble (per §1.11 cards).

**AoE splash (Heavy Carrier):**
- Primary projectile travels straight (same as Sharpshooter).
- On impact, applies damage to primary target AND all **enemy** entities within 1-tile Euclidean splash radius.
- No falloff (full damage to all in radius). **No friendly fire** — splash skips friendly entities.

**Sample flight times:**
- Slinger to 4-tile target: 0.4s.
- Sharpshooter to 8-tile target: 0.8s.
- Heavy Carrier to 6-tile target: 0.6s.

### 4.6.4 Counter Math

Damage formula (locked):

```
final_damage = base_damage
             × counterMul    (1.5 if attacker's archetype counters target's archetype, else 1.0)
             × chargeMul     (2.0 if attacker is Biker AND this is first hit on this target, else 1.0)
             × splashMul     (1.0 — splash hits in V1 take same damage as primary)
```

**Counter rules:**
- Computed at **attack-commit time** (fire moment for ranged; swing-start for melee).
- Applies **only vs enemy soldiers** (per locked Q-shared.2). Counter bonus does **NOT** apply vs zombies. Zombies always take 1.0× damage from counters.
- Counter pairs per `[GAME_DESIGN.md §13.2]`:

```
Scout       counters    Biker
Slinger     counters    Scout
Sharpshooter counters    Bruiser
Bruiser     counters    Slinger, Scout
Biker       counters    Sharpshooter, Slinger
```

- Symmetric: if A counters B, B's damage to A is **0.5×** (effectively, by the inverse) — actually no, only the **counterer** gets the 1.5× bonus. The counter target deals normal 1.0× back. (Per locked design — bonus goes to the countering attacker only.)

### 4.6.5 Knockback (Bruiser)

- Triggered at the damage-impact frame of every successful Bruiser hit.
- Direction: **directly away from Bruiser** (along the shooter→target axis).
- Distance: **1 tile** (per §2.3.4).
- Push-tile validation:
  - If the push-tile is walkable: target moves there, animation plays.
  - If the push-tile is impassable (wall, water for non-swimmer, another unit, tree, etc.): target stays put (no extra damage, no chain push, no overlap).
- Knockback is **not stackable** — multiple Bruisers all hitting at once each apply 1-tile push toward their own opposite, but the engine resolves only the first valid push per frame (locked V1 — avoids physics stacking).
- Useful for pinning zombies against walls or breaking enemy formations.

### 4.6.6 Biker Charge ×2

- Each Biker tracks a private `currentChargeTargetId` (initially null).
- On every hit by this Biker:
  - If `target.id != currentChargeTargetId`:
    - Apply **2× base damage** (the charge-hit bonus).
    - Set `currentChargeTargetId = target.id`.
  - Else (subsequent hits on same target): apply 1× base damage.
- Switching focus to a different target resets the charge — the next attack on the new target gets the 2× bonus.
- Charge bonus stacks with counter: Biker hitting Sharpshooter for first time = 2× × 1.5× = **3× damage** on that hit.
- Charge bonus stacks multiplicatively with knockback (irrelevant — knockback isn't damage).
- Disengaging (target dies, Biker dragged elsewhere) clears `currentChargeTargetId` for next engagement.

### 4.6.7 AoE Splash (Heavy Carrier)

- Heavy Carrier's mounted weapon = 20 DPS at 6-tile range with 1-tile splash radius around primary target.
- On hit:
  1. Primary target takes full 20 base damage (× counter / charge as above).
  2. Find all enemies within 1-tile Euclidean radius of the primary's tile.
  3. Each enemy in splash takes the same 1.0× of base damage (no falloff, no counter applied to splash hits — splash damage is 1.0× flat).
  4. Friendly entities in splash are **untouched** (no friendly fire in V1).
- Practical: hitting a clustered group of 4 zombies = 4 × 20 = 80 total damage per shot. Heavy Carrier shines vs hordes.

### 4.6.8 Multi-Attacker Stacking

- Max **4 simultaneous attackers per target** (any combination of zombies, soldiers, Bikers, Bruisers).
- Each potential target maintains a `currentAttackers: Set<entityId>` (max size 4).
- Attack attempt logic:
  - When attacker A wants to engage target T:
    - If `T.currentAttackers.size < 4`: A is added, attack proceeds.
    - Else: A enters `queue_for_target_T` state — walks to within 2 tiles of T and waits.
  - When an attacker leaves (target dies / out of range / re-targets): slot opens. The closest queued attacker takes the slot.
- Ranged attackers (Slinger, Sharpshooter, mounted) **do not occupy slots** — multiple ranged attackers can fire at the same target unconstrained.
- Slots apply only to melee/contact attackers.

### 4.6.9 Damage Application Pipeline

For every attack hit, the engine processes in this order:

```
1. Compute final_damage (§4.6.4 formula).
2. Apply to target: target.hp -= final_damage.
3. Trigger feedback: damage flash animation, hit particle, sound (Phase 6 polish).
4. Check derived effects:
   a. Knockback (if Bruiser hit) — §4.6.5
   b. Charge tracking (if Biker hit) — §4.6.6
   c. AoE splash (if Heavy Carrier hit) — §4.6.7
5. Check death: if target.hp <= 0 → trigger die / wreck transition (§4.7 Lifecycle).
```

### 4.6.10 Acceptance criteria

- [ ] Soldiers target the closest enemy in their 6-tile sense circle; on tie, prefer their counter target.
- [ ] Zombies target closest living being; prefer workers on tie.
- [ ] Damage applies at the mid-swing impact frame (test: pause animation at start vs mid-swing — damage only at mid).
- [ ] Slinger arc projectile travels 4 tiles in 0.4s; clears low obstacles; blocked by walls/trees.
- [ ] Sharpshooter straight shot blocked by walls / live trees / buildings; passes over water and stumps.
- [ ] Heavy Carrier shot deals 20 dmg to primary + 20 dmg to all enemies within 1-tile splash; friendlies in splash untouched.
- [ ] Counter bonus 1.5× applies only when shooting an enemy soldier (test: Scout vs Biker → 1.5×; Scout vs zombie → 1.0×).
- [ ] Bruiser hit pushes target 1 tile back; if push-tile impassable, target stays.
- [ ] Biker first-hit on a fresh target = 2× damage; second hit on same target = 1×.
- [ ] Biker switching to new target resets charge → 2× on next hit.
- [ ] Biker charge × counter stacks: 2× × 1.5× = 3× on first hit on counter target.
- [ ] Max 4 melee attackers per target; 5th queues at 2-tile distance.
- [ ] Ranged attackers don't occupy melee slots — multiple Sharpshooters fire on same target freely.
- [ ] Projectile fire-and-forget: target sidesteps a Sharpshooter shot → projectile passes through the vacated tile.
- [ ] Death triggers correctly when target.hp <= 0.

---

## 4.7 Lifecycle (LOCKED — 2026-04-28)

5 sub-systems: spawn queues, construction, repair, die, wreck. (Eat + Starve live in §4.10 Apple Feeding to avoid duplication.)

### 4.7.1 Flag Spawn Queues

Per `[PHASE_3_BUILDINGS.md §3.3.1]`. The Flag has 3 parallel queues running simultaneously: **Workers, Soldiers, Vehicles**.

**Player command UX:**
1. Player clicks the Flag.
2. Menu opens with 3 sub-menus (Workers / Soldiers / Vehicles).
3. Player clicks a unit type → 1 of that unit is added to its queue. Cost deducted at click time. Multiple clicks = multiple queued.
4. Each queue is FIFO, runs independently, no maximum queue length in V1.
5. Player can cancel a queued item by clicking it in the queue UI → cost refunded; item removed.

**Per-queue tick logic:**
- Each queue has a private `cooldownRemaining` timer (initially 0).
- Each frame, if `cooldownRemaining == 0` AND `queue.length > 0`:
  - Pop the first item.
  - Set `cooldownRemaining = item.buildTime`.
- Each frame, decrement `cooldownRemaining` by `deltaTime`.
- When `cooldownRemaining` hits 0 (just-built):
  - Spawn the unit at a random unoccupied tile in the **spawn platform halo** (1-tile ring around the 3×3 Flag = 16 candidate tiles).
  - Unit enters `idle` state; awaits drag.
  - Note: King is NOT spawned here — he exists from game start.

**Queue exception:**
- Cost deducted at queue-time. If player cancels before build starts → refund full cost.
- If player cancels after build starts (mid-cooldown) → refund full cost; building progress lost.
- If insufficient resources at click → click rejected, no queue add.

### 4.7.2 Construction

Per `[PHASE_3_BUILDINGS.md §3.2]` shared block.

**HP-accumulator model:**
- Each ghost has `buildHP = 0`, `buildHP_max = buildTime × 5`.
- Idle Builders scan every 1s for ghost sites (any building marked `state: ghost`).
- Closest ghost to each idle Builder is the target.
- Builder walks to ghost, then while **adjacent (1-tile range)**:
  - Applies `5 × stackCurve(adjacentBuilderCount)` HP/sec to `buildHP`.
  - Stack curve: 1×, 1.7×, 2.3×, 2.8×, 3.0× cap at 5+ Builders (§3.2).
- When `buildHP == buildHP_max`: ghost transitions to `state: active`. Mesh swaps from translucent ghost to final building.
- Builder returns to idle and re-scans for next ghost.

**Apple Farm Plot exception (§3.3.6):**
- **Farmer** handles construction, NOT Builder. Builders ignore Apple Farm Plot ghosts.
- Farmer applies 5 HP/sec via the same model (buildHP_max = 15 × 5 = 75).
- Farmer transitions from "till" → "plant seed" automatically when plot activates.

**Cost:**
- Building cost is deducted at **ghost placement** (not during construction).
- Cancel ghost before complete → resources refunded.
- Cancel ghost after partial construction → resources refunded; partial buildHP lost.

### 4.7.3 Repair

Per `[GAME_DESIGN.md §11.6]` and §13.10.

**Detection:**
- Builders scan every 1s for damaged buildings (any building with `currentHP < maxHP_after_construction`).
- **Priority (locked L-1 = A): nearest damaged building.**
- One Builder pursues one damaged building at a time; multiple Builders can converge on the same building (stack curve applies).

**Repair tick:**
- While Builder is adjacent (1-tile range):
  - Apply `5 × stackCurve(adjacentBuilderCount)` HP/sec to `currentHP`.
- Materials consumed proportionally:
  - Per-tick material cost = `(½ × original_build_cost / maxHP) × repair_HP_this_tick`.
  - Per-tick apple cost = `(1 / 50) × repair_HP_this_tick` (1 apple per 50 HP repaired, per §13.10).
- Material deduction:
  - If stockpile has the materials: deduct, repair proceeds.
  - If stockpile is **out**: repair **pauses** (Builder waits adjacent). Resumes the moment materials become available.
- When `currentHP == maxHP`: Builder returns to idle and re-scans.

**Repair example (Wood Wall, 200 HP, taken to 50 HP):**
- HP_missing = 150. Repair time at 1 Builder = 150 / 5 = 30s.
- Materials: ½ × 5 wood × (150 / 200) = ~1.9 → **2 wood (rounded up)**.
- Apples: 150 / 50 = **3 apples**.

### 4.7.4 Die (living beings)

For workers, soldiers, King, zombies. Triggered when `entity.hp <= 0`.

**Sequence:**
1. **Halt all entity systems** — sense, attack, hunger, pathfind, eat. Entity becomes inert.
2. **Trigger `die` animation** (1.0s active + 0.5s fade = 1.5s total per §2.7).
3. **At die animation start (frame 0) — locked L-2 = A:**
   - **Drop loot** per archetype:
     - **Zombie:** 1 liquid essence at death tile, 10-second decay timer starts (per §2.5.6).
     - **Worker / soldier / King:** nothing (locked Q4=B / KQ-rec — death drops nothing).
   - **If King died → trigger game-over screen.** Game state transitions to `loss`. No despawn for King's body until game-over screen accepts user input.
4. After 1.5s (non-King): despawn entity from world.

**Visual feedback:**
- Damage flash on hit (Phase 6 polish).
- Hit particle (Phase 6).
- Death sound (Phase 6).

### 4.7.5 Wreck (vehicles)

For Buggy, War Truck, Heavy Carrier, Storage Cart. Triggered when `vehicle.hp <= 0`.

**Sequence:**
1. **Halt all vehicle systems** — mounted weapon, drive, pathfind.
2. **Trigger `wreck` animation** (5s active per §2.6 animation table).
3. **At wreck start (frame 0) — locked L-3 = A:**
   - **All boarded troops drop at the wreck's tile at full HP** (per `[GAME_DESIGN.md §7.3]`). Troops emerge as the vehicle goes up in smoke; each enters `idle` state at full HP, ready for new commands.
   - **Cargo resources are LOST** — not salvageable in V1.
4. After 5s: despawn wreck visual.
5. The wreck site is **walkable during the 5s** — no debris collider in V1 (cosmetic only).

### 4.7.6 Acceptance criteria

- [ ] Click Flag → menu shows 3 sub-menus (Workers / Soldiers / Vehicles).
- [ ] Clicking a unit deducts cost AND adds to that queue.
- [ ] All 3 queues run in parallel (test: queue Heavy Carrier + Worker; both progress simultaneously).
- [ ] Cancelling a queued item refunds full cost AND removes from queue.
- [ ] Spawned units emerge in the spawn platform halo, then go idle.
- [ ] Insufficient resources → click rejected; no queue add.
- [ ] Building ghost: cost deducted at placement; refunded on cancel.
- [ ] Builders scan every 1s, walk to nearest ghost, build at 5 HP/sec base.
- [ ] Multi-Builder stack: 1×, 1.7×, 2.3×, 2.8×, 3.0× cap at 5+.
- [ ] Apple Farm Plot ghost is built by a Farmer (NOT Builder); Builders skip Farm Plot ghosts.
- [ ] Damaged buildings auto-detected; **nearest** Builder walks to **nearest** damaged building.
- [ ] Repair consumes materials + apples proportionally; pauses if stockpile empty.
- [ ] Living-being death drops loot at die animation **start** (immediate); zombie drops 1 essence with 10s decay.
- [ ] Worker / soldier / King death drops nothing.
- [ ] King death → game-over screen.
- [ ] Vehicle wreck drops boarded troops at wreck **start** at full HP; cargo lost.
- [ ] Wreck visual lingers 5s, then despawns; no debris collider during the 5s.
- [ ] Dead/wrecked entities halt all their systems (sense, attack, hunger, pathfind).

---

## 4.8 Economy (LOCKED — 2026-04-28)

4 sub-systems: Worker Harvest Loop · Delivery Routing · Storage Cart Behavior (relocatable silo) · Overflow Handling.

### 4.8.1 Worker Harvest Loop

Each worker runs a state machine that loops indefinitely. The shape is identical for all 5 worker types; the differences (target, action, yield) are per-archetype.

```
        [idle]
           │
           ▼
   [walk to harvest target]
           │
           ▼
       [harvest]      (chop / mine / collect / till+grow / construct)
           │
           ▼
   [walk to drop]
           │
           ▼
        [drop]        (5 units / 1 for essence)
           │
           ▼
       [loop]
```

Per-worker specifics are locked in `[PHASE_2_ENTITIES.md §2.2]`. The system layer just runs the state machine and routes between states.

**Target selection** (per worker type):

| Worker | Target search |
|---|---|
| Wood Worker | nearest live tree (`yield.tripsRemaining > 0`) |
| Stone Worker | nearest live stone node |
| Farmer | nearest active Apple Farm Plot in ripe state, OR nearest unbuilt plot ghost (then transitions to `construct`) |
| Essence Collector | nearest liquid essence pool with `decayRemaining > 0` |
| Builder | nearest ghost building, OR nearest damaged building (per §4.7.2 + §4.7.3) |

**Tie-break (locked default):** equidistant targets → deterministic by entity ID. No randomness in V1.

**Re-targeting triggers:**
- Current target depleted (tree died, stone node empty, essence pool decayed): scan for next nearest.
- Worker dragged-to-waypoint by player: state machine pauses, walks to player's waypoint, resumes scan from new position.
- Worker enters flee state (zombie within 6 tiles per §4.5.4): drops state machine, runs to wall. Resumes loop after danger clears.

### 4.8.2 Delivery Routing

When a worker has cargo on its back and needs to drop:

1. **Find candidate containers** = all of:
   - Apple Silo / Wood Silo / Stone Silo / Essence Vault matching the cargo's resource type.
   - Storage Cart matching the cargo's resource type, currently parked anywhere on the map.
   - Each must have `currentStock < maxCapacity` (per §4.8.4 overflow rule below).
2. **Pick nearest** by Euclidean distance from worker's current tile.
3. Walk to chosen container.
4. On arrival: `container.currentStock += worker.carry`; `worker.carry = 0`; trigger drop animation; resume harvest loop.

**Re-routing on the fly:**
- If chosen container becomes invalid mid-walk (cart moved away, silo destroyed by competitor, container now full because someone else delivered): worker re-runs the search from current position.
- This re-route fires at most once per second (cheaper than per-frame).

### 4.8.3 Storage Cart Behavior (relocatable silo)

The Storage Cart is functionally a **silo on wheels.** Identical to a static silo (§3.3.2-§3.3.5) except:

| Property | Storage Cart | Static Silo |
|---|---|---|
| Relocatable? | Yes — drag-to-waypoint | No (must be destroyed and rebuilt) |
| Capacity | 50 (one type) | 100–200 (one type) |
| HP | 100 | 150 |
| SPD | 0.8 (slowest vehicle) | — |
| Cost | 0 / 30 / 10 / 0 | 0 / 15 / 10 / 0 |

**No auto-route mode in V1** (override of `[GAME_DESIGN.md §4.5]` earlier draft — see reconciliation note in §4.5 of master design).

**Player workflow:**
1. Spawn Storage Cart at Flag (player picks resource type at spawn UI).
2. Drag the cart to wherever it's strategically useful (next to a forest, near a forward operating area, etc.).
3. Cart sits idle. Workers auto-deliver to it per §4.8.2 when the cart is closer than alternatives.
4. When player wants resources back at base: drag cart manually back. Cart drives there. Resources are now in the cart at the new location.
5. Workers can then auto-deliver from the cart's resources to a static silo at the base — wait, no — workers don't move resources between containers in V1. The player drags the cart back to base; the resources go with it. Workers harvest from the world, not from a container.

**Cart relocation while loaded:**
- Drag a partially-loaded cart → cart drives to new waypoint with cargo intact. No spillage.

**Cart wreck behavior:**
- Per §4.7.5 wreck rules. Storage Cart with no boarded troops doesn't drop troops on wreck (because there are none). **Cargo resources are LOST** (consistent with all vehicle wrecks).

### 4.8.4 Overflow Handling

When a worker arrives at a container that's now full (or full at delivery routing search time):

1. Worker walks to the **NEXT-nearest valid container** (rerun §4.8.2 search excluding the full one).
2. If found: walk + drop there.
3. **If ALL valid containers are full:**
   - Worker idles at the original drop site, **still holding cargo**.
   - Re-checks for available container space every 1s.
   - When any container has space: walk + drop.
4. Worker does **NOT** drop cargo on the ground. **No spillage in V1.**

**Idle-while-full state:**
- Worker plays `idle` animation while waiting.
- Hunger ticks continue; worker can starve while overflowing if apples run out.
- Player can manually drag worker out of the idle state (worker resumes idle at new waypoint, but still holds cargo until container space opens).

**Practical consequence:** if the player ignores storage scarcity, harvesting stalls but resources are not lost. Workers wait patiently until silos / carts have room. This forces the player to expand storage as harvest scales.

### 4.8.5 Acceptance criteria

- [ ] Each worker type runs its full harvest loop unattended (test all 5 in sandbox).
- [ ] Worker delivers to nearest valid container; Storage Cart wins over Silo when closer.
- [ ] Worker re-routes if destination becomes invalid mid-walk (test: destroy a silo while a worker is en route).
- [ ] Storage Cart spawned with resource-type prompt at Flag; locked to that type.
- [ ] Storage Cart can be dragged anywhere; partially-loaded cart relocates without spillage.
- [ ] Storage Cart has NO auto-route mode (cancel button absent; cart sits idle until manually dragged again).
- [ ] Cart wreck loses all cargo (consistent with vehicle wreck rule).
- [ ] Overflow: nearest container full → worker walks to next-nearest.
- [ ] All containers full → worker idles holding cargo; retries every 1s; no spillage.
- [ ] Worker idle-while-full continues to take hunger ticks (can starve).
- [ ] Equidistant target tie-break deterministic by entity ID.

---

## 4.9 AI Behaviors (LOCKED — 2026-04-28)

> **Note:** this section **consolidates** the state machines that drive each unit type's autonomous behavior. All transitions, sense triggers, attack conditions, and lifecycle events were locked in earlier sections (§4.3–§4.8). This is the unifying view per archetype — useful as the implementation reference for AI / brain code.

### 4.9.1 Shared SM Architecture

- **One state machine per unit type.** ~16 SMs total: zombie, 5 workers, 5 soldiers, King, 4 vehicles. Modest duplication keeps each SM independently debuggable. (Shared-base + role-overrides architecture is a V2 cleanup.)
- **Transition tick rate:** **10 Hz** (every 6 frames at 60 FPS), aligned with the sense tick from §4.5.1.
- **High-priority transitions** (death, drag-override, damage-received) bypass the 10 Hz cadence and trigger **immediately** on their event.

### 4.9.2 Zombie Brain

**States:** `wander`, `aggro_target`, `wall_hammer`, `dying`.

```
[wander] ──sense fires (living being in 8-tile)──▶ [aggro_target]
   ▲                                                   │
   │                                              path blocked
   │                                              by wall?
   │                                                   ▼
   │                                              [wall_hammer] ──wall broken──▶ [aggro_target]
   │                                                   │
   │ target died / left 8-tile circle                  │
   └───────────────────────────────────────────────────┘

Any non-dying state ──HP <= 0──▶ [dying] → drop 1 essence → despawn 1.5s
```

| From | To | Trigger |
|---|---|---|
| wander | aggro_target | living being enters 8-tile sense circle |
| aggro_target | wall_hammer | pathfind hits wall in path; zombie at wall edge |
| wall_hammer | aggro_target | wall HP = 0; target still in range |
| aggro_target | wander | target leaves 8-tile circle OR target died |
| wander | wander | direction-change tick (every 3–5s); pick new random direction within 10-tile leash from spawn point |
| any | dying | HP <= 0 |

### 4.9.3 Worker Brain (5 worker types)

**States:** `idle`, `harvest`, `deliver`, `flee`, `eat`, `dying`.

```
[idle] ──scan target──▶ [harvest] ──carry full / depleted──▶ [deliver] ──drop──▶ [idle]

Pre-empts (any non-dying state):
  zombie in 6-tile circle  ──▶ [flee] ──zombie clear──▶ resume previous state
  hunger tick / HP < 30%   ──▶ [eat]  ──ate apple──▶ resume
  player drag              ──▶ walk to waypoint ──▶ [idle] at new pos

HP <= 0 ──▶ [dying] (no drop) ──▶ despawn
```

**Builder** replaces `harvest`+`deliver` with: `scan_ghost` → `construct` → `scan_damaged` → `repair` (priority: ghost first, repair second). No carry.

**Farmer** has an extra `till` sub-state for Apple Farm Plot ghost construction (per §3.3.6). Standard `harvest` covers the 30s plant→grow→ripe cycle.

### 4.9.4 Soldier Brain (5 soldier types)

**States:** `idle_at_waypoint`, `walk_to_engage`, `fight`, `return_to_waypoint`, `en_route_drag`, `eat`, `dying`.

```
[idle_at_waypoint] ──enemy in 6-tile circle──▶ [walk_to_engage] ──in range──▶ [fight]
       ▲                                                                          │
       │                                                                target dead / out of circle
       │                                                                          ▼
       └─────────────────[return_to_waypoint]──arrived──────────────────────────┘

Player drag ──▶ [en_route_drag] ──arrived──▶ [idle_at_waypoint]
                  (no detour for sensed enemies; engages only if attacked)

Hunger / HP < 30% (combat-mode gate):
  ──only if no enemy in sense circle──▶ [eat] ──ate──▶ resume

HP <= 0 ──▶ [dying] (no drop, no flee) ──▶ despawn
```

### 4.9.5 King Brain

**States:** `idle_at_waypoint`, `retaliate`, `return_to_waypoint`, `en_route_drag`, `eat`, `dying_game_over`.

Same shape as Soldier Brain except:
- **`idle → retaliate`** fires only on **incoming damage event** (King does NOT initiate combat from sense alone, per §2.4).
- **`HP <= 0 → dying_game_over`** triggers the game-over screen. King's body persists on the map until the player accepts the loss screen (no automatic despawn).

### 4.9.6 Vehicle Brain (4 vehicle types)

**States:** `idle`, `drive`, `wreck`.

```
[idle] ──player drag──▶ [drive] ──arrived at waypoint──▶ [idle]

In any non-wreck state:
  - mounted weapon auto-targets nearest enemy in range, fires per attack cooldown
  - boarded troops fire from vehicle position at their own range / pattern

HP <= 0 ──▶ [wreck] ──▶ drop troops at full HP → cargo lost → despawn after 5s
```

Storage Cart has no mounted weapon and no boarded troops — its non-wreck states are just `idle` ↔ `drive`.

### 4.9.7 Acceptance criteria

- [ ] Zombie SM transitions correctly: wander → aggro → wall_hammer → wander on event triggers.
- [ ] Zombie wandering stays within the 10-tile leash from spawn point.
- [ ] Worker SM loops; `flee` pre-empts `harvest`; `eat` pre-empts non-flee states; `dying` halts all.
- [ ] Builder SM prioritizes ghost-construction over repair when both are available.
- [ ] Farmer SM handles ghost `till` (15s) before the harvest cycle starts.
- [ ] Soldier SM transitions idle → walk_to_engage on sense → fight → return after target down or out.
- [ ] Soldier SM `en_route_drag` does NOT detour for sensed enemies; only retaliates if attacked en-route.
- [ ] King SM `retaliate-only` — does not initiate combat without incoming damage.
- [ ] King SM `dying_game_over` triggers game-over screen; body persists.
- [ ] Vehicle SM drive→idle on arrival; mounted weapon fires in both states.
- [ ] All SMs evaluate transitions at 10 Hz; high-priority events (death, drag-override, damage-received) trigger immediately.

---

## 4.10 Apple Feeding (LOCKED — 2026-04-28)

System runtime implementation of `[PHASE_2_ENTITIES.md §2.8 Apple Feeding System]`. All design decisions are already locked there; this section specs the **runtime mechanics**.

### 4.10.1 Hunger Ticker

Per living being, private state:

```
hunger = {
  elapsed: 0,                  // seconds since last meal
  queuedEat: false,            // a trigger fired but eat is suppressed
  isEating: false              // mid-eat-sequence
}
```

**Per-frame update:**
- `hunger.elapsed += deltaTime`.
- If `hunger.elapsed >= hunger.max` (200s default) AND `hunger.isEating == false`: fire `hunger_tick` event for this entity.

### 4.10.2 Critical-HP Trigger

**Per 10 Hz tick** (aligned with sense system):
- For each living being: if `hp < hp.max × 0.30` AND `hunger.isEating == false`: fire `critical_hp` event.

Both `hunger_tick` and `critical_hp` events route to the same **Eat Trigger Handler** (§4.10.3). If both fire on the same entity in the same tick, only **one apple** is consumed (resets hunger AND heals).

### 4.10.3 Eat Trigger Handler

```
[event fires]
   │
   ▼
[Combat-Mode Gate check] ──gate closed──▶ [queue eat]  hunger.queuedEat = true
   │
   ▼ gate open
[Apple Source Search]    ──no source──▶ [suppress]
   │
   ▼ source found
[Eat Sequence start]
```

### 4.10.4 Apple Source Search

1. Build candidate list:
   - All **Apple Silos** with `apples > 0`.
   - All **Storage Carts** with `resourceType == "apple"` AND `cargo > 0`.
2. Filter to those within **10-tile** Euclidean range from the entity.
3. If empty: suppression — entity stays put, hunger keeps accumulating, queuedEat stays true.
4. Else: pick **nearest** container; trigger Eat Sequence (§4.10.6) with that target.

Note: Apple **Farm Plots** are NOT eat sources — they produce, don't store. Worker carry inventories are NOT sources — in-transit goods are untouchable.

### 4.10.5 Combat-Mode Gate (Soldiers + King only)

Per-archetype `hunger.combatModeGate` flag:

| Archetype | Gate value | Meaning |
|---|---|---|
| All workers | `false` | Skip gate, proceed to source search. |
| All soldiers | `true` | Check 6-tile sense circle. If enemy present → queue. |
| King | `true` | Same as soldiers. |
| Zombies | n/a | No hunger system. |

When gated (closed), `hunger.queuedEat = true`. Queued eat is re-evaluated at every 10 Hz tick. The moment the sense circle clears, the eat fires immediately.

**Gate side effects:**
- Hunger timer keeps ticking under gate suppression.
- Starvation damage (§4.10.7) applies normally — combat-mode gate does NOT pause starvation. Soldiers and the King CAN bleed out mid-fight from hunger.

### 4.10.6 Eat Sequence

```
[walk to container] ──reach 1-tile range──▶ [play eat animation 0.5s]
                                                        │
                                          damage event during animation?
                                                        ▼ yes
                                          [INTERRUPT] ──▶ apple consumed, NO benefit, resume prior task
                                                        │ no
                                                        ▼
                                          [animation end (0.5s)]
                                                        │
                                                        ▼
                                          [apply benefits]:
                                            container.apples -= applesPerMeal
                                            entity.hp += applesPerMeal × healPerApple (capped)
                                            hunger.elapsed = 0
                                            hunger.queuedEat = false
                                            hunger.isEating = false
                                                        │
                                                        ▼
                                          [resume prior task]
```

**Per-archetype overrides:**
- **King:** `applesPerMeal: 3`, heals 3 × 10 = 30 HP per meal.
- **Workers, soldiers:** `applesPerMeal: 1`, heals 1 × 10 = 10 HP per meal.

### 4.10.7 Starvation Damage

Per-frame check (60 Hz, NOT 10 Hz — needs precise per-second damage):

- If `hunger.elapsed >= hunger.max` AND `hunger.isEating == false`:
  - Apply `starveDmgPerSec × deltaTime` HP damage to entity.
  - Continue every frame until eat fires (resets timer) or entity dies.

**Apply in ALL states:** idle, walking, fighting, fleeing, en-route, even mid-animation. Starvation does not pause for any reason.

### 4.10.8 Apple Silo Aura Integration

Apple Silo Aura (§4.5.5) and Apple Feeding (§4.10) are **independent** systems:

| System | Trigger | Heal rate | Cost rate |
|---|---|---|---|
| Apple Silo Aura | passive, while in 5-tile silo radius | +1 HP/sec | 0.1 apple/sec per healed unit (via silo stock) |
| Apple Feeding (eat event) | hunger tick OR critical HP | +10 HP per apple (instant on eat) | apples consumed at eat moment |

Both can fire on the same entity concurrently. Example:
- Wounded worker enters a silo aura → starts regenerating 1 HP/sec passively.
- Hunger timer hits 200s → eat event fires → walks to silo → eats → +10 HP heal + hunger reset.
- The wounded worker has now received both passive aura heal AND explicit meal heal in the same encounter.

### 4.10.9 Acceptance criteria

- [ ] Hunger ticker increments at 1/sec per living being; resets on eat.
- [ ] Hunger tick fires at 200s elapsed (test: cut apple supply, verify eat triggers at 200s).
- [ ] Critical-HP trigger fires when HP drops below 30% of max (test: damage worker to 28% → eat triggers).
- [ ] Both triggers fire simultaneously → only 1 apple consumed (resets hunger AND heals).
- [ ] Apple source search picks nearest valid container (Silo or Cart) within 10 tiles.
- [ ] No source within 10 tiles → eat suppressed; queuedEat = true.
- [ ] Combat-Mode Gate (soldiers + King) suppresses eat when enemy in 6-tile sense circle.
- [ ] Queued eat fires immediately when sense circle clears.
- [ ] Workers (no gate) eat freely after fleeing to safety.
- [ ] Eat animation 0.5s; on success: -1 apple, +10 HP heal (or +30 for King), hunger reset.
- [ ] King eats 3 apples per meal; heals 30 HP.
- [ ] Eat interrupted by damage: apple still consumed, no heal applied, animation cancels.
- [ ] Starvation damage 1 HP/sec applies in ALL states (test: damage starving worker mid-flee, mid-fight, mid-animation).
- [ ] Apple Silo aura and explicit eat events fire independently; both can heal the same unit in the same encounter.
- [ ] Apple Farm Plots are NOT eat sources (test: place worker next to plot only, confirm no eat fires).
- [ ] Worker carry inventory is NOT an eat source (test: Farmer with 5 apples on back — can't self-eat).

---

## Changelog (Phase 4)

- **2026-04-28** — Phase 4 opened. System roster defined (8 categories, ~25 individual systems total). Designing in dependency order: Input → Movement → Sensing → Combat → Lifecycle → Economy → AI → Apple Feeding. First system in queue: §4.3 Drag-to-Waypoint Controller.
- **2026-04-28 (later)** — **§4.3 Drag-to-Waypoint Controller LOCKED.** Two modes (1-step single-entity, 2-step multi-entity-group), drag-end as target (auto-pathfind shortest connected walkable path), impassable-fallback walks-to-first-blocker (or routes around if a connected detour exists), camera follows finger near screen edge for long-distance drags, two-finger gestures reserved for pan/zoom (no conflict). Existing implementation references commits `00ed3bc`, `084813c2`, `34c74a8`, `72e98ca`. Acceptance criteria checklist defined. Up next: §4.4 Movement systems (Pathfinding · Water Crossing · Vehicle Drive).
- **2026-04-28 (later 2)** — **§4.4 Movement LOCKED.** 3 sub-systems: §4.4.1 Pathfinding (Grid A* on the tile grid; per-tile walkability table; event-driven recompute on wall destroy/build OR target moved >2 tiles OR new drag; independent group pathfinding; cap of 8 concurrent pathfinds per frame; other entities NOT pathfinder obstacles — local steering handles overlap), §4.4.2 Water Crossing (applies §1.11.3 rules per entity at pathfind-time), §4.4.3 Vehicle Drive (auto-pilot via standard pathfinder, hard stop at waypoint, mounted weapon fires while driving, wheel rotation scales with SPD). Acceptance criteria checklist defined. Up next: §4.5 Sensing (5 sense / aura systems).
- **2026-04-28 (later 3)** — **§4.5 Sensing LOCKED.** 5 detection sub-systems all sharing locked mechanics: 10 Hz tick rate uniform, naive O(n×m) detection, circular Euclidean range. Sub-systems: §4.5.2 Zombie Sense (8-tile, living beings only), §4.5.3 Soldier Sense (6-tile, idle-at-waypoint only, return after fight), §4.5.4 Worker Flee (6-tile, run to wall/building cover), §4.5.5 Apple Silo Aura (5-tile, +0.1 HP/tick = 1 HP/sec, 0.01 apple/tick = 1 apple per 10 HP healed; pauses when silo empty), §4.5.6 Gate Auto-Open (1-tile Euclidean = orthogonal adjacency, opens/closes within 100ms). Acceptance criteria checklist defined. Up next: §4.6 Combat (8 sub-systems — the densest section in Phase 4).
- **2026-04-28 (later 4)** — **§4.6 Combat LOCKED.** 8 sub-systems specced: §4.6.1 Targeting (per-unit priority tables; soldier prefers counter-target on tie), §4.6.2 Attack Patterns (melee / arc / straight / AoE; mid-swing impact frame), §4.6.3 Projectile Flight (10 tiles/sec, fire-and-forget, parabolic vs straight vs splash), §4.6.4 Counter Math (1.5× counter pairs vs enemy soldiers ONLY, computed at attack-commit time, formula: `base × counter × charge`), §4.6.5 Knockback (Bruiser 1-tile push, no chain, no extra damage if blocked), §4.6.6 Biker Charge (per-target first-hit ×2, resets on target switch, stacks multiplicatively with counter for 3×), §4.6.7 AoE Splash (Heavy Carrier 1-tile, no falloff, no friendly fire), §4.6.8 Multi-Attacker Stacking (4-max for melee only — ranged unconstrained). §4.6.9 Damage pipeline order locked. Acceptance criteria checklist defined. Up next: §4.7 Lifecycle (7 sub-systems: spawn queues, construction, repair, eat, starve, die, wreck).
- **2026-04-28 (later 5)** — **§4.7 Lifecycle LOCKED.** 5 sub-systems (eat + starve moved to §4.10 Apple Feeding to avoid duplication): §4.7.1 Flag Spawn Queues (3 parallel FIFO queues; click-to-add with cost deducted at queue-time; refund on cancel), §4.7.2 Construction (HP-accumulator model: `buildHP_max = buildTime × 5`; Builder applies 5 HP/sec × stack curve; Apple Farm Plot exception = Farmer-built), §4.7.3 Repair (Builders auto-scan every 1s for damaged buildings, nearest first, materials/apples deducted proportionally per HP repaired; pauses if stockpile empty), §4.7.4 Die (halt all entity systems → die animation 1.5s → drop loot at frame 0 → despawn at end; King death = game over), §4.7.5 Wreck (halt vehicle systems → wreck animation 5s → drop boarded troops at frame 0 at full HP → cargo lost → despawn at end). Acceptance criteria checklist defined. Up next: §4.8 Economy (4 sub-systems: harvest loop, delivery routing, Storage Cart route mode, overflow handling).
- **2026-04-28 (later 6)** — **§4.8 Economy LOCKED + 5th master-doc reconciliation.** 4 sub-systems: §4.8.1 Worker Harvest Loop (state machine: idle → walk → harvest → walk → drop → loop; per-worker target selection; deterministic tie-break by entity ID), §4.8.2 Delivery Routing (search nearest valid container per resource type, re-route on invalidation, max 1 re-route per second), §4.8.3 Storage Cart Behavior (**no auto-route mode in V1** — overrides `[GAME_DESIGN.md §4.5]` earlier draft. Cart is a relocatable silo: spawn at Flag with resource-type prompt → drag-to-waypoint to position → workers auto-deliver to it as nearest container → manual drag back to base when full. Auto-route deferred to V2), §4.8.4 Overflow Handling (next-nearest container fallback; idle-while-full state if all full, retries every 1s, no spillage). Patches: `[PHASE_2_ENTITIES.md §2.6.4]` Storage Cart special bullets + JSON `routeMode: null`; `[GAME_DESIGN.md §4.5]` reconciliation note added. Up next: §4.9 AI Behaviors (zombie wander/aggro, worker behavior loops, soldier idle/engage, Builder/Farmer construction loops).
- **2026-04-28 (later 7)** — **§4.9 AI Behaviors LOCKED.** Consolidation of state machines (transitions/triggers/conditions all locked in §4.3–§4.8). 16 per-unit-type SMs at 10 Hz transition tick (high-priority events bypass cadence): §4.9.2 Zombie Brain (4 states: wander/aggro_target/wall_hammer/dying with 10-tile leash on wander), §4.9.3 Worker Brain (6 states; flee + eat pre-empt harvest; Builder uses scan_ghost→construct→scan_damaged→repair; Farmer adds till sub-state), §4.9.4 Soldier Brain (7 states with combat-mode-gated eat), §4.9.5 King Brain (retaliate-only; HP=0 → dying_game_over with body persists until input), §4.9.6 Vehicle Brain (3 states: idle/drive/wreck; Storage Cart has no mounted weapon/troops). Acceptance criteria checklist defined. Up next: §4.10 Apple Feeding (final Phase 4 system — implements §2.8 with hunger tick, critical-HP trigger, eat sequence, interruption, combat gate, starvation).
- **2026-04-28 (later 8)** — **§4.10 Apple Feeding LOCKED. ✓ PHASE 4 FULLY LOCKED.** Runtime implementation of §2.8 spec. 7 sub-systems: §4.10.1 Hunger Ticker (per-frame elapsed accumulator, 200s threshold), §4.10.2 Critical-HP Trigger (10 Hz tick, fires at HP < 30% × max), §4.10.3 Eat Trigger Handler (routes both events through gate→search→sequence), §4.10.4 Apple Source Search (Silo OR Cart within 10-tile cap, nearest wins; Farm Plots and worker carry are NOT sources), §4.10.5 Combat-Mode Gate (soldiers + King; queued eat fires when sense circle clears; starvation NOT paused by gate), §4.10.6 Eat Sequence (0.5s animation; damage cancels but apple still consumed; King eats 3 apples = 30 HP heal), §4.10.7 Starvation Damage (60 Hz check, 1 HP/sec, applies in all states), §4.10.8 Apple Silo Aura Integration (independent of eat events; both can fire concurrently). Acceptance criteria checklist defined. **Phase 4 complete — all 8 categories / ~25 individual systems locked.**
