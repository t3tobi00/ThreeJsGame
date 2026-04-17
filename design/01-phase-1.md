# Phase 1 — Opening (~first 10 minutes)

_Updated 2026-04-07: pivoted to burger framing. The player learns the entire game loop in miniature with one machine, one customer counter, and one big choice._

## Player goal
Survive long enough to make the first coins, then make the first investment decision.

## What exists in Phase 1
- **Combat:** Starter weapon (current melee/pistol). One zombie type, slow trickle from SW. No night cycle.
- **Essence drops:** Same as current meat — green-tube fluid, jelly-stacks on player back.
- **Factory:** ONE machine — **Steak Press**. Recipe: `1 essence → 1 zombie steak`. Located in SE factory zone.
- **Restaurant:** ONE counter — **Steak Counter**. No kitchen, no dining tables yet. Just a front counter where a customer arrives, takes a raw zombie steak skewer, drops coins. Located in NE business zone.
- **Walls:** Visible, indestructible backdrop on the SW boundary.
- **Other zones:** NW jungle visible but inert. NE kitchen/dining empty. Combat branch in factory locked.

## The Phase 1 loop
1. **SW:** Walk to combat front. Kill zombie. Essence drops. Jelly-stacks on player back.
2. **SE:** Walk to factory. Drop essence on Steak Press. Wait for cycle. Pick up zombie steak (also jelly-stacks).
3. **NE:** Walk to restaurant. Drop steak on Steak Counter. Customer arrives, takes it, drops coins on tray.
4. Pick up coins. Carry back to base camp.
5. Repeat until you can afford the first investment.

## The first investment — *the core tycoon dilemma in miniature*

Two purchase options visible from the start, both affordable around the same coin total:

- **(A) Better Weapon** — heavier damage / wider arc. Combat is faster, less risky. Pure combat upgrade.
- **(B) Collector NPC** — first automation. A little worker that auto-grabs essence drops on the SW front and runs them back toward base.

**Phase 1 ends when the player owns at least one of each.**

## Why these two specifically
- **(A)** is the dopamine of *"I am stronger now."*
- **(B)** is the dopamine of *"I have a little guy doing my chores."*
- Together they introduce the two axes of every future investment: **combat power** vs **automation depth**.

## Phase 1 success criteria
- Player has touched all three active zones (SW, SE, NE).
- Player has experienced the full essence → steak → coins loop end-to-end at least 3 times.
- Player has made the A-vs-B choice and felt its effect.
- Player understands "kill zombies → make food → sell food → buy stuff" without being told.

## Things explicitly NOT in Phase 1
- No NW jungle interaction (jungle is visible scenery only)
- No bun, no fries, no cola, no full burger (those come Phases 2 and 3)
- No combat branch / no ammo / no turrets
- No night cycle / day-night pressure
- No second machine, no second customer type
- No multiple zombie types
- No assembly lines (the steak goes straight from machine to counter)

## Open design questions for Phase 1
- How long should the Steak Press cycle be? (Long enough to feel earned, short enough to not bore — guess: 2-3 sec)
- What's the per-coin cost of the better weapon vs the collector NPC? They should feel "roughly the same" so the choice is real.
- Does the customer at the Steak Counter have a patience timer? (Probably no — Phase 1 should be relaxed to let the player learn.)
- How does the player visually know the Steak Counter is "the place to bring food"? (Suggestion: floating icon overhead, plus a glowing drop pad like the existing meat table.)
