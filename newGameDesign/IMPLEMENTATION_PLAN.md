# Base Defense Tycoon — Implementation Plan (Index)

> **What this is:** the lean router for the V1 build plan.
> **What it isn't:** a place for detailed design — those live in `PHASE_N_*.md` companion files, opened only when you're building that phase.
>
> Master design doc: `GAME_DESIGN.md` (13 numbered sections).
> Visual direction: stick-man / minimal — like *High Treason*. Game mechanics over visual fidelity.

---

## Phase Overview

| # | Phase | Detail file | Status |
|---|---|---|---|
| 1 | **Environment** | `PHASE_1_ENVIRONMENT.md` | ✓ Fully locked (2026-04-28) |
| 2 | **Entities** | `PHASE_2_ENTITIES.md` | ✓ Fully locked (2026-04-28) — §2.1 anatomy, §2.2 (5 workers), §2.3 (5 soldiers), §2.4 King, §2.5 Zombie, §2.6 (4 vehicles), §2.7 animations, §2.8 Apple Feeding System |
| 3 | **Buildings** | `PHASE_3_BUILDINGS.md` | ✓ Fully drafted (2026-04-28) — all 11 building cards: Flag, 4 silos, Apple Farm Plot, Wood Wall, Stone Wall, Gate, Roof, Research Hut. Shared Building Behavior block + acceptance criteria. |
| 4 | **Game Systems** | `PHASE_4_SYSTEMS.md` | ✓ Fully locked (2026-04-28) — all 8 categories: Input · Movement · Sensing · Combat · Lifecycle · Economy · AI Behaviors · Apple Feeding. ~25 individual systems specced with mechanics + acceptance criteria. |
| 5 | **AI** | `PHASE_5_AI.md` | ✓ Fully locked (2026-04-28) — Competitor AI fully designed: 26 decisions across 7 brainstorm rounds. Lifecycle (cyclic ECO/RAID/RECOVER), 3 archetypes (Turtle/Rusher/Economist), hybrid attack triggers, full-sim economy, per-level scaling. Zombie AI already covered in `PHASE_4_SYSTEMS.md` §4.5 + §4.9.2. `GAME_DESIGN.md` §10/§13.8/§13.12 patched (A-1, A-2, C-1 resolved). |
| 6 | **Polish** | `PHASE_6_POLISH.md` | ✓ Fully locked (2026-04-30) — 24 decisions across 6 brainstorm rounds. UI/HUD (3D-parented + HTML hybrid, mobile-first), Sound (~35 SFX with per-class combat sounds, ambient BGM + raid intensifier), VFX (cartoon-poof, severity-coded hits), Juice (cheap layers + 3-tier finishers), Ceremonies (brief level start/win/loss). |

Each phase is a **buildable, testable milestone**. Don't move forward until the current phase has a working sandbox.

Phase files are created the moment that phase opens for design — no empty stubs.

---

## Visual Style (LOCKED — global, applies to every phase)

**Stick-man / minimal aesthetic.** Inspired by *High Treason*. Focus on mechanics:

- Living beings: simple geometry (cylinder body + sphere head + line limbs)
- Buildings: flat-shaded boxes/cylinders
- World: plain colors, no textures (or one minimal texture per element)
- No high-detail shaders, no PBR materials
- Cute hyper-casual touches OK (squash-stretch, bouncy animations)

Defer all polish until Phase 6.

---

## Cross-reference convention (used by every phase doc)

- Bare `§N.x` = section in **the same file** you're reading.
- `[PHASE_M_*.md §M.y]` = section in another phase's detail file.
- `[GAME_DESIGN.md §N.M]` = section in the master design doc.

---

## Doc-level Changelog (cross-cutting events only)

> Per-phase changelog entries live at the bottom of each `PHASE_N_*.md` file.

- **2026-04-27** — Doc created. Phase 1 (Environment) opened first.
- **2026-04-28** — Reorganized: design docs moved into `design/` subfolder, then again into `newGameDesign/` (clean folder; legacy planning notes stay at `../design/`).
- **2026-04-28 (split)** — `IMPLEMENTATION_PLAN.md` split into per-phase detail files. This file became a lean index. `PHASE_1_ENVIRONMENT.md` and `PHASE_2_ENTITIES.md` created with their phase content extracted intact (Phase 1 with §1.10/§1.11 reordered; Phase 2 with the lone `§11.6` cross-ref harmonized to `[GAME_DESIGN.md §11.6]`). Future phase docs created when each phase opens. `CLAUDE.md` updated to reflect the new file inventory.
- **2026-04-28 (Phase 3 opened)** — `PHASE_3_BUILDINGS.md` created with all 11 building cards drafted. Three master-doc conflicts reconciled in the process: apple heal rate (10 HP/apple — patched §2.8), troop apple-carry (overridden — §13.10 line removed in `GAME_DESIGN.md`), Apple Farm Plot construction (Farmer-built in 15s — patched §13.5, §8.2, §2.2.3). `CLAUDE.md` and this index updated to reflect Phase 3 status.
- **2026-04-28 (Phase 5 locked)** — `PHASE_5_AI.md` created and fully designed: 26 decisions across 7 brainstorm rounds. Competitor AI specced top-to-bottom: full-sim rival economy, cyclic lifecycle, 3 personality archetypes, hybrid attack triggers, per-level scaling, hand-authored L1 intro. **Master-doc patches applied to `GAME_DESIGN.md`**: §10 replaced with summary + redirect; §13.8 row relabeled (A-2); §13.12 win condition added (A-1). Conflict C-1 (§10 vs §13.8 multiplier reading) RESOLVED in favor of universal damage modifier. Phase 6 (Polish) is the only remaining V1 design phase.
- **2026-04-30 (Phase 6 locked — V1 DESIGN COMPLETE)** — `PHASE_6_POLISH.md` created and fully designed: 24 decisions across 6 brainstorm rounds. UI rendering split (3D-parented + HTML overlay), HUD layout (top resources, bottom toolbar), sound library (~35 SFX with per-soldier-class combat sounds, ambient BGM + raid intensifier overlay, hybrid 2D/3D spatial mix, 3-tier alerts), VFX library (cartoon-poof, severity-coded hits, per-class projectile trails, selective state emotes), juice timing matrix (cheap layers per hit + 3-tier finishers), end-state ceremonies (brief start/win/loss + cosmetic ambient). **All 6 V1 design phases now locked.** Implementation can proceed.
- **2026-05-04 (Prototype Plan locked)** — `PROTOTYPE_PLAN.md` created and fully designed: 25 decisions across 5 brainstorm rounds. **NOT V1** — a ≤5-minute high-intensity playable demo to validate theme + economy + combat + 5-act intensity arc BEFORE V1 implementation. Diverges from V1 in key areas (no silos, no hunger, no apples, 2 soldier classes only, no tech, single rival without archetype). Reuses existing project's jelly-stack + magnetic harvest + drain-&-build patterns. State-machine engine (15 states, milestone-driven + 30s safety timers). **Recommended implementation order:** ship the prototype FIRST (days, not weeks) → playtest → then begin V1 Phase 1.
