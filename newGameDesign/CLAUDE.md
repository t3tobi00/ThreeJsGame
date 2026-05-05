# newGameDesign Folder — Base Defense Tycoon V1

> **🎯 CURRENT FOCUS (2026-05-05): The Prototype.**
> The whole project's active development is on the `?prototype` mode — a
> 5-minute playable-ad demo of the V1 game idea. V1 Phase 1-6 docs in this
> folder are LOCKED design but NOT being implemented yet. The prototype
> validates feel + arc before V1 work resumes.
>
> Read in order when continuing prototype work:
>   1. `PROTOTYPE_STATUS.md` — what's built, what's broken, next priorities
>   2. `PROTOTYPE_PLAN.md` — locked spec
>   3. `~/.claude/plans/yes-binary-bentley.md` — implementation plan
>
> Foundation + Act 1 (skeleton) are shipped. Acts 2-5 + Act 1 visual polish
> remain. See PROTOTYPE_STATUS.md for the granular punch list.

This folder is the **clean home** for the complete game design and implementation plan for V1 of Base Defense Tycoon. Only V1 docs live here. Future Claude Code agents should read this file first to orient, then dive into the design docs.

---

## Files in this folder

| File | Purpose |
|---|---|
| `GAME_DESIGN.md` | The complete V1 design — every system, mechanic, locked decision. 13 numbered sections (§1–§13). |
| `IMPLEMENTATION_PLAN.md` | **Lean index** across all phases: file pointers, global visual style, cross-ref convention, cross-cutting changelog. |
| `PHASE_1_ENVIRONMENT.md` | Phase 1 detail — map, generation, water moat, boundary, full per-element Environment Cards (§1.11). ✓ LOCKED. |
| `PHASE_2_ENTITIES.md` | Phase 2 detail — base anatomy, 5 Worker cards (locked), Soldier/King/Zombie/Vehicle visual specs (next: full cards). |
| `PHASE_3_BUILDINGS.md` *(future)* | Created when Phase 3 opens. |
| `PHASE_4_SYSTEMS.md` *(future)* | Created when Phase 4 opens. |
| `PHASE_5_AI.md` | Phase 5 detail — Competitor AI. ✓ FULLY LOCKED (2026-04-28). 26 decisions across 7 brainstorm rounds: lifecycle (cyclic ECO/RAID/RECOVER), 3 archetypes (Turtle/Rusher/Economist), full-sim rival economy, hybrid attack triggers, per-level scaling. |
| `PHASE_6_POLISH.md` | Phase 6 detail — Polish (UI/HUD, sound, VFX, juice, ceremonies). ✓ FULLY LOCKED (2026-04-30). 24 decisions across 6 brainstorm rounds. |
| `PROTOTYPE_PLAN.md` | **5-minute intense playable prototype** (NOT V1). ✓ FULLY LOCKED (2026-05-04). 25 decisions across 5 brainstorm rounds. State-machine engine, 2 soldier classes, no silos/hunger/apples/tech. Build this FIRST to validate the V1 idea before Phase 1 implementation begins. |
| `PROTOTYPE_STATUS.md` | **Active build status** (2026-05-05). Granular snapshot: what's shipped (Foundation + Act 1 skeleton), what's broken, next-session priorities (visual polish: scary zombies, soldier anim, unlock-zone upgrade, finger pointer), Acts 2-5 roadmap, and a session-start prompt for the next conversation. |
| `high_treason_reference.md` | Inspiration source — the indie game *High Treason* that we modeled V1's structure on. |
| `CLAUDE.md` | This file. |

**Why the per-phase split:** when implementing Phase N, you only open `PHASE_N_*.md` — no scrolling past every other phase. The index (`IMPLEMENTATION_PLAN.md`) routes between them. Future phase files are created on-demand the moment that phase opens for design (no empty stubs).

## Where the legacy notes live

Older planning notes from earlier iterations of the game (different design — single persistent base, Tier-4 Hive Charge win, NW/NE/SE/SW corner zones, etc.) are at the repo root in **`../design/`**. **Do NOT use them as a design source for V1.** They are kept only as historical reference.

---

## How to read (recommended order)

1. **`GAME_DESIGN.md` §1 (Identity)** — elevator pitch, win/lose, three pressures.
2. **§2 (Core Loop)** — how a session unfolds.
3. **§13 (Balance Tables)** — master numbers reference.
4. **`IMPLEMENTATION_PLAN.md`** — lean index: phase status, file pointers, cross-ref convention.
5. **`PHASE_N_*.md`** — open only the phase detail file you currently need (e.g., `PHASE_1_ENVIRONMENT.md` to implement world generation).
6. **`high_treason_reference.md`** — patterns we drew from (counter pentagon, single resource, modular walls, etc.).

---

## State of the design (as of 2026-04-28)

### Done
- All 13 sections of `GAME_DESIGN.md` drafted.
- §10 (Competitor AI) ✓ FULLY DESIGNED — see `PHASE_5_AI.md`. §10 in master doc now holds a summary + redirect.
- **V1 DESIGN COMPLETE (2026-04-30)** — Phases 1–6 all fully locked. 4 phases of entity/world design + 1 phase of AI + 1 phase of polish. Ready for implementation.
- **Phase 1 (Environment) fully locked** in `PHASE_1_ENVIRONMENT.md` — includes the 6 Environment Element Cards (§1.11: Tree, Stone Node, Water, Grass, Ground, Boundary Wall).
- **Phase 2 (Entities) ✓ FULLY LOCKED** — all 16 entity cards (5 workers + 5 soldiers + King + Zombie + 4 vehicles), §2.7 animation states, and §2.8 Apple Feeding System all written in `PHASE_2_ENTITIES.md`.
- **Phase 3 (Buildings) ✓ FULLY DRAFTED** — all 11 building cards (Flag, 4 silos, Apple Farm Plot, Wood Wall, Stone Wall, Gate, Roof, Research Hut) written in `PHASE_3_BUILDINGS.md` with shared Building Behavior block + acceptance criteria.
- **Phase 4 (Game Systems) ✓ FULLY LOCKED** — all 8 categories / ~25 individual systems specced in `PHASE_4_SYSTEMS.md`: Input (drag-to-waypoint) · Movement (pathfinding, water crossing, vehicle drive) · Sensing (zombie/soldier/worker-flee/silo-aura/gate-open) · Combat (8 sub-systems including counter math, knockback, charge, AoE) · Lifecycle (spawn queues, construction, repair, die, wreck) · Economy (harvest, delivery, Storage Cart as relocatable silo, overflow) · AI Behaviors (16 per-unit state machines) · Apple Feeding (full §2.8 implementation).
- **Master-doc reconciliations (2026-04-28, 5 total):** (1) apple heal = 10 HP/apple for living, was 20; (2) troops do NOT carry apples or eat in combat (§13.10, §11.9, §11.11 lines overridden); (3) Apple Farm Plot is Farmer-built in 15s (§13.5, §8.2, §2.2.3 patched); (4) King `applesPerMeal: 3` per §11.11; (5) Storage Cart auto-route mode REMOVED — cart is a relocatable silo (§4.5 patched).
- `IMPLEMENTATION_PLAN.md` reorganized into a lean per-phase index (2026-04-28 split). Each phase now has its own detail file.

### Locked design pillars (DO NOT relitigate)
- 4 resources: **essence, wood, stone, apple**.
- 5-unit pentagon: **Scout, Slinger, Sharpshooter, Bruiser, Biker** + neutral King.
- **King is the only loss target** (King death = game over).
- **Hunger system**: every living being eats 1 apple per 200s; 1 HP/sec starvation if unfed.
- **The Flag**: indestructible, central, ALL spawning happens here (workers, soldiers, vehicles).
- **Universal drag-to-waypoint** control for ALL entities (no joysticks, no clicks, no WASD).
- **3 levels in V1** (L1, L2, L3) — no L4+.
- **Stick-man / minimal visual style** (HT-inspired).
- **All vehicles + Scout + Slinger cross water**; everyone else cannot.
- **Trees: no regrowth; stones: non-renewable.** Scarcity drives conflict.
- **Workers and soldiers are separate populations** — no conversion either way.

---

## How to continue planning with this user

The user wants:
- **Detailed, step-by-step planning BEFORE coding.** No coding starts until every system is mapped out.
- **Per-entity / per-building / per-system "complete cards"** that include visual + stats + behavior + rules + JSON archetype. Single-file reference per entity.
- **Brainstorm mode is the default**: ASK first, propose options + recommendations, do NOT code until they explicitly say go.
- **Concise responses**: short text, options A/B with recommendations, ASCII/Braille art for visual concepts, write artifacts to files (not chat).
- **Plain language**: avoid jargon. When introducing a new term, explain with a simple example.
- **Use Edit/Write to update docs**; don't dump giant text in chat.

## Style notes for the user
- They work in bursts and need orientation on re-entry.
- They prefer **simple working systems first**; avoid over-engineering.
- They prefer **JSON-configurable first**, UI editor later.
- They prefer **3D-parented UI** over HTML overlays for in-world UI alignment.
- They prefer **non-destructive experiments** (parallel toggleable modes, never edit-in-place).
- They like **organic sprawl over framed quadrants** for world layout.

---

## Cross-references

- Repo root `CLAUDE.md` — tech stack (Three.js, pure ECS, ES modules, no bundler), `src/` file structure.
- User's persistent memory under `~/.claude/projects/.../memory/` — cross-session notes including `project_game_design_v1.md`.

---

## Next step (as of 2026-05-05)

**Project focus pivoted to the prototype.** V1 implementation is paused; Phases 1-6 design remains locked but is not being built. The prototype validates feel + economy + arc before V1 resumes.

**Prototype build status:** Foundation + Act 1 skeleton shipped. Visual polish (scary zombies, soldier anim, unlock zones, finger pointer) and Acts 2-5 are next. See `PROTOTYPE_STATUS.md`.

---

## (Historical) V1 design state — 2026-04-30

**V1 DESIGN COMPLETE — Phases 1–6 ALL FULLY LOCKED.** Implementation can now proceed across all 6 phases.

Full blueprints (locked):
- `PHASE_1_ENVIRONMENT.md` — map, generation, water moat, boundary, 6 environment element cards.
- `PHASE_2_ENTITIES.md` — 16 entity cards (5 workers + 5 soldiers + King + Zombie + 4 vehicles), animations, Apple Feeding system.
- `PHASE_3_BUILDINGS.md` — 11 building cards: Flag, 4 silos, Apple Farm Plot, Wood/Stone Walls, Gate, Roof, Research Hut.
- `PHASE_4_SYSTEMS.md` — input (drag-to-waypoint), movement, sensing, combat, lifecycle, economy, ~25 systems with acceptance criteria.
- `PHASE_5_AI.md` — Competitor AI (26 decisions, 3 archetypes Turtle/Rusher/Economist, cyclic ECO/RAID/RECOVER lifecycle, per-level scaling).
- `PHASE_6_POLISH.md` — UI/HUD, sound, VFX, juice, ceremonies (24 decisions across 6 rounds).

Master design: `GAME_DESIGN.md` (13 sections, all complete).
Index: `IMPLEMENTATION_PLAN.md` (per-phase routing + global visual style + cross-cutting changelog).

Each phase produces a complete blueprint before any coding starts. The user may now proceed to implementation, or continue iterating on individual blueprints as needed.
