# GearWorks Machine — Miniaturization Plan ("Stacked Tumbler")

Target: shrink the bench-style machine so 4–6 fit on screen at once,
without losing the spinning-gear hero element.

## 1. Current constraints (file: `src/entities/machines/GearworksMachine.js`)

- **Footprint 14 × 3.6 = 50 sq units** at default `frameWidth/frameDepth`.
- Horizontal three-section layout (input 30% / gear 40% / output 30%).
  Width scales linearly with input-count → multi-resource recipes get worse.
- Two glass gears (R 0.55 / 0.38, gap 1.1) sit centered in a vast wood
  deck; visual "hero" is dwarfed by surrounding bench surface.
- Aspect ratio ≈ 3.9 : 1 — long bars don't tile. Camera at iso angle
  fits one machine across the factory pad and clips a second.
- Input "drop-off pad" + section dividers + corner posts add bulk
  without gameplay role.
- Coin tray torus + preview mesh hangs flat on top of wood; reads as
  "decoration on a table" rather than active output.

## 2. Redesign — Stacked Tumbler

**Footprint: 2.4 × 2.4 (square), 1.6 tall.** ~6 sq units → **8× reduction.**
Square base + chamfered corners → tiles in 2×2, 3×2, hex-staggered grids.

### Visual layout (front-facing player)
```
       ┌────────────┐
       │  HOPPER    │   ← intake, top dome with funnel rim
       │  ▼ ▼ ▼     │     piston plunger drops inputs in on drain tick
       ├────────────┤
       │ ◉   ◉      │   ← LCD input-counter chips (one per resource,
       ├────────────┤      data-driven row, no per-input pad geometry)
       │   ⚙ ⚙      │   ← gear viewport — two glass gears stacked
       │   ⚙ ⚙      │     vertically behind beveled porthole, spinning
       ├────────────┤
       │   ╲▼╱      │   ← angled output chute (glass tube)
       └────╨─╨─────┘
        ░░ stand-pad ░░  ← 1.2 × 1.2 plate flush to front face
```

### Aesthetic notes
- Brass/copper accents on hopper rim + chute (warm vs current cold steel)
- Glass porthole framed in dark metal (was: open-air gears)
- Rounded shoulders + beveled corners → friendly enough to clump
- Status LEDs collapse to a single pill on top dome (breathing)

### New mechanical elements (parented 3D, per visual-polish memory)
1. **Piston plunger** — pneumatic shaft above hopper drops on each
   `drain:tick`, lifts back over ~0.3 s. Sells the "feeding" beat.
2. **Vertical gear cascade** — two stacked gears in viewport, opposing
   spin. Uses existing gear builder, just rotated and offset on Y.
3. **Output chute** — angled glass tube replaces flat torus. Output
   mesh slides down chute on `output:produced` (existing event).
4. **Steam puff** — single particle burst from hopper rim per output
   produced. Reuses ParticleSystem; one-line addition.
5. **Counter chips** — small emissive plates with canvas-textured
   "0/10" labels (data-driven row). Replaces separate input pads +
   floating text.

### Footprint comparison
| | width | depth | sq units | screen tiles |
|---|---|---|---|---|
| Current | 14.0 | 3.6 | 50.4 | 1 |
| Mini | 2.4 | 2.4 | 5.76 | 6+ |

## 3. Braille art

### Side view (player ⇢ on left)
```
⠀⠀⠀⠀⢠⡶⠶⠶⠶⠶⡆⠀⠀⠀⠀
⠀⠀⠀⠀⢸⠀⢀⡆⠀⠀⢸⠀⠀⠀⠀     hopper + piston
⠀⠀⠀⠀⢸⡶⡶⡶⡶⡶⢸⠀⠀⠀⠀     counter chips row
⠀⠀⠀⠀⢸⢀⣀⣀⣀⡀⢸⠀⠀⠀⠀
⠀⠀⠀⠀⢸⠀⣿⠀⣿⠀⢸⠀⠀⠀⠀     gear viewport
⠀⠀⠀⠀⢸⠀⣿⠀⣿⠀⢸⠀⠀⠀⠀
⠀⠀⠀⠀⢸⠀⠈⠉⠁⠀⢸⠀⠀⠀⠀
⠀⠀⠀⠀⢸⢀⣰⡏⡆⡀⢸⠀⠀⠀⠀     output chute
⠀⠀⠀⠀⠿⠿⠿⠿⠿⠿⠿⠀⠀⠀⠀
⢇⢇⢇⢇⡾⡾⡾⡾⡾⡾⡾⠀⠀⠀⠀     stand pad
```

### Top-down, 2×3 tile arrangement
```
⡏⠉⢹⠀⡏⠉⢹⠀⡏⠉⢹
⡇⊙⢸⠀⡇⊙⢸⠀⡇⊙⢸
⣇⣀⣸⠀⣇⣀⣸⠀⣇⣀⣸

⡏⠉⢹⠀⡏⠉⢹⠀⡏⠉⢹
⡇⊙⢸⠀⡇⊙⢸⠀⡇⊙⢸
⣇⣀⣸⠀⣇⣀⣸⠀⣇⣀⣸
```
Six machines in a footprint roughly equal to **one** of the originals.

## Migration notes

- Keep the `(cost, output, outputCount)` build-entry signature so
  `gearworks-machine.json` archetype works unchanged.
- `frameWidth/frameDepth/sectionRatio` defaults change; remove unused
  section-ratio param entirely (square footprint).
- `userData.inputCounters[]` shape preserved (one per cost entry) —
  only the visual changes from "pad + label" to "front-face chip".
- `userData.outputDisplayGroup` preserved; new chute mesh wraps it.
- `outputLocalCenter` Y rises ~0.3 to chute mouth for collector pickup.

## Resolved decisions

- **Input ceiling locked at 3 max (typically 2).** Chip row fits 3
  cleanly across the front face — no wrap logic needed, no 2×2 grid
  fallback. Layout can be tuned for the 2-input common case.

## Stand-pad — integrated options (pick one)

The plate must read as "stand here to drain" without being a separate
sticker on the floor. Three integrated approaches:

### A. Apron skirt (recommended)
Bottom of machine extends ~0.6 forward as a continuous lip — same
body material, one silhouette. An inset emissive ring breathes when
idle, locks solid when player stands on it. Industrial precedent:
bandsaw footplate, lathe operator base.

### B. Recessed alcove
Bottom-front third is carved IN with an overhang above (arcade-cabinet
foot recess). Player steps INTO the machine; output chute drops into
the alcove. Strongest "go here" cue, but eats internal volume that
would otherwise hold the gear cascade.

### C. Pure floor decal
Emissive ring on diorama ground beneath the chute, no geometry. Cheap,
but doesn't feel like part of the machine.

## Still open

- Gears: both glass (whimsical) vs. front-glass + rear-brass (clockwork
  contrast). See response for context.
