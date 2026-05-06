# Prototype Build Status — 2026-05-06

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

### Done since 2026-05-05 session
1. ✓ **Unlock zone flat UI** — ghost preview deleted; orientation aligned (parallel preset `unlock-zone-flat` scoped to prototype only via `unlock-turret-prototype` archetype); shade lightened (`0x9aa6b0` @ 0.45); per-input mini-bars dropped in favour of a single **whole-zone water fill** (translucent emerald plane anchored at south edge, scales north as `total_progress / total_cost` rises).
2. ✓ **Zombies are scary** — full pass shipped:
   - **Player-hit reactions**: grunt + new `snarl` cue + halved camera shake (anti-stack throttle in CameraSystem) + red FlashAnim already wired.
   - **Blood splatter** on every combatant hit (zombies, player, allies) — silent damage (poison) skips the splatter.
   - **Rigged green zombie mesh** (`character-zombie` preset) with classic forward-reach idle, hunched torso, tilted head. WalkAnim `style: 'zombie'` drives a stiff-leg lurch + side sway in PlayerAnimSystem.
   - **3-phase attack animation** in LungeAnimSystem — wind-up arms overhead, slam forward-down past rest, body lunge, head bite, scale pulse. Reads as horror movie zombie.
   - **Ranged poison-spit attack** (new `Spitter` component + `SpitterSystem`): range 5u, 2.2s cooldown, head-recoil → thrust anim, glowing arcing projectile. Spit no longer direct-hits — lands as a lingering **poison cloud** at impact location.
   - **Poison cloud** (new `PoisonCloudSystem`) — 7 scattered translucent green blobs (varied size, squashed Y, ground-hugging) form an irregular gas pocket, opacity 0.10, 10s lifetime, fade in last 30%, light particle drift accent. Damage: 2 HP/s in 1.6u radius. Multiple clouds stack (each ticks damage independently). Player tactic: keep moving.
3. ✓ **Soldier attack animations + per-troop identity**:
   - **Scout (green)** — fast 0.24s alternating right-then-left jab. Each jab peak spawns a **cyan slash arc** (partial torus, scales+fades) via new `CombatVFXSystem`.
   - **Bruiser (red)** — heavy 0.50s two-arm overhead hammer-smash with deep pelvis dip + body lunge + 16% scale boost. Strike peak spawns a **red ground shockwave ring** (expands 0.5→2.8u over 0.40s).
   - Both fire `impact_thud` audio cue.
   - Routing in LungeAnimSystem reads Tag to pick scout/bruiser/soldier kind.
4. ✓ **Combat readability fixes**:
   - **SeparationSystem** — same-faction repulsion via spatial hash (uses `Collider.radius × 1.85` for desired centre-to-centre gap). Prevents 8 zombies from blobbing into one silhouette.
   - **Stop-at-attack-range** — EnemySystem reads `ContactDamage.range - 0.4` as stop distance; soldiers' `HeroAI.attackRange` lowered `1.5 → 1.1` so they sit inside the damage zone with visible space.
5. ✓ **Combat pacing rebalance**:
   - Zombie HP `30 → 45`, speed `4 → 3`, melee dmg `5 → 2`, melee cooldown `1.0 → 1.5`, spit cooldown `1.5 → 2.2`.
   - Player sword damage `8 → 6`, fireRate `0.35 → 0.45` (~2× TTK ≈ 3s/zombie).
   - Camera shake amount `0.3 → 0.18` + anti-stack gate (only refresh if current decayed below 50% of incoming).
6. ✓ **Pre-placed test soldiers** — 1 Scout at `(-3,0,-3)`, 1 Bruiser at `(3,0,-3)` in `level-prototype.json` so attack anims can be inspected without draining essence into spawn pads. Level loader sets `HeroAI.homePosition` from spawn pos so they guard their placement instead of `(0,0,0)`. **Remove the two test entries before final balancing is locked.**

### Still open — next-session priorities

1. **No "what to do next" feedback.** Player has to guess what to chop/build/spawn. Goal: 3D-parented finger-pointer or pulsing-glow ring on the next-step target (tree → ghost → spawn pad), cleared when sub-milestone is met.
2. **Per-troop attack visual richness.** User flagged that Scout/Bruiser still feel "okay for now" but should later get richer per-class identity (different weapon arcs, hit reactions, finishers). VFX foundation (`CombatVFXSystem`) is in place — extend later.
3. **`pulseTrees` action is still a stub.** Wire to actually pulse trees when wood is low (state machine action exists, system call is `console.log` placeholder).
4. **Conflicts between joystick + drag-to-waypoint** — when both push the player, behavior is jittery. May need to clear waypoint on joystick input.
5. **Wall ghost #2 reveal timing** — currently activates on State D entry. Player might still be fighting marchers from State C. Polish: maybe wait for clearance.

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
| `src/core/AudioManager.js` | Web Audio synth singleton (added cues: `snarl`, `spit_hiss`, `spit_splat`, `impact_thud`) |
| `src/state/PrototypeStats.js` | End-of-run counters |
| `src/systems/PrototypeStateMachine.js` | 15-state FSM engine |
| `src/systems/SpitterSystem.js` | Ranged poison-spit projectile manager |
| `src/systems/PoisonCloudSystem.js` | Lingering gas clouds (irregular blob clusters + drifting puffs) |
| `src/systems/SeparationSystem.js` | Same-faction crowd repulsion |
| `src/systems/LungeAnimSystem.js` | Per-faction/per-class attack animations (zombie slam, scout jab, bruiser smash, spit recoil) |
| `src/systems/CombatVFXSystem.js` | Transient mesh effects (slash arc, ground shockwave) |
| `src/ecs/components/Component_Spitter.js` | Ranged spit attack data |
| `src/ui/PrototypeEndUI.js` | Victory/Defeat overlay |
| `src/config/prototypeStates.json` | State machine config |
| `src/config/levels/level-prototype.json` | Prototype level layout (now also contains 1 test scout + 1 test bruiser) |
| `src/config/archetypes/player-prototype.json` | HP-bumped player |
| `src/config/archetypes/enemy-prototype.json` | Prototype zombie (rigged + spitter) |
| `src/config/archetypes/enemy-prototype-marcher.json` | permanentChase variant |
| `src/config/archetypes/tree-prototype.json` | HP 5, 5W deterministic |
| `src/config/archetypes/scout.json` | Fast/cheap ally soldier |
| `src/config/archetypes/bruiser.json` | Slow/strong ally soldier |
| `src/config/archetypes/unlock-turret-prototype.json` | Prototype-scoped variant — uses `unlock-zone-flat` mesh preset |

### Deleted files
| Path | Reason |
|---|---|
| `src/utils/GhostMeshFactory.js` | 3D translucent ghost preview was rejected; flat unlock-zone UI replaces it |

### Modified files
| Path | Change |
|---|---|
| `src/main.js` | Boot wiring (Spitter, PoisonCloud, Separation, CombatVFX, LungeAnim systems); blood-splatter listener with silent-poison skip; HeroAI homePosition seed for level-loaded heroes |
| `src/core/SceneMode.js` | Add `isPrototypeMode()` |
| `src/core/ArchetypeLoader.js` | Register prototype + soldier archetypes |
| `src/core/MeshPresets.js` | Add `character-zombie` (rigged green zombie reach pose) + `unlock-zone-flat` (no Y-twist + lighter shade); legacy `unlock-zone` kept untouched for diorama/legacy modes |
| `src/core/AudioManager.js` | Snarl + camera shake on player hit; new cues (`snarl`, `spit_hiss`, `spit_splat`, `impact_thud`); silent-damage skip |
| `src/core/EventBus.js` | (unchanged) |
| `src/config/gameConfig.js` | SCENE_CONFIG.mode enum extended |
| `src/config/skills/sword.json` | Player damage/fireRate retuned for ~3s TTK |
| `src/systems/CameraSystem.js` | Anti-stack shake gating (only refresh if decayed below 50% of incoming) |
| `src/systems/CollectorSystem.js` | Decay timer for essence disks |
| `src/systems/ContactDamageSystem.js` | Emits `entity:attacked` alongside `entity:damaged` so LungeAnimSystem can drive attack anims |
| `src/systems/UnlockZoneSystem.js` | Ghost mesh layer removed; flat UI only |
| `src/systems/EnemySystem.js` | `setFrozen()` + `archetype` config + `permanentChase` honoring + stop-at-attack-range chase |
| `src/systems/BuildSystem.js` | Tags emitted in `zone:built` / `zone:spawned` events |
| `src/systems/ParticleSystem.js` | New methods: `createBloodSplatter`, `createPoisonSplatter`, `createPoisonPuff`, `createSlashSpark`, `createImpactBurst`; per-burst `gravity` + `opacity` options |
| `src/systems/PlayerAnimSystem.js` | `WalkAnim.style === 'zombie'` branch (locked-forward arms, stiff lurch, side sway) |
| `src/ui/UnlockZoneUI.js` | Whole-zone water-fill plane (replaces per-input mini bars) |
| `src/ecs/components/Component_EnemyAI.js` | `permanentChase` field |
| `src/ecs/components/Component_WalkAnim.js` | `style: 'human' | 'zombie'` field |
| `src/entities/EntityFactory.js` | Register `Spitter` component |
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

| PR | Status |
|---|---|
| PR #1: Foundation | ✓ shipped |
| PR #2: Act 1 (skeleton) | ✓ shipped |
| PR #2.5: Act 1 polish — unlock-zone fill, scary zombies, soldier anim+VFX, crowd separation, stop-at-range, combat pacing | ✓ shipped |
| PR #2.6: Visual feedback for next-step targets (finger pointer / glow ring) + `pulseTrees` wiring | ⏳ next session |
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
  1. Visual feedback for next step — 3D finger pointer / pulsing-glow ring
     on the next-required target (tree, ghost, spawn pad), cleared when
     the sub-milestone is met.
  2. Wire the stub `pulseTrees` action to actually pulse trees when wood
     is low (currently a console.log placeholder in PrototypeStateMachine).
  3. Acts 2-5 implementation (after polish).

Already shipped in PR #2.5 (do NOT redo):
  - Unlock zone flat UI (water fill, lightened shade, parallel preset).
  - Scary zombies (snarl, shake, blood, rigged green mesh, lurch walk,
    3-phase slam attack, ranged poison spit, lingering poison clouds).
  - Soldier attack identity (scout fast jab + cyan slash arc, bruiser
    heavy smash + red ground shockwave, impact_thud audio).
  - Crowd separation (SeparationSystem) + stop-at-attack-range.
  - Combat pacing rebalance (zombie HP 45, sword 6dmg/0.45fr, melee 2dmg).
  - 1 test Scout + 1 test Bruiser pre-spawned in level-prototype.json
    (REMOVE these two entries before final balancing is locked).

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
