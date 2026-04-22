# SESSIONS.md — Claude Code Session Memory

<!--
╔══════════════════════════════════════════════════════════════╗
║                  INSTRUCTIONS FOR CLAUDE CODE                ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ON SESSION START (new conversation):                        ║
║    1. Read everything below the divider                      ║
║    2. Announce: "Resuming from [date]. Last stop: [topic]"   ║
║    3. Do NOT modify this file yet                            ║
║                                                              ║
║  ON SESSION END (user says "save session" or "exit"):        ║
║    1. OVERWRITE this entire file                             ║
║    2. Keep these instructions intact at the top              ║
║    3. Replace LAST SESSION section with current session      ║
║    4. Be thorough — this is the only memory that persists    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
-->

---

## LAST SESSION

### Date
2026-04-20

### Goal
Multi-part session:
1. Fix flat unlock-zone UI appearing over gearworks machine in diorama mode.
2. Fix resource sizing — `stackConfig.json` values were being ignored.
3. Document resource-integration flow.
4. Fix joystick capturing the whole screen; add WASD keyboard input.
5. Build a full Hero system from scratch (UI button, archetype, editor, AI, combat, HP).

### What We Built / Changed

**Machine / resources**
- Decoupled gearworks from `UnlockZone`. New `MachineSystem` owns drain + convert loop; flat UI on gearworks is gone in diorama.
- Fixed `ResourceStack._pop` — was hard-coding scale 1.5→1.0, overwriting `stackConfig.json` values. Now animates relative to `mesh.userData.stackScale`.
- Added docs: `design/logic-flow/add-new-resource.md` — 3-file flow (`MeshPresets.js` + `resources.json` + `stackConfig.json`) for integrating a standalone Three.js prototype.

**Input / UI**
- Rewrote `Joystick.js` — fixed-position pad (bottom-left, 140×140); only drags starting inside the base register. No more full-screen overlay.
- New `src/ui/KeyboardInput.js` — WASD + arrow keys.
- `MovementSystem` now sums joystick + keyboard vectors.
- CSS: joystick hidden on mouse-primary devices via `@media (hover: hover) and (pointer: fine)`.

**Hero system (main deliverable)**
- New archetype `src/config/archetypes/hero.json` — reuses `character-player` mesh, yellow (`0xffd700`), faction `ally`, HP 5.
- New component `Component_HeroAI` — guardRadius, attackRange, homePosition, target, spawn grace timer.
- New system `HeroAISystem` — target acquisition + pursuit; 1s post-spawn grace; defensive faction+tag filter (never targets `player`/`ally`/`neutral`).
- New UI `src/ui/HeroBar.js` — second HUD row with yellow "Summon Hero 5🪙" button. Spawns at player's level-defined spawn point + ring offset. Each hero gets its own `WorldHealthBar`.
- New dev tool `tools/heroes/editor.html` + `editor.js` — live editor for hero stats + combat/AI toggles. Copy-paste JSON output.
- Moved player spawn to cell `[15, 4]` in `level-1-diorama.json` (factory zone near gearworks) — closer to enemy spawn for combat.
- `main.js` player-spawn now prefers `cell` + `grid.toWorld()` over raw `position` (routed through GridSystem).

### Key Decisions Made

- **Machines don't use UnlockZone anymore.** `MachineSystem` handles drain + convert. `UnlockZone` is reserved for legacy `level-1.json` zones.
- **Hero/enemy separation via `EnemyAI` requirement, not faction filter.** `EnemySystem` query changed from `[Transform, Movement, Health]` to `[Transform, Movement, Health, EnemyAI]`. This was the ROOT CAUSE of "hero running at player" — EnemySystem silently ran enemy AI on any entity with those three components.
- **Stationary-by-default heroes.** Removed return-home drift. Heroes stay where they end up after combat.
- **Combat reuses `SkillSystem`.** Heroes have `SkillLoadout: 'sword'`; zero new combat code.
- **HP bars per hero via shared `WorldHealthBar`.** `HeroBar.update()` called each frame from animate loop.
- **Hero armor dropped to 0.** With enemy damage 1 and armor 2, actual dmg was `max(0, 1-2) = 0` → immortal heroes. Fix: armor 0 so every hit lands.

### Bugs Solved

1. **Gearworks showed flat UnlockZone ring over 3D mesh** — archetype had `UnlockZone` component. Fix: removed from archetype, moved cost/output into `Machine`, wrote `MachineSystem` to run the drain loop.
2. **All resources stacked at the same size on player's back** — `ResourceStack._pop` overwrote the per-resource `stackScale` applied by `Component_InventoryStack.addToSlot`. Fix: `_pop` reads `mesh.userData.stackScale` and animates relative to that target.
3. **Hero summon button unclickable** — `#joystick-container` full-screen overlay intercepted clicks. Fix: `z-index: 20` on `#hero-bar`, plus full joystick rewrite to fixed-size.
4. **Hero "running at player" even with no enemies** — NOT a HeroAISystem bug. `EnemySystem` matched any entity with `[Transform, Movement, Health]` and applied full enemy AI (wander + chase player + stop in range). Fix: added `'EnemyAI'` to query + faction guard + removed `|| DEFAULT_AI` fallback.
5. **Heroes were immortal** — `enemy.json` → `ContactDamage.targetFactions` didn't include `"ally"`. Plus armor 2 absorbed the 1-dmg hits. Fix: added `"ally"`, dropped armor to 0.
6. **No visible HP bar on heroes** — only player had `WorldHealthBar`. Fix: `HeroBar` now creates one per hero, updates each frame, cleans up on `entity:died`.

### Files Modified

**New files**
- `src/systems/MachineSystem.js`
- `src/systems/HeroAISystem.js`
- `src/ui/HeroBar.js`
- `src/ui/KeyboardInput.js`
- `src/ecs/components/Component_HeroAI.js`
- `src/config/archetypes/hero.json`
- `tools/heroes/editor.html`
- `tools/heroes/editor.js`
- `design/logic-flow/add-new-resource.md`

**Edited**
- `src/main.js` (MachineSystem + HeroAISystem + KeyboardInput + HeroBar wiring; player spawn uses `grid.toWorld` + cell; `heroBar.update()` in animate loop)
- `src/ui/Joystick.js` (rewrite: fixed-position pad)
- `src/systems/MovementSystem.js` (sums joystick + keyboard)
- `src/systems/EnemySystem.js` (query tightened to require `EnemyAI`; faction guard; removed DEFAULT_AI fallback; multi-target chase: nearest of {player, allies}; safe-zone redirect only when chasing player)
- `src/ecs/components/Component_Machine.js` (added cost/progress/output/drainRate/range fields)
- `src/entities/EntityFactory.js` (registered HeroAI in COMPONENT_MAP)
- `src/core/ArchetypeLoader.js` (added 'hero')
- `src/utils/ResourceStack.js` (`_pop` respects `mesh.userData.stackScale`)
- `src/config/archetypes/gearworks-machine.json` (UnlockZone → Machine)
- `src/config/archetypes/enemy.json` (ContactDamage.targetFactions includes "ally")
- `src/config/archetypes/hero.json` (armor 2 → 0 after enemy-damage balancing)
- `src/config/levels/level-1-diorama.json` (player spawn cell → [15, 4]; diorama gearworks loader passes Machine config)
- `styles/main.css` (#hero-bar styles + hero-btn animations; joystick CSS rewrite; media query to hide joystick on mouse devices)
- `index.html` (added `<div id="hero-bar">`)
- `tools/index.html` (link to hero editor card)

### Where We Stopped

Hero system feature-complete for MVP:
- Spawn at factory pad (player's spawn cell `[15, 4]`), 5-coin cost per summon, no cap.
- Stationary until enemy enters guardRadius → chases → auto-swings sword.
- Green floating HP bar; dies at 0 HP; mesh + bar cleaned up.
- Enemies reciprocate: target nearest of {player, heroes}; contact damage to either.

Last user exchange was a cheat-sheet of files to edit for future hero tweaks.

### Immediate Next Steps

1. **Return-home toggle** — revisit if hero drift-back is wanted. Would live in `HeroAISystem` with a `returnWhenIdle` flag in `Component_HeroAI` + editor toggle.
2. **Multi-weapon support** — `hero.json` → `SkillLoadout.activeSkill` already accepts any skill in `src/config/skills/`. Add editor dropdown once a second skill (e.g. bow) is validated for heroes.
3. **Hero cap / formation** — right now spawn-spam stacks heroes around the player. Consider max-alive limit or formation positions.
4. **Beyond-hero coin sinks** — heroes are the first real sink. Later: upgrades, buildings, turret unlocks.

---

## NEXT SESSION PRIMER

**Current game state (diorama mode, `?diorama`):**
- Player spawns on factory pad (cell [15, 4], ~world (-21, 0, 1)).
- Gearworks machine sits there. Drop essence → candy appears on output pad → customer stalls buy candy for coins.
- Top HUD row: resource counts. Second row: "Summon Hero 5🪙" button.
- Heroes spawn in a ring around player spawn, get green HP bar, stand still until enemies enter 8-unit guardRadius, then chase + sword.
- Enemies spawn at (-45, 0, 0), walk east, engage nearest of {player, heroes}, contact-damage 1/0.8s.

**Architectural rules to respect:**
- Never register an ECS system with just `[Transform, Movement, Health]` — matches everything. Be specific (e.g. require `EnemyAI`, `HeroAI`).
- Every grid→world lookup → `grid.toWorld(...)` (see `design/logic-flow/grid-system.md`).
- Every add-to-stack → `inventory.addToSlot(type, mesh)` — tune sizes only in `src/config/stackConfig.json` (see `design/logic-flow/universal-stacking.md`).
- Every new resource = 3 files: `MeshPresets.js` + `resources.json` + `stackConfig.json` (see `design/logic-flow/add-new-resource.md`).
- Hero behavior: movement in `HeroAISystem.js`, combat in `SkillSystem`, tuning in `hero.json` via `tools/heroes/editor.html`.

**Hero stack mental map:**

```
hero.json (config)
   ↓
ArchetypeLoader → EntityFactory.create('hero', pos)
   ↓
Entity with [Transform, Movement, Health, HeroAI, SkillLoadout, SkillState, Arms, Tag(hero,ally), ...]
   ↓
HeroAISystem       — guards + chases (faction 'enemy' only, grace-gated 1s after spawn)
SkillSystem        — auto-swings sword when enemy in weapon range (2.8)
HealthSystem       — damage + death + mesh cleanup
EnemySystem        — enemies chase nearest {player, ally}
ContactDamageSystem — enemies damage heroes on contact (faction 'ally' in targetFactions)
HeroBar.update()   — positions floating HP bar each frame
```

<!--
HOW TO USE THIS FILE
─────────────────────
START  →  Paste into context or run: cat SESSIONS.md
          Then say: "Read SESSIONS.md and let's resume."

SAVE   →  Say: "Save this session and overwrite SESSIONS.md"
          Claude will replace this file with current session summary.

TIP    →  Keep this file in your project root and commit it to git.
          Each save = a recoverable snapshot of where your head was at.
-->
