# Factory Recipe Spine — Burger Restaurant + Combat Branch

_Updated 2026-04-07: pivoted from abstract "vials" to a literal zombie burger restaurant economy. The factory has TWO branches that compete for the same essence input. The core tycoon dilemma becomes: feed the customers, or feed the war?_

## The split

Zombies drop **essence** (single resource type for early phases). Essence enters the factory and the player decides which branch consumes it.

```
                    ┌──> FOOD BRANCH ──────> Restaurant ─────> Coins ──┐
ESSENCE ─────>──┤                                                          │
                    └──> COMBAT BRANCH ────> Defense + Hive Charge (win)   │
                                                                            │
            ◄────────────── reinvest ◄───────────────────────────────────┘
```

Every essence drop is a decision. Early game: 100% to food (combat branch is locked). Mid game: split. Late game: shift more to combat as Hive Charges become the only thing that matters.

---

## FOOD BRANCH (always available)

Three product machines in the factory zone, each turning essence into a restaurant ingredient. The restaurant zone (NE) handles assembly and sales.

### Machine 1 — Steak Press
- **Recipe:** `1 essence → 1 zombie steak`
- **Phase introduced:** 1 (the only machine in the entire game at start)
- **Sells as:** raw steak skewer (Phase 1) → patty in burger (Phase 2+)

### Machine 2 — Fryer
- **Recipe:** `1 essence → 1 zombie fries`
- **Phase introduced:** 2 (or 3, TBD based on pacing)
- **Sells as:** side item in meal tray

### Machine 3 — Soda Tap
- **Recipe:** `1 essence → 1 zombie cola`
- **Phase introduced:** 3
- **Sells as:** drink in meal tray

### Restaurant assembly (NE zone, kitchen side)
The factory makes ingredients; the restaurant assembles meals.

- **Burger Assembly Line** (Phase 2+):
  `1 zombie steak + 1 bun → 1 zombie burger`
  Bun = wheat from NW jungle. Without wheat, no burger.
- **Meal Tray Assembly Line** (Phase 3+):
  `1 burger + 1 fries + 1 cola → 1 zombie meal`
- **Cash Counter:** customer takes meal → drops coins on tray

### Phase progression of the food branch
| Phase | Factory machines | Restaurant offering | Sells as |
|-------|------------------|---------------------|----------|
| 1 | Steak Press | Steak Counter (no kitchen yet) | raw steak skewer |
| 2 | + (jungle wheat → bun) | Burger Assembly Line | zombie burger |
| 3 | + Fryer + Soda Tap | Meal Tray Assembly Line | full zombie meal |
| 4 | (food branch fully built) | multiple customer types | premium meals, VIPs, etc. |

---

## COMBAT BRANCH (unlocks Phase 4)

Until Phase 4, combat is fully manual: you, your weapon, your collector NPCs, your basic walls. Phase 4 is when the *factory itself* starts producing combat goods, and the game gets a destination.

### Machine 4 — Bullet Maker
- **Recipe:** `1 essence + 1 stone → 1 ammo crate`
- **Use:** Feeds turrets and robot fighter NPCs
- **Effect:** Your defenses now consume a real resource. Run out of ammo → defenses go silent → zombies break through.

### Machine 5 — Charge Forge (the win condition)
- **Recipe:** `N ammo crates + 1 ??? → 1 hive charge`
- **Use:** Carry charge to the Hive on SW frontier; each charge permanently damages it
- **Visual:** Slow, ritualistic, centerpiece machine. The thing the whole game has been building toward.

### Open questions for Phase 4+
- What is the rare extra input for the Charge Forge?
- How many charges to win? (Should feel like a campaign, not an afternoon)
- Does the Hive counter-attack when damaged? (Probably yes — sends a counter-wave)
- Do special boss zombies start appearing near the Hive?

---

## Why this works
- **Food branch is instantly readable** — burger restaurant is universal hyper-casual visual language. No tutorial needed.
- **Combat branch is the secret depth** — unlocks late, unifies survival and victory under one factory output.
- **Both branches compete for essence** — every drop is a decision. Adds tycoon weight.
- **The restaurant is the visual hook** — assembly lines, customers, cash counter, juice everywhere.
- **The win condition is built, not won** — the factory IS the game's destination.
