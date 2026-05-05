# High Treason — Complete Game Design Reference

> A reference doc compiled from the delisted Microsoft Store indie game *High Treason* (by Templar_VII). Primary sources: the developer's official forum posts at hightreason.forumotion.net, the delisted Microsoft Store listing, PCGamingWiki, and release notes.
>
> Purpose: use this as a thinking tool for your own game's combat, economy, and progression systems.

---

## 1. Game Identity

| Field | Value |
|---|---|
| **Title** | High Treason |
| **Developer** | Templar_VII (indie, solo) |
| **Platforms** | Windows 10, Windows 8.1, Windows 10 Mobile |
| **Perspective** | 2D side-view (per PCGamingWiki) |
| **Genre** | Tower defense × RTS × Village builder |
| **Price** | Free |
| **Modes** | Singleplayer + Multiplayer (up to 1v1v1) |
| **Status** | Delisted from Microsoft Store |
| **Forum** | hightreason.forumotion.net (active until 2022) |

### Core Pitch
> *"Your king is under attack. Retrain villagers, gathering food and create a defense to protect your king. A small strategy game in the style of tower defense with elements of Age of Empires, Stronghold and Minecraft."*

### Win / Lose Condition
- **You lose** when your King dies.
- **In 1v1v1**, the game continues after the first king falls — last king standing wins.

---

## 2. The Combat Pentagon (Rock-Paper-Scissors-Lizard-Spock)

The dev explicitly stated: *"The units work a bit like Stone-Rock-Paper-Scissors-Lizard-Spock. It's always a good idea to have a good mix of units."*

```
                    ARCHER
                   /      \
                  ↓        ↑
              KNIGHT ←→ MILIZ
                ↑  ╳      ↓
                 ↖ ╳ ↙
           SWORDSMAN ↔ STONE THROWER
```

### Counter Relationships (confirmed from dev posts)

| Unit | Strong vs | Weak vs |
|---|---|---|
| **Miliz** | Knights | Stone Throwers |
| **Stone Thrower** | Miliz | Archers, Knights |
| **Archer** | Swordsman | Knights |
| **Swordsman** | Stone Thrower, Miliz | Archers |
| **Knight** | Archers, Stone Throwers | Miliz |

### Why the pentagon matters
- 5 units × 2 counter-targets each = **10 counter-relationships** (vs. only 3 in classic RPS).
- Every unit has a purpose. No unit is "best overall."
- Forces army composition decisions, not unit spam.

---

## 3. Full Unit Roster (9 units)

### 👑 The Objective

**King**
- Many hit points, high damage, moves slow
- If he dies, the game is over

### 🌾 Economy

**Villager**
- Collects food (wheat)
- Bad in close combat
- Can be retrained into any military unit

**Storage Cart**
- Mobile storage for resources
- Brings resources between villages
- Can't fight

### ⚔️ Combat Pentagon

**Miliz** (light infantry)
- ✅ Cheap, fast, can cross water
- ✅ Bonus vs Knights
- ❌ Few hit points

**Stone Thrower** (light skirmisher)
- ✅ Cheap, fast, can cross water
- ✅ Bonus vs Miliz
- ❌ Low range, bad in close combat

**Archer** (ranged)
- ✅ Wide range
- ✅ Bonus vs Swordsman
- ❌ Bad in close combat

**Swordsman** (heavy infantry)
- ✅ Many hit points, high damage
- ❌ Expensive, slow

**Knight** (cavalry)
- ✅ Fast
- ✅ Excellent vs Archers and Stone Throwers
- ❌ Bad vs Miliz

### 🏰 Siege

**Ram**
- ✅ Bonus vs buildings
- ✅ Shield against arrows/stones
- ❌ Bad in close combat

**Siege Tower**
- ✅ Shield against projectiles
- Workflow: build tower → add walls → add stairs → bring next to enemy wall → climb over
- ❌ Can't fight

**Catapult / Trebuchet**
- ✅ Wide range, bonus vs buildings, projectile shield
- ❌ Expensive, slow, bad vs moving targets, bad in close combat

---

## 4. Complete Building List (13 buildings)

### Economy
- **Storage Pit** — holds wheat; place multiple near farms to shorten villager paths
- **Well** — idle villagers irrigate nearby wheat → wheat grows faster
- **Spawn Point** — required in every village where you want to train units

### Walls & Gates
- **Wall (w)** — blocks units and projectiles; drag-and-drop multiple together
- **Gate (g)** — like wall but openable; weaker than a wall
- **Stairs (s)** — let archers climb onto walls
- **Merlon (n)** — your arrows pass through, enemy arrows blocked
- **Battlements (b)** — archers shoot straight down at wall-attackers
- **Roof (o)** — blocks projectiles from above (vs longbows); also protects storage pits

### Terrain Features
- **Terrain Elevation** — higher ground = more archer range
- **Water / Moat** — blocks most units; only Miliz and Stone Thrower cross
- ~~**Drawbridge**~~ (removed in 2022 update)

### Removed/Updated
- Grind Stone was added in v5.2.0 (not in main forum doc — likely a mill/refinement building)

---

## 5. Technology Tree (7 researches)

| Tech | Effect | Strategic Use |
|---|---|---|
| **Coinage** | Use resources across all map tiles | Removes need for storage carts; enables multi-village economy |
| **English Longbow** | +Archer range | Counter-counter: extends archer reach against Knights |
| **Fletching** | +Archer precision | Makes archers more reliable, less spray-and-pray |
| **Halberd** | +Miliz damage vs mounted (Knights) | Reinforces the Miliz → Knight counter |
| **Geology** | Moat size 4 → 10 tiles | Huge defensive tech, reshapes the map |
| **Mortar** | Only the hit wall tile breaks, not the whole wall | Wall durability becomes modular, not cascading |
| **Plummet** | +Wall & Gate strength | Flat defensive buff |

### Tech tree insight
Notice the pattern: **techs don't unlock new units, they modify existing ones.** The pentagon stays the same size; techs just shift the *math* of existing matchups. This keeps the game simple to learn but gives it depth.

---

## 6. Economy — Single Resource

**Everything costs food (wheat).** That's it. One resource for units, buildings, and techs.

### The Economy Loop
```
Villager → farms wheat → delivers to Storage Pit → pool grows
         ↓
Food pool → spent on: more villagers | military units | buildings | tech
```

### Why one resource works
- **Removes resource-juggling micro.** You're not managing wood + stone + gold + food.
- **Every choice is a tradeoff in the same pool.** Another villager means one less soldier. A wall means no archer.
- **Creates clear priority pressure** — food is always scarce against competing needs.

### The Well Mechanic (elegant design)
Wheat grows slowly. If you have more villagers than farmable tiles, extras go idle.
- **Problem:** small farming zones are safer, but cause idleness
- **Solution:** Well → idle villagers irrigate → wheat grows faster → fewer idle villagers
- **Lesson:** every design problem (idle units) has a building-based answer that *chains back into the loop*

---

## 7. Siege & Wall System — Deep Mechanics

This is where the game gets clever. Walls aren't just "HP blocks" — they have layered modular parts:

```
        [Roof]          ← blocks arrows from above
         ↑
      [Merlon]           ← your arrows through, enemy arrows blocked
         ↑
    [Battlements]        ← archers shoot down at attackers
         ↑
  [Stairs] → [Wall]      ← archers climb up, wall blocks everything
              ↓
           [Gate]        ← opens for your units
              ↓
    [Water/Moat]         ← only Miliz & Stone Thrower can cross
```

### Siege attackers have specific tools for each layer
- **Ram** → breaks walls
- **Trebuchet** → breaks walls from long range
- **Siege Tower** → bypasses walls entirely
- **Miliz / Stone Thrower** → bypass moats
- **Longbow-tech Archers** → outrange tower archers (countered by Roof)

**Lesson:** Every defense has a specific counter. Defenders layer; attackers pick the layer-breaker. This is how you create emergent strategy without designing dozens of units.

---

## 8. Balance Numbers — Starter Table for Your Game

These aren't from the game's source (which is closed), but are sensible starting values based on the dev's descriptions. Tune from here.

| Unit | HP | DMG | Range | Speed | Cost | Counter Bonus |
|---|---|---|---|---|---|---|
| Villager | 20 | 2 | 1 | 1.0 | 5 | — |
| Miliz | 40 | 8 | 1 | 1.3 | 10 | 1.5× vs Knight |
| Stone Thrower | 35 | 10 | 3 | 1.2 | 12 | 1.5× vs Miliz |
| Archer | 45 | 12 | 6 | 1.0 | 20 | 1.5× vs Swordsman |
| Swordsman | 110 | 20 | 1 | 0.8 | 40 | 1.5× vs Stone Thrower, Miliz |
| Knight | 90 | 25 | 1 | 1.5 | 50 | 1.5× vs Archer, Stone Thrower |
| Ram | 80 | 5 / 60 vs buildings | 1 | 0.6 | 60 | — |
| Trebuchet | 60 | 90 vs buildings | 10 | 0.3 | 120 | — |
| King | 500 | 30 | 1 | 0.7 | — | — |

### The Core Balance Formula
```
TTK (Time to Kill) = HP_defender / DPS_attacker
```

**Tuning targets:**
- Unit hitting its hard counter: **TTK ≈ 2–4 seconds** (feels decisive)
- Mirror matchup (same unit): **TTK ≈ 6–10 seconds** (feels fair)
- Unit hitting its counter-opposite (the one that counters it): **TTK ≈ 12+ seconds** (feels bad, encourages switching)

### Cost-to-Power Ratio (DPS per gold)
Keep this roughly constant, with premium units paying slightly more per DPS to justify their tankiness.

---

## 9. Key Design Lessons for Your Game

### ✅ What to steal

1. **Pentagon combat, not triangle.** 5 units with layered counters gives way more depth than 3-unit RPS. Consider this for enemy AI variety too.

2. **Single resource economy.** Stops resource-micro. Every spend is a tradeoff against every other spend — in your game, this maps cleanly to your essence economy.

3. **Role-convertible base units.** Villagers retrain into any combat unit. One art asset, many roles.

4. **Techs modify, don't add.** Research changes math of existing units. Shorter tech tree, same depth. Great for your scope.

5. **Building-based progression.** A new building = a new strategy option. Maps directly to your post-cycle progression plans.

6. **Modular defenses with specific counters.** Each wall layer has a specific attacker. Creates emergent siege puzzles without needing 20 unit types.

7. **The Well pattern.** Every system inefficiency (idle villagers) becomes a *reason to build something*. Look for places in your loop where you can turn an inefficiency into a building unlock.

8. **Single-point-of-failure objective.** The King mechanic creates per-wave tension. Your sell hub could work the same way.

### ❌ What to watch out for

1. **Multiplayer desyncs** — the dev fought these for multiple patches. If you go multiplayer, use lockstep carefully or go server-authoritative.

2. **Side-view gets complex with siege.** Stacking walls, stairs, battlements vertically on a 2D side-view is hard to make readable.

3. **Tech tree bloat.** 7 techs is tight. Resist adding more — each tech should materially change matchup math.

---

## 10. Quick Combat Math Cheat Sheet

### Designing a new unit?
Fill these 6 numbers:

```
HP    : How long it survives
DMG   : How hard it hits
RNG   : Where it can hit from
SPD   : How it positions
COST  : How it trades against other spending
ROLE  : Which 1-2 units it hard-counters
```

### Then sanity check against these rules:
- **DMG × attacks_per_sec / COST** should be roughly equal across units (cost-effectiveness parity).
- **Speed × Range** should be inversely related to HP (fast + long range = glass cannon).
- **Every unit must have at least one hard counter.** No unit wins vs everything.
- **Every unit must hard counter at least one other.** No unit is purely a jack-of-all-trades.

---

## 11. Source Attribution

- Unit descriptions, building list, tech tree: **Templar_VII** (developer), posted Jan 31, 2022 on hightreason.forumotion.net
- Unit pentagon diagram: fan forum, confirmed against dev's text descriptions
- Release notes: Microsoft Store listing (delisted)
- Platform/genre info: PCGamingWiki (stub article)
- Counter-relationships verified against dev's explicit text ("Bonus against…", "Excellent against…")

---

*Compiled April 2026. The live game is delisted; the forum is the last surviving canonical source.*
