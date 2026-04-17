# Base Defense Tycoon — Design Pillars

_Last updated: 2026-04-07_

## One-line vision
Tycoon-primary base builder where combat is the doom timer: ignore the factory and zombies overrun you, ignore combat and you can't survive long enough to build the win.

## Locked decisions (2026-04-07 brainstorm)

1. **Genre weight:** Tycoon-primary, combat as pressure valve. Both loops are mandatory and pull resources from each other.
2. **Session shape:** Long-form persistent base with hyper-casual *feel* (juicy, satisfying micro-loops). Inspired by fake-ad hyper-casual aesthetics, structured as a longer game.
3. **Progression:** One persistent base, no run resets. The game has an end.
4. **Win condition:** A **Zombie Hive / Rift** sits on the SW frontier. Invulnerable to normal weapons. The only way to permanently destroy it is to manufacture and deliver a **Tier-4 Hive Charge** from the factory line. Beating the game = engineering the bomb.
5. **Essence:** Single essence type for phases 1–4. Variants introduced in later phases as a complexity unlock.
6. **"Level" = phase**, not a map or wave. A phase ends when the player unlocks one of: a new recipe tier, a new automation NPC type, or a new zone capability.
7. **Map shape:** Single persistent map. Center = base camp. Four corner zones:
   - **NW = Jungle** (wood, stone, natural resources)
   - **NE = Business** (customer stalls, sales)
   - **SE = Factory** (machines, assembly lines)
   - **SW = Combat Frontier** (zombie spawn edge + the Hive)

## The two-loop tension

```
Combat ──drops──> Essence ──feeds──> Factory ──makes──> Products ──sold──> Coins
   ▲                                     │                                      │
   └─────── better weapons / NPCs / ammo ◄──────────── invest ◄─────────────────┘
```

Combat keeps you alive long enough to build. Business funds the build. Jungle supplies the build. Factory IS the build.

## Aesthetic anchors
- Saturated, high-contrast, isometric (per CLAUDE.md)
- Squash/stretch on everything, juicy hit feedback
- Procedural three.js geometry — no external assets
- 3D-parented UI preferred over HTML overlays (per memory)
