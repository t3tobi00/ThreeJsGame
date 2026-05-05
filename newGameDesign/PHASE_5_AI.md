# Phase 5 — Competitor AI (LOCKED 2026-04-28)

**Status:** All 7 rounds locked. 26 decisions in §2. Master-doc patches A-1 / A-2 applied to `GAME_DESIGN.md`. Phase 6 (Polish) is the only remaining V1 phase.

**Scope:** Competitor (rival base) AI ONLY.
Zombie AI is LOCKED in `PHASE_4_SYSTEMS.md` §4.5 (Sensing) + §4.9.2 (Zombie Brain). Do not redesign.

**Carried forward from `GAME_DESIGN.md` §10 (locked principles):**
- Each rival runs the SAME economy + military as the player.
- Rivals attack at resource nodes (intercept player harvesters) AND at the player base via vehicles.
- Rivals suffer zombie attacks like the player (§3.5 sensing applies symmetrically).
- Competitor damage ~1.5–2× zombie damage per hit (interpretation pending — see §0 C-1).

**Per-level rival counts (`GAME_DESIGN.md` §13.12):**
- L1: 2 rivals · L2: 4 rivals · L3: 6 rivals.

---

## §0. Master-Doc Conflicts & Additions (Phase 5 pass)

### §0.A Conflicts
| ID | Status | Issue |
|---|---|---|
| **C-1** | RESOLVED | Per L4.1: rival units deal a universal +50–100% damage modifier on every attack (vs player, zombies, walls). §10's "competitor damage > zombie damage (~1.5–2× per hit)" reading is canonical. §13.8's mislabel needs a master-doc patch — see §0.B A-2. |

### §0.B Master-Doc Additions (patch into master when Phase 5 locks)
| ID | Status | Spec |
|---|---|---|
| **A-1** | LOCKED | **V1 level-win condition = all rival Kings dead.** Future versions (V1.5+) may use alternative win conditions (survival timer, free-the-world-from-zombies objective, etc.). Patch into `GAME_DESIGN.md` §13.12. |
| **A-2** | LOCKED | `GAME_DESIGN.md` §13.8 row currently labeled *"Competitor unit vs zombie damage"* should be relabeled to *"Competitor unit damage modifier (universal, vs any target)"* with multiplier **1.5×–2.0× (per archetype, set in Round 6)**. Patch into `GAME_DESIGN.md` §13.8 when Phase 5 locks. |

---

## §1. Open Questions

**ALL 7 ROUNDS LOCKED (2026-04-28).** No open questions remain. See §2 for the 26 locked decisions, §0 for the master-doc patches applied to `GAME_DESIGN.md`.

---

## §2. Locked Decisions

**Round 1 (foundational):**
- **L1.1** [Q1] Rival economy = **full simulation**. Rival workers are real entities on the map; player can ambush them at nodes. Fidelity tweaks (cheaper hunger ticks, batched movement, etc.) deferred to a performance pass.
- **L1.2** [Q2] Behavior style = **personality archetypes**. Each rival is rolled an archetype on level start. Specific roster locked in Round 2.
- **L1.3** [Q3] Attack trigger = **hybrid**: army-size gate AND min-time floor AND weakness sensor (player wall breach / low HP / harvester ambushed). Specific thresholds locked in Round 3.
- **L1.4** [Q4] Inter-rival relations = **player-only target**. Rivals do not attack each other in V1. FFA / coalition deferred to V1.5+.

**Round 2 (skeleton & archetypes):**
- **L2.1** [Q5] Lifecycle = **cyclic**: ECO → RAID → RECOVER loop, with DEFEND interrupting any state when zombies/player attack the rival base. Defeated rival exits the loop (dormant — see L2.4).
- **L2.2** [Q6] Archetype roster = **3 archetypes**: Turtle / Rusher / Economist. Specific behavior deltas locked in Round 6.
- **L2.3** [Q7] Distribution = **constrained random per level**. L1: 2 random rolls; L2: 4 rivals with ≥1 of each archetype; L3: 6 rivals with ≥2 of each.
- **L2.4** [Q8] Rival King death → rival base goes **dormant**: workers flee, structures decay, no further raids or eco. **V1 level-win condition: all rival Kings dead** (see §0.B A-1).

**Round 3 (economy baseline, neutral rival):**
- **L3.1** [Q9] Worker count = **mirror player exactly** — 5 wood + 5 stone + 5 farmer per rival; essence drops from kills. Per-level difficulty rides on Round 7 knobs (attack frequency, raid composition), not eco scale.
- **L3.2** [Q10] Build-order trigger = **threshold-based**. Each milestone fires on resource stockpile (1st soldier when essence ≥ unit cost, 1st wall when wood ≥ wall cost, etc.). Player ambushing rival workers naturally slows rival ramp → emergent counterplay.
- **L3.3** [Q11] Spending priority in non-RAID states = **(1) replenish soldiers to raid-ready threshold, (2) repair walls if breached, (3) stockpile for next raid**. Archetypes perturb the priority order in Round 6.
- **L3.4** [Q12] Vehicle policy = **build vehicle ONLY for cross-base raids on the player base**. Foot units for local resource-node intercepts.

**Round 4 (combat baseline):**
- **L4.1** [Q13] Rival damage = **universal modifier**. Rival units deal +50–100% damage on every attack — vs player units, zombies, and walls. Specific multiplier (1.5× vs 2.0×) ties to archetype in Round 6. **Resolves C-1.**
- **L4.2** [Q14] Hybrid attack trigger fires under EITHER condition (sensor is opportunistic accelerator, not co-required):
  - **Standard raid:** army ≥ 5 (full pentagon) AND ≥180s since rival start → raid.
  - **Opportunistic raid:** weakness sensor fires (player wall breach OR player HP < 30%) AND ≥180s since rival start → raid with whatever army is available (min 2).
  - Post-raid cooldown: deferred to Round 7 tuning.
- **L4.3** [Q15] Raid composition (neutral baseline) = **balanced pentagon** — 1 Scout + 1 Slinger + 1 Sharpshooter + 1 Bruiser + 1 Biker. Archetypes deviate in Round 6.
- **L4.4** [Q16] Retreat = raid party retreats when **total HP < 30% OR fewer than 2 survivors**. Survivors return to base, enter RECOVER state.

**Round 5 (defense baseline, neutral rival):**
- **L5.1** [Q17] Initial wall buildout = **wood ring built during initial ECO phase**, threshold-gated on first wood stockpile reaching ring cost. Rivals are wall-protected before the t=180s minimum raid time.
- **L5.2** [Q18] Wall shape (neutral) = **full ring (all 4 sides)**. Symmetric; no map-geometry awareness needed in V1.
- **L5.3** [Q19] Gate count = **1 gate per ring**. Sense-gated per §3.6: opens for friendly units, closes against hostiles.
- **L5.4** [Q20] Wood → Stone wall upgrade trigger = **event-based**. Upgrade fires after rival survives the first zombie attack OR first player attack on the wall.

**Round 6 (archetype perturbations):**
- **L6.1** [Q21] Archetype delta matrix accepted as drawn:

| Knob | Turtle | Rusher | Economist |
|---|---|---|---|
| Workers/type | 5 | 5 | **7** |
| Spending priority | **walls→soldiers→stockpile** | **soldiers→raid→walls** | **stockpile→soldiers→walls** |
| Vehicle policy | cross-base only | cross-base only | **always** |
| Damage modifier | **2.0×** | **1.5×** | **1.75×** |
| Min-time floor | **300s** | **120s** | **240s** |
| Raid +1 unit | **+1 Slinger** | **+1 Biker** | **+1 Sharpshooter** |
| Retreat HP | **<50%** | **<15%** | **<30%** |
| Wall shape | **DOUBLE ring** (wood outer + stone inner once L5.4 fires) | **partial 3-sided** (one side open) | full ring |

- **L6.2** Army gate refinement of L4.2: each archetype's standard-raid army gate = **6** (pentagon + the archetype's +1 unit). Opportunistic raid retains min-2 from L4.2.

**Round 7 (per-level scaling):**
- **L7.1** [Q22] Post-raid cooldown (RECOVER duration before the rival can re-arm a raid) = **per-level**:
  - **L1: 120s · L2: 60s · L3: 30s.**
  Cooldown begins when the raid party returns to the rival base (or when the last surviving raider re-enters the wall ring).
- **L7.2** [Q23] Raid party size = **per-level**:
  - **L1: 5** (pentagon as drawn in L4.3, no archetype bonus unit).
  - **L2: 6** (pentagon + the archetype's +1 unit per L6.1).
  - **L3: 7** (pentagon + 2 copies of the archetype's +1 unit).
  *Note:* L1 raids drop the archetype +1 unit. The archetype still affects damage modifier, min-time, retreat, walls, etc. (per L6.1) — only the bonus unit is gated by level.
- **L7.3** [Q24] Rival tech research = **none in V1**. Rivals never operate Research Huts; the player has tech-tree advantage at every level. Rival tech AI is deferred to V1.5+.
- **L7.4** [Q25] L1 archetype mix = **hand-authored**: L1 always spawns **1 Turtle + 1 Rusher** (balanced intro: one slow defender, one fast aggressor). L2 / L3 stay constrained random per L2.3.

---

## §3. Summary

26 locked decisions across 7 rounds. Conflicts: 1 (resolved). Master-doc additions: 2 (applied). Phase 5 design closes with this commit.
