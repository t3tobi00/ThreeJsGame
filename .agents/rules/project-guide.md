---
trigger: manual
---

# Base Defense Tycoon - Project Guide

## ⚡ Memory System (READ FIRST)

This project uses a shared `.memory/` system for multi-agent coordination. **Before doing ANY work, follow this sequence:**

```
1. Read .memory/AGENT_GUIDE.md           → learn the full protocol
2. Read .memory/PROJECT_STATE.md         → understand current phase & priorities
3. Read .memory/ARCHITECTURE.md          → understand file map & dependencies
4. Check .memory/locks/active.md         → check for soft locks on files you'll touch
5. Read .memory/changelog/<module>.md    → recent changes to files you'll modify
```

**After EVERY session (success or fail), you MUST update the memory:**

- Create a session log in `.memory/sessions/active/`
- Append to the relevant `.memory/changelog/<module>.md`
- Update `.memory/ARCHITECTURE.md` if you added/removed files or exports
- Update `.memory/PROJECT_STATE.md` if you completed a feature or found a blocker
- Log errors in `.memory/errors/` if the task failed or partially succeeded
- Register and release soft locks in `.memory/locks/active.md`

See `.memory/AGENT_GUIDE.md` for exact templates and formatting rules. **No exceptions — every session gets logged.**

---

## Tech Stack

- **Engine:** Three.js (latest via CDN)
- **Architecture:** Modular project structure with ES modules — separate files for each system/concern
- **Assets:** Procedurally generated geometry and Canvas-based textures (no external image dependencies)
- **UI:** HTML/CSS overlays for joystick, HUD, and screens — keep WebGL canvas for 3D only

## Project Structure

```
/
├── index.html              # Entry point, loads main module
├── src/
│   ├── main.js             # App bootstrap, render loop
│   ├── config/             # Tunable values (colors, speeds, sizes, etc.)
│   ├── core/               # Engine setup (renderer, scene, camera, input)
│   ├── entities/           # Player, enemies, structures, projectiles
│   ├── systems/            # Game systems (combat, harvesting, building, spawning)
│   ├── ui/                 # HUD, joystick, menus, overlays
│   └── utils/              # Shared helpers (object pool, math, easing)
├── styles/
│   └── main.css            # All UI styles
├── .memory/                # Multi-agent memory system (see AGENT_GUIDE.md inside)
│   ├── AGENT_GUIDE.md      # Full protocol — read this first
│   ├── PROJECT_STATE.md    # Current phase, done/pending features
│   ├── ARCHITECTURE.md     # Living file map, exports, dependencies
│   ├── changelog/          # Function-level change logs per module
│   ├── sessions/           # Session logs (active + archived)
│   ├── errors/             # Failure reports with reasoning
│   └── locks/              # Soft lock warnings
├── idea.md                 # Full game design specification
└── CLAUDE.md               # This file
```

**Key principle:** Each file should own one responsibility. If you need to change enemy behavior, you go to `entities/`. If you need to tweak a color or speed value, you go to `config/`. If you need to change how harvesting works, you go to `systems/`. If you need to understand what changed recently, you go to `.memory/changelog/`.

## Coding Approach

- Consult the installed `threejs-*` skills (in `.claude/skills/`) for Three.js best practices before writing rendering, animation, lighting, or material code
- Keep game-tunable values (colors, speeds, sizes, counts, durations) in `config/` — never hardcode magic numbers in system or entity files
- Use object pooling for anything spawned frequently (projectiles, enemies, collectibles)
- Ensure all animation and movement is frame-rate independent
- Clean up GPU resources (geometry, materials, textures) when objects are permanently removed
- Prefer simple, readable code over clever abstractions — each module should be easy to understand in isolation
- **Check `.memory/changelog/` for the module you're about to modify** — understand recent changes before making your own
- **Log every function you add, modify, or remove** in the appropriate changelog after your session

## Core Game Mechanics

These are the signature mechanics that define the game's feel. Refer to `idea.md` for full details.

### Jelly Stack

Collected resources stack on the player's back like a wobbly jelly tower. The stack should:
- Follow the player with a trailing delay — each item lags slightly behind the one below it
- Sway and wobble on direction changes or sudden stops
- Have satisfying squash/stretch feedback when items are added or removed

### Magnetic Harvest

When enemies die, resource disks fly toward the player along curved arcs. The collection should:
- Use parabolic/Bezier trajectories (not straight lines) for a satisfying "thwup" feel
- Only trigger when the player is within a magnetic pull range
- Accelerate toward the player, not move at constant speed

### Drain & Build

Standing in an unlock zone drains resources from the stack into the structure. This should:
- Peel items off the top of the stack one by one at a steady rhythm
- Give visual/scale feedback on the UI counter with each item drained
- Play a punchy "boing" construction animation when the structure is fully built

## Visual Style

**"Fake Ad" hyper-casual aesthetic** — high saturation, high contrast, extremely smooth animations. Everything should feel polished, bouncy, and satisfying.

- Bright, saturated colors with strong contrast between safe zone, danger zone, player, and enemies
- Isometric top-down perspective with a smooth "rubber-band" camera follow
- No linear motion for gameplay elements — use easing, springs, or curves for all transitions
- Squash & stretch on the player character during movement
- Glowing/emissive accents on important elements (crown, enemy eyes)
- Animated borders (marching ants) on unlock zones
- Semi-transparent hologram previews for locked structures

## Performance Goals

- Target 60 FPS on mobile devices
- Pool frequently spawned objects instead of creating/destroying them
- Be selective about which objects cast shadows
- Cap pixel ratio for high-DPI screens