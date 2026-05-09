# Prototype Plan — 5-Min Intense Demo (LOCKED 2026-05-04)

**Status:** ✓ All 5 rounds locked. 25 decisions across mechanism / ghost lineup / state machine / system trim / edges. **Ready for implementation.**

**Purpose:** Build a **≤5-minute high-intensity playable prototype** of the V1 game idea BEFORE committing to full V1 implementation. Validate theme, economy loop, combat feel, and the 5-act intensity arc. Reuses existing project patterns where possible to ship in days, not weeks.

**NOT a vertical slice. NOT V1.** Standalone artifact with its own mechanics that may diverge from V1 locked decisions (e.g., this prototype uses no silos and no hunger, both core to V1).

---

## §0. Carried-Forward Direction

**5-act intensity arc (locked):**

```
intensity → ⠁ ⠂ ⠠ ⢀ ⢂ ⡂ ⢄ ⣀ ⣄ ⣶ ⣷ ⣿ ⣿ ⣿ ⣿ ⣿
            0:00────1:00────2:00────3:00────4:00────5:00
            └act 1┘└act 2┘└act 3┘└act 4┘└act 5┘
             calm   build  comfy  CRISIS climax

Act 1 (0–1m)   alone — zombies appear — kill — collect essence — spawn 1st troop
Act 2 (1–2m)   more zombies — collect wood — build first walls
Act 3 (2–3m)   spawn workers — automate — base feels strong
Act 4 (3–4m)   TWIST — rival raid hits — heavy loss — see rival base on map
Act 5 (4–5m)   strategize — push — kill rival King = win
```

**Other locked principles:**
- **Map:** small, single-screen visible at default zoom.
- **Health bars** real on player / troops / walls.
- **No menu scrolling** — every interaction is in-world, ambient, immediate.
- **Visual style:** stick-man minimal (matches V1 aesthetic).

---

## §1. Open Questions

**ALL 5 ROUNDS LOCKED (2026-05-04).** No open questions remain. See §2 for the 25 locked decisions, §3 for the summary, §4 for the full state machine + numbers reference.

---

## §2. Locked Decisions

**Round 1 (mechanism foundations):**
- **L1.1** Control = **drag-to-waypoint** (V1's locked pattern, not joystick).
- **L1.2** Build mechanism = **hybrid: ghost-shape buildings with floating cost labels** above them. Ghost teaches WHAT will be built; cost label teaches HOW MUCH. No menu.
- **L1.3** Marker / ghost placement = **pre-placed at level start**, scripted per the 5-act timeline. No player-driven placement in prototype.
- **L1.4** Resource delivery = **player carries early (act 1–2), workers auto-carry from act 3**. Workers are the automation upgrade beat.
- **L1.5** Troop autonomy = **autonomous with drag-override**. Troops auto-aggro on enemies in range; player can drag-to-override for strategic moves (defend wall, rally for the act-5 push).

**Round 2 (ghost lineup + reveal cadence):**
- **L2.1** [Q5] Building roster = **tight** — Spawn Pad (1) + Wall sections (5) + Gate (1) + Worker Pad (1) + Attack Ready zone (1). **NO SILOS.** Resources held in player carry-inventory (large cap, e.g., 50 wood / 50 essence).
- **L2.2** [Q6] Rival base reveal = **hidden until act 4**. Dramatic dust-clears reveal when raid hits. Maximizes the "we're not alone" moment.
- **L2.3** [Q7] Worker count in act 3 = **3 specialized workers**: Wood Worker (auto-harvests trees), Essence Collector (auto-picks zombie drops), Builder/Runner (auto-delivers resources to incomplete ghosts).
- **L2.4** [Q8] Apple/hunger/healing = **OUT**. Prototype uses 2 resources (essence, wood). No hunger ticker, no apple farm, no apple-heal. **Troops die permanently when HP hits 0** — losses in act 4 stay lost; act-5 comeback is genuinely earned.

**Round 3 (script — state machine, not timeline):**
- **L3.1** Trigger model = **state-machine, milestone-driven**. Each state advances when its exit condition is met (kill count, build count, deposit count). **30s per-state safety-net timer** — if player stalls, the next state force-fires.
- **L3.2** Wave-size escalation curve = **5 → 10 → 15 → 20 → 10** (open burst → mid → late → rival raid → final push).
- **L3.3** Visual-prompt loudness = **medium** — glow pulse + soft chime when a prompt appears; arrow + decay highlight on dropped essence; tree-pulse + arrow when wood is needed.
- **L3.4** Damage feedback = **heavy** — red tint flash + screen shake + grunt sound when player or soldier is hit. HP bar drops visibly.
- **L3.5** Script style = **fully hand-authored** for prototype (no per-run randomness in v1 of the prototype).
- **L3.6** Combat + resource numbers — see §4 numbers reference table.
- **L3.7** Reuse of existing project patterns = **jelly stack** (resources stack on player's back with wobble), **magnetic harvest** (essence disks arc to player), **drain & build** (stand on ghost → resources drain 1-by-1 with visual feedback). Prototype implementation reuses these directly from the existing codebase where they fit.
- **L3.8** Full 5-act state machine — see §4 Script below.

**Round 4 (system trim):**
- **L4.1** [Q9] Soldier classes = **2 classes — Scout (fast/cheap) + Bruiser (slow/strong)**. Two separate Spawn Pads visible from act 1 state C — Scout Pad pulses 8E, Bruiser Pad pulses 15E. Player walks to whichever they want to feed. Stats added to §4 numbers reference.
- **L4.2** [Q10] Rival archetype labeling = **none**. Single "rival" with prototype-tuned stats per §4. The 3-archetype V1 system is skipped — prototype's lone rival raids once and dies once.
- **L4.3** [Q11] Tech tree = **OUT**. No tech research in prototype.
- **L4.4** [Q12] System inventory = accept the trim as drawn. All locked exclusions/inclusions confirmed.

**Round 5 (edges):**
- **L5.1** [Q13] Failure mode (player King dies) = **Game-over screen ("Defeated") + retry / quit buttons**, preceded by T3 hitstop + slow fade per Phase 6 polish (L6.3).
- **L5.2** [Q14] Tutorial = **no overlays**. Visual prompts (glowing ghosts, pulsing trees, decay arrows on essence drops) ARE the tutorial. Player learns by doing.
- **L5.3** [Q15] Alert sounds = **2-tier (simplified from Phase 6's 3-tier)**: critical (King in danger / raid incoming) = piercing chime; info (build complete) = quiet ping. No warning tier in prototype.
- **L5.4** [Q16] Restart flow = **Stats screen → "Play Again" button**. Stats shown: zombies killed, time, peak essence + wood, did you survive, did you kill rival King. Single-tap retry.

---

## §3. Summary

**25 locked decisions across 5 rounds.** Prototype is a ≤5-minute high-intensity playable demo of the V1 game idea, designed to validate theme + economy loop + combat feel + 5-act intensity arc BEFORE V1 implementation begins.

**The prototype at a glance:**

- **Control:** drag-to-waypoint (V1 pattern). Player + troops both respond to drag; troops auto-aggro on enemies in range, drag overrides for strategic moves.
- **Build:** ghost-shape buildings with floating cost labels, pre-placed at level start. No menus — player walks resources to ghosts (drain & build pattern from existing project).
- **Economy:** 2 resources only (essence + wood). No silos — resources stack visibly on player's back (jelly-stack pattern from existing project). Magnetic harvest for essence pickups (Bezier arc to player). 10s decay on dropped essence.
- **Roster:** 2 soldier classes (Scout 8E fast/cheap + Bruiser 15E slow/strong). 3 worker types (Wood Worker, Essence Collector, Builder/Runner) auto-spawned at act 3 from Worker Pad. No hunger, no healing, no tech tree, no apples, no vehicles.
- **Combat:** player 100HP / 10DMG / 2atk-sec → 3-hit zombie kill in ~1.5s. No healing — damage is permanent. Heavy damage feedback (red flash + shake + grunt).
- **Engine:** state machine, milestone-driven, with 30s per-state safety timers. 15 states across 5 acts. Wave-size escalation 5 → 10 → 15 → 20 (rival raid) → 10 (final push).
- **Arc:** Act 1 Survival burst → Act 2 Defense build → Act 3 Automation → Act 4 RIVAL TWIST (audio sting, base reveals, heavy losses) → Act 5 Push & kill rival King = win.
- **Win = kill the rival King. Loss = your King dies.** Game-over screen + retry/quit on either end.

**Reuse from existing project codebase:** jelly-stack (resources on back), magnetic harvest (essence Bezier arc), drain & build (stand on ghost → resource transfer), drag-to-waypoint (already implemented for King). Prototype implementation should reuse these directly.

**What this validates:** intensity feel, economy loop, decision density, narrative arc, build-via-ghost flow.
**What this does NOT validate:** V1's full pentagon, hunger pacing, multi-rival AI, tech tree, vehicle systems, multi-level progression. Those wait for V1 phase 1–6 implementation.

---

## §4. Script (State Machine)

**Engine:** state-machine, milestone-driven primary triggers + 30s per-state safety-net timer (force-fires next state if player stalls). NOT a wall-clock timeline.

### Numbers reference

| Entity | HP | DMG / hit | Atk rate | Notes |
|---|---|---|---|---|
| **Player** | 100 | 10 | 2 / sec | No healing. Permanent damage. |
| **Scout (yours)** | 30 | 10 | 2 / sec | Fast/cheap. Cost **8E** at Scout Pad. No healing. |
| **Bruiser (yours)** | 80 | 20 | 1 / sec | Slow/strong. Cost **15E** at Bruiser Pad. No healing. |
| **Zombie** | 30 | 5 vs living, 3 vs wall | 1 / sec | 8-tile sense radius. 3 player-hits to kill (~1.5s). |
| **Wood Wall** | 100 | n/a | n/a | ~33 zombie hits to break (~33s). |
| **Gate** | 100 | n/a | n/a | Same as wall. |
| **Rival soldier** | 80 | 15 | 1 / sec | 8 hits from your soldier. |
| **Rival King** | 200 | 30 | 1 / sec | Loss target. |

| Resource | Source | Spent on |
|---|---|---|
| **Essence** | Zombie kill (1E each, 10s decay timer) | Scout 8E · Bruiser 15E · Wall 3E (per wall) · Gate 5E · Worker Pad 15E (3 workers) |
| **Wood** | Tree chop (1W per swing, tree HP=5, 5W per tree) | Wall 10W · Gate 20W |

**Wave-size escalation curve:** 5 → 10 → 15 → 20 → 10 (open burst → mid → late → rival raid → final push).

---

### Act 1 — Survival Burst (~0:00 – ~1:00)

```
┌─────────────┐ 5 kills    ┌──────────────┐ wall built  ┌──────────────┐
│ A: BLOOD    │───────────▶│ B: DEFENSE   │────────────▶│ C: ARMY      │
│ ─────────── │            │ ──────────── │             │ ──────────── │
│ at t=0:     │            │ wall ghost   │             │ TWO pads:    │
│ 5 zombies   │            │ pulses 10W+3E│             │  Scout 8E    │
│ rush player │            │ trees pulse  │             │  Bruiser 15E │
│ in safe pkt │            │ +10 zombies  │             │ +15-20 zomb  │
│ +2 idle     │            │ approaching  │             │ approaching  │
│ outer ring  │            │              │             │              │
└─────────────┘            └──────────────┘             └──────┬───────┘
                                                                │ soldier spawned
                                                                ▼
                                                         ┌─────────────────┐
                                                         │ D: MULTI-FRONT  │
                                                         │ ─────────────── │
                                                         │ more wall ghosts│
                                                         │ pulse           │
                                                         │ continued zomb. │
                                                         │ soldier on duty │
                                                         │ player → wood   │
                                                         └────────┬────────┘
                                                                  │ exit ~1:00 (timer floor)
                                                                  ▼ ACT 2
```

---

### Act 2 — Defense Build (~1:00 – ~2:00)

```
┌──────────────┐  3 walls   ┌──────────────┐ gate built  ┌──────────────┐
│ E: WALL UP   │───────────▶│ F: GATE UP   │────────────▶│ → ACT 3      │
│ ──────────── │            │ ──────────── │             │              │
│ 4 wall ghosts│            │ gate ghost   │             │              │
│ pulse        │            │ pulses 20W+5E│             │              │
│ +10 zombies  │            │ +10 zombies  │             │              │
│ continue     │            │ continue     │             │              │
│ soldier auto │            │ wood worker  │             │              │
│ engages      │            │ stacking     │             │              │
└──────────────┘            └──────────────┘             └──────────────┘
```

Player gathers wood while soldier holds line. State E exit = 3 walls built (or 90s safety timer).

---

### Act 3 — Automation (~2:00 – ~3:00)

```
┌──────────────┐ workers    ┌──────────────────┐ 3:00 timer  ┌──────────────┐
│ G: PAD REVEAL│───────────▶│ H: AUTO ACTIVE   │────────────▶│ → ACT 4 TWIST│
│ ──────────── │ spawned    │ ──────────────── │             │              │
│ Worker Pad   │            │ Wood Worker chops│             │              │
│ ghost pulses │            │ Essence Coll.    │             │              │
│ "15E + 3"    │            │ picks up drops   │             │              │
│ silhouettes  │            │ Builder runs     │             │              │
│ +15 zombies  │            │ wood to walls    │             │              │
│ continue     │            │ Player free to   │             │              │
│              │            │ stockpile / spawn│             │              │
└──────────────┘            │ more soldiers    │             │              │
                            │ +15 zombies      │             │              │
                            └──────────────────┘             └──────────────┘
```

Player feels competent. Base hums. Calm before storm.

---

### Act 4 — RIVAL TWIST (~3:00 – ~4:00)

```
┌──────────────┐  rivals    ┌──────────────┐  raid ends  ┌──────────────┐
│ I: REVEAL    │───────────▶│ J: DEFENSE   │────────────▶│ K: RECOVERY  │
│ ──────────── │ in range   │ ──────────── │             │ ──────────── │
│ AUDIO STING  │            │ 5 rivals vs  │             │ Survey damage│
│ rival base   │            │ walls + you  │             │ broken walls │
│ MATERIALIZES │            │ + soldiers   │             │ dead troops  │
│ across map   │            │ +20 zombies  │             │ ~10s calm    │
│ 5 rival sol- │            │ wave (chaos!)│             │ before act 5 │
│ diers charge │            │ HEAVY losses │             │              │
│ red arrow    │            │ red flashes  │             │              │
│ ~5s pure FX  │            │ shake spam   │             │              │
└──────────────┘            └──────────────┘             └──────┬───────┘
                                                                 │ exit at 4:00
                                                                 ▼ ACT 5
```

This is the EMOTIONAL CENTERPIECE. Heavy losses. Player learns "we're not alone."

---

### Act 5 — Push & King Kill (~4:00 – ~5:00)

```
┌──────────────┐ 3+ soldiers ┌──────────────┐ at rival   ┌──────────────┐
│ L: REBUILD   │────────────▶│ M: MARCH     │───────────▶│ N: KING FIGHT│
│ ──────────── │             │ ──────────── │            │ ──────────── │
│ Attack Ready │             │ Player walks │            │ Combat with  │
│ zone reveals │             │ onto Attack  │            │ Rival King   │
│ glows        │             │ Ready zone → │            │ (HP 200/30D) │
│ +10 zombies  │             │ troops auto- │            │ + remaining  │
│ wave (final) │             │ rally + foll.│            │ defenders    │
│ player spawns│             │ Player drags │            │ Final stand  │
│ 3-4 soldiers │             │ toward rival │            │              │
│              │             │ base. Fight  │            │ King dies →  │
│              │             │ stragglers   │            │ T3 finisher  │
│              │             │ en route.    │            │ (hitstop +   │
│              │             │              │            │ shake + red) │
└──────────────┘             └──────────────┘            └──────┬───────┘
                                                                 │ VICTORY
                                                                 ▼
                                                          ┌──────────────┐
                                                          │ END: STATS   │
                                                          │ rival kings  │
                                                          │ killed: 1    │
                                                          │ zombies      │
                                                          │ killed: ~50  │
                                                          │ time: ~5:00  │
                                                          │ continue     │
                                                          └──────────────┘
```

---

### Typical Playthrough Timeline (average-paced player)

> **Note:** times below assume average pacing. State transitions fire on **player milestones** (kill counts, build counts, deposits), NOT on a wall clock. Slow player → 30s safety timer forces next state. Fast player → reaches act 5 sooner. Total play length: **~4:30–5:30** either way.

**ACT 1 — Survival Burst (0:00 – ~1:00)**

| Time | Event |
|---|---|
| 0:00 | Drop in. 12 zombies pre-placed; 5 aggro on player. Visible: 2 Spawn Pads (Scout 8E / Bruiser 15E), 4 Wall ghosts (10W+3E), trees. |
| 0:00–0:08 | Combat burst — 5 zombies killed (~1.5s each). 5E stacked on back. Player HP 100→~70. |
| 0:08 | **State B (DEFENSE)** fires. Wall ghost pulses; trees pulse. +10 zombies activate. |
| 0:15–0:30 | Player chops trees (1 swing = 1W). Gathers 10W. |
| 0:30–0:40 | Drains 10W + 3E into wall ghost. **Wall #1 built.** |
| 0:40 | **State C (ARMY)** fires. Spawn Pads pulse louder. |
| 0:40–0:55 | Player kills more zombies, gathers 8E. |
| 0:55 | Drains 8E into Scout Pad. **Scout spawns.** Auto-aggros nearby zombies. |

**ACT 2 — Defense Build (~1:00 – ~2:00)**

| Time | Event |
|---|---|
| 1:00 | **State E (WALL UP)**. 4 wall ghosts pulse. Soldier holds line. |
| 1:00–1:30 | 2–3 walls built. ~10 zombie pressure ongoing. |
| 1:30 | **State F (GATE UP)**. Gate ghost pulses 20W+5E. |
| 1:30–2:00 | Player gathers more wood. **Gate built ~1:55.** |

**ACT 3 — Automation (~2:00 – ~3:00)**

| Time | Event |
|---|---|
| 2:00 | **State G (PAD REVEAL)**. Worker Pad pulses 15E. ~15 zombies. |
| 2:00–2:30 | Player kills zombies for essence. |
| 2:30 | Drains 15E. **3 workers spawn.** Automation begins. |
| 2:30–3:00 | Workers auto-harvest + auto-deliver. Player stockpiles essence. Base hums. |

**ACT 4 — RIVAL TWIST (3:00 – 4:00)**

| Time | Event |
|---|---|
| 3:00 | **State I (REVEAL)**. AUDIO STING. Rival base materializes across map. Red arrow at 5 charging rival soldiers. |
| 3:05 | **State J (DEFENSE)**. Rivals hit walls. +20 zombie chaos wave joins. |
| 3:15–3:45 | Heavy damage. 1–2 walls breach. Workers/soldiers die. Red flashes, screen shake, grunts. |
| 3:45 | **State K (RECOVERY)**. Rivals retreat (~3 escape). ~10s calm. Player surveys damage. |

**ACT 5 — Push & Win (4:00 – 5:00)**

| Time | Event |
|---|---|
| 4:00 | **State L (REBUILD)**. Attack Ready zone reveals, glowing. UI: "Kill Rival King!" +10 zombies (lighter wave). |
| 4:00–4:30 | Player rebuilds — spawns 3–4 more soldiers. |
| 4:30 | **State M (MARCH)**. Player walks onto Attack Ready zone. Troops auto-rally + follow. |
| 4:30–4:50 | Player drags toward rival base. Fights stragglers en route. |
| 4:50 | **State N (KING FIGHT)**. Rival King (200HP/30D) + remaining defenders vs player + troops. |
| 4:55 | **King dies.** T3 hitstop + screen shake + red puff. |
| 5:00 | **END**. Victory screen + stats + Play Again button. |

---

### State machine reference: triggers + safety timers

| Act | State | Primary Exit Trigger | Safety Timer |
|---|---|---|---|
| 1 | A: Blood | 5 zombies killed | 30s |
| 1 | B: Defense | 1 wall built (10W+3E deposited) | 30s |
| 1 | C: Army | 1 soldier spawned (10E deposited) | 30s |
| 1 | D: Multi-front | timer floor | 1:00 hard cap |
| 2 | E: Wall Up | 3 walls built | 60s |
| 2 | F: Gate Up | gate built | 30s |
| 3 | G: Pad Reveal | workers spawned (15E deposited) | 30s |
| 3 | H: Auto Active | 3:00 hard cap | 60s |
| 4 | I: Reveal | rivals reach perimeter | 10s |
| 4 | J: Defense | rival raid retreats or all killed | 60s |
| 4 | K: Recovery | 4:00 hard cap | 15s |
| 5 | L: Rebuild | 3+ soldiers ready | 30s |
| 5 | M: March | reach rival base | 30s |
| 5 | N: King Fight | Rival King dies | 30s (must win!) |
| END | — | VICTORY / DEFEAT screen | — |
       