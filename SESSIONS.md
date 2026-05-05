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
2026-04-24

### Goal
Build a complete, character-agnostic touch/mouse command + camera-navigation
stack on top of the existing hero/player characters. The session progressed
through five user-driven iterations:

1. **Drag-to-waypoint unit command** — tap a character, drag, release → walks
   to release point. Character-agnostic, reusable on any entity.
2. **Behavior-priority interrupt** — enemy attack preempts walk; walk auto-
   resumes to the original destination after combat.
3. **Apply same feature to player character** — prove modularity by adding
   via JSON only. Also disable joystick/WASD in favor of drag.
4. **Map navigation** — two-finger pan (mobile) + trackpad pan (MacBook) +
   pinch-zoom + ctrl+wheel zoom. All smooth, non-shaky.
5. **Long-distance commands** — persistent selection (single-tap unit +
   tap-on-empty-ground) so troops can be sent to areas off-screen after
   panning/zooming to them.

### What We Built / Changed

**New ECS components (all in `src/ecs/components/`)**
- `Component_DragCommandable` — tag + visual config (ring color, trail color,
  pick radius). Any entity tagged with this is drag-commandable.
- `Component_Waypoints` — runtime path state: `list`, `currentIdx`,
  `finalDestination`, `active`, `onInterruptResume` (`"destination"` or future
  `"idle"`).
- `Component_BehaviorState` — cooperative priority lock (`priority: int`,
  `tag: string`). Any behavior system writes its priority+tag when it wants
  control; yields if a higher priority is already set. Convention: 0 idle /
  5 walk-path / 10 combat / 20+ cinematic.

**New ECS systems (both in `src/systems/`)**
- `DragInputSystem` — unified pointer + wheel input. 7-state machine:
  `idle / armed_single / armed_group / armed_marquee / single_drag /
  group_drag / marquee_drag / pan`. Owns canvas pointer listeners, selection
  ring, live trail, marquee rectangle, two-finger pan, pinch-zoom, trackpad
  wheel. Character-agnostic: operates on any entity with DragCommandable.
- `WaypointFollowSystem` — walks any entity with `Waypoints + Movement +
  BehaviorState + Transform` toward its next waypoint. Mirrors HeroAISystem's
  direct-position-write style (bypasses MovementSystem, controller-
  agnostic). Claims priority 5 while active; yields + preserves list when a
  higher priority owns the lock → auto-resume.

**Modified systems**
- `HeroAISystem` — on target acquired, claims BehaviorState priority 10 /
  tag `combat`. On target lost, releases to priority 0. Walk-path resumes
  automatically.
- `CameraSystem` — major rework:
  - Added `_panOffset: Vector3` + `pan/setPan/getPan/recenter()`.
  - Added `_zoom: float` + `setZoom/zoomBy/getZoom()` with frustum scaled by
    `1/_zoom`, clamped `[0.4, 2.5]`.
  - Added internal `_followPos` separate from `camera.position`. Follow lerp
    runs on `_followPos` alone (player-only target). Final position =
    `_followPos + _panOffset` each frame, pan applied OUTSIDE the lerp →
    1:1 instant response, zero amplification, no shake.
  - `lookAt` uses `player + _panOffset + lookAtOffset` so rotation stays in
    lockstep with the pan translation.

**Gesture vocabulary**
- **Single-unit command** — touch unit + drag + release → walks straight to
  release point. Intermediate drag squiggles are ignored (endpoint only).
- **Single-tap unit** — selects (ring stays, persistent). Tap another unit →
  replaces selection. Tap same unit → deselects.
- **Marquee** — drag on empty ground → blue rectangle → release → every
  commandable unit inside becomes the new selected group.
- **Long-distance tap command** — with any selection, tap empty ground →
  whole group marches to that point with formation preserved (each unit
  keeps its offset from the group centroid). Auto-clears selection.
- **Drag from group unit** — group-move command, formation preserved.
- **Drag from non-group unit** — clears group, single command for that unit.
- **Two-finger pan** (mobile) — fingers slide → camera pans on XZ plane.
- **Pinch zoom** (mobile) — fingers spread/pinch → zoom in/out.
- **Two-finger trackpad swipe** (MacBook) — pan. Browser back/forward
  hijack blocked via `preventDefault` on `wheel` with `{ passive: false }`.
- **Pinch on trackpad / ctrl+wheel** — zoom.

**Visual feedback**
- Selection ring: `RingGeometry` child of entity mesh. Pulses while armed
  (finger down). Persistent rings for selected group (no pulse, just visible).
- Drag trail: scene-level `THREE.Line` with 256-point pre-allocated buffer.
  Preview only — ignored for actual walking (endpoint-only policy).
- Marquee rectangle: scene-level plane (translucent fill) + line border,
  rendered on the ground plane, grows/updates during drag.

**JSON enablement** (hero.json + player.json)
Adding these three blocks to any archetype makes it drag-commandable —
ZERO code changes required:
```json
"DragCommandable": { "enabled": true, "ringColor": "0xffd700",
                      "trailColor": "0xffd700", "pickRadius": 0.9 },
"Waypoints":       { "onInterruptResume": "destination",
                      "arrivalThreshold": 0.25 },
"BehaviorState":   { "priority": 0, "tag": "idle" }
```

**Joystick + WASD disabled** (commented, not deleted)
`main.js` lines: `this.joystick = new Joystick()` and
`this.keyboard = new KeyboardInput()` replaced with `null`. Both
`MovementSystem` and `DragInputSystem` already accept `null`, so nothing else
had to change. Re-enabling = one-line uncomment.

### Key Decisions Made

- **Endpoint-only path policy.** User's drawn squiggle is just a preview.
  On release, only the final pointer-up position is written as a single
  waypoint. Straight-line walk. Ignoring obstacles is intentional — path is
  "a suggestion of destination," not a rail.

- **Cooperative priority via BehaviorState, not a central scheduler.**
  Each behavior system self-manages its claim. Lighter than a
  TaskPrioritySystem and fully modular — new behaviors plug in by following
  the same "claim high when you want control, drop to 0 when done" pattern.

- **`onInterruptResume: "destination"` is the launch policy.**
  `"idle"` option parked in JSON but not yet branched in code. User wants it
  switchable per-entity later.

- **Gesture-scoped vs persistent selection.** Original one-gesture drag
  (touch-drag-release) has no persistent selection — ring only while finger
  down. Marquee + single-tap add persistent selection for long-distance
  commands. Both coexist cleanly.

- **Pan is instant, follow is lerped.** The shake root cause was the follow-
  lerp being applied to a target that included `_panOffset`. Fix: lerp an
  internal `_followPos` (player-only target), then add `_panOffset` after
  the lerp. This keeps follow "weighted" feel for player-induced motion,
  1:1 responsive feel for user pan input. `lookAt` includes pan so rotation
  stays in lockstep.

- **Snapshot camera for touch pan, live camera for wheel pan.** Touch pan is
  a sustained gesture — raycasting through the live (lerping) camera would
  feed back and oscillate. Clone the camera at touchdown and raycast
  through the frozen snapshot. Wheel events are discrete, one event per
  pan, so live-camera raycast is fine.

- **Zoom is un-anchored (screen-center).** Simple. Anchored pinch-zoom
  (world point under fingers' midpoint stays pinned) would be nicer but
  requires joint pan+zoom math; parked as polish.

### Bugs Solved

1. **Shake on two-finger pan.** First attempt: snapshot camera fixed the
   feedback loop but the user still saw reverse-then-correct motion. Root
   cause diagnosed: `CameraSystem.update` lerped position (smooth) but
   `lookAt` applied pan instantly → rotation-before-translation phase
   mismatch. Fixed by splitting pan out of the follow-lerp and applying it
   after, with lookAt using the panned target.

2. **10× pan amplification** (intermediate bug from the first fix attempt).
   Lerping `camera.position` toward a no-pan target and then adding pan each
   frame caused steady-state amplification by `1/smoothing` (≈10×). Camera
   went upside-down/orbiting. Fixed by introducing internal `_followPos`
   state: the lerp runs on `_followPos`, not on `camera.position`, so
   re-adding pan doesn't feed back.

3. **Zigzag drag paths.** First implementation had the hero literally mimic
   every squiggle. User wanted straight-line-to-endpoint. Fixed by writing
   only `[endpoint]` as the waypoint list on commit, not the full trail.

4. **Accidental commands from persistent selection.** First drag-to-waypoint
   had persistent selection (ring stays after tap). Random drags on empty
   ground would re-command the hero. Fixed by going gesture-scoped: ring
   only while finger down, no selection carries over between single-unit
   gestures. Then later ADDED persistent selection deliberately (via
   single-tap and marquee) for long-distance commands — both models now
   coexist based on which gesture the user chose.

5. **MacBook trackpad scroll hijacked by browser history.** Two-finger
   swipe on trackpad triggered back/forward navigation instead of panning.
   Fixed with `addEventListener('wheel', handler, { passive: false })` +
   `event.preventDefault()` in the wheel handler.

### Files Modified

**New files**
- `src/ecs/components/Component_DragCommandable.js`
- `src/ecs/components/Component_Waypoints.js`
- `src/ecs/components/Component_BehaviorState.js`
- `src/systems/DragInputSystem.js`
- `src/systems/WaypointFollowSystem.js`
- `design/logic-flow/drag-to-waypoint.md`

**Edited**
- `src/systems/CameraSystem.js` — `_panOffset`, `_followPos`, `_zoom`, all
  methods (`pan/setPan/getPan/recenter/setZoom/zoomBy/getZoom`). Pan/follow
  decoupling. Frustum scales by `1/_zoom`.
- `src/systems/HeroAISystem.js` — BehaviorState claim/release around the
  existing pursuit logic. Detection runs every frame so combat can
  interrupt walk-path.
- `src/entities/EntityFactory.js` — imported the 3 new components and
  registered them in `COMPONENT_MAP`.
- `src/main.js` — registered `WaypointFollowSystem` + `DragInputSystem`
  (with `cameraSystem` passed as 6th arg). Commented out joystick +
  keyboard instantiation; replaced both with `null`.
- `src/config/archetypes/hero.json` — added DragCommandable (gold ring),
  Waypoints, BehaviorState blocks.
- `src/config/archetypes/player.json` — added same three blocks with blue
  ring/trail (`0x44ccff`) to distinguish from hero.

### Where We Stopped

All five features shipped and confirmed working by user on mobile + desktop:
- Drag-to-waypoint works on hero AND player (JSON-only addition proved
  modularity).
- Combat interrupts + auto-resumes via BehaviorState.
- Two-finger pan is silky, 1:1, no shake.
- Trackpad pan works, no browser hijack.
- Pinch/ctrl+wheel zoom works, clamped sensibly.
- Tap-to-select + long-distance tap-to-command works for both single and
  marquee'd groups.
- Player character can no longer move via joystick/WASD — drag only.

Dev server left running at `http://127.0.0.1:8765`.

### Immediate Next Steps (from conversation)

1. **`onInterruptResume: "idle"` branch** — JSON field exists but behavior
   not yet wired. Would live in `WaypointFollowSystem` + `HeroAISystem`
   interrupt path.
2. **Anchored pinch-zoom** — currently zoom scales around screen center.
   Proper anchoring (world point under fingers' midpoint stays pinned)
   needs unified pan+zoom math; sketch in the plan file if revisited.
3. **Recenter gesture** — `CameraSystem.recenter()` exists but no gesture
   wires it. Double-tap to recenter is the obvious candidate. On recenter,
   lerp `_panOffset` toward 0 over ~300ms to avoid a snap.
4. **Additive tap-selection** — currently plain tap on unit REPLACES group.
   Marquee is the only additive gesture. Could add a "shift-tap" equivalent
   (e.g. long-press or double-tap) to add individual units to an existing
   group.
5. **Local obstacle avoidance / path smoothing** — currently the straight-
   line path goes through buildings. Parked per user preference (path is a
   "suggestion of destination").

---

## NEXT SESSION PRIMER

**Current game state (diorama mode, `?diorama`):**
- Player spawns on factory pad (cell [15, 4], ~world (-21, 0, 1)).
- **Player moves ONLY via drag-to-waypoint.** Joystick + WASD disabled.
  Tap player → drag → release = walk straight. Or tap player → navigate
  with two-finger pan/pinch → tap empty ground far away = long-distance
  march.
- Top HUD row: resource counts. Second row: "Summon Hero 5🪙" button.
- Heroes spawn with yellow ring; players with blue ring. Both are
  drag-commandable.
- Enemies spawn at (-45, 0, 0), walk east, engage nearest of {player,
  heroes}, contact-damage. Enemy presence auto-interrupts any drag walk
  (hero fights, then resumes toward original destination).

**Gesture cheat-sheet:**

| Gesture | Effect |
|---|---|
| Tap unit, drag, release | Single unit walks to release point |
| Tap unit | Select (ring persists) |
| Tap selected unit | Deselect it |
| Tap another unit | Switch selection to that one |
| Drag on empty ground | Marquee → group select |
| Drag from group-member | Whole group walks, formation preserved |
| Drag from non-group unit | Clear group, single command |
| Tap empty ground + selection | Group walks there (LONG-DISTANCE) |
| Tap empty ground, no selection | No-op (prevents misfires) |
| Two fingers | Pan the camera |
| Pinch / spread | Zoom out / in |
| Ctrl + wheel | Zoom (desktop) |
| Two-finger trackpad | Pan (desktop) — back/forward hijack blocked |

**Architectural rules to respect:**
- **Drag-commandable any entity** = add 3 JSON blocks to its archetype
  (`DragCommandable`, `Waypoints`, `BehaviorState`). NO code changes.
  See `design/logic-flow/drag-to-waypoint.md`.
- **New AI system wanting to interrupt walk** = claim BehaviorState
  priority ≥ 5 with a unique tag. Release to `{priority:0, tag:'idle'}`
  when done. Walk-path resumes automatically.
- **Camera pan logic** — always lerp `_followPos` (internal), then add
  `_panOffset` after the lerp. Never lerp `camera.position` directly
  toward a target that contains pan. The 10× amplification bug is easy
  to re-introduce if this is forgotten.
- **lookAt must include pan.** `player + _panOffset + lookAtOffset`.
  Otherwise rotation/translation phase-mismatch → visible shake.
- **Touch pan uses snapshot camera; wheel uses live camera.** Sustained
  gesture vs discrete event. Do not mix them.
- **Every grid→world lookup** → `grid.toWorld(...)` (see
  `design/logic-flow/grid-system.md`).
- **Every add-to-stack** → `inventory.addToSlot(type, mesh)` (see
  `design/logic-flow/universal-stacking.md`).
- **Every new resource** = 3 files: `MeshPresets.js` + `resources.json` +
  `stackConfig.json` (see `design/logic-flow/add-new-resource.md`).
- **Hero behavior** — movement in `HeroAISystem.js`, combat in
  `SkillSystem`, tuning in `hero.json` via `tools/heroes/editor.html`.

**Drag/pan stack mental map:**

```
archetype.json (DragCommandable + Waypoints + BehaviorState)
   ↓
EntityFactory.create(...) attaches components
   ↓
Entity with [Transform, Movement, DragCommandable, Waypoints, BehaviorState, ...]

Input:
   DragInputSystem (canvas pointerdown/move/up + wheel)
       ├─ 1 finger on unit   → ARMED_SINGLE  (tap=select, drag=command)
       ├─ 1 finger on group  → ARMED_GROUP   (tap=deselect, drag=group command)
       ├─ 1 finger on ground → ARMED_MARQUEE (tap=command selection, drag=marquee)
       └─ 2 fingers          → PAN (snapshot cam + pinch zoom)
       wheel + ctrlKey       → zoom; plain wheel → pan

Command writes:
   Waypoints.list = [endpoint]   (single waypoint, straight line)
   BehaviorState unchanged       (WaypointFollowSystem will claim priority 5)

Execution:
   WaypointFollowSystem         — claims priority 5, walks to waypoint
       yields when              → HeroAISystem claims priority 10 on enemy
   HeroAISystem (combat)        — claims 10, releases to 0 when target gone
   ↓ cooperative lock           — walk-path re-claims 5, resumes to destination

Camera:
   CameraSystem.update()
       followIdeal = player + cameraOffset         (pan-free)
       _followPos.lerp(followIdeal, 10%)            (internal smoothing)
       camera.position = _followPos + _panOffset    (instant pan on top)
       camera.lookAt(player + _panOffset + lookAtOffset)
       frustumSize /= _zoom
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
