# Prototype Build Status — 2026-05-12 (haunt-pass complete)

## §0. Headline (2026-05-12 session — spatial + rival + zombie AI overhaul)

End-of-session state — user said: *"looks really impressive but now it's becoming overall very challenging to survive."*

**Live and validated:**
- **100×100u map** (was 60u). Player south (0,0,+40); 3 rival king flags at W/N/E compass extremes (±40u).
- **Procedural trees + rocks** (`level-prototype.json` → `procedural` block). Seeded RNG (mulberry32), tunable counts/radii/min-spacing. Default 70 trees + 10 rocks.
- **Finite forest** — trees don't regrow; felling leaves a **vertical squat stump** (new `tree-stump` archetype + new MeshPreset).
- **Victory condition** wired — kill all 3 `rival-king` entities → `state:entered { id: 'END' }` → PrototypeEndUI Victory.
- **Smart zombies** — Reynolds boids (separation + alignment + cohesion + random), batched cemetery bursts with shared-march destination, stall-break, cemetery→cemetery herd patrols, random ground emergence with 2s dust-puff marker, F.E.A.R.-style LKP memory, 3-tier horde call (immediate 25u / drift 60u / alert 120u map-wide), combat blood sense buff. Detection icons (`!`/`?`) flash above zombie heads on aggro/noise pickup.

**Key locked decisions during this session:**
- Forest is one big random sprawl (no per-base starter clusters; pure unfiltered random).
- Rival soldiers REMOVED; only king flags remain (rival worker AI deferred to next session).
- Rival kings tagged `no_zombie_target` — zombies don't pile on the objectives; player still attacks normally.
- Zombies attack rival faction too (haunted for everyone), but the tag filter keeps kings safe.

**See `~/.claude/projects/.../memory/project_haunt_pass_complete_2026_05_12.md`** for the granular file-by-file change log + every tuning knob exposed.

## §0a. Next-session priorities (in order)

**1. Difficulty tuning** (user-flagged). Most likely first dial-downs:
- `Z_max` 100 → 60-70
- `hordecall_alert_radius` 120 → 80
- `hordecall_alert_sense_multiplier` 2.0 → 1.5
- `combat_blood_radius` 20 → 14
- `investigate_duration` 10s → 6s
- enemy-prototype `senseRadius` 16 → 12
- Survivability levers: reintroduce 3-4 starter trees near each base; bump player `regen_rate_per_sec` 1 → 2

**2. Rival workers + behavior archetypes** (deferred from this session). Add Rusher / Economist / Turtle defensive AI + 3-5 idle soldiers around each king. Currently rivals are JUST passive flags.

**3. (Optional) Sound** — combat noise mechanic uses `entity:damaged` but there's no actual audio cue. Could add muffled moans on Tier 3 alert + dramatic chord on horde events.

## §0b. Historical: 2026-05-11 (post-tutorial cleanup)

End-of-session state, all user-validated:

- **Balance v2** — full research-derived math pass live (see `project_balance_v2_2026_05_11.md`).
- **Tutorial system removed** — sandbox mode. No state machine, no fence, no unlock zones, no next-step pointer.
- **Right-edge SpawnMenu is the sole spawn/build interface.** ARMY (Scout/Bruiser/Sharp) + WORK (Lumber/Mage) read costs from `archetype.spawn.cost` via `$balance` placeholders. BUILD ▸ Wood Box (30W+5E) / Ess. Box (15W+10E) wired. BUILD ▸ Wall shows `1🪵 / 2 logs` per-log sub-label.
- **`ResourceDrain` util** (`src/utils/ResourceDrain.js`) is the canonical drain order — storage entities first, player back second. Both `SpawnMenuSystem` and `DrawWallSystem` route through it.
- **Storage chicken-and-egg fixed.** Player carry capacity bumped 10 → 30 (`balance.economy.carry_capacity_per_slot`) so 6 trees of chopping (~12s) funds the first Wood Box.
- **DrawWallSystem can drain storage wood** — no more "Need wood" lie when wood sits in storage.
- **PrototypeToast** — `src/ui/PrototypeToast.js` carries the lazy red toast div for `EventBus 'hud:showAlert'` (DrawWallSystem out-of-wood, SpawnMenu unaffordable). Replaces the inline toast that used to live in PSM.

What works end-to-end (verified by code + sim):
1. Chop trees → up to 30W on back.
2. BUILD ▸ Wood Box → place → drains 30W + 5E.
3. Chop more → walk near Wood Box → StorageDepositSystem arcs items in.
4. ARMY/WORK menu drains storage first then player back (one rule, two systems).
5. BUILD ▸ Wall → DrawWallSystem charges 1W per 2 logs, sources from storage + player back.
6. Player dies → PrototypeEndUI Defeat screen. (Victory has no trigger yet.)

Open questions for next session: §0a.

## §0a. Next session — spatial redesign (A) + first rival (B)

User signed off on shipping both together in the next session:

**A. Spatial redesign — risk-graded harvest.** Current sandbox has 10 trees clustered close to base; harvest feels safe, no risk-trip tension. Target: redistribute trees + rocks across the 60×60 map at distance-graded yields (e.g. close = 3W, mid = 5W, far = 8W per tree), pull inner-perimeter trees, anchor far-grove clusters near the 22u cemeteries. Optionally a `stump` prop where a tree is felled (locked input #3 — "no regrowth, leave a small remaining log").

**B. First rival + win condition.** Pick one Pentagon archetype (recommend **Turtle** — defensive, easier AI to validate) and place at one corner (probably NW). Stats per `newGameDesign/PHASE_5_AI.md` + V1 §13. Includes: rival king (HP 200, DMG 30), ~5 rival soldiers, base building. Behavior: defensive sit-still + one-shot raid mid-game (per `PROTOTYPE_PLAN.md` §4 Act 4 simplification). Victory trigger: player kills rival king → `PrototypeEndUI` Victory.

See `project_next_session_spatial_rival_2026_05_11.md` for the full brief.

## §0b. Historical: tutorial removed (early 2026-05-11)

- **Deleted files:** `src/systems/PrototypeStateMachine.js`, `src/systems/NextStepIndicator.js`, `src/systems/PalisadeGateSystem.js`, `src/config/prototypeStates.json`, `src/config/archetypes/worker-pad-active.json`.
- **Level (`level-prototype.json`):** `fence` block + all 9 `unlockZones` (north/south/east/west wall_zone, scout_pad, bruiser_pad, plus the 3 storage/worker-pad zones added earlier this session) all removed. Boot scene is now: player at center + 4 hidden cemeteries + 7 idle zombies + 10 trees + 4 rocks.
- **main.js:** all PSM / NextStepIndicator / palisade-gate / fence:revealSide / wall-rise tween wiring removed. Toast feedback (e.g. `DrawWallSystem` out-of-wood) routes through new `src/ui/PrototypeToast.js` which listens on `EventBus 'hud:showAlert'`.
- **ArchetypeLoader:** `worker-pad-active` dropped from the load manifest.
- **Palisade fence:** gone entirely. Drawn walls (BUILD ▸ Wall) are the only player-built fortification. Auto-sink palisade-gate system removed; drawn-wall gate system (`DrawnWallGateSystem`) kept for the drawn walls.

What still works (no regressions):
- Player spawn, joystick, sword swing, tree chop, rock harvest.
- Zombies spawn from 4 hidden cemeteries via `EnemySystem` reading wave config from `balance.json`.
- Right-edge SpawnMenu (ARMY / WORK / BUILD) — all soldier + worker spawns route through it. (Storage cost wiring landed later in the same session — see §0.)
- Drawn walls cost 1W per 2 logs; truncation toast fires via PrototypeToast.
- PrototypeEndUI shows the Defeat screen on `player:died`.

What no longer exists:
- Act 1-5 progression / milestone exits / stall escalation / "go here next" 3D pointer.
- North-South-East-West palisade fence + staged build flow.
- Worker-pad ghost zone + the 3-worker OnSpawn drop.

Open items the user has flagged for later:
- BUILD ▸ Wood Box / Essence Box currently FREE — wire `balance.economy.wood_storage` / `essence_storage` costs into `SpawnMenuSystem._onPointerDown`.
- New tutorial design (TBD).
- Storage drain when consumed (the `stack:changed` emit added earlier still applies when storage exists).

## §0a. Earlier 2026-05-11 session — balance v2 (still live)

Shipped this session:
- **Balance v2 — fresh research-derived math pass.** All HP/DMG/cost/cadence values rederived from gaming principles (Diablo TTK, TaB swarm density, Hades panic window, RTS counter canon, Brotato 5-min arc). 12 master inputs feed the entire sheet. See `~/.claude/projects/.../memory/project_balance_v2_2026_05_11.md` for the full derivation chain and `src/config/balance.json` for the spreadsheet itself.
- **BalanceLoader + placeholder resolver.** Archetype / skill / level JSONs reference values via `$balance.X.Y.Z` strings; `src/core/BalanceLoader.js` walks the trees and substitutes real numbers at boot. Retuning is a single-file edit. `ArchetypeLoader`, `SkillRegistry`, and `SceneLoader` all run the resolver during their load passes.
- **RegenSystem + Component_Regen** — player slow regen 1 HP/s after 5s OOC (locked input #4). Allies/workers stay perma-damage.
- **Hidden zombie spawn points** — cemetery lava-hole visuals hidden at factory creation (`spawn-hidden` tag), spawn logic preserved.
- **Drawn walls now cost wood** — `DrawWallSystem` charges 1W per `logs_per_wood` (=2) and truncates the path at the affordable length; toast on truncation via `EventBus 'hud:showAlert'`.

Headline tuned values (user-validated where noted): player 100HP + 1HP/s regen / sword 10dmg @ 0.5s / zombie 30/7/1.5s (4.67 DPS → solo TTK 21s, 4-swarm TTK 5.4s — playtested as "just right") / Scout 50/6/0.5s 8E / Bruiser 125/20/1.0s 15E / Sharpshooter 50/14/1.2s 12E / Worker 25HP 5E / Tree HP 40 / 5W drop / Wall 10W+3E / Drawn-log HP 30 / waves cap 5→25 @ +5/min over 240s / spawn 4-7s / essence decay 10s.

NEW infrastructure costs in balance.json (NOT yet wired to ghost zones — Round 2 work): wood-storage 30W+5E · essence-storage 15W+10E · worker-base 10W+5E · worker-pad (3 workers) 30W+15E.

## §0a. Known bugs (active, fix next)

1. **Wood storage doesn't deduct on build.** When a builder or player consumes wood for a wall ghost zone, the wood-storage visible stack does not decrease. Storage prop appears to be a fire-and-forget deposit destination, not a real withdrawal source. Reported user 2026-05-10.
2. **Wood storage + essence storage place for free.** Storage props are pre-placed in the level (or disabled in current clean-boot state) — no ghost zone gates their construction. balance.json now has costs (30W+5E / 15W+10E); just need the build-zones wired into `level-prototype.json`.
3. **Drawn-wall truncate toast not visible.** When `DrawWallSystem` runs out of wood mid-draw it emits `EventBus 'hud:showAlert'` with "Out of wood — wall cut short." The state-machine has a listener for `hud:showAlert`, but the user reports the toast doesn't appear. Either the listener isn't firing or the toast renders behind something.

## §0b. Old headline (2026-05-08 session, kept for history)

Shipped this session, all user-validated:
- **#9 trees blinking fix** — new `living-tree` MeshPreset with leafy crown + foliage-only pulse
- **#1 map layout (south logistics belt)** — 5 worker buildings rearranged into 2 south rows; mil pads moved north of player
- **#5 attack animations BOTH halves** — scout chained spear-throw + bruiser magma-breath cone-AOE with burning zombies + ground patches

**Remaining backlog (in user's priority order for next session):**
1. PHASE 1: Quick bug fixes
   - HeroAI: soldiers only attack what's directly in front (target locks until death)
   - Wood-worker stuck on spawn (was working before this session)
2. PHASE 2: #6 Long-range Sharpshooter (third soldier class — needs design brainstorm)
3. PHASE 3: #4 Combat AI Intelligence (poison-cloud avoidance, defend workers/king/walls, group cohesion)
4. PHASE 4: #3 Builder construction phase (pre-pay + hammer animation)
5. PHASE 5: #2 Wood-chop animation
6. PHASE 6: #8 UnlockZoneUI essence icon + overall icon designs
7. PHASE 7: #7 Storage prop colors

See `~/.claude/projects/.../memory/project_next_session_priorities_2026_05_08.md` for the full work order.

---

# (Historical) Prototype Build Status — 2026-05-07 (PR #2.7 shipped)

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

### Done since 2026-05-06 (PR #2.6)
1. ✓ **Next-step visual feedback (3D pointer)** — new `NextStepIndicator` system renders an emerald pulsing ground-ring + bobbing diamond chevron above the next-required target. JSON-driven `hints` arrays per state (B/C/D in `prototypeStates.json`) reuse the stall-escalation condition vocabulary (`playerInventoryLt/Gte`, `zoneNotBuilt`, `zoneBuilt`). Target kinds: `tag` (named ghost/pad), `nearestTag` (closest tree), `nearestFaction` (closest enemy). Pointer auto-hides when no hint matches.
2. ✓ **`pulseTrees` action wired** — replaces the `console.log` stub. State B entry triggers `indicator.setTreePulse(true)`; emissive on every visible tree mesh oscillates green; State C disables it; State D re-enables for the second wall; END turns it off. Originals restored on disable.

### Done 2026-05-07 (PR #2.7) — Wall overhaul + auto-sink palisade gates
1. ✓ **Palisade fence look** — replaced the old `wall` archetype block with `MeshPresets.create('palisade-log', ...)` rendered via `SceneLoader._buildFence`. Each log: 8-sided cylinder body (1.8u tall, 0.18u radius, warm wood) + pointed conical cap (darker), per-instance scale/lean/tint variation for a hand-built feel. Spacing 0.30u so the row reads as a continuous wall.
2. ✓ **Per-side fence (staged build N→S→E→W)** — `SceneLoader._buildFence` extended to support `fence.sides: { north, south, east, west }` (legacy `fence.cells` still works). Each side renders into its own `THREE.Group` with its own edge metadata. `main.js` hides all sides at boot, lazily creates colliders + reveals each side on a `fence:revealSide` event (auto-fired from `zone:built` tag listeners). State machine extended with states E (east) and F (west) so Act 1 cycles the full perimeter.
3. ✓ **`eventTag` filter** — new filter case in `PrototypeStateMachine._triggerMatches` that checks `ev.tags?.includes(expected)`, used by the new wall-zone exit triggers.
4. ✓ **Auto-sink palisade gates** — new `PalisadeGateSystem` opens local logs as the player approaches a wall. Two-tier trigger: **close-range** (≤0.7u box-distance) opens for any movement direction; **mid-range** (0.7–1.1u) requires |velocity · outward-normal| > 0.30. Once open, a 1.0s **hold timer** keeps the gate latched even if the player stops or turns — fixes the twitchy "open/close racing with your speed" behavior. Logs sink 2.5u Y-down with smoothstep easing; edge collider disables at 45% openness (hysteresis prevents flicker).
5. ✓ **Box-distance metric (debug fix)** — early version measured player-to-edge-midpoint, which left a "seam dead-zone" between adjacent edges. Fixed to measure perpendicular distance to the edge AABB, so straight-on approaches always trigger.
6. ✓ **Local velocity derivation** — `Movement.velocity` isn't reliably populated by the prototype's joystick/waypoint paths. Gate system derives velocity from per-frame position deltas instead.

### Files added / changed in PR #2.7
- NEW `src/systems/PalisadeGateSystem.js` — auto-sink gate system.
- NEW `src/config/archetypes/wall-segment.json` — chunky wall variant (kept around but unused by prototype now that the palisade fence carries the wall role).
- `src/core/MeshPresets.js` — new `palisade-log` preset.
- `src/core/SceneLoader.js` — `_buildFence` rewritten to support `fence.sides` + per-side groups + edges; back-compat with legacy `fence.cells`.
- `src/main.js` — fenceSides plumbing, lazy collider creation, palisade gate wiring.
- `src/config/levels/level-prototype.json` — palisade `fence.sides` block; 4 wall-zone unlock pads (N/S/E/W); +4 inside-perimeter trees so D/E/F can complete without leaving the base.
- `src/config/prototypeStates.json` — states B/D retargeted to north/south; new states E (east) and F (west); all hints + stall escalations updated; `eventTag` filter usage.
- `src/systems/PrototypeStateMachine.js` — `eventTag` filter case.
- `src/core/ArchetypeLoader.js` — registered `wall-segment`.

### Still open — next-session priorities

**Headline next move: Acts 2 polish (optional gate ceremony) → Act 3 (worker automation) → Act 4 (rival twist) → Act 5 (king kill).**

State machine today covers A–F (Acts 1 + perimeter walls). What remains:

1. **Act 2 — gate ceremony (DESIGN FORK).** Spec calls for a "build the gate" state after the 4 walls. With auto-sink palisade gates already covering player movement through any wall, a dedicated gate building is redundant. Two options:
   - **A.** Skip the gate ceremony — current 4-wall flow IS Act 2. Move straight to Act 3.
   - **B.** Add a gate ceremony anyway — a single ornamental archway at the south wall that costs 20W+5E and reads as "the front door" (cosmetic, since auto-sink already opens the wall).
   Brainstorm with user before coding.
2. **Act 3 — automation (the major novel work).** 3 worker archetypes (Wood Worker, Essence Collector, Builder/Runner), Worker Pad (drains 15E for 3 workers), WorkerAI state machine, role icons, auto-pathing to trees / disks / ghosts. Per `PROTOTYPE_PLAN.md` §4 Act 3 and V1 `PHASE_4_SYSTEMS.md`.
3. **Act 4 — rival twist.** Rival faction (soldier + king + base entity), RivalAI (one-shot raid), base-reveal opacity tween + dust burst, audio sting, chaos wave (20 zombies). Per `PROTOTYPE_PLAN.md` §4 Act 4 and `PHASE_5_AI.md`.
4. **Act 5 — king kill.** Attack-Ready zone reveal, RallyZoneSystem (player steps on → troops auto-rally + follow), King fight, T3 finisher (hitstop + shake + red puff + victory chord), stats routing. Per `PROTOTYPE_PLAN.md` §4 Act 5 and `PHASE_6_POLISH.md`.

### Still-open polish (lower priority, can defer)

- **Per-troop attack richness.** Scout/Bruiser feel "okay for now" but should get richer per-class identity (different weapon arcs, hit reactions, finishers). VFX foundation (`CombatVFXSystem`) is in place — extend later.
- **Joystick × drag-waypoint conflict.** When both push the player, behavior is jittery. May need to clear waypoint on joystick input.
- **Wall-zone reveal timing.** Currently each wall zone reveals on state entry; player might still be fighting prior wave. Polish: maybe wait for clearance.

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
| `src/systems/NextStepIndicator.js` | 3D pointer (ground ring + chevron) on next-step target; drives off state `hints` array; also handles `pulseTrees` |
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

- **[2026-05-07] Act 3 Builder role REDEFINED — supersedes `PROTOTYPE_PLAN.md` §10.4 / `~/.claude/plans/yes-binary-bentley.md` §10.3-10.4.** The locked spec had Builder pulling resources from the player's jelly-stack and running them to active ghost zones. For the prototype build we instead give the Worker Pad a `Component_Stockpile {wood, essence}` (no cap): Wood-Worker and Essence-Collector deposit at the pad's stockpile, Builder withdraws from the stockpile and drains into active ghost zones. Reason: cleaner mental model, removes the "worker pickpockets the player" mechanic, and decouples worker loops from player position. Worker count stays 3 (cost still 15E). All other §10.x details (FSM shape, scanRadius 15, HP 25, speed 3, peer-skip on `deliveryTarget`, 2s stuck-detect → re-SCAN) remain in force.
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
| PR #2.6: Next-step 3D pointer + `pulseTrees` wiring | ✓ shipped |
| PR #2.7: Palisade fence + staged N/S/E/W build + auto-sink gates | ✓ shipped |
| PR #2.8: Act 2 — optional gate ceremony (design fork — may skip) | pending |
| PR #3:   Act 3 — worker automation (Wood / Essence / Builder workers + WorkerAI + Worker Pad) | pending |
| PR #4:   Act 4 — rival twist (RivalAI + base reveal + chaos wave + audio sting) | pending |
| PR #5:   Act 5 — king kill (Attack-Ready zone + RallyZoneSystem + T3 finisher + stats routing) | pending |

---

## §7. Session-start prompt for the next conversation

Paste this at the start of a new Claude Code session to resume work on **Acts 2–5**:

```
I'm continuing work on the Base Defense Tycoon prototype. The whole project's
focus is on the ?prototype mode — V1 phase docs are reference only, and
legacy/diorama modes are not to be touched.

Read these in order before doing anything:
  1. newGameDesign/PROTOTYPE_STATUS.md     (current state — start here)
  2. newGameDesign/PROTOTYPE_PLAN.md       (locked spec, 25 decisions)
  3. ~/.claude/plans/yes-binary-bentley.md (implementation plan)
  4. CLAUDE.md (root) and newGameDesign/CLAUDE.md

Auto mode: brainstorm BEFORE coding for novel design (especially Act 3
worker AI). Ask first on major design forks.

Top priority: Acts 2–5 implementation.

Already shipped through PR #2.7 (do NOT redo — see PROTOTYPE_STATUS §1–§3
for the full inventory):
  - Acts 1 ✓ — A blood, B north wall, C spawn pads, D south wall.
  - Act 2 partial ✓ — E east wall, F west wall (added during palisade
    testing). Open design fork: optional gate ceremony — PROTOTYPE_PLAN §4
    Act 2 spec calls for it, but auto-sink gates already cover wall
    crossing. Brainstorm first: skip OR add a cosmetic archway.
  - Foundation: palisade fence (rustic wood-log style + per-instance
    variation), auto-sink palisade gates (close-range + mid-range trigger,
    1.0s latch, hysteresis collider toggle), staged N/S/E/W build flow,
    next-step pointer, pulseTrees, scary zombies (snarl/shake/blood/rigged
    mesh/3-phase slam/ranged poison spit/lingering clouds), soldier attack
    VFX (scout slash arc, bruiser shockwave), crowd separation,
    stop-at-attack-range, combat pacing rebalance, eventTag filter on the
    state machine, 4 inside-perimeter trees so D/E/F can complete.

Acts 2–5 work remaining (priority order):

  1. Act 2 polish — gate ceremony (design fork). DECIDE FIRST:
     A. Skip (current 4-wall flow IS Act 2; advance straight to Act 3).
     B. Add cosmetic gate at south wall (20W+5E build, no functional
        purpose since auto-sink already opens any wall span).
     Brainstorm with user.

  2. Act 3 — automation (THE major novel work).
     Per PROTOTYPE_PLAN §4 Act 3 + V1 PHASE_4_SYSTEMS.md:
       - 3 worker archetypes: wood-worker, essence-collector, builder-runner.
       - Worker Pad (drains 15E for 3 workers, OnSpawn helper for multi-spawn).
       - WorkerAI state machine per role (find target → walk → harvest/pickup/
         deliver → return → repeat). Reuse jelly-stack + magnetic-harvest +
         drain-and-build patterns from existing systems.
       - Role icon above each worker (3D-parented, like NextStepIndicator).
       - State G (PAD REVEAL) + State H (AUTO ACTIVE) in prototypeStates.json.
     Brainstorm BEFORE coding — needs design choices: pathing (A* vs direct),
     target selection (nearest vs round-robin), per-worker vs shared inventory,
     visual differentiation (color/hat/tool).

  3. Act 4 — rival twist.
     Per PROTOTYPE_PLAN §4 Act 4 + V1 PHASE_5_AI.md:
       - Rival faction: 5 soldiers + 1 King, all with HP per §4 numbers table.
       - RivalBase entity at edge of map, hidden until Act 4 reveal.
       - RivalAI: spawn at base, march to player perimeter, fight, retreat
         after losses (single one-shot raid).
       - State I (REVEAL) — audio sting + base opacity tween + dust burst +
         red arrow billboard pinned to rival group.
       - State J (DEFENSE) — 20-zombie chaos wave joins the rivals.
       - State K (RECOVERY) — rivals retreat, ~10s calm.

  4. Act 5 — king kill.
     Per PROTOTYPE_PLAN §4 Act 5 + V1 PHASE_6_POLISH.md:
       - State L (REBUILD) — Attack-Ready zone reveals, glowing.
       - State M (MARCH) — RallyZoneSystem: player steps on Attack-Ready zone
         → all alive troops auto-rally + follow waypoint to rival base.
       - State N (KING FIGHT) — combat with Rival King (HP 200 / DMG 30).
       - On king death: T3 finisher (hitstop ~0.15s + screen shake + red
         puff via CombatVFXSystem + victory_chord audio).
       - END routing: PrototypeEndUI Victory + Stats screen.

Workflow constraints:
  - Stay in ?prototype mode. Don't touch legacy/diorama.
  - Non-destructive: extends-based archetypes, parallel mode pattern,
    separate level JSON, JSON-first config.
  - Progression-based — milestone exits + stall escalation
    (playerInventoryLt/Gte, zoneNotBuilt, zoneBuilt, eventTag).
  - 3D-parented UI for in-world prompts; HTML overlay only for one-shot.
  - Brainstorm then code. Especially for Act 3 worker design.

Boot for testing:
  cd /Users/bibektandon/Desktop/code/ThesisGame2
  python3 -m http.server 8000
  http://localhost:8000/?prototype

Start by reading PROTOTYPE_STATUS.md fully, then propose a 2-3 bullet plan
for the Act 2 gate-ceremony design fork (skip vs cosmetic). After user
confirms, move into Act 3 brainstorm (worker design choices) before coding.
```
