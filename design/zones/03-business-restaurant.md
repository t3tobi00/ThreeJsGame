# Zone Spec — NE Business: ZOMBURGER (the burger restaurant)

_The visual centerpiece of the food economy. A literal zombie-themed burger joint where customers walk in, order, eat, and leave. This is where the hyper-casual fantasy is fully realized._

## Vision in one paragraph
You step into a brightly-lit zombie-themed burger restaurant under a glowing neon "ZOMBURGER" sign. The kitchen sits on the west half, the dining area on the east half, with a service counter dividing them. The player runs both halves: in the kitchen they assemble burgers and meals on conveyor lines fed by the factory; on the dining side, customers queue at the counter, place orders, sit at colorful tables, eat with juicy chomp animations, and drop coins on the way out. Saturated colors, exaggerated cartoon townsfolk, satisfying *pop* feedback when meals are plated, coin-shower animations on payment.

## Top-down layout (ASCII)

```
+----------------------------------+----------------------------------+
|             KITCHEN              |              DINING              |
|                                  |                                  |
|  [Steak drop]  [Fries drop]      |    [table]  [table]  [table]   |
|                                  |                                  |
|  [Cola drop]   [Bun drop]        |    [table]  [table]  [table]   |
|                                  |                                  |
|        ▼                         |                                  |
|  ╔══════════════╗                |          customer queue          |
|  ║ BURGER LINE  ║ ──────►        |               │                  |
|  ╚══════════════╝                |               ▼                  |
|        │                         |     [pickup window] ◄──── [counter]
|        ▼                         |                                  |
|  ╔══════════════╗                |          coin tray               |
|  ║ MEAL LINE    ║ ──────►──────► |              [coin tray]         |
|  ╚══════════════╝                |                                  |
|                                  |    ↑ customers exit ↑            |
+----------------------------------+----------------------------------+
                                   ↑
                            front entrance
                          (customers enter)
```

## Sub-areas

### Kitchen (west half)
- **4 Ingredient Drop Zones** — one for each input the kitchen accepts:
  - **Steak Drop** (always active, Phase 1+)
  - **Bun Drop** (Phase 2+)
  - **Fries Drop** (Phase 3+)
  - **Cola Drop** (Phase 3+)
  Player jelly-drops carried items here. Each drop zone has a stack visualizer so the player can see kitchen inventory at a glance.
- **Burger Assembly Line** (Phase 2+)
  Conveyor that combines `1 steak + 1 bun → 1 burger`. Visual: bun closes on patty with a satisfying *clap*. The line only runs when both ingredients are available.
- **Meal Tray Assembly Line** (Phase 3+)
  Conveyor that combines `1 burger + 1 fries + 1 cola → 1 meal tray`. Visual: tray slides under each station, items drop on with bouncing physics.
- **Pickup Window**
  Finished items (steak skewers, burgers, meals) appear here for the dining side. The most recent finished item is highlighted.

### Dining (east half)
- **Front Entrance**
  Customers walk in from a side door on the east edge. Visible "OPEN" sign.
- **Customer Queue**
  Customers line up at the order counter. Queue length is a soft pressure signal — long queue = customers waiting = juice the kitchen.
- **Order Counter / Pickup Window**
  Customer steps up, takes whatever the kitchen has produced (matching their order), walks to a table.
- **Tables (3 → 6 → more across phases)**
  Customers sit, eat with juicy chomp animations. Eating takes a few seconds. Empty seats during a busy queue is a visual cue that things are flowing.
- **Coin Tray**
  Customers drop coins on the way out. Player picks up. Phase 4+ unlocks a Cashier NPC to auto-collect.
- **Exit**
  Customers leave through the same front door, or a back exit. (TBD which feels better.)

## Phase progression in this zone

| Phase | What's in the zone | Customers want | Restaurant capacity |
|-------|--------------------|----------------|---------------------|
| 1 | Just the front counter (no kitchen visible behind it). Steak Drop only. | Raw zombie steak skewer | 1 customer at a time, slow trickle |
| 2 | Kitchen revealed. Bun Drop unlocks. Burger Assembly Line activates. 3 tables appear. | Zombie burger | 2-3 customers in flight |
| 3 | Fries Drop + Cola Drop unlock. Meal Tray Assembly Line activates. 6 tables. | Full zombie meal | 4-6 customers in flight |
| 4 | Multiple customer types arrive. Some want only burgers (cheap), some want full meals (expensive). | Variable | 6+ customers, queue forms |
| 5+ | Special customers, drive-thru lane, VIP booth, special-order tickets — TBD | TBD | TBD |

## Player interactions in this zone
- **Drop ingredient on a kitchen drop zone** (steak / bun / fries / cola)
- **Pick up assembled item from pickup window** (manual mode, before NPCs)
- **Pick up coins from coin tray**
- **Hire Kitchen Worker NPC** (Phase 3+) — auto-assembles items on conveyor lines
- **Hire Waiter NPC** (Phase 3+) — auto-delivers from pickup window to customer hand
- **Hire Cashier NPC** (Phase 4+) — auto-collects coins from tray
- **Upgrade restaurant capacity** (Phase 3+) — pay coins to add more tables, more drop zone slots

## NPCs in this zone
- **Customer (Phase 1+):** walks in → queues → takes item → sits at table → eats → drops coins → exits
- **Kitchen Worker (Phase 3+):** stands by conveyor, auto-assembles when ingredients are present
- **Waiter (Phase 3+):** carries from pickup window to customer hand or table
- **Cashier (Phase 4+):** collects coins from tray, deposits to base camp storage

## Visual style notes
- **Neon "ZOMBURGER" sign** above the front entrance, glowing green and pink
- **Bright primary-color tables** (red, yellow, blue), checkerboard floor in dining
- **Customers** are exaggerated cartoon townsfolk (round bodies, big heads, bouncy walk cycle)
- **Eating animation:** speech bubble with food emoji, table juice (squash/stretch on table)
- **Payment:** coin shower from the customer to the tray (3-5 coins arc out with jelly physics)
- **Conveyor belts:** visible motion lines, segmented texture that scrolls
- **Plated meal:** a small sparkle + "ding!" pop when assembled
- **Queue length indicator** (soft pressure): if 3+ customers waiting, the order counter glows orange

## Where the player enters the zone
The player enters the kitchen from the **back door** (west edge, facing the center base camp). They never use the front door. This separates "player flow" from "customer flow" — they don't bump into customers.

## Open design questions
- Should multiple customer types arrive simultaneously, or always one at a time even in Phase 4?
- Do customers have patience timers? Adds pressure but may feel too stressful for tycoon vibes. **Suggested rule:** no patience timer in Phases 1-3 (relaxed learning), introduce in Phase 4 with a forgiving baseline.
- How is "the restaurant is at capacity" communicated visually? (Glowing queue? "FULL" sign?)
- Should the Steak Counter (Phase 1) and the full restaurant (Phases 2+) be the *same building that grows*, or *different buildings* that replace each other? **Suggestion:** same building, the kitchen wall "opens up" in Phase 2 like a tycoon expansion reveal.
- Should there be a "tip jar" separate from the meal payment? (Maybe Phase 4+ — adds another collectable.)
