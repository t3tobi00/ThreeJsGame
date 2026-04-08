# Melee Combat — Lessons Learned

A distilled log of what we figured out while building the sword weapon lab. Read this before starting any new melee weapon so we don't rediscover the same mistakes.

## 1. Core design philosophy

**The weapon IS the visual identity. Not the character body.**

The player is a rig-less capsule. There are no hands, no arms, no IK, no skeletal animation — and there never will be. Every ounce of "this weapon feels powerful" has to come from:

1. The weapon mesh's silhouette
2. The slash arc effects
3. Particles, shockwaves, hitstop, screen shake
4. Sound (not yet implemented)

Do not try to animate the character. Do not build windup/recover arm swings. Accept the constraint and lean into effects-driven identity.

## 2. Summoned, not persistent

**Don't waste effort on idle/windup/recover states.**

Early in the lab we built the sword as a persistent object that tweened through an `idle → windup → strike → recover` state machine. Wrong mental model. In the actual game, the weapon is INVISIBLE on the character when not in use — it's a thing the character summons for the strike and then vanishes.

Good consequences of this:
- No "return to rest position" constraint — the sword can start and end a swing anywhere in space.
- No need to orient the weapon to match a hand (there is no hand).
- The weapon can teleport between slashes in a combo, each flicker being its own stop-motion moment.
- Swings feel decisive, not tentative.

**Pattern:** the sword mesh has `visible = false` by default. On each slash in a combo, briefly flicker it to visible at the slash's midpoint oriented along the cut, hold ~80ms, then hide again.

## 3. A good slash arc is a sharp tapered crescent that ANIMATES along its curve

This was the biggest visual win of the whole project. Three specific things matter:

### 3a. Shape
Do NOT use `TorusGeometry` arc segments — they're uniform-thickness tubes that read as "spinning geometry," not blade wake. Instead, build a custom `THREE.Shape` from two offset arcs:

- **Outer arc** at radius = slash reach
- **Inner arc** with radius = `reach - thickness * sin(π * t)` along the arc — taper goes 0 at the tips, max in the middle, producing **sharp tapered points** at both ends.

Then `ExtrudeGeometry` thin with a soft bevel, rotate flat in XZ, and rotate the yaw so the bisector points in the slash direction.

### 3b. Reveal animation (the thing that sells motion)
A static crescent that just pops in and fades out reads as "a shape appeared here" — not "a blade cut through here." The fix is a **shader-driven reveal** where a ribbon-shaped window sweeps across the arc over ~55% of the slash's duration, then holds and fades.

Vertex shader computes each vertex's parametric position `t ∈ [0, 1]` along the arc from its local XZ angle:
```glsl
float angle = atan(position.z, position.x);
float t = (angle + uSpan * 0.5) / uSpan;
```
No per-vertex attributes needed — the shape is a perfect arc around the origin.

Fragment shader makes only vertices inside `[uTrailPos, uLeadingEdge]` visible with smoothstep fades, plus a brightness boost near the leading edge ("hot tip" of the blade).

**Per slash, animate two phases:**
- Phase A (reveal, 0 → 55%): `uLeadingEdge` sweeps from -0.15 to 1.2 with easeOutQuad. `uTrailPos` follows at a fixed lag (~0.55).
- Phase B (hold + fade, 55 → 100%): hold values, fade opacity to 0.

**Sweep direction is per-slash.** A `reverseSweep: true` option flips the arc's t mapping so a slash can draw in the opposite direction. This lets a multi-slash combo read as an X-cut or back-and-forth flick instead of three identical motions.

### 3c. Core + halo layering needs radial alpha profiles
Layering a "bright core" mesh and an "additive halo" mesh at a scale of 1.22 creates two visually distinct arcs — an inner white band and an outer colored band with a visible seam between them. The fix is:

1. **Halo scale should be tight** (≤ 1.10, not 1.22). Keeps the glow close to the core silhouette.
2. **Shader radial alpha profile** across the thickness:
   - Core mesh uses a flat plateau with soft radial edges: `smoothstep(0.12, 0.32, vRadial) * (1 - smoothstep(0.68, 0.88, vRadial))`
   - Halo mesh uses a parabolic bell that's zero at both radial edges: `pow(4 * vRadial * (1 - vRadial), 0.7)`
   - Both go to zero at the outer silhouette → no hard rim or seam.
3. **Tint the core color toward the halo color** — pure white next to saturated blue reads as two distinct arcs. `coreColor = lerp(white, haloColor, 0.25)` gives tonal continuity.
4. **Core = normal alpha blend, halo = additive blend.** Additive gives the glow feel; normal gives the sharp bright center.

## 4. Slash combos are data, not animation code

**Mental model:** a swing is a pre-scripted sequence of discrete `SlashEvent` objects. Each event has everything needed to spawn itself: timing, direction, reach, cone, visual params, damage multiplier. The controller just walks the list and fires events at their `tAt` time.

```js
{
  tAt:        0.00,   // seconds from combo start
  angleDeg:   -24,    // direction offset from anchor forward, around Y
  range:      3.2,    // reach (hit + visual)
  coneDeg:    150,    // hit cone width
  spanDeg:    160,    // visual arc span
  tilt:       0.55,   // roll around bisector for diagonal feel
  thickness:  0.52,
  color:      0xffaa44,
  innerColor: 0xffeeaa,
  duration:   0.26,
  damageMul:  1.2,
  showSword:  true,
  reverseSweep: false,
  trailWidth:   0.55, // optional override
  shockwave:    false,
}
```

Adding a new combo later = one new constant array of SlashEvents. Adding a new weapon archetype = one new combo pair (normal + finisher).

**Tunable per-swing config, separately:**
- `finisherEvery` (N): finisher fires every Nth trigger
- `normalRangeMul` / `finisherRangeMul`: scale all slash reaches proportionally
- `slashSpeedMul`: time-stretch the whole combo
- `normalTrailColor` / `finisherTrailColor`: override the first-slash color so sidebar color pickers actually work

## 5. Combo shape matters for "feel"

### Normal swing = 2 slashes back-and-forth in ONE time budget
A single slash reads as flat. A **quick double-tap** (out + return) in the same ~0.2s window reads as decisive, snappy, "real swordsman" motion.

- Slash 1: default sweep direction, tilt `+0.12`, `tAt: 0.00`, `duration: 0.13`
- Slash 2: `reverseSweep: true`, tilt `-0.12` (mirrored), `tAt: 0.07`, `duration: 0.13`

The second slash fires while the first is still in its reveal phase — the two blend into one continuous flick, not two separate swings. Halve the per-slash `damageMul` to ~0.7 so combined damage is only a small bonus.

### Finisher = 3 slashes in different directions
- Slash 1: diagonal `\`, tilt `+0.55`, normal sweep
- Slash 2: diagonal `/`, tilt `-0.55`, **`reverseSweep: true`** (mirror direction → X-cut read)
- Slash 3: horizontal power strike, fatter `trailWidth`, `shockwave: true`, longer hitstop

**Multi-hit is desirable.** Let every slash in the finisher hit the dummy separately — three damage popups, three spark bursts, three hitstops. That's the payoff of the finisher.

## 6. Per-slash cone hit detection

**Do NOT sample the blade position every frame** and check collisions per-frame. That approach has bugs (dedupe issues, frame-rate dependence, doesn't match the visual) and is unnecessary.

**Do** run one cone-based hit test PER SLASH when it fires:

```js
onSlash({ origin, direction, range, coneDeg, damageMul, isFinisher, slashIdx, slash })
  → for each potential target:
      distance ≤ range?
      angle between (target - origin) and direction ≤ coneDeg/2?
    → handleImpact(target, impactPos, info)
```

Each slash runs its own dedup implicitly (it only fires once). Finisher multi-hit happens naturally because there are 3 separate slash events.

## 7. Hitstop must be tuned per-slash, not global

Global hitstop sounds reasonable until you chain 2 or 3 slashes in rapid sequence — each impact pausing the game for ~60ms chokes the combo rhythm and delays subsequent slashes from firing.

**Rule:** early slashes in a combo get a micro-stop (~15ms) just to add weight. The LAST or HEAVIEST slash gets the real stop (~100ms). The combo reads as `tap-tap-THUD`, not `PAUSE-pause-PAUSE`.

```js
if (info.isFinisher && info.slash.shockwave) hitstopLeft = 0.11;   // heavy final
else if (!info.isFinisher && info.slashIdx === 0) hitstopLeft = 0.015; // setup
else hitstopLeft = 0.04;                                            // normal impact
```

## 8. Longer reach > fancier arc

The finisher was missing the dummy for a long time because the arc was wider but not actually longer in hit reach. **The finisher MUST have a larger hit range than the normal swing** — both visual and gameplay reach — or it will feel worse than the normal swing despite being "bigger."

Keep reach tunable via sidebar sliders during development so you can set the hit range exactly where it lands visually.

## 9. Playground-first, not in-game-first

**Do NOT iterate melee feel inside the full game.** Every tweak would require: boot game → spawn wave → wait for enemy → swing → observe. Tight feedback loop is dead.

**Do** build a standalone HTML lab first (`design/melee-combat/index.html`):
- Three.js via CDN, no bundler
- Sidebar with live sliders for every tunable
- One anchor point, one stationary dummy
- Mouse/space to trigger swings, auto-swing for hands-free comparison
- HUD showing phase/combo/hit count

Iterate feel to "really good" in the lab. THEN port to the game. A tweak cycle in the lab is ~2 seconds; in the game it's ~2 minutes.

**Required**: the lab uses ES modules, which means file:// won't work. Run a local HTTP server: `python3 -m http.server 8000` from the project root.

## 10. Architecture of a weapon lab

```
design/melee-combat/
├── index.html              # sidebar + canvas shell
├── lab.js                  # scene, anchor, dummy, input, hit detection, HUD
├── weapon.js               # sword mesh + slash combo scheduler + flicker
├── core/
│   └── effects.js          # reusable spawners: spawnCrescentSlash,
│                           # spawnHitSpark, spawnShockwave, etc.
└── skills/SKILL.md         # this file
```

**Separation of concerns:**
- `effects.js` — pure visual spawners. No gameplay. No weapon knowledge.
- `weapon.js` — defines combos, runs the scheduler, spawns effects, exposes an `onSlash` callback.
- `lab.js` — owns the scene, dummy, hit detection, impact feedback, and UI. No visual primitives.

**When adding a new weapon:** create a new `weapon-<name>.js` that exports the same `createSwingController` contract with a different mesh + different combo data. The lab shouldn't need to know which weapon it is.

## 11. Gotchas & non-obvious pitfalls

- **ES modules don't load over `file://`**. Browser CORS blocks them. Use a local HTTP server.
- **`atan2(position.z, position.x)`** in a shader works for our crescent because the shape was built around (0,0) in XY then `rotateX(PI/2)`'d flat. If you build a shape centered elsewhere, this breaks.
- **`shared { value }` references for uniforms** are required to make core+halo materials animate together from a single write. `{ ...uniforms }` spread creates fresh objects and breaks sharing.
- **Don't forget `depthWrite: false`** on slash materials or the core and halo z-fight.
- **Bevel on extruded crescent** adds slight geometry variation — acceptable visually, but don't rely on exact shape math for hit detection.
- **Anchor forward direction is hardcoded `+Z`** in `weapon.js`. When promoting to the game, use the player transform's actual forward.
- **Sword flicker list gets replaced, not appended** — each new slash cancels the previous flicker so there's only ever one active. Don't push, clear-and-push.
- **Auto-swing + hitstop interaction**: hitstop sets dt=0, which pauses auto-swing's trigger check naturally. Fine.
- **Slider IDs are tightly coupled** between `lab.js` and `index.html`. When adding a slider, update both.

## 12. What I'd do differently next time

1. **Start with the lab, not the game.** No code in `src/` until the feel is locked.
2. **First thing to get right: the slash shape + reveal animation.** Everything else is easier once that reads well.
3. **Write the shader reveal on day 1.** Static crescents are a dead end — I spent time tuning "hold and fade" timing when the real issue was "it doesn't move."
4. **Don't build persistent-weapon state machines** (idle/windup/recover) unless you know the weapon is always visible. Default to "summoned per slash."
5. **Always tune with a dummy in the scene**, not an empty arena. Feel is about connecting with something.
6. **Keep combos data-driven from the start.** Don't code swing animation imperatively.
