# Unlock Zone — UI Prototype

Standalone HTML workbench for designing the new unlock-zone "machine card" UI before porting it back into `src/ui/UnlockZoneUI.js`.

## What this is

The current in-game unlock zone (`src/ui/UnlockZoneUI.js`) draws a generic two-column trade card to a `THREE.CanvasTexture` on a flat ground plane. Every zone looks identical regardless of whether it's a 10-coin shop or a multi-input "factory."

This folder is the design sandbox where we iterate on a new look that:

- **Feels like a machine** (input bay → process chamber → output chute) while staying flat 2D.
- **Belongs to the game's HUD family** — palette, font, drop shadows, border-radius, and gradients are all pulled directly from `styles/main.css` (`#1a1a1a` body, `#555 → #222` HUD pill, `#777` border, chunky `0 8px 0` drop shadow, Outfit weight 900). No invented colors.
- **Auto-sizes by content** so a 1-input zone is genuinely smaller than a 3-input zone.
- **Animates from day one** so motion ports cleanly to the eventual Canvas 2D port.

## How to use it

Open `unlock-zone-preview.html` directly in a browser (`file://`, no server needed). Hard reload (`Cmd+Shift+R`) if the file appears stale.

The page is a three-pane workbench:

```
┌──────────┬─────────────────────┬──────────┐
│ VARIANTS │      PREVIEW        │ SETTINGS │
│          │                     │          │
│ Baseline │   [the card]        │ Inputs   │
│ ●Gear    │                     │ Output   │
│  Works   │                     │ Progress │
│          │                     │ Speeds   │
│          │                     │ LED      │
│          │                     │ Play/||  │
└──────────┴─────────────────────┴──────────┘
```

- **Left sidebar (Variants)** — click to switch which design renders in the preview.
- **Middle (Stage)** — the live card.
- **Right sidebar (Settings)** — knobs that update the card live:
  - Add / remove input rows, change emoji + count
  - Change output emoji + count
  - Drag progress %
  - Drag gear and flow periods (CSS variables, no re-render)
  - **Gear count (1 / 2 / 3)** — number of meshing gears in the process pod
  - **Gear size** — single multiplier (0.6× → 1.8×) that scales every gear together; the proc pod auto-resizes to fit
  - LED state: idle / draining / done
  - **Process time** (Pads variant) — seconds per craft cycle
  - **Off-state look** (Pads) — Frozen vs Idle hum while not processing
  - **Drop tool** (Pads) — pick an ingredient + amount and feed it into the machine; or click the input pod directly
  - **Take output** (Pads) — clears the stacked outputs from the output pod
  - Play / pause animations

## Variants

| Key | Name | What it explores |
|---|---|---|
| `baseline` | **Baseline** | The Phase D approved card. Single ⚙ glyph in a small 46px process pod. Compact, minimal — the locked-in default. |
| `gearworks` | **Gear Works** | Process pod hosting a row of meshing SVG gears that auto-size to the pod. Gear count is settings-driven (1 / 2 / 3) and a single size slider scales every gear together. With **1 gear** the pod collapses to ~46×46 (matches Baseline). With **2 gears** it's the original 8-tooth big + 6-tooth small pair. With **3 gears** the row reads big → small → medium-big so it doesn't taper. Spin direction alternates per gear; tiny copies of input emojis stream from the input bay into the cluster, fade as they "enter," and small output emojis emerge on the right side. |
| `pads` | **Pads** | Live recipe-machine simulation built on top of Gear Works. The input pod *is* the receiving zone (click it or use the Drop tool to feed ingredients) and shows REMAINING needed per row. The output pod *is* the output zone — stacked outputs settle vertically with a wobble like the in-game `ResourceStack`. A conic-gradient progress ring on the proc pod ticks down `processTime` seconds per craft. While idle the machine sits still (Frozen) or creeps (Idle hum); while processing, gears spin at full speed and flow particles fly. Validates the "stand-on input pad + stacked output pad" interaction language for the eventual in-world version. |

New variants are added by:
1. Defining a new `state.variant` value in the `<script>` block.
2. Branching in `renderCard()` to swap process pod content / add overlays.
3. Adding a `.variant-btn` in the left sidebar with the matching `data-variant`.
4. Scoping all new CSS under `.factory.{variantName}` so other variants don't regress.

## Design history (phases)

- **Phase A** — basic structural skeleton (3-zone flex layout, neutral palette, no chrome, no animation). Approved.
- **Phase B** — *skipped*; user chose a single unified design over per-output color themes.
- **Phase C** — factory chrome: rivets in corners, status LED, bolt-style joints, scanline-textured process pod, 2D bevel. Auto-sizing card by content count. Approved.
- **Phase D** — animation polish: gear spin, LED breathing, scanline drift, bar sheen, output bob, input tick. All on a unified ~2.4s rhythm. Approved as the **baseline**.
- **Variant 1 — Gear Works** — expanded process pod with 2 SVG meshing gears + flowing emoji particles. Approved.
- **Workbench restructure** — three-pane layout with variant picker + live settings panel.
- **Variant 2 — Pads** — live recipe-machine simulation: click-to-feed input pod, stacked output pod with wobble physics, conic-gradient processing ring, two off-state looks (Frozen / Idle hum), Drop tool + Take output controls. Validates the "stand-on input + stacked output" interaction model.
- **Gear cluster generalization** — `gearClusterSVG()` rewritten to drive off a `GEAR_TEMPLATES` table + `computeGearLayout()` helper. Settings now expose **Gear count (1/2/3)** and **Gear size (0.6×–1.8×)**; the proc pod auto-resizes from the computed viewBox so 1 gear collapses to baseline-sized 46×46 and 3 gears widen the pod automatically. Three-gear layout uses big → small → medium-big to feel balanced rather than tapering.

## What's next

- **Other unlock-zone categories** — the Factory variants (Baseline / Gear Works / Pads) cover the `convert` engine type. Other categories with different visual chrome are still TBD: **Builder** (one-shot blueprint → structure, no factory parts), **Recruiter** (portrait card → hero), **Barracks** (door + queue → batch units), **Upgrade pad** (level badge + stat icon), **Gate** (barrier + directional cue). Each will get its own workbench entries when designed.
- **Phase E (deferred)** — port the chosen variant(s) to Canvas 2D inside `src/ui/UnlockZoneUI.js`'s `_renderContent()`, drive animation from `animate(dt)` (cap redraw to ~15-20 fps), shrink the in-game ground plane to match the smaller card proportions.
- **In-world Pads** — physical in-game zone with two adjacent footprints: an **input drop area** where the player stands and drops harvested resources (using the existing drain mechanic), and an **output drop area** where the produced resource / building / NPC appears once a cycle completes. The card UI from this prototype renders on top of (or beside) the machine, while the gameplay zones live on the ground.

## Key files this work will eventually touch

- `src/ui/UnlockZoneUI.js` — `_renderContent()` rewrite + `animate(dt)` extension. The constructor signature `(group, cost, outputType, size, outputCount)` may grow a `mode` arg so the renderer knows which variant to draw.
- `src/ecs/components/Component_UnlockZone.js` — already carries `type` (`build` / `spawner` / `convert`) and all needed metadata; nothing to add for the visual port.
- `src/core/ResourceRegistry.js` and `src/core/ArchetypeLoader.js` — provide the per-output `emoji` field that the card consumes.
- `src/config/gameConfig.js` — likely shrink the unlock-zone plane size from `4` to something smaller.
