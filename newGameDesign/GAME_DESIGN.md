# Base Defense Tycoon — Complete Game Design Document

> Living design reference. Modeled on `high_treason_reference.md`. Single source of truth for V1 design decisions — updated as each system is locked.
>
> **Status:** V1 design in progress. Foundations locked **2026-04-24**.
>
> **Reference inspiration:** *High Treason* (Templar_VII). See `high_treason_reference.md`.

---

## Table of Contents

1. [Game Identity](#1-game-identity)
2. [Core Loop & Session Flow](#2-core-loop--session-flow)
3. [World & Map Structure](#3-world--map-structure)
4. [Economy — Four Resources](#4-economy--four-resources)
5. [Worker Roster](#5-worker-roster)
6. [Military Pentagon](#6-military-pentagon)
7. [Vehicle Roster](#7-vehicle-roster)
8. [Building Roster](#8-building-roster)
9. [Zombie Threat System](#9-zombie-threat-system)
10. [Competitor AI](#10-competitor-ai) *(stub)*
11. [Combat Math](#11-combat-math)
12. [Progression / Tech Tree](#12-progression--tech-tree)
13. [Balance Tables](#13-balance-tables)

---

## 1. Game Identity

| Field | Value |
|---|---|
| **Working Title** | Base Defense Tycoon |
| **Developer** | Solo (bibektan) |
| **Engine** | Three.js (ES modules, no bundler) |
| **Platforms** | Web browser — desktop + mobile; mobile-first input |
| **Perspective** | Isometric top-down, multi-base map |
| **Genre** | Survivor Base Builder × Tower Defense × RTS-Lite |
| **Visual Style** | Stylized hyper-casual "fake ad" — high saturation, bouncy squash-and-stretch |
| **Mode (V1)** | Singleplayer continuous sandbox |
| **Modes (Future)** | Day/night cycle (V2); multiplayer (V3+) |
| **Session Length Target** | 15–40 minutes per level |
| **Input** | **Universal drag-to-waypoint** for all entities (King, workers, soldiers, vehicles); two-finger pinch/pan for camera |

### Core Pitch

*"You are the King of a small survivor camp in a world overrun by zombies and rival survivors. Train villagers, farm apples, build walls, raise an army — protect your King, outlast the undead, and take the thrones of everyone else. Your King walks among you. If he falls, the camp falls."*

### Win / Lose Conditions

- **You lose** when the King dies.
- **You win** a level when every rival king on the map is dead (last-king-standing, per HT).
- Levels unlock sequentially (L1 → L2 → …); V1 only cares about the current level.

### The Three-Pressure Structure

1. **Zombies** — always present, spawn from fixed world points. Attack any living thing they *sense* (player workers, player troops, player King, rival workers, rival troops, rival Kings). See §3.5 sensing rule.
2. **Competitor Survivors** — rival bases on the same map. Build their own economies. Eventually march on the player for the throne. Also suffer zombie attacks. Their attacks are **more dangerous than zombies'** (see §10).
3. **Hunger** — every living being eats apples on a timer (200s). Without enough farms, your population starves and takes 1 HP/sec until they die or get fed. Apples are the universal sustenance resource, doubling as healing currency. See §11.11.

Zombies are a timer; competitors are the puzzle; hunger is the constant tax. You can never fully turtle — zombies erode anyone who doesn't farm essence aggressively, competitors outscale a passive player, and hunger eats your standing army apple by apple.

---

## 2. Core Loop & Session Flow

### Macro Loop (per level)

```
SPAWN     →  survive first zombie pressure with only workers + King
            ↓
GROW      →  convert essence into military; wood/stone into walls; farm apples
            ↓
EXPAND    →  reach distant resources via wall tunnels or vehicles
            ↓
ASSAULT   →  army + carrier vehicles → siege a rival base
            ↓
CROWN     →  kill all rival Kings = win level → L+1 unlocks
```

### Moment-to-Moment Loop

```
Zombies spawn from world spawn points
          ↓
Workers gather: wood / stone / apples / essence (from zombie kills)
          ↓
Spend on: more workers | military units | buildings | vehicles | tech
          ↓
Place walls / silos / vehicles; reassign workers between tasks
          ↓
Zombie waves test defenses → essence flows in from kills → surplus → army
          ↓
March on rival → break walls → kill rival King → repeat
```

### Zombie Pressure Ramp (V1)

- Zombies spawn from **fixed world spawn points**, visible to player, **indestructible in V1**.
- At most **X concurrent zombies** exist globally. Cap starts at `X₀` and increases by `+Y` every `N` seconds, hard-ceilinged to protect framerate.
- Zombies do **not** target the player specifically — they attack the nearest living thing they sense (player or rival).

**V1 starter numbers** (TBD via playtest):

| Variable | Value | Meaning |
|---|---|---|
| `X₀` | 15 | Initial concurrent cap |
| `Y` | +5 | Cap increment per tick |
| `N` | 60s | Tick interval |
| `X_max` | 60 | Hard ceiling (framerate guard) |

### Level Scaling

**V1 ships with 3 levels only.** Higher levels are a post-launch concern.

| Level | Total bases | Player + Rivals | Zombie spawn points |
|---|---|---|---|
| L1 | 3 | 1 + 2 | 2 |
| L2 | 5 | 1 + 4 | 3 |
| L3 | 7 | 1 + 6 | 4 |

### Session Shape (V1)

One continuous real-time session from level start to last-king-standing. No forced waves, no day/night — the zombie cap ramp is the only implicit clock. Player can pause for UI; world does not actually pause.

**V2 extension (deferred):** day/night cycle. Zombies surge at night; competitors raid during day. Not in V1.

### Universal Control — Drag-to-Waypoint

```
Touch + drag a path on the screen → release.
The selected entity (or group) moves toward the released endpoint.
```

This is the **universal command mechanic** for every controllable entity:

- **King** — drag to walk to a point.
- **Workers** — drag to relocate; on arrival they resume their fixed task at the new spot.
- **Soldiers** — drag to move; auto-engage enemies in range during travel.
- **Vehicles** — drag to drive (no driver needed; vehicles auto-pilot).
- **Storage Carts** — drag to assign a route or destination.

There are no joysticks, no WASD, no click-to-move. Drag-and-release is the single learnable input. This already works for the King in the current build; V1 generalizes it across all entity types.

---

## 3. World & Map Structure

The world is a **continuous open-world isometric map**. No scene transitions, no sub-zones, no capturable outposts. What you see is one shared landscape — your base, rival bases, wilderness, and zombie spawn points all coexist on the same view.

### 3.1 The World

- One large iso map per level.
- Player base + N rival bases scattered (per Level Scaling, §2).
- Wilderness fills the space between bases.
- Zombie spawn points fixed at hand-authored locations.

### 3.2 Natural Resource Distribution

Trees and stone nodes are **scattered naturally** across the wilderness — random or hand-placed per level. **No special "zones," no labels, no claim mechanics.** They are just things in the world, like in real nature.

| Element | Where it lives | Behavior |
|---|---|---|
| **Trees** | Random clusters, denser further from bases | Felling kills the tree. **No regrowth in V1** — locked. |
| **Stone nodes** | Random clusters, often on rocky terrain or near cliffs | Mining depletes permanently. **No regrowth.** |
| **Apple farm plots** | Player-built **anywhere** on plain land | Farmer converts terrain → permanent farm plot. Infinite cycles. |
| **Water bodies (rivers, lakes)** | Natural map features | Block most living beings. Crossable by **all vehicles** + **Scout + Slinger** only (see §6.3). Become natural chokepoints for sieges and farming runs. |
| **Zombie spawn points** | Fixed, visible, indestructible | Zombies emerge here on a timer. |

### 3.3 Why Resources Cause Conflict (no outposts needed)

The capture mechanic is **scarcity**, not territory.

- Easy resources nearby at level start.
- All survivors (player + rivals) harvest aggressively.
- Local supply depletes.
- Players must travel further to find more.
- Distant resources = exposure to zombies + rival ambushes.
- Late game: only the contested distant nodes remain.

You don't claim a zone — you simply harvest a node before someone else does, then defend the route home.

### 3.4 Fertile Land — Farms Anywhere

**Any plain land tile can be made fertile.** Process:

```
[plain land] → Farmer tills (~15s) → [Apple Farm Plot]
                                          ↓
                                    plant → wait → harvest → store → loop
```

Apple production is **placement-flexible** — unlike stone (must travel to nodes) and wood (must travel to trees), farms go where you want them. This makes apples the player's most controllable resource.

### 3.5 Zombie Sensing Rule (the heart of world tension)

**Zombies attack only what they sense — living beings.** Not buildings. Not walls. Not empty vehicles. Not dropped resources.

```
ZOMBIE SENSE RADIUS: ~8 tiles around each zombie
                   ↓
If a living being (worker / troop / King / rival villager) is within radius:
  → zombie aggros toward them
  → if a wall blocks the path, zombie attacks the wall to reach them
If no living beings are sensed:
  → zombie wanders aimlessly
  → ignores all walls, buildings, empty vehicles, dropped resources
```

**Implications:**
- An **empty wall tunnel** through wilderness is invisible to zombies. They walk past.
- A **walking worker** triggers every zombie in 8-tile radius to aggro.
- A **vehicle with troops onboard** is a sensed target — zombies will chase.
- **Roofs / enclosed corridors** (TBD): may block sense from above. Could be a tech upgrade.

This single rule is what makes the wall-tunnel mechanic work and what gives "infrastructure" value beyond active defense.

### 3.6 Safe Travel — Two Methods

#### A) Wall Tunnel
Build a corridor of walls from your base to the resource node. Workers walk through. Zombies still sense them through the walls and pile on, but the walls absorb damage instead of the worker.

```
DANGER PATH (no walls):           SAFE PATH (wall tunnel):

🌲       🪨🪨🪨                    🌲       🪨🪨🪨
                                              ▓▓▓▓
        💀💀                                  ▓👷▓
   👷 ← exposed                       👷 →▓▓▓▓
   💀 ← attacks!                              ▓
                                     ▓▓▓▓▓▓▓▓▓
   🏰                                  🏰

- cheap (no walls)               - expensive wood
- workers die a lot              - one-time build, permanent
- need vehicle escort            - workers walk safely
- fast to set up                 - slow to set up, but durable
```

#### B) Vehicle Run
Drive workers + storage cart out to the node, harvest fast, drive back. Vehicles can fight back while moving (mounted attack + boarded troops shoot out). If the vehicle is destroyed, troops are dropped at the wreck site.

#### Tradeoff Comparison

| Method | Upfront cost | Ongoing cost | Travel speed | Safety | Best for |
|---|---|---|---|---|---|
| **Wall Tunnel** | High wood/stone | None (passive) | Walking pace | High (walls absorb) | Frequent runs to nearby key nodes |
| **Vehicle Run** | Med (build vehicle once) | Repair after damage | Vehicle speed | Medium | One-off runs to far reserves |

Mid-late game most players combine both — wall tunnels to closest big nodes, vehicle expeditions for far reserves.

### 3.7 V1 Starter Numbers — Proposal

| Variable | Value | Rationale |
|---|---|---|
| Zombie sense radius | 8 tiles | Far enough to feel threatening; close enough that walls help |
| Zombie HP | 30 | Dies in 2-3 Scout hits |
| Zombie damage (vs living being) | 8 dmg/hit, 1s cooldown | Worker (30 HP) dies in ~4 hits |
| Zombie damage (vs wall) | 3 dmg/hit, 1s cooldown | 5× slower than vs living |
| Wood Wall HP | 200 | 1 zombie takes ~67s to break a wall tile |
| Stone Wall HP | 400 | 1 zombie takes ~134s |
| Roof tile | 5 wood / 5 stone | Always buildable. Pre-tech: blocks projectile arcs from above (e.g., Slinger lobs). Post-tech (Roof Sense Block, §12): also blocks zombie sense from above. |

### 3.8 Why this works (design intent)

- **Walls = infrastructure, not active defense.** Front-loaded cost, low ongoing cost. Zombies ignore them when empty.
- **Resources are limited.** As they deplete near base, you must take risks. Risk = travel. Travel = exposure. Exposure = need for walls or vehicles.
- **Vehicles enable expedition gameplay.** A small vehicle run with 1 worker + 1 escort troop can grab a remote stone node before the rival does.
- **Competitors compete for the same finite supply.** The long-term pressure isn't just "rivals attack you" — it's "rivals are draining the same wood pool you need."
- **Greed vs fear:** that distant stone node is the *last* one. Send a vehicle now (greed) or play safe (fear)? This is the emotional core.

---

## 4. Economy — Four Resources

The whole game runs on **four resources**. Every spend is a tradeoff against every other spend in the same pool.

### 4.1 The Resources

| Resource | Source | Renewable? | Notes |
|---|---|---|---|
| **Essence** | Zombie kills (1 per zombie, V1) | Yes — zombies respawn from spawn points | Two states: **liquid** (decays) → **stored** (permanent) |
| **Wood** | Felling trees | Very slowly or not at all (TBD playtest) | Easy supply nearby; deep-jungle reserves further out |
| **Stone** | Mining rock nodes | **Non-renewable** — nodes deplete permanently | Easy nearby start; must travel further as nearby nodes drain |
| **Apple** | Farmed only at apple plots (any fertile land) | Yes — infinite cycles | Healing + economy hybrid (see §11) |

### 4.2 Two States of Essence

Matches the existing magnetic-pickup feel of the engine.

1. **Liquid Essence** — a glowing pool splashed where the zombie died. **Decays in ~10 seconds** if not collected.
2. **Stored Essence** — picked up into a tube/stack, delivered to an Essence Silo. **Permanent** until spent.

**Pickup rule:** any worker assigned the **Essence Collector** task can walk to a liquid pool and convert it to stored. *(Future: long-arm collector machines vacuum from a distance — deferred past V1.)*

### 4.3 Per-Resource Storage (type-locked silos)

- Each resource has its own silo. **A wood silo cannot hold stone.** Same for essence and apple.
- **Static silos** — buildings placed in the base, cap = N units per silo.
- **Mobile silos** — Storage Carts (vehicles, see §7) ferry resources between distant nodes and the home base.
- **Overflow rule:** when all silos for a resource are full, the worker **goes idle** near the silo and resumes only when space opens (someone spends resources). The visible idleness creates pressure to build more silos — that's the design intent.

### 4.4 Worker Carry Rule

- A worker carries **only their type's resource** (Wood Worker carries wood, Stone Worker carries stone, etc.).
- **Carry capacity:** 5 units per trip. Visualized as a stack on the worker's back (re-uses the existing jelly-stack system).
- Workers are **fixed-role for life** — no reassignment in V1 (see §5).

### 4.5 Cross-Base Transport — Storage Cart (V1)

In HT, distant resource zones required either (a) building a second village nearby, (b) using a Storage Cart, or (c) researching the *Coinage* tech that pools all resources globally.

**For V1: Storage Cart only.** Forces strategic placement decisions and lets the player feel the geography of their economy. Coinage-style global pooling is deferred to mid-game tech (§12).

**Storage Cart behavior:** mobile silo on wheels. One cart locked to one resource type. Slow but high capacity (50 units). See §7.

> **2026-04-28 reconciliation:** earlier draft had the cart "assigned a route between two points." That auto-route mode has been **removed for V1**. The cart is a relocatable silo — player manually drags it between points as a strategic choice (e.g., park at distant forest during harvest; drag back to base when full). See `[PHASE_2_ENTITIES.md §2.6.4]` and `[PHASE_4_SYSTEMS.md §4.8.3]`. Auto-route is a V2 enhancement.

### 4.6 V1 Starter Numbers — Proposal

> Per HT's note: these aren't sacred. They're a starting calibration where the *relationships* feel right. Tune from playtest. All times in seconds; all amounts in units.

#### Gather rates (per worker, baseline)

| Task | Yield per trip | Time per trip | Rate per minute |
|---|---|---|---|
| Wood Cutter | 5 wood | 20s | ~15 wood/min |
| Stone Miner | 5 stone | 30s | ~10 stone/min |
| Farmer | 5 apples per plot per cycle | 30s cycle | ~10 apples/min |
| Essence Collector | 1 essence per pickup | 5s walk + collect | gated by zombie kill rate |

#### Node yields

| Node | Total yield | 1-worker depletion |
|---|---|---|
| Tree | 20 wood | ~80s (4 trips × 5) |
| Stone node | 50 stone | ~5 min |
| Apple farm plot | infinite | never |

#### Essence

- Zombie drop: **1 liquid essence** on death.
- Liquid decay: **10s** if uncollected.
- Stored: permanent.

#### Spawn costs (V1 starter)

| Thing | Essence | Wood | Stone | Apple | Build time |
|---|---|---|---|---|---|
| **Living units** | | | | | |
| Worker | 5 | — | — | 1 | 5s |
| Scout | 10 | — | — | 1 | 8s |
| Slinger | 12 | — | — | 1 | 8s |
| Sharpshooter | 20 | 5 | — | 2 | 12s |
| Bruiser | 35 | — | 5 | 3 | 15s |
| Biker | 40 | 10 | 5 | 3 | 18s |
| **Defense** | | | | | |
| Wood Wall tile | — | 5 | — | — | 3s |
| Stone Wall tile | — | — | 8 | — | 5s |
| Gate | — | 10 | 5 | — | 5s |
| **Economy** | | | | | |
| Storage Silo *(any one resource)* | — | 15 | 10 | — | 20s |
| Apple Farm Plot | — | 10 | — | 1 | 12s |
| **Vehicles (see §7 for full table)** | | | | | |
| Storage Cart | — | 30 | 10 | — | 30s |
| Buggy | — | 30 | 10 | — | 25s |
| War Truck | 5 | 60 | 30 | 2 | 40s |
| Heavy Carrier | 10 | 100 | 60 | 5 | 60s |

#### Starting conditions for L1

- **1 King** (free, you start with him)
- **3 Workers** (default: 1 wood, 1 stone, 1 farmer)
- **1 Storage Silo of each resource type** (small starter capacity)
- **1 Apple Farm Plot** (already fertile)
- **On hand:** 50 wood, 30 stone, 10 apples, 0 essence
- **Pop cap:** 5 (King + 3 workers + 1 spare). Build a Shack for more.

### 4.7 Why these numbers (design intent)

- **Wood is fast & cheap** — early-game victory route is wood walls + housing.
- **Stone is slow & finite** — gates the heavy pentagon (Bruiser, Biker) and durable buildings.
- **Apples are slowest per worker** — forces multiple farms before military scaling, and double as healing ammo.
- **Essence flows from zombie kills** — zombies are a resource, not just a threat. Engagement is incentivized.
- **Liquid essence decay (10s)** — punishes turtling. You must actively collect.

---

## 5. Worker Roster

Workers are weak fighters and the economic backbone. **Each worker has a fixed role for life** (no reassignment in V1). Workers and soldiers are entirely separate populations — no conversion either way.

### 5.1 The 5 Worker Types

| Type | Job | Where they work |
|---|---|---|
| **Wood Worker** | Chops trees → hauls wood to nearest cart/silo | Forests / wilderness |
| **Stone Worker** | Mines stone nodes → hauls stone | Stone outcrops |
| **Farmer** | Tills plain land → plants → harvests → delivers apples | Farm plots in/near base |
| **Essence Collector** | Picks up liquid essence from zombie corpses | Anywhere zombies die |
| **Builder** | Constructs/repairs buildings, walls, vehicles | Anywhere the player places construction |

### 5.2 Spawn Cost (matches §4.6 table)

| Type | Cost (E/W/S/A) | Build time |
|---|---|---|
| Any worker | 5 / 0 / 0 / 1 | 5s |

All worker types share the same cost. Pick the type at spawn time; cannot change later.

### 5.3 Carry & Delivery Rule

- Worker carries 5 units of their type's resource per trip.
- Visualized as a jelly-stack on the worker's back (re-uses existing stack system).
- Drop-off priority: walks to the **nearest valid container** on the way back — Storage Cart preferred if closer, else Silo.
- A Wood Worker carrying 5 wood en route to drop-off cannot pivot to mining stone — they walk back, drop, then return to their tree.

### 5.4 Combat Behavior (defensive only)

| Stat | Value |
|---|---|
| HP | 30 |
| DMG | 2 |
| Atk/sec | 1.0 |
| SPD | 1.0 |
| Range | 1 (melee, last-resort fists) |

- Workers don't actively defend — that's the soldiers' job.
- If a zombie enters within ~6 tiles, the worker **flees** toward the nearest wall/building. They only fight when cornered.
- A worker can be killed by a single zombie in ~4 hits (8 dmg × 4 = 32 vs 30 HP).
- **Hunger:** workers participate in the hunger system — 1 apple per meal every 200s, 1 HP/sec starvation if no apples available (see §11.11).

### 5.5 Visual Indicator (proposal)

Each worker type wears a distinct color/hat so the player can spot them at a glance:

| Type | Color | Tool icon |
|---|---|---|
| Wood Worker | brown | axe |
| Stone Worker | gray | pickaxe |
| Farmer | green | basket |
| Essence Collector | purple | tube |
| Builder | yellow | hammer |

### 5.6 Open questions

- Do builders **auto-construct** from stockpile when player places a building, or does the player click → place ghost → builder walks → builds? *(Recommend: auto, simpler.)*
- Cap on each worker type individually, or only the total pop cap?
- Can workers cross water / climb cliffs, or only follow ground paths? *(Recommend: ground only, vehicles required for water.)*

---

## 6. Military Pentagon

### 6.1 Locked
- 5 unit types: **Scout, Slinger, Sharpshooter, Bruiser, Biker**.
- 10 counter edges (each unit hard-counters 1-2, is hard-countered by 1-2).
- Hard counter bonus: **1.5× damage** (HT-style).

### 6.2 Counter Graph

| Unit | Role | Hard counters | Countered by |
|---|---|---|---|
| **Scout** | fast light melee, cheap | Biker | Slinger |
| **Slinger** | cheap thrown ranged | Scout | Sharpshooter, Biker |
| **Sharpshooter** | slow long-range | Bruiser | Biker |
| **Bruiser** | tanky heavy melee | Slinger, Scout | Sharpshooter |
| **Biker** | fast heavy charger | Sharpshooter, Slinger | Scout |

### 6.3 V1 Stat Sheet — Proposal

| Unit | HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build | Special |
|---|---|---|---|---|---|---|---|---|---|
| **Scout** | 40 | 5 | 1.5 | 7.5 | 1 | 1.5 | 10 / 0 / 0 / 1 | 8s | Fast melee, cheap; **swims** |
| **Slinger** | 35 | 8 | 0.8 | 6.4 | 4 | 1.3 | 12 / 0 / 0 / 1 | 8s | Lobs rocks (arc projectile); **swims** |
| **Sharpshooter** | 50 | 14 | 0.6 | 8.4 | 8 | 1.0 | 20 / 5 / 0 / 2 | 12s | Long-range straight shot |
| **Bruiser** | 110 | 18 | 0.7 | 12.6 | 1 | 0.8 | 35 / 0 / 5 / 3 | 15s | Knockback on hit |
| **Biker** | 90 | 22 | 0.9 | 19.8 | 1 | 2.0 | 40 / 10 / 5 / 3 | 18s | Charge: first-hit ×2 dmg |

### 6.4 Range Tiers

| Tier | Range | Used by |
|---|---|---|
| Melee | 1 tile | Scout, Bruiser, Biker |
| Thrown | 4 tiles | Slinger |
| Long | 8 tiles | Sharpshooter |

(Tech "English Longbow" equivalent extends Sharpshooter to 10-12 tiles — see §12.)

### 6.5 Attack Patterns

- **Melee (Scout, Bruiser, Biker):** instant on adjacent target.
- **Slinger:** arc projectile, 0.5s travel time. Fast units can dodge.
- **Sharpshooter:** straight-line projectile, 0.3s travel. Hard to dodge.
- **Knockback (Bruiser):** pushes target back 1 tile per hit — disrupts ranged DPS uptime.
- **Charge (Biker):** when entering combat from movement, first hit deals 2× dmg. Resets after target dies.

### 6.6 The King — Special Class (not in pentagon)

| Stat | Value |
|---|---|
| HP | 500 |
| DMG | 30 |
| RNG | 1 (melee) |
| SPD | 0.7 |
| Counter bonus | none (neutral vs all) |
| HP regen | slow passive (TBD rate, no apple cost) |
| Death | game over |

The King is *not* part of the pentagon counter graph — neutral matchups. He fights like a juggernaut Bruiser but slower and tougher. His death ends the level.

### 6.7 TTK Sanity Matrix (with §3 / §9 numbers)

| Attacker → Defender | Counter? | Eff DPS | Def HP | TTK | Feel |
|---|---|---|---|---|---|
| Scout → Biker | hard | 11.25 | 90 | **8.0s** | decisive but committed |
| Slinger → Scout | hard | 9.6 | 40 | **4.2s** | satisfying snipe |
| Sharpshooter → Bruiser | hard | 12.6 | 110 | **8.7s** | kite-and-poke |
| Bruiser → Slinger | hard | 18 | 35 | **1.9s** | brutal, instant |
| Biker → Sharpshooter | hard | 29.7 | 50 | **1.7s** | run-down execution |
| Scout → Slinger | anti | 7.5 | 35 | **4.7s*** | Slinger kites, free hits |
| Bruiser → Sharpshooter | anti | 12.6 | 50 | **4.0s**\*\* | rarely closes; Sharp kites |
| Mirror Scout vs Scout | none | 5 | 40 | **8.0s** | even fight |

\* While Scout closes (3 tiles at speed 1.5 = 2s), Slinger lands ~16 dmg for free. Scout arrives at 24 HP.
\*\* Bruiser speed 0.8 < Sharp speed 1.0 — Sharp kites indefinitely. Scout escort needed.

These show why pure DPS doesn't tell the full story — **range × speed matters as much as DPS**.

### 6.8 Cost-Effectiveness Check

| Unit | DPS / Essence | HP / Essence | Notes |
|---|---|---|---|
| Scout | 0.75 | 4.00 | cheap utility |
| Slinger | 0.53 | 2.92 | range premium |
| Sharpshooter | 0.42 | 2.50 | long range premium |
| Bruiser | 0.36 | 3.14 | HP premium, stone-gated |
| Biker | 0.50 | 2.25 | speed + charge premium |

Slight imbalance: Scout is the most cost-effective per essence. Justified because Scout dies easily and doesn't scale into late wars (paper armor). Bruiser/Biker pay a premium for survivability + stone gating.

### 6.9 Resolved (was open)

- ✓ **Specials**: included for V1 (Bruiser knockback, Biker charge).
- ✓ **Counter bonus**: 1.5× (HT-style).
- ✓ **King healing**: no auto-regen — King uses apples like everyone else (see §11).
- ✓ **Friendly fire**: none. Slinger arcs pass through allies harmlessly.
- ✓ **Worker→Soldier conversion**: none. Workers and soldiers are separate populations (see §5). All 5 soldier types are spawned at the **Flag** — the kingdom's universal spawn point (see §8.3).

### 6.10 Hunger (cross-ref)

All pentagon soldiers participate in the hunger system: **1 apple per meal every 200s**, **1 HP/sec starvation** if no apple is available. Bruiser and Biker do **not** eat more than light units in V1 (kept simple). The King eats **3 apples per meal** (royal portion). See §11.11 for the full mechanic.

---

## 7. Vehicle Roster

Vehicles fill three roles: **war** (auto-attack), **carrier** (troop transport), and **storage** (resource ferry). All vehicles except Storage Cart can attack zombies and competitors via mounted weapons + boarded troops shooting out.

### 7.1 Locked Principles
- Boarded troops are **visible on top** of carrier vehicles and shoot out when enemies enter range.
- Players board troops by **dragging the troop sprite onto the vehicle**.
- If a vehicle's HP hits 0, all boarded troops are **dropped at the wreck site** (alive, with full HP).
- Vehicles can carry **mixed cargo** — personnel slots (workers/troops) + cargo capacity (resources).
- No fuel system in V1. Vehicles cost only to build and repair.

### 7.2 V1 Vehicle Tiers — Proposal

| Vehicle | Personnel | Cargo | HP | Speed | Mounted Atk | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| **Buggy** | 2 (any) | 0 | 80 | 2.0 | 5 dmg/s | 0 / 30 / 10 / 0 | 25s |
| **War Truck** | 5 (any) | 10 res | 200 | 1.5 | 12 dmg/s | 5 / 60 / 30 / 2 | 40s |
| **Heavy Carrier** | 10 (any) | 50 res | 400 | 1.0 | 20 dmg/s + AoE | 10 / 100 / 60 / 5 | 60s |
| **Storage Cart** | 0 | 50 res | 100 | 0.8 | none | 0 / 30 / 10 / 0 | 30s |

> *Personnel slot* = 1 worker OR 1 pentagon troop. *Cargo* = resource units (any type, but locked to one type per cargo bay).

### 7.3 Boarded Troop Combat

Each boarded troop adds their own attack. Example: a War Truck (12 dmg/s mounted) with 4 Sharpshooters (12 dmg/s each):

```
Mounted gun:        12 dmg/s
4 × Sharpshooter:   48 dmg/s
─────────────────
Total:              60 dmg/s
```

This makes carriers feel *menacing* — they're mobile fortresses.

### 7.4 The Resource Run — example loadout

User-described scenario: travel to a distant stone node with one storage cart + one worker + one escort troop.

```
Convoy: [War Truck]
        ├── Slot 1: Worker (will mine)
        ├── Slot 2: Bruiser (escort)
        ├── Cargo: 0 starting, fills with 10 stone
        └── Mounted gun fires at any enemy in range

If attacked en route:
  → Worker hides inside truck (no longer "out" → not sensed by zombies)
  → Truck drives away or fights with mounted + Bruiser shooting out
```

### 7.5 Damage & Repair
- Empty parked vehicles are **ignored by zombies** (sensing rule §3.5). Only attacked when boarded or near living beings.
- Competitors will attack vehicles regardless (they can see structures).
- **Repair formula** (per §11.6): materials = ½ build cost × damage fraction; apples = HP_missing / 50.
- **Repair speed**: 5 HP/sec per Builder worker; multi-Builder stacking caps at 3.0× (per §8.7).
- All vehicles **cross water** by default — a key strategic advantage over most ground troops.

### 7.6 Upgrade Methods (tech-driven, see §12)

Each vehicle can be upgraded via tech research. Proposed upgrades:

| Upgrade | Effect | Vehicle |
|---|---|---|
| **Plate Armor (Mk II)** | +50% HP | All combat vehicles |
| **Reinforced Wheels (Mk III)** | +25% speed | All vehicles |
| **Heavy Caliber (Mk II)** | +30% mounted damage | War Truck, Heavy Carrier |
| **Extended Cargo (Mk II)** | +50% cargo capacity | Storage Cart, Heavy Carrier |

Specifics formalized in §12 once tech tree is designed.

### 7.7 Resolved (was open)

- ✓ **No driver slot.** Vehicles auto-pilot via universal drag-to-waypoint (see §2 Universal Control).
- ✓ **Vehicles spawn at the Flag** (§8.3) — no separate Vehicle Yard in V1.
- ✓ **Command UX** = drag-to-waypoint. Player drags from vehicle to destination; vehicle drives there. Same mechanic as moving the King.
- ✓ **No nested vehicles** in V1. Heavy Carriers can't transport Storage Carts. Reconsider for V2.
- ✓ **All vehicles cross water** — strategic advantage over ground troops.

---

## 8. Building Roster

### 8.1 Locked principles
- Buildings use a **place → ghost → builder construction** flow (see §8.7). Resources deducted at place-time. **More Builder workers = faster construction** (with diminishing returns).
- The **King's death is the only loss condition** — there is no separate Throne building to defend.
- Per-resource silos (locked from §4.3).
- **The Flag** is the universal spawn point — workers, soldiers, and vehicles all spawn here. **1 per base, free at level start, indestructible.** Replaces the older Spawn Building + Vehicle Yard concepts.
- All buildings are placed via free-place; walls auto-snap (per §3 layout principle).

### 8.2 The Full Roster (V1) — 11 buildings

#### Economy (5)

| Building | Function | Cost (W/S/A) | Build | HP | Cap |
|---|---|---|---|---|---|
| **Wood Silo** | Stores wood | 15 / 10 / 0 | 20s | 150 | 200 wood |
| **Stone Silo** | Stores stone | 15 / 10 / 0 | 20s | 150 | 200 stone |
| **Apple Silo** | Stores apples; **aura-heals 5-tile radius** | 15 / 10 / 0 | 20s | 150 | 100 apples |
| **Essence Vault** | Stores essence | 15 / 10 / 0 | 20s | 150 | 200 essence |
| **Apple Farm Plot** | Farmer plants apples here (also constructs the plot via 15s till — Farmer is the builder, not Builder workers); infinite cycles | 10 / 0 / 1 | 15s (Farmer) | 80 | — |

> **Note (V1 simplification):** No Well, Lumber Mill, or Stone Refinery. Workers gather directly to the nearest cart/silo with no buff buildings. Farmers till and plant on whatever fertile land is near their spawn point. Adding speed-buff buildings is a V2 consideration.

#### Defense (4 — one tech-gated)

| Building | Function | Cost (W/S/A) | Build | HP |
|---|---|---|---|---|
| **Wood Wall** (1 tile) | Blocks units; drag-snap chain | 5 / 0 / 0 | 3s | 200 |
| **Stone Wall** (1 tile) | Tougher wall | 0 / 8 / 0 | 5s | 400 |
| **Gate** | Opens for friendlies; weaker than wall | 10 / 5 / 0 | 5s | 150 |
| **Roof** | Covers a tile. Always blocks projectile arcs. **Blocks zombie sense from above only after** Roof Sense Block tech (§12). | 5 / 5 / 0 | 5s | 100 |

> Wall layers HT had (stairs, merlons, battlements) deferred to V2 to keep V1 simple. V1 has flat walls only — no climbing.

#### Central (1)

| Building | Function | Cost (W/S/A) | Build | HP |
|---|---|---|---|---|
| **Flag** | Kingdom symbol; **all spawning happens here** (workers, soldiers, vehicles). 1 per base, **free at level start, indestructible**. | — | — | ∞ |

#### Tech (1)

| Building | Function | Cost (W/S/A) | Build | HP |
|---|---|---|---|---|
| **Research Hut** | Queues tech researches (see §12) | 40 / 20 / 2 | 30s | 200 |

### 8.3 The Flag — Universal Spawn Point

The Flag is the central building of your kingdom. It is **1 per base, indestructible, free at level start** — you cannot move it, rebuild it, or have more than one. All units (workers, soldiers, vehicles) spawn here. The Flag is also the visual symbol of your kingdom — each base has a distinct flag color.

```
        /----|
       /     |
      /      |     THE FLAG
     /       |
    |        |     Click -> menu:
    |        |
    |        |     Workers:   [Wood] [Stone] [Farmer] [Essence] [Builder]
    |        |     Soldiers:  [Scout] [Slinger] [Sharp] [Bruiser] [Biker]
    |        |     Vehicles:  [Buggy] [War Truck] [Heavy Carrier] [Cart]
    |________|
    |        |     Three parallel queues (workers / soldiers / vehicles).
    ----------     Costs and build times per §4.6.
                   Spawned units emerge on the platform around the Flag,
                   then the player drags them via universal drag-to-waypoint.
```

**Three parallel queues** — workers, soldiers, and vehicles each have their own queue and run simultaneously. Within each queue, items build FIFO. This means a Heavy Carrier (60s) does NOT block a Worker (5s) from spawning.

**No Vehicle Yard, no Spawn Building** — they were merged into the Flag for V1 simplicity. One central kingdom hub, everything emerges from it.

### 8.4 (Reserved — was Vehicle Yard, now merged into §8.3 Flag)

### 8.5 Apple Silo — Aura Heal Math

- **Radius:** 5 tiles (same as zombie sense radius for thematic symmetry).
- **Heal rate:** 5 HP/sec passive while in radius.
- **Apple consumption:** 1 apple per 10 HP healed.
- **Stacks** with troop-carried apples and vehicle cargo apples (see §3 / §11).

### 8.6 Population Limits — Implicit via Hunger

V1 has **no hard population cap**. Your population is naturally limited by your apple supply: if your farms can't feed your army, the surplus dies of hunger (see §11.11). To support a bigger army, build more Apple Farm Plots and Apple Silos.

**Sample sustainability:** 1 King + 8 Workers + 8 Soldiers (17 mouths) ≈ 5.7 apples/min. Covered by **1 Farmer with surplus**. Add a 2nd Farmer when you scale further or expect heavy combat losses.

### 8.7 Building Construction Flow (universal)

Same flow for every building — wall, silo, shack, vehicle yard, etc.

```
1. SELECT       Click building icon in top UI bar
                (e.g., [Wall], [Silo], [Spawn Building])
                       ↓
2. PLACE/DRAW   - Walls: drag to draw a line; tiles snap neighbor-to-neighbor
                - Point buildings: click the spot
                       ↓
3. GHOST        Transparent placeholder appears on the map.
                Resources deducted at this moment.
                Cancellable → refund.
                       ↓
4. DISPATCH     Idle Builder workers walk to the ghost site.
                       ↓
5. CONSTRUCT    Building rises tile by tile.
                Multiple builders speed it up.
                       ↓
6. DONE         Building becomes active.
```

**Construction speed scaling (more builders = faster):**

| Builders on site | Speed multiplier |
|---|---|
| 1 | 1.0× (base time) |
| 2 | 1.7× |
| 3 | 2.3× |
| 4 | 2.8× |
| 5+ | 3.0× (cap, diminishing returns) |

This makes Builder workers a meaningful late-game investment — a small army of Builders can wall off a corridor to a stone node in seconds.

#### Wall-specific drag rules

- Click + drag on ground → wall tiles auto-snap into a continuous line.
- Cost computed per-tile, deducted at place-time as a single batch.
- Gates and Roofs can replace individual wall tiles after the chain is built (click tile → "upgrade" menu).

### 8.8 Starting Buildings (L1)

Reaffirms §4.6:
- **1 Flag** (free, indestructible — your kingdom's central spawn point)
- 1 of each Silo (small starter cap, 50 each)
- 1 Apple Farm Plot
- No Research Hut at start — build one to unlock tech research.

### 8.9 Open questions

- Should Vehicle Yard cap how many vehicles exist at once?
- Does a Roof require a Wall under it, or can it stand alone?
- Can you stack walls (double walls)? *(Recommend V1: no, single rows only.)*
- Does the Spawn Building have a max army size, or is the only cap pop-cap from Shacks?

---

## 9. Zombie Threat System

### 9.1 Locked
- Spawn from fixed, visible, **indestructible** spawn points (V1).
- Concurrent global cap ramps over time (see §2 Zombie Pressure Ramp).
- **Sensing rule** (see §3.5): zombies aggro only on living beings within ~8-tile radius. Empty walls/buildings/vehicles/resources ignored.
- V1 has **only one zombie type** (the Shambler — no variants).
- Drop: **1 liquid essence** per kill, decays in 10s.

### 9.2 V1 Zombie Stats — Proposal

| Stat | Value | Notes |
|---|---|---|
| HP | 30 | 2-3 Scout hits |
| DMG (vs living) | 8 / hit | Worker (30 HP) dies in ~4 hits |
| DMG (vs wall) | 3 / hit | Wood wall (200 HP) = 67s solo |
| Attack speed | 1 hit/sec | — |
| Move speed | 1.0 | Slow shamble |
| Sense radius | 8 tiles | Aggros within this range |
| Drop | 1 liquid essence | Decays 10s if uncollected |

### 9.3 AI Priority

When a zombie senses multiple living beings:
1. **Closest** living being takes priority.
2. If equal distance: prefers **workers** (lower HP — easier kill).
3. If a wall blocks path: attacks wall directly until it breaks, then resumes target.
4. If target leaves sense radius: zombie returns to wandering.

### 9.4 Why Killing Zombies Is High-Risk-High-Reward

By design, killing zombies should feel *dangerous but profitable* — not a chore.

- Zombie HP (30) ÷ Scout DPS (~5) = ~6s solo kill. Manageable, but your Scout takes hits during it.
- 1 zombie drops 1 essence, decays in 10s.
- A Scout might die in 5 hits (40 HP ÷ 8 dmg). Feels *risky*.
- Alternative: lure zombies to walls, let walls absorb hits, snipe with Sharpshooters from inside. Slower but safer.
- **The greed loop:** more zombies = more essence; but more zombies = higher risk. Players self-regulate when to push.

### 9.5 Future variants (deferred to V2+)

V1 ships with one type. Later variants (proposal):
- **Sprinter** — fast, low HP. Punishes slow walls.
- **Spitter** — ranged. Forces tower placement.
- **Brute** — high HP, smashes walls fast. Drops 5 essence.
- **Horde Mode** — cap +20 spawn during night cycle (V2).

### 9.6 Resolved (was open)
- ✓ **King has no special sense profile** — zombies aggro on him at the same 8-tile sense radius as any other living being. No auto-regen (King eats apples like everyone, see §11).
- ✓ **Stored apples do NOT attract zombies.** Sensing rule (§3.5) is *living beings only*. Silos packed with apples are invisible to zombies.
- ✓ **Pathfinding around walls** — zombies hammer the nearest wall to reach a sensed living being (per §9.3). No A* around long tunnels in V1.
- ✓ **Wall climbing** — not applicable in V1. No stairs, merlons, or stacking (deferred to V2).

---

## 10. Competitor AI

> **STATUS (2026-04-28):** ✓ Fully designed. The complete spec lives in `PHASE_5_AI.md` — 26 locked decisions across 7 brainstorm rounds. This section retains a one-paragraph summary; for any detail (rival economy, archetypes, attack triggers, raid composition, walls, per-level scaling), see `PHASE_5_AI.md` directly.

### Summary

Each rival base runs the **same economy + military as the player**, in a fully simulated parallel cycle (workers harvest real nodes; the player can ambush them). Three personality archetypes — **Turtle / Rusher / Economist** — perturb a neutral baseline across eight knobs (workers, spending priority, vehicle policy, damage modifier, attack timing, raid composition, retreat threshold, wall shape). Rivals follow a cyclic **ECO → RAID → RECOVER** loop with a DEFEND interrupt; they never fight each other in V1 (player-only target). Rival units deal a **universal +50–100% damage modifier** on every attack (vs player, zombies, walls), tuned per archetype: Turtle 2.0× / Rusher 1.5× / Economist 1.75×. Per-level scaling rides post-raid cooldown (L1: 120s / L2: 60s / L3: 30s) and raid party size (L1: 5 / L2: 6 / L3: 7 — the +1 / +2 unit comes from the archetype's signature unit per `PHASE_5_AI.md` L6.1). **V1 level-win condition: all rival Kings dead** — rival King death sends that base dormant (workers flee, structures decay, no further raids or eco). L1 always spawns **1 Turtle + 1 Rusher** (hand-authored intro); L2 / L3 use constrained random distribution (≥1 of each archetype at L2; ≥2 of each at L3).

For locked specifics — archetype delta matrix, hybrid attack-trigger logic, retreat thresholds, wall shapes, per-level mix — see `PHASE_5_AI.md` §2.

---

## 11. Combat Math

### 11.1 Stat Schema

Every combat-capable entity is defined by:

| Field | Meaning |
|---|---|
| `HP` | Hit points |
| `DMG` | Damage per attack |
| `Atk/sec` | Attack frequency |
| `DPS` | DMG × Atk/sec (derived) |
| `RNG` | Range in tiles |
| `SPD` | Movement speed (tiles/sec) |
| `COST` | E / W / S / A breakdown |
| `COUNTER_BONUS` | List of unit types this counters at 1.5× damage |

### 11.2 Damage Formula

```
effective_DMG = DMG × (1.5 if attacking hard counter else 1.0)
effective_DPS = effective_DMG × Atk/sec
```

### 11.3 TTK (Time to Kill) Formula

```
TTK = defender_HP / attacker_effective_DPS
```

Pure formula. Real combat skews due to range, speed, and AI movement (see §6.7 TTK matrix for kiting examples).

### 11.4 TTK Targets

| Matchup | Target TTK | Feel |
|---|---|---|
| Hitting hard counter | 2–4s | Decisive |
| Mirror matchup | 6–10s | Fair fight |
| Anti-counter (unit that counters you) | 12+s | Bad — switch units |

### 11.5 Apple Healing — Living Units

```
1 apple   = 10 HP restored
Heal rate = 5 HP/sec passive (while in aura or eating)
```

**Apple sources (stack — closest takes priority):**
- Apple Silo aura — 5-tile radius
- Troop's own inventory — each carries up to 2 apples
- Vehicle cargo — boarded troops auto-heal from cargo

**Out-of-aura behavior:** unit walks to nearest apple source, eats until full HP, returns to task.

#### Sanity check

| Unit | HP | Apples to full heal | Time to full |
|---|---|---|---|
| Worker | 30 | 3 | 6s |
| Scout | 40 | 4 | 8s |
| Slinger | 35 | 4 | 7s |
| Sharpshooter | 50 | 5 | 10s |
| Bruiser | 110 | 11 | 22s |
| Biker | 90 | 9 | 18s |
| King | 500 | 50 | 100s |

The King's heavy heal cost (50 apples ≈ 5 minutes of one farmer's output) is by design — strong incentive to keep him out of skirmishes.

### 11.6 Repair — Non-Living (Walls, Buildings, Vehicles)

```
materials_cost = (1/2 × original build cost) × (HP_missing / HP_max)
apples_cost    = HP_missing / 50
                                 (both rounded up)
```

A Builder worker walks to the damaged structure and repairs at **5 HP/sec**. Multiple Builders stack with the same diminishing-returns curve as construction (capped at 3.0× with 5+ Builders, see §8.7).

#### Repair examples (full repair from 0 HP)

| Structure | HP | Build cost | Repair (full) |
|---|---|---|---|
| Wood Wall | 200 | 5W | 3W + 4 apples |
| Stone Wall | 400 | 8S | 4S + 8 apples |
| Gate | 150 | 10W / 5S | 5W / 3S + 3 apples |
| Spawn Building | 250 | 50W / 30S / 2A | 25W / 15S / 1A + 5 apples = 25W / 15S / 6A |
| Buggy | 80 | 30W / 10S | 15W / 5S + 2 apples |
| War Truck | 200 | 60W / 30S / 2A | 30W / 15S / 1A + 4 apples = 30W / 15S / 5A |
| Heavy Carrier | 400 | 100W / 60S / 5A | 50W / 30S / 3A + 8 apples = 50W / 30S / 11A |

### 11.7 Damage Scaling

| Damage source | Multiplier |
|---|---|
| Zombie vs living being | 1.0× (baseline 8 dmg/hit, see §9) |
| Zombie vs wall | ~0.4× (3 dmg/hit) |
| Competitor unit vs living | 1.5–2× zombie damage (more threatening per hit) |
| Counter bonus | 1.5× |
| Biker first-hit charge | 2.0× (special, see §6.5) |

### 11.8 Detection / Aura Radii (consolidated)

| Radius | Tiles | Used by |
|---|---|---|
| Zombie sense | 8 | §9 — zombies aggro on living beings |
| Worker flee | 6 | §5 — workers run when zombies enter this range |
| Apple Silo aura | 5 | §8 — auto-heals living units |
| Sharpshooter range | 8 | §6 — long-range attack |
| Slinger range | 4 | §6 — thrown attack |
| Melee range | 1 | §6 — Scout / Bruiser / Biker / King |

### 11.9 Resolved (was open)

- ✓ Apple-per-HP: 1 apple = 10 HP (living units), 1 apple = 50 HP (non-living repair).
- ✓ Heal rate: 5 HP/sec.
- ✓ Counter bonus: 1.5×.
- ✓ King heals identically to other living units (no special regen).
- ✓ Builder repair speed: 5 HP/sec, multi-Builder scaling per §8.7.
- ⚠ ~~Troops carry up to 2 apples in personal inventory.~~ **OVERRIDDEN 2026-04-28.** Soldiers and the King do NOT carry apples and do not auto-eat in combat. See `[PHASE_2_ENTITIES.md §2.8 Apple Feeding System]` for V1 locked rules.

### 11.10 Open questions

None remaining for V1. All numbers are starter proposals — tune from playtest.

### 11.11 Hunger & Starvation

**Every living being has a Hunger meter.**

```
Hunger increases at 1 per second.
At Hunger = 200, unit auto-eats from nearest apple source.
King eats 3 apples per meal; everyone else eats 1.
If no apple available: 1 HP/sec starvation damage until fed or dead.
Damage stops the moment the unit eats.
```

**Apple sources (V1 locked 2026-04-28 — see `[PHASE_2_ENTITIES.md §2.8 Apple Feeding System]`):**
- Nearest **Apple Silo** OR **Storage Cart** within 10-tile range cap (whichever is closer).
- **Apple Silo aura** (5-tile passive heal radius — see `[PHASE_3_BUILDINGS.md §3.3.4]`).

> The previous lines about troops' own inventory + vehicle cargo are **OVERRIDDEN**. Troops do not carry apples, and boarded troops do not auto-eat from vehicle cargo. Soldiers and the King eat only between fights (combat-mode gate per §2.8.6).

**Hunger stat table:**

| Unit | HP | Time to max hunger | Time to starve to death (after max) | Apples/meal | Steady-state apples/min |
|---|---|---|---|---|---|
| Worker | 30 | 200s | +30s | 1 | 0.30 |
| Scout | 40 | 200s | +40s | 1 | 0.30 |
| Slinger | 35 | 200s | +35s | 1 | 0.30 |
| Sharpshooter | 50 | 200s | +50s | 1 | 0.30 |
| Bruiser | 110 | 200s | +110s | 1 | 0.30 |
| Biker | 90 | 200s | +90s | 1 | 0.30 |
| King | 500 | 200s | +500s | **3** | 0.90 |

**Sustainability check:**

| Composition | Mouths | Demand (apples/min) | Farmers needed |
|---|---|---|---|
| L1 starter (King + 3 Workers) | 4 | 1.8 | 1 (with huge surplus) |
| Mid-game (King + 8 Workers + 5 Soldiers) | 14 | 4.8 | 1 (tight) |
| Late-game (King + 8 Workers + 12 Soldiers) | 21 | 6.9 | 2 (comfortable) |

**Implications:**

- **Apple is now the most strategically central resource** — economy (spawn cost) + health (heal) + sustenance (hunger). Triple duty.
- **Long-distance operations** (sieges, expeditions) MUST pack apples in vehicle cargo or troops starve mid-fight.
- **Standing army tax** — idle armies still consume apples → encourages active play, punishes hoarding.
- **Implicit population cap** — if farms can't feed your army, surplus dies. Self-regulating economy without a Shack mechanic.

---

## 12. Progression / Tech Tree

### 12.1 Locked Principles

- Per HT: techs **MODIFY** existing units/buildings; they do **NOT** add new ones. Pentagon stays the same size; tech shifts the math.
- Research at the **Research Hut** (§8). One queue per Hut.
- V1: **per-level** — research starts fresh each level. V2+ may carry forward.
- **No prerequisites** — all 7 techs available from level start. Cost is the gate.

### 12.2 The 7 Techs (V1) — Proposal

| Tech | Tier | Effect | Modifies | Cost (E/W/S/A) | Research time |
|---|---|---|---|---|---|
| **Reinforced Walls** | early | Wall HP +25% (Wood 200→250, Stone 400→500) | §8 Walls | 50 / 30 / 20 / 5 | 60s |
| **Coinage** | early-mid | Spend any silo's resources from anywhere — no Storage Cart needed for transit | §4 Economy | 80 / 50 / 30 / 5 | 90s |
| **English Longbow** | mid | Sharpshooter range +4 tiles (8 → 12) | §6 Sharpshooter | 100 / 60 / 40 / 10 | 120s |
| **Plate Armor** | mid | All vehicles +50% HP | §7 Vehicles | 120 / 80 / 60 / 10 | 150s |
| **Roof Sense Block** | mid-late | Existing Roofs gain zombie-sense blocking (corridors become invisible from above). Roofs themselves are buildable from level start. | §3 / §8 Roof | 150 / 100 / 70 / 15 | 180s |
| **Reinforced Wheels** | late | All vehicles +25% speed | §7 Vehicles | 200 / 120 / 80 / 20 | 240s |
| **Heavy Caliber** | late | Vehicle mounted attack +30% | §7 Vehicles | 250 / 150 / 100 / 25 | 240s |

### 12.3 Why These 7 (strategic intent)

| Tech | Strategic Use |
|---|---|
| Reinforced Walls | Buys time vs zombies and competitor sieges; boosts the wall-tunnel mechanic. |
| Coinage | Removes Storage Cart logistics; huge QoL mid-late game. Optional — skip if you like the ferry economy. |
| English Longbow | Counter-counters Biker — Sharpshooter outranges Biker's charge. |
| Plate Armor | Vehicles survive longer on expedition runs and sieges. |
| Roof Sense Block | Enables enclosed corridors invisible to zombies. Reshapes base layout. |
| Reinforced Wheels | Mobility — faster harvest cycles, faster sieges. |
| Heavy Caliber | Vehicles become real frontline fortresses, not just transports. |

Notice the pattern: **every tech makes existing systems better.** No new units, no new buildings, no new mechanics — just deeper math on what already exists. That's HT's secret to keeping the roster tight and the depth high.

### 12.4 Tech Order (visual — order is by cost only, no hard prereqs)

```
+---------------------+
|    RESEARCH HUT     |
+----------+----------+
           |
    +------+------+------+------+------+------+
    |      |      |      |      |      |      |
 Reinf   Coin   Eng    Plate   Roof   Reinf  Heavy
 Walls          Long   Armor  Sense   Wheels Caliber
                bow            Block

  EARLY          MID          MID-LATE       LATE
  (cheaper)                                  (most expensive)
```

### 12.5 Research UX

```
Click Research Hut -> menu of 7 techs:

  [Reinforced Walls]   50/30/20/5    60s     [RESEARCH]
  [Coinage]            80/50/30/5    90s     [RESEARCH]
  [English Longbow]    100/60/40/10  120s    [RESEARCH]
  [Plate Armor]        120/80/60/10  150s    [in progress 47s]
  [Roof Sense Block]   150/100/70/15 180s    [LOCKED - already had?]
  [Reinforced Wheels]  200/120/80/20 240s    [RESEARCH]
  [Heavy Caliber]      250/150/100/25 240s   [RESEARCH]

Researching locks the Hut for that duration.
Build a 2nd Research Hut to parallel-research.
```

### 12.6 Open Questions

- Tech dependencies (e.g., Plate Armor before Heavy Caliber)? V1 = no, V2 may add.
- Persistence across levels? V1 = no, V2+ feature.
- Tech costs need playtest tuning.
- Should "Coinage" be later-tier given how QoL it is? Or keep early-mid for sandbox accessibility?

---

## 13. Balance Tables — V1 Master Reference

> Consolidates every stat scattered across §1-§12 into one sheet. This is the single page to consult during implementation and playtest. All numbers are **V1 starter values** — tune from playtest.

### 13.1 Resources & Gather Rates

**Per-worker rates** (baseline, see §4.6):

| Worker Type | Yield/trip | Time/trip | Rate/min |
|---|---|---|---|
| Wood Worker | 5 wood | 20s | ~15 wood/min |
| Stone Worker | 5 stone | 30s | ~10 stone/min |
| Farmer | 5 apples per cycle | 30s cycle | ~10 apples/min |
| Essence Collector | 1 essence | 5s | gated by kill rate |

**Resource rules:**
- Workers carry 5 units per trip; drop at nearest cart/silo.
- Workers fixed-role for life (no reassignment).
- Liquid essence decays in **10s**; stored is permanent.

**Node yields:**
- Tree: 20 wood total → tree dies (very slow / no respawn).
- Stone node: 50 stone → depletes permanently.
- Apple Farm Plot: infinite cycles.

### 13.2 Soldiers (Pentagon)

| Unit | HP | DMG | Atk/sec | DPS | RNG | SPD | Cost (E/W/S/A) | Build | Special / Water |
|---|---|---|---|---|---|---|---|---|---|
| Scout | 40 | 5 | 1.5 | 7.5 | 1 | 1.5 | 10/0/0/1 | 8s | — / **swims** |
| Slinger | 35 | 8 | 0.8 | 6.4 | 4 | 1.3 | 12/0/0/1 | 8s | arc projectile / **swims** |
| Sharpshooter | 50 | 14 | 0.6 | 8.4 | 8 | 1.0 | 20/5/0/2 | 12s | straight shot |
| Bruiser | 110 | 18 | 0.7 | 12.6 | 1 | 0.8 | 35/0/5/3 | 15s | knockback 1 tile |
| Biker | 90 | 22 | 0.9 | 19.8 | 1 | 2.0 | 40/10/5/3 | 18s | charge ×2 first hit |

**Counter graph (1.5× damage):**

| Unit | Counters | Countered by |
|---|---|---|
| Scout | Biker | Slinger |
| Slinger | Scout | Sharpshooter, Biker |
| Sharpshooter | Bruiser | Biker |
| Bruiser | Slinger, Scout | Sharpshooter |
| Biker | Sharpshooter, Slinger | Scout |

### 13.3 Workers & King

**Workers (all 5 types share the same combat stats):**

| HP | DMG | Atk/sec | RNG | SPD | Cost (E/A) | Build | Flee radius |
|---|---|---|---|---|---|---|---|
| 30 | 2 | 1.0 | 1 | 1.0 | 5/1 | 5s | 6 tiles |

**King (special class, not in pentagon):**

| HP | DMG | Atk/sec | RNG | SPD | Counter | Heal |
|---|---|---|---|---|---|---|
| 500 | 30 | 1.0 | 1 | 0.7 | none (neutral) | apples only, no auto-regen |

### 13.4 Vehicles

| Vehicle | Personnel | Cargo | HP | Speed | Mounted DPS | Cost (E/W/S/A) | Build |
|---|---|---|---|---|---|---|---|
| Buggy | 2 | 0 | 80 | 2.0 | 5 | 0/30/10/0 | 25s |
| War Truck | 5 | 10 res | 200 | 1.5 | 12 | 5/60/30/2 | 40s |
| Heavy Carrier | 10 | 50 res | 400 | 1.0 | 20 + AoE | 10/100/60/5 | 60s |
| Storage Cart | 0 | 50 res | 100 | 0.8 | none | 0/30/10/0 | 30s |

Boarded troops shoot out — each adds their own DPS to vehicle. Wreck → troops dropped at site, alive, full HP.

### 13.5 Buildings (11)

**Economy (5):**

| Building | HP | Cost (W/S/A) | Build | Capacity |
|---|---|---|---|---|
| Wood Silo | 150 | 15/10/0 | 20s | 200 wood |
| Stone Silo | 150 | 15/10/0 | 20s | 200 stone |
| Apple Silo | 150 | 15/10/0 | 20s | 100 apples + aura heal |
| Essence Vault | 150 | 15/10/0 | 20s | 200 essence |
| Apple Farm Plot | 80 | 10/0/1 | 15s (Farmer-built — see `[PHASE_3_BUILDINGS.md §3.3.6]`) | infinite cycles |

**Defense / Central / Tech:**

| Building | HP | Cost (W/S/A) | Build | Notes |
|---|---|---|---|---|
| Wood Wall (1 tile) | 200 | 5/0/0 | 3s | drag-snap |
| Stone Wall (1 tile) | 400 | 0/8/0 | 5s | drag-snap |
| Gate | 150 | 10/5/0 | 5s | opens for friendlies |
| Roof | 100 | 5/5/0 | 5s | always buildable; blocks arcs; sense-block via tech |
| **Flag** | ∞ | — | — | 1 per base, free at start, **indestructible**; spawns workers/soldiers/vehicles (3 parallel queues) |
| Research Hut | 200 | 40/20/2 | 30s | queues techs |

### 13.6 Zombies (V1 = 1 type, Shambler)

| Stat | Value |
|---|---|
| HP | 30 |
| DMG vs living | 8 / hit |
| DMG vs wall | 3 / hit |
| Atk speed | 1 hit/sec |
| Move speed | 1.0 |
| Sense radius | 8 tiles |
| Drop | 1 liquid essence (decays in 10s) |

**Spawn cap ramp:**

| `X₀` initial | `+Y` per `N` | `X_max` |
|---|---|---|
| 15 | +5 per 60s | 60 |

### 13.7 Tech Tree (7 techs, no prereqs, per-level)

| # | Tech | Effect | Cost (E/W/S/A) | Time |
|---|---|---|---|---|
| 1 | Reinforced Walls | Wall HP +25% | 50/30/20/5 | 60s |
| 2 | Coinage | Global resource pool | 80/50/30/5 | 90s |
| 3 | English Longbow | Sharpshooter range +4 | 100/60/40/10 | 120s |
| 4 | Plate Armor | Vehicle HP +50% | 120/80/60/10 | 150s |
| 5 | Roof Sense Block | Roofs hide units from zombie sense | 150/100/70/15 | 180s |
| 6 | Reinforced Wheels | Vehicle speed +25% | 200/120/80/20 | 240s |
| 7 | Heavy Caliber | Vehicle mounted attack +30% | 250/150/100/25 | 240s |

### 13.8 Combat Multipliers (consolidated)

| Source | Multiplier |
|---|---|
| Counter bonus (any unit hitting hard counter) | 1.5× |
| Biker first-hit charge | 2.0× |
| Zombie vs wall (vs living being) | 0.4× (3 vs 8) |
| Competitor unit damage modifier (universal — vs player, zombies, walls) | 1.5×–2.0× per archetype: Turtle 2.0× / Rusher 1.5× / Economist 1.75× (`PHASE_5_AI.md` L4.1, L6.1) |

### 13.9 Detection / Aura Radii (consolidated)

| Radius | Tiles | What |
|---|---|---|
| Zombie sense | 8 | Aggro on living beings |
| Worker flee | 6 | Workers run from zombies |
| Apple Silo aura | 5 | Auto-heal living units |
| Sharpshooter range | 8 | Long-range attack |
| Slinger range | 4 | Thrown attack |
| Melee range | 1 | Scout / Bruiser / Biker / King / Worker |

### 13.10 Healing & Repair

| Target | Apple cost | Rate |
|---|---|---|
| Living unit | 1 apple = 10 HP | 5 HP/sec |
| Non-living repair | 1 apple = 50 HP + (½ build cost × damage frac) | 5 HP/sec per Builder |

Builder construction/repair stacks: 1× → 1.7× → 2.3× → 2.8× → 3.0× cap (5+ builders).

> **2026-04-28 reconciliation:** the previous "troops carry up to 2 apples / auto-eat in combat" line has been removed. Soldiers and the King do NOT carry apples and do NOT auto-eat in combat — see `[PHASE_2_ENTITIES.md §2.8 Apple Feeding System]`, locked Q3=B (no mid-combat eating) and AQ7 default (no eating from carry). Eating happens only between fights, only from a Silo or Storage Cart within 10 tiles.

### 13.11 Starting Conditions (L1)

| Resource / Asset | Starting Amount |
|---|---|
| King | 1 |
| Workers | 3 (1 Wood, 1 Stone, 1 Farmer) |
| Soldiers | 0 |
| Flag | 1 (free, indestructible — universal spawn point) |
| Silos | 1 of each (50 cap each) |
| Apple Farm Plot | 1 |
| Wood | 50 |
| Stone | 30 |
| Apple | 10 |
| Essence | 0 |
| Pop cap | none — limited implicitly by apple supply (§11.11) |

### 13.12 Level Scaling

**V1 ships with 3 levels only.**

| Level | Total bases | Player + Rivals | Zombie spawn points |
|---|---|---|---|
| L1 | 3 | 1 + 2 | 2 |
| L2 | 5 | 1 + 4 | 3 |
| L3 | 7 | 1 + 6 | 4 |

**V1 level-win condition:** all rival Kings dead. Rival King death → that rival base goes dormant (workers flee, structures decay, no further raids or eco). Future versions (V1.5+) may use alternative win conditions (survival timer, free-the-world-from-zombies objective, etc.). See `PHASE_5_AI.md` §2 (L2.4) for full rival-defeat behavior.

---

## Design Principles (locked)

1. **Pentagon over triangle** — 5 military units with 10 counter edges. No unit is best overall.
2. **Four resources, not twenty** — essence / wood / stone / apple. Every spend is a tradeoff against every other spend.
3. **Apple = the survival nexus** — economy (spawn cost) + health (heal injuries) + sustenance (hunger). Triple-duty makes apple scarcity the heartbeat pressure.
4. **Fixed-role population** — workers and soldiers are separate populations; no conversion. Each worker is locked to one resource job for life.
5. **Techs modify, don't add** — depth without roster bloat.
6. **Walls are modular** — layered defense (wall/gate/stairs/merlon/battlement/roof), each layer has a specific attacker.
7. **Walls = infrastructure, not active defense** — empty walls ignored by zombies; only sensed living beings trigger aggro.
8. **Three pressures always** — zombies + competitors + hunger. You can never fully turtle.
9. **Single-point-of-failure** — King's death = game over. Creates constant tension.
10. **Scarcity-driven conflict** — finite resources, not capturable territory. The fight is over what's left.

---

## Changelog

- **2026-04-24** — Doc created. Foundations locked (perspective, win/lose, sandbox, 4 resources, pentagon roles, pop cap model, apple storage, vehicle boarding, theme). Sections 1–2 fully drafted; sections 3–12 stubbed with open questions.
- **2026-04-25 (am)** — Section 3 (Economy → §4 after renumber) fully drafted. Locked: 1 zombie type V1, 1 essence/zombie, two-state essence with 10s liquid decay, type-locked per-resource silos, 1-type worker carry with empty-before-reassign, Storage Cart for V1 cross-base transport (Coinage as later tech). V1 starter balance numbers proposed.
- **2026-04-25 (pm)** — Section 3 (World & Map Structure) added — natural resource distribution, no outposts, finite/non-renewing resources, fertile-anywhere farms, **zombie sensing radius rule**, two safe-travel methods (wall tunnel vs vehicle). Section 7 (Vehicles) fleshed out with 4-tier proposal (Buggy / War Truck / Heavy Carrier / Storage Cart) plus combat/repair/upgrade rules. Section 9 (Zombies) updated with sensing rule, V1 stat proposal, AI priority, and risk-reward framing. All sections renumbered: §3 → §4, §4 → §5, …, §12 → §13.
- **2026-04-25 (eve)** — Section 6 (Military Pentagon) fully drafted. V1 stat sheet for all 5 units (HP, DMG, atk/s, RNG, SPD, cost, build, special). Counter bonus locked at 1.5×. Range tiers (melee/thrown/long = 1/4/8 tiles). Attack patterns (knockback for Bruiser, charge for Biker). King as special class outside pentagon (HP 500, DMG 30, neutral). TTK sanity matrix included.
- **2026-04-25 (night)** — Section 5 (Workers) fully drafted: **fixed-role for life, no reassignment**. 5 distinct worker types (Wood/Stone/Farmer/Essence/Builder) with own colors and indicators. Workers and soldiers are separate populations — no conversion either way. Workers fight only as last resort (HP 30, DMG 2, flee at sense-radius 6). All §6 open questions resolved (specials yes, 1.5× counter, no king regen, no friendly fire, soldiers spawn at single Spawn Building per §8). Design Principle #4 updated to "fixed-role population."
- **2026-04-25 (late night)** — Section 8 (Buildings) fully drafted: 13 buildings across Economy (5) / Housing (1) / Defense (4) / Military (2) / Tech (1). King-only loss target (no Throne building). V1 wall layers simplified to Wood Wall + Stone Wall + Gate + Roof (stairs/merlons/battlements deferred to V2). Apple Silo aura heal locked at 5 HP/sec, 1 apple per 10 HP, 5-tile radius. Single Spawn Building queues all 5 soldier types; single Vehicle Yard required for all vehicles; single Research Hut for tech. **Building flow (locked):** select-tool → draw/place → ghost appears (resources deducted) → idle Builder workers walk to site → construct over time. More Builders = faster construction (cap at 3.0× with 5+ builders). Cut Well + Lumber Mill + Stone Refinery from V1 — workers gather directly with no buff buildings; farmers till nearby land directly.
- **2026-04-26 (am)** — Section 11 (Combat Math) fully drafted. Locked numbers: 1 apple = 10 HP for living units, 1 apple = 50 HP for non-living repair, heal rate 5 HP/sec, counter bonus 1.5×, troops carry up to 2 apples in personal inventory. King heal cost = 50 apples / 100s by design (incentive to keep him out of skirmishes). Repair formula scales with damage fraction. Builder repair speed: 5 HP/sec with multi-Builder stacking (3.0× cap). Detection/aura radii consolidated table. All §11 open questions resolved pending playtest.
- **2026-04-26 (mid am)** — Section 12 (Tech Tree) fully drafted. 7 techs proposed across 3 tiers: Reinforced Walls (early), Coinage (early-mid), English Longbow (mid), Plate Armor (mid), Roof Sense Block (mid-late), Reinforced Wheels (late), Heavy Caliber (late). All techs MODIFY existing units/buildings — none add new ones (HT principle). V1: per-level research, no prerequisites, single queue per Research Hut. Cost is the only gate.
- **2026-04-26 (late am)** — Section 13 (Balance Tables) fully drafted. Master reference sheet consolidating every stat across §1-§12: resources & gather rates, all 5 soldiers, workers + King, all 4 vehicles, all 13 buildings, zombies (incl. cap ramp), 7 techs, combat multipliers, detection/aura radii, healing & repair, starting conditions, level scaling. 12 sections complete; only §10 Competitor AI remains (intentionally last per plan).
- **2026-04-26 (noon)** — Gap Sweep started, section by section. **§1 Identity:** no gaps. **§2 Core Loop:** zombie cap ramp locked at V1 starter values (X₀=15, +5 per 60s, max=60). V1 SCOPE LOCKED: ships with **L1, L2, L3 only**; L4+ removed from doc as a post-launch concern.
- **2026-04-26 (early pm)** — Gap Sweep §3 World & Map closed. **Trees: no regrowth in V1** (matches stone non-renewability — scarcity drives conflict). **Roofs: always buildable** (cost 5W/5S, HP 100); pre-tech they block projectile arcs from above; Roof Sense Block tech (§12) adds zombie-sense blocking. Updates rippled to §3.2, §3.7, §8.2, §12.2, §13.5.
- **2026-04-26 (mid pm)** — Gap Sweep §4 Economy closed. **Silo overflow rule locked: worker goes idle** when all silos for their resource are full. Visible idleness pressures the player to build more silos.
- **2026-04-26 (late pm)** — Gap Sweep §5 Workers + major design pivot: **HUNGER SYSTEM added**. Every living being eats 1 apple per 200s (King eats 3); 1 HP/sec starvation if no apple available. Population is now implicitly capped by apple supply. **Shack removed from V1** (its pop-cap job replaced by hunger). Updated: §1 → Three-Pressure Structure (zombies + competitors + hunger), §4.6 spawn costs (no Shack), §5.4 (worker hunger note), §6.10 (pentagon hunger cross-ref), §8.2 (12 buildings, no Housing category), §8.6 (Pop Cap → implicit hunger limit), §11.11 NEW (full Hunger & Starvation mechanic), §13.5 (12 buildings, no Shack), §13.11 (no pop cap), Design Principles #3 (Apple = survival nexus) and #8 (three pressures).
- **2026-04-26 (evening)** — Gap Sweep §6 (closed via §6.10 hunger cross-ref) and §7 Vehicles closed. **Universal Drag-to-Waypoint** locked as the single command mechanic for all entities (King, workers, soldiers, vehicles); no joysticks, no clicks. New §2 subsection added. Vehicles **auto-pilot** (no driver slot). **Water crossing** added: all vehicles cross water; Scout + Slinger can swim; other living beings need a vehicle or must go around. Water bodies added to §3.2 as natural map terrain. §7.4 repair pinned to §11.6 formula and §8.7 Builder scaling. §7.7 open questions all resolved.
- **2026-04-26 (night)** — Gap Sweep §8 closed + major design pivot: **THE FLAG** introduced. The Flag is the kingdom's central building — 1 per base, indestructible, free at level start, **all spawning happens here** (workers, soldiers, vehicles via 3 parallel queues). **Spawn Building and Vehicle Yard removed and merged into Flag.** Building count: 11 (was 12). New category: Central (1). 8A Vehicle Yard cap moot (no Yard exists). 8B Roof requires Wall under it (locked). Updates rippled to §6.9, §7.7, §8.1/8.2/8.3/8.4/8.8, §13.5, §13.11.
- **2026-04-26 (late night)** — Gap Sweep §9 Zombies closed. King has same 8-tile sense profile as any other living being. **Stored apples do NOT attract zombies** (sensing rule is living-beings-only). Zombies hammer nearest wall to reach sensed targets (no A* around tunnels in V1). Wall climbing N/A in V1. **Gap Sweep complete** for §1–§9, §11, §12, §13. Only §10 Competitor AI remains for design.
- **2026-04-27** — §10 Competitor AI **deferred** to post-fundamentals (design resumes after Phase 5 of implementation plan). New companion doc `IMPLEMENTATION_PLAN.md` created. Pivot from design → implementation planning. Phase 1 (Environment) opened for design discussion: aesthetic style, generation approach, map size, boundary type.
- **2026-04-28 (Phase 5 locked)** — `PHASE_5_AI.md` created and fully designed: 26 locked decisions across 7 brainstorm rounds covering Competitor AI in full. **§10 patched** — replaced the deferred stub with a one-paragraph summary + redirect to `PHASE_5_AI.md`. **§13.8 patched (A-2):** "Competitor unit vs zombie damage" row relabeled to "Competitor unit damage modifier (universal — vs player, zombies, walls)" with per-archetype values (Turtle 2.0× / Rusher 1.5× / Economist 1.75×). **§13.12 patched (A-1):** added V1 level-win condition (all rival Kings dead). **Conflict C-1** (the §10 vs §13.8 reading of the 1.5–2× multiplier) RESOLVED in favor of universal modifier. Phase 6 (Polish) is the only remaining V1 design phase.

---

*Inspired by and modeled on [High Treason reference doc](./high_treason_reference.md). Compiled April 2026.*
