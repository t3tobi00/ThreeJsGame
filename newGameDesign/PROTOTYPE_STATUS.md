# Prototype Build Status — 2026-05-05

> **The prototype is the project's full focus.** Everything else (V1 phases 1-6, legacy game, diorama) is on hold. This doc is the canonical source of truth for "where the prototype is right now."

**Spec source of truth:** `newGameDesign/PROTOTYPE_PLAN.md` (LOCKED — 25 decisions, 15 states, 5 acts).
**Implementation plan:** `~/.claude/plans/yes-binary-bentley.md` (full architecture, file-by-file map).
**Boot URL:** `http://localhost:8000/?prototype` (start with `python3 -m http.server 8000` from repo root).

---

## §1. What works today

### Foundation layer (PR #1) — ✓ shipped
- **`?prototype` URL flag** parallel mode (alongside `?diorama` and legacy default). Zero edits to legacy/diorama mode.
  - `src/core/SceneMode.js` — adds `isPrototypeMode()`.
  - `src/config/levels/level-prototype.json` — new level.
  - `src/main.js` — branch on prototype throughout.
- **AudioManager** (Web Audio synth, no external assets): `src/core/AudioManager.js`. 8 cues — grunt, chime_kill, chime_build, chime_info, alert_high, essence_fading, victory_chord, defeat_thud.
- **PrototypeStateMachine** (JSON-driven, milestone-based): `src/systems/PrototypeStateMachine.js`. Config: `src/config/prototypeStates.json`.
- **PrototypeStats** (counter aggregator): `src/state/PrototypeStats.js`.
- **PrototypeEndUI** (Stats + Play Again): `src/ui/PrototypeEndUI.js`.
- **Decay timer** for essence drops (10s shrink+fade) — extension to `src/systems/CollectorSystem.js`.
- **Ghost mesh layer** (translucent preview + emissive pulse) — `src/utils/GhostMeshFactory.js` + extension to `src/systems/UnlockZoneSystem.js`.
- **Hidden-zone activation** — `level-prototype.json` `hidden:true` + `tag:'foo'` per zone, state machine action `factory.activateGhost('foo')` reveals.
- **Joystick** re-enabled (CSS `body.prototype-mode` overrides desktop hide). Drag-to-waypoint coexists.
- **FPS overlay hidden** in prototype mode.

### Act 1 partial (PR #2) — milestone state machine working, polish pending
- **player-prototype.json** (HP 100, otherwise legacy player) — extends `player.json`.
- **enemy-prototype.json** (HP 30, DMG 5, speed 4, aggroRadius 8) — extends `enemy.json`.
- **enemy-prototype-marcher.json** (permanentChase=true) — for the 5 zombies pre-placed at spawn that march south at boot.
- **tree-prototype.json** (HP 5, deterministic 5 wood drop) — extends `tree.json`.
- **scout.json** (HP 30, ContactDamage 10/0.5, speed 5, faction:'ally', cost 8 essence) — NEW.
- **bruiser.json** (HP 80, ContactDamage 20/1.0, speed 2, cost 15 essence) — NEW.
- **State A → B → C → D → END** wired, all milestone-driven (no time-based auto-advance).
  - A: 5 zombie kills → B
  - B: 1 wall built → C
  - C: 1 soldier spawned (Scout or Bruiser) → D
  - D: 1 more wall built → END
- **Stall escalation engine** — granular sub-milestone checks:
  - `playerInventoryLt: { wood: 5 }` (player hasn't started chopping)
  - `playerInventoryGte: { wood: 10 }` (player has materials)
  - `zoneNotBuilt: 'wall_ghost_1'` (specific ghost not yet built)
  - On match → `enemy.sendWave` (visible reinforcement) + `audio.cue` + `hud.showAlert` toast.
- **EnemyAI.permanentChase** flag — bypasses aggroRadius for marchers.
- **enemy.activateReserves** action — wakes the 7 reserve idlers on State B entry.
- **enemy.sendWave** action — spawns N marchers at the EnemySystem spawn point, bypasses cap.
- **HUD alert toast** — top-center red banner for `hud.showAlert` action.

### Level layout (level-prototype.json)
- 5 marchers pre-placed at z=-19 (chase player from boot).
- 7 reserve idlers at z=-22 to -26 (wander near spawn until State B activates them).
- 6 trees clustered at z=-10 to -14.
- 4 wall ghosts (cells [11,12], [11,14], [11,16], [11,18]) — all hidden until activated.
- 2 spawn pads (Scout at [16,11], Bruiser at [16,19]) — hidden until State C entry.

---

## §2. What's not good yet (next-session priorities)

### Visual polish — HIGH priority
1. **Unlock zone flat UI: misaligned + no progress feedback.**
   - **DELETE the 3D ghost building preview entirely** — remove `src/utils/GhostMeshFactory.js` and the `_ensureGhost`/`_destroyGhost`/`_ghostMap` block in `src/systems/UnlockZoneSystem.js`. The ghost mesh isn't wanted; the flat UI alone is the goal.
   - **Fix orientation mismatch.** The corner brackets, the shaded rectangle, and the inner content (cost icons / numbers) currently face different directions. Pick ONE orientation and align everything to it (corners + shade + content match).
   - **Lighten the shade.** Current shadow opacity is too dark — make it brighter / more white so the panel reads better.
   - **Per-resource progress fill.** Currently the cost label is static (e.g. "10 wood + 3 essence"). Make it visibly fill up as the player drops resources: a small bar or dot row per resource type that grows from 0 → cost as drains land. Combined with the existing arc-pickup animation, this should feel like the zone is consuming the items in real time.
   - Keep `UnlockZoneUI` (`src/ui/UnlockZoneUI.js`) — that's the flat UI we're improving. `FloatingUI` is the 3D-projected text helper.
2. **Zombies aren't scary.** Currently they walk forward and contact-damage silently. Goal: scare juice — attack lunge animation, growl/snarl SFX, red-flash burst on hit, screen shake on player hit, blood splatter particles, optional limb tatters.
3. **Soldiers don't animate.** Scout/Bruiser stand stiff while engaging. They use HeroAI for steering + ContactDamage for damage, no SkillSystem (no sword swing). Goal: arm-swing or melee-strike animation on each ContactDamage hit + impact SFX.
4. **No "what to do next" feedback.** Player has to guess what to chop/build/spawn. Goal: 3D-parented finger-pointer or pulsing-glow ring on the next-step target (tree → ghost → spawn pad), cleared when sub-milestone is met.

### Acts 2-5 — high-level work remaining
- **Act 2** (Defense Build): 3 more walls + 1 gate ghost, state E + F. Largely existing systems (UnlockZone + BuildSystem).
- **Act 3** (Automation): 3 worker archetypes (Wood / Essence / Builder) + WorkerAI system + Worker Pad multi-spawn + OnSpawn helper. Most novel new code.
- **Act 4** (Rival Twist): Rival faction (Soldier + King + Base) + RivalAI + base-reveal opacity tween + dust burst + audio sting + chaos wave config. Polish-heavy.
- **Act 5** (King Kill): Attack-Ready zone + RallyZoneSystem + King fight + T3 finisher (hitstop + shake + red puff + victory chord) + Stats screen routing.

### Smaller polish nice-to-haves
- Tree pulse-glow when wood is low (the `pulseTrees` action is currently a stub log).
- Decay arrow above expiring essence (currently shrink+fade only).
- 3D-parented role icon above each worker (Act 3).
- Red-arrow billboard pinned to rival group (Act 4).
- Better camera shake on player hit (event currently emitted but tuning needed).

---

## §3. Architecture additions (the new pieces)

### New files
| Path | Purpose |
|---|---|
| `src/core/AudioManager.js` | Web Audio synth singleton |
| `src/state/PrototypeStats.js` | End-of-run counters |
| `src/systems/PrototypeStateMachine.js` | 15-state FSM engine |
| `src/utils/GhostMeshFactory.js` | Translucent preview meshes |
| `src/ui/PrototypeEndUI.js` | Victory/Defeat overlay |
| `src/config/prototypeStates.json` | State machine config |
| `src/config/levels/level-prototype.json` | Prototype level layout |
| `src/config/archetypes/player-prototype.json` | HP-bumped player |
| `src/config/archetypes/enemy-prototype.json` | §4 zombie tuning |
| `src/config/archetypes/enemy-prototype-marcher.json` | permanentChase variant |
| `src/config/archetypes/tree-prototype.json` | HP 5, 5W deterministic |
| `src/config/archetypes/scout.json` | Fast/cheap ally soldier |
| `src/config/archetypes/bruiser.json` | Slow/strong ally soldier |

### Modified files
| Path | Change |
|---|---|
| `src/main.js` | Boot wiring, mode flag, system registration, level path branch, body class for CSS |
| `src/core/SceneMode.js` | Add `isPrototypeMode()` |
| `src/core/ArchetypeLoader.js` | Register new archetype names |
| `src/config/gameConfig.js` | SCENE_CONFIG.mode enum extended |
| `src/systems/CollectorSystem.js` | Decay timer for essence disks |
| `src/systems/UnlockZoneSystem.js` | Ghost mesh spawn + visibility check |
| `src/systems/EnemySystem.js` | `setFrozen()` + `archetype` config + `permanentChase` honoring |
| `src/systems/BuildSystem.js` | Tags emitted in `zone:built` / `zone:spawned` events |
| `src/ecs/components/Component_EnemyAI.js` | `permanentChase` field |
| `styles/main.css` | `body.prototype-mode #joystick-container` override |

### State machine action vocabulary (current)
| Action | Effect |
|---|---|
| `enemy.setSpawnConfig <key>` | EnemySystem.setConfig with bundle |
| `enemy.sendWave { count, archetype }` | Spawn N at spawn point, bypass cap |
| `enemy.activateReserves` | Set permanentChase=true on all current EnemyAI |
| `enemy.freeze <bool>` | Pause EnemySystem update |
| `audio.cue <name>` | Emit `audio:cue` event |
| `camera.shake { amount, duration }` | Emit `camera:shake` |
| `camera.hitstop <seconds>` | Emit `game:hitstop` |
| `factory.activateGhost <tag>` | Set Transform.mesh.visible=true on tagged entity |
| `factory.spawn { archetype, count, anchor }` | Spawn N at named anchor (tag) or world pos |
| `revealRivalBase` | Stub for Act 4 |
| `hud.showAlert <text>` | Toast banner top-center |
| `pulseTrees <bool>` | Stub (Act 1 polish) |

### Stall escalation schema (per state config)
```jsonc
"stallEscalation": [
  {
    "afterSeconds": 15,
    "stallCondition": {
      "playerInventoryLt":  { "wood": 5 },        // player has < 5 wood
      "playerInventoryGte": { "wood": 10 },       // player has >= 10 wood
      "zoneNotBuilt":       "wall_ghost_1",       // tag not in builtTags set
      "zoneBuilt":          "wall_ghost_1"        // tag in builtTags set
    },
    "actions": [...]
  }
]
```

ALL listed conditions must hold for the escalation to fire (AND semantics). Escalation fires once per state entry.

---

## §4. Known issues / open questions

- **Scout/Bruiser don't visibly attack.** They navigate to enemies via HeroAI but ContactDamage is silent (no anim). Address in next session.
- **Zombies don't visibly attack.** Same — they walk into the player and silently apply ContactDamage. Address in next session.
- **Unlock zones visually flat.** Address in next session.
- **No finger pointer.** Stall escalation tells the player WHAT to do via toast text but not WHERE. Address in next session.
- **`pulseTrees` action is a stub.** Wire it to actually pulse trees when wood is low.
- **Conflicts between joystick + drag-to-waypoint** — when both push the player, behavior is jittery. May need to clear waypoint on joystick input.
- **Wall ghost #2 reveal timing** — currently activates on State D entry. Player might still be fighting marchers from State C. Polish: maybe wait for clearance.

---

## §5. How to test

```bash
cd /Users/bibektandon/Desktop/code/ThesisGame2
python3 -m http.server 8000
# then in browser:
http://localhost:8000/?prototype       # prototype
http://localhost:8000/?diorama         # regression
http://localhost:8000/                 # legacy
```

**Active-play scenario** (~60-90s):
1. Boot → 5 marchers + 7 idlers visible north. Joystick bottom-left.
2. Kill 5 zombies → State B fires. 7 idlers wake up (start marching south). Wall ghost #1 reveals.
3. Chop trees (10 wood) + collect 3 essence from kills → walk to wall ghost → wall builds.
4. State C fires. Spawn pads reveal.
5. Kill more zombies for 8 essence → drain into Scout pad → Scout spawns + auto-engages.
6. State D fires. Wall ghost #2 reveals.
7. Chop more trees → build wall #2 → State END → Victory screen.

**Stall-pressure scenario:**
1. Boot, kill 5 marchers, then DO NOTHING in State B.
2. ~15s in: 3 marchers spawn at north + red toast "Chop the trees!" + chime.
3. Still nothing.
4. Wood-stall tier (no wood condition still) won't fire again. The wood-≥10-but-not-built tier won't fire (you have 0 wood). The "no wall built (any reason)" tier fires at 45s with 6 marchers + alert sting.

**Inventory-stall scenario:**
1. Kill 5, State B fires.
2. Chop two trees → 10 wood on stack. Don't go to ghost.
3. ~30s in: "Build the wall!" toast + 4 marchers + sting.

---

## §6. Implementation cadence

Six PRs total. Foundation + Act 1 done. Acts 2-5 + visual polish remain.

| PR | Status |
|---|---|
| PR #1: Foundation | ✓ shipped |
| PR #2: Act 1 (skeleton) | ✓ shipped — milestone-based working |
| PR #2.5: Act 1 polish | ⏳ next session — visual quality, scary zombies, soldier anim, finger pointer |
| PR #3: Act 2 | pending |
| PR #4: Act 3 | pending |
| PR #5: Act 4 | pending |
| PR #6: Act 5 | pending |

---

## §7. Session-start prompt for the next conversation

Paste this at the start of a new Claude Code session to resume work:

```
I'm continuing work on the Base Defense Tycoon prototype. The whole project's
focus is now on the ?prototype mode — V1 phase docs are reference only, and
legacy/diorama modes are not to be touched.

Read these in order before doing anything:
  1. newGameDesign/PROTOTYPE_STATUS.md     (current state, this snapshot)
  2. newGameDesign/PROTOTYPE_PLAN.md       (locked spec, 25 decisions)
  3. ~/.claude/plans/yes-binary-bentley.md (full implementation plan)
  4. CLAUDE.md (root) and newGameDesign/CLAUDE.md

Auto mode active — execute autonomously. Ask only on major design forks.

Top priorities (in order):
  1. Unlock zone flat UI improvement (NOT a 3D preview — keep flat).
       a. DELETE src/utils/GhostMeshFactory.js and the
          _ensureGhost / _destroyGhost / _ghostMap block in
          src/systems/UnlockZoneSystem.js. The 3D ghost preview is
          NOT wanted.
       b. Fix orientation mismatch in UnlockZoneUI: corner brackets,
          shaded rectangle, and inner content (cost icons/numbers)
          currently face different directions. Align all to one
          orientation.
       c. Lighten the shade — current shadow opacity is too dark.
          Make corners brighter / more white so the panel reads
          cleaner.
       d. Add per-resource progress fill — a small bar or dot row
          per resource type (e.g. wood, essence) inside the panel
          that fills 0→cost as drains land. Should feel like the
          zone is visibly consuming items as the player drops them.
  2. Make zombies SCARY — attack lunge animation + snarl SFX + red flash
     burst + screen shake on player hit + blood-splatter particles.
  3. Soldier attack animations — Scout/Bruiser arm-swing or melee-strike
     animation on each ContactDamage hit + impact SFX.
  4. Visual feedback for next step — 3D finger pointer / pulsing-glow ring
     on the next-required target (tree, ghost, spawn pad), cleared when
     the sub-milestone is met.
  5. Wire the stub `pulseTrees` action to actually pulse trees.
  6. Acts 2-5 implementation (after polish).

Workflow constraints:
  - Stay in ?prototype mode. Don't touch legacy/diorama.
  - Non-destructive: extends-based archetypes, separate level JSON,
    parallel mode pattern.
  - Progression-based, not time-based — milestone exits + stall escalation
    with sub-milestone checks (playerInventoryLt/Gte, zoneNotBuilt, zoneBuilt).
  - 3D-parented UI for in-world prompts; HTML overlay only for one-shot UI.
  - JSON-configurable first.

Boot for testing:
  cd /Users/bibektandon/Desktop/code/ThesisGame2
  python3 -m http.server 8000
  http://localhost:8000/?prototype

Start by reading the priority files, then propose a concrete action plan
for priority #1 (unlock zone visual upgrade) in 2-3 short bullets, then
execute autonomously.
```
