# Player Animation Lab — context for the next session

A standalone lab for designing the player character's animations as JSON keyframes. Imports the same `MeshPresets`, `ECSManager`, `Component_Animator`, and `AnimationSystem` the game uses, so anything tuned here ships unchanged.

**Open**: serve the repo root (`python3 -m http.server 8000`) and visit `http://localhost:8000/design/player-rig/`.

---

## Where we left off

Functional skeleton is in place: 11-bone rig, keyframe animation system with rot/scale/pos per bone, lab UI with a simple animation list, and 8 starter clips. **The system works end-to-end.** What's broken is the *content* — almost every starter animation reads badly and needs re-tuning. The first half of next session should be re-authoring those 8 clips so they actually look like the actions they're named for.

The `sword-slash` clip is also the in-game sword swing now (it plays on `skill:fired` for the sword). When you fix it in the lab, the in-game player adopts the fix automatically.

---

## The vision (what we're building toward)

> *"I want my character to look like a businessman in a black suit, but fight like John Wick."*

**Visual identity (planned, not built):**
- Black suit jacket body, white shirt collar, tie, dark trousers, pale head — businessman silhouette
- Should land as a parallel `character-player-suit` mesh preset (per the "non-destructive experiments" rule), toggleable by changing `mesh.preset` in `player.json`
- The current rig stays as the underlying skeleton — only the materials/proportions change

**Animation feel:**
- Cartoony exaggeration for action moments — limbs visibly stretch and squash on impact
- Normal pose: anatomically normal proportions
- During action: dramatic deformation (e.g. sword swing extends the right arm to 1.5×–2× length on the impact frame, then snaps back)
- Reference: rubber-hose / smear-frame animation, but applied to a 3D rig
- Action poses should be readable from the isometric game camera even at small scale

**Action library the user wants to be able to play:**
- **Locomotion**: idle, walk, run, sprint, sneak
- **Combat**: punch, kick, sword swing (multiple variants per weapon), gun draw, gun fire, parry, dodge roll, dive
- **Reactions**: get hit, stagger, knockdown, get up
- **Misc**: jump, land, climb, sit, sleep, wave, taunt
- **Combos**: chained sequences of the above (e.g. 3-hit sword combo, dodge → counter-shot)

**Workflow they want:**
- They never write JSON. Claude writes and edits all animations.
- The lab UI is just animation name + play button. No sliders.
- They give feedback in plain English ("the sword swing should feel heavier", "the run looks like the arms are facing wrong direction") and Claude tunes the JSON.
- Same JSON drives the in-game player — no porting between lab and game.

---

## Architecture

### Rig — 11 named bone pivots

Built by `MeshPresets.character-player` in `src/core/MeshPresets.js`.

```
root  (the entity mesh — accessible as bone "root")
├── torso
│   ├── body                ← capsule, position-driven for bob
│   ├── head                ← pivot above neck, holds head sphere + eyes
│   ├── leftArm  (shoulder pivot)
│   │   ├── upper arm capsule
│   │   └── leftElbow       ← elbow pivot
│   │       └── forearm capsule
│   └── rightArm / rightElbow (mirror)
├── leftLeg  (hip pivot — attached to root, not torso, so body bob doesn't lift feet)
│   ├── thigh capsule
│   └── leftKnee             ← knee pivot
│       └── shin capsule
└── rightLeg / rightKnee (mirror)
```

Animations target bones by name. Bones inherit parent rotation (rotating `leftArm` rotates the whole arm including the forearm), so animations that only mention the shoulder still work — the elbow lets you bend the forearm independently *on top* of that.

### Animation format

Defined in `src/config/animations.json`. Each clip:

```json
{
  "clip-name": {
    "loop":     true | false,    // wrap forever (walk, run, idle)
    "hold":     true | false,    // clamp at last keyframe (sit, sleep)
    "duration": 0.5,             // seconds
    "keyframes": [
      { "t": 0.0, "pose": { ... } },
      { "t": 0.5, "pose": { ... } },
      { "t": 1.0, "pose": { ... } }
    ]
  }
}
```

`t` is normalized 0..1. Each keyframe `pose` is a partial bone → properties map. Each bone can declare any combination of:

- `rot`   — `{ x, y, z }` Euler radians (replaces rest rotation)
- `scale` — `{ x, y, z }` multiplier (replaces rest scale = 1)
- `pos`   — `{ x, y, z }` offset added to rest position

Bones not mentioned in a clip are never touched, so animations layer additively over `PlayerAnimSystem`'s walk anim. Special bone name `root` refers to the entity mesh itself (used by `jump` for whole-body squash/stretch).

### Three flags = three behaviors

| `loop` | `hold` | Behavior                                                     | Use for                  |
|--------|--------|--------------------------------------------------------------|--------------------------|
| `true` | —      | wraps `t` to 0 forever                                       | walk, run, idle, breath  |
| —      | `true` | clamps at the last keyframe and stays there                  | sit, sleep, T-pose       |
| —      | —      | plays once, then snaps bones back to rest pose               | sword, jump, hit, wave   |

### Wiring path (how the in-game sword reaches the new system)

```
Player swings sword
  → SkillSystem._fire()
  → EventBus.emit('skill:fired', { entityId, skillId: 'sword' })
  → AnimationSystem subscribes to skill:fired
  → looks up sword.json → reads `animation: "sword-slash"`
  → plays the clip on the player's Component_Animator
```

`SkillSystem.js` was never modified — the new system subscribes to the existing event.

---

## Files this session added / changed / removed

### Added
- `src/ecs/components/Component_Animator.js` — single-slot animation state component
- `src/systems/AnimationSystem.js` — keyframe animator, handles rot/scale/pos, loop/hold/once
- `src/systems/PlayerAnimSystem.js` — procedural walk/idle (still runs in-game; lab does NOT use it)
- `src/config/animations.json` — 8 starter clips (see below)
- `design/player-rig/index.html` — minimal lab UI (animation list + stop button + HUD)
- `design/player-rig/lab.js` — lab runtime (Three.js scene, ECS bridge, click handlers)

### Modified
- `src/core/MeshPresets.js` — `character-player` preset now builds 11-bone rig with elbows/knees/head pivots
- `src/entities/EntityFactory.js` — added `Animator` to `COMPONENT_MAP`, wires `Component_Arms` from named limb pivots
- `src/systems/MovementSystem.js` — removed crude `Math.sin(Date.now())` scale wobble
- `src/config/archetypes/player.json` — `mesh.preset: "character-player"`, added `Animator: {}`, bumped `InventoryStack.anchorOffset.y` to 1.55
- `src/config/skills/sword.json` — added `"animation": "sword-slash"`
- `src/main.js` — registered `AnimationSystem` after `PlayerAnimSystem` (committed via the diorama commit)

### Removed
- `src/ecs/components/Component_PoseLayer.js` (replaced by `Component_Animator`)
- `src/systems/PoseLayerSystem.js` (replaced by `AnimationSystem`)
- `src/config/poses.json` (replaced by `src/config/animations.json`)

---

## Current animation library — status

| Clip               | Type   | What it should look like                                | Status                                     |
|--------------------|--------|----------------------------------------------------------|--------------------------------------------|
| `idle`             | LOOP   | Subtle breath, gentle head bob                          | **OK** (least bad — boring is fine here)   |
| `walk`             | LOOP   | Standard cycle: opposite arm/leg swing, slight body bob | Untested, likely needs tuning              |
| `run`              | LOOP   | Faster, knees bend, forward lean, exaggerated swing     | **BROKEN** — hands face wrong direction (see screenshot from session). Elbow sign convention is backward — forearm bends away from body instead of toward it. |
| `wave`             | ONCE   | Right arm raises overhead, waves side-to-side           | **BROKEN** — arm crosses through chest, doesn't read as wave at all |
| `jump`             | ONCE   | Squat → stretched launch → tucked airborne → landing    | **BROKEN** — overall reads bad             |
| `sword-slash`      | ONCE   | Windup across body → impact with stretchy reach         | **WEAK** — motion plays but feels insufficient. Used in-game on sword fire. |
| `dramatic-stretch` | ONCE   | Showcase: right arm doubles in length, body squashes    | Works as a proof-of-concept for the format, but the visual quality is also questionable |
| `sit`              | HOLD   | Hips fold, knees bend, body lowers                      | Hits rig limitation — body can't truly lower because legs are children of root, not torso |

**Bottom line**: 1 of 8 is acceptable. The system works; the content needs to be re-authored.

---

## Known issues to fix next session

### 1. Sign convention bugs in `run` (and probably others)
- Elbow bend direction is wrong. In `run`, both elbows have `rot.x: 1.10` which bends the forearm *away* from the body (capsule swings to negative Z). Natural elbow bend during a run is positive direction in our convention's *opposite* sign — needs to be tested empirically and fixed across `run`, `walk`, `wave`, and any other clip that uses elbows.
- Likely the same issue for knees in `run` — we set `rot.x: 1.20` on the lifted leg's knee, which bends backward but may be visually wrong because the upper leg is also rotating.
- Action: pose the rig manually one bone at a time in the lab (or add a temporary debug print) to nail down which sign means "fold forward" vs "fold back" for each joint, then audit every clip.

### 2. `wave` arm crosses through the chest
- The clip uses `rightArm.rot.z: -1.6` which raises the arm but in the wrong axis. To raise an arm overhead from a hanging-down rest, the right axis is *positive* `rot.x` combined with possibly some `rot.z`. Need to recompose the wave from scratch.

### 3. `jump` reads bad overall
- The squat / launch / land sequence is timed wrong, the arm motions are stiff, and the `root.scale` squash/stretch competes badly with the body bob. Probably easier to throw out and re-author than to tune.

### 4. `sword-slash` is too weak in-game
- Even with `rightArm.scale.y: 1.55` and `pos.z: 0.18` on the impact frame, the swing doesn't read as dramatic. Push values further: try `scale.y: 2.0+`, `pos.z: 0.4+`, more aggressive torso twist. Also: shorter windup (0.10s feels glacial — try 0.06s) for snappier feel.

### 5. `sit` hits a real rig limitation
- The legs are parented to `root`, not to `torso`. When `body.pos.y` lowers, the legs don't move — so sitting looks like the upper body floats down past stationary legs.
- Either: (a) add a `pelvis` pivot above the legs that body and legs both attach to, so a single `pelvis.pos.y` lowers everything together, OR (b) accept that "sit" needs to also offset both leg pivots downward in the JSON, which is awkward.
- Option (a) is the right answer eventually; defer until `sit` actually matters.

### 6. Cartoony "stretch" effect needs more punch
- `dramatic-stretch` is the proof-of-concept and even it doesn't read super dramatic at game scale. The user wants cartoon-level exaggeration. Likely we need to push `scale.y` values to 2.5–3× on key impact frames, not 1.5–2×.

### 7. The lab is missing one piece — `PlayerAnimSystem` doesn't run in the lab
- This means `idle` only shows what `animations.json` defines, not the procedural breath that `PlayerAnimSystem` adds in-game. Players will look slightly different in the lab vs the game. Acceptable for now; eventually we'd convert the procedural breath/walk to JSON clips and retire `PlayerAnimSystem`.

---

## Next session — priority order

1. **Fix sign conventions** by exploring with a temporary "test single bone" debug clip. Establish the truth table: which axis sign means "fold forward" / "lift up" / "twist left" for every bone. Document it in a comment block at the top of `animations.json`.
2. **Re-author `run`** — get the John Wick "running with intent" look. Bigger arm swing, real knee lift, slight forward lean, head steady.
3. **Re-author `wave`** — overhead raise + side-to-side wrist motion. Demonstrates the elbow bone working correctly.
4. **Re-author `sword-slash`** — push the cartoony stretch further, tighten the timing. This is the in-game one — improvements show up in the actual game immediately.
5. **Re-author `jump`** — start with the timing first (squat 0.15s, launch 0.10s, peak 0.20s, fall 0.10s, land 0.20s), then pose each phase deliberately.
6. **Add `pelvis` pivot** to the rig to fix `sit`. (Optional — only if sit becomes important.)
7. **Add new clips** as needed: `punch`, `kick`, `dodge-roll`, `gun-fire`. Each one is a new entry in `animations.json` and immediately appears in the lab list.

## Tuning loop (the workflow)

The user does NOT write JSON. The loop is:

1. User opens the lab, clicks an animation button to play it
2. User describes what's wrong in plain English ("the windup feels too slow", "the right arm should be more dramatic", "make it look like he's running for his life")
3. Claude edits `src/config/animations.json`
4. User refreshes the page and watches again
5. Repeat until it feels right

When a clip is good, the in-game player automatically uses it (since both lab and game read the same `animations.json`). No port step.

## Quick reference — where to look

| Task                              | File                                                           |
|-----------------------------------|----------------------------------------------------------------|
| Tune an animation                 | `src/config/animations.json`                                   |
| Add a new bone                    | `src/core/MeshPresets.js` → `character-player` preset          |
| Change how keyframes blend        | `src/systems/AnimationSystem.js` → `_lerpBoneProps`            |
| Add loop/hold/event semantics     | `src/systems/AnimationSystem.js` → `update()`                  |
| Hook a new event to trigger anims | `src/systems/AnimationSystem.js` → constructor `EventBus.on()` |
| Lab UI / styling                  | `design/player-rig/index.html`                                 |
| Lab runtime (scene, click logic)  | `design/player-rig/lab.js`                                     |
| In-game sword → animation hookup  | `src/config/skills/sword.json` (`animation` field)             |
