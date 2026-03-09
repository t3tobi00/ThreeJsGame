# Project State — Base Defense Tycoon

> **Last Updated**: 2025-06-10 15:15:00 — selling_system_complete
> **Current Phase**: Phase 4 IN PROGRESS → Selling System COMPLETE

---

## Phase Summary

| Phase | Name                        | Status      |
|-------|-----------------------------|-------------|
| 1     | Foundation (Movement/Input) | ✅ DONE     |
| 2     | Core Juice (Combat/Harvest) | ✅ DONE     |
| 3     | Base Building & Expansion   | ✅ DONE     |
| 4     | Level Progression & Enemies | 🔧 PENDING  |
| 5     | Boss, Polish & Optimization | ⬜ NOT YET  |

---

## Phase 4 — What Needs Building

### Features
- [x] **Selling System** — Player-to-table meat transfer, villager NPCs, coin economy
- [ ] Level progression system (Lone Outpost → Dusty Junction → Neon Oasis → Sandstorm Siege)
- [ ] New enemy types: Speeder (fast, low HP), Tank (slow, high HP)
- [ ] Wall repair mechanic (player spends resources to restore wall HP)
- [ ] Player upgrade zones (stack limit increase, fire rate boost)

### Blockers
- None currently.

---

## Phase 5 — Planned (Not Started)
- Boss: Cylinder King
- Infinite wave generator
- Particle system (pooled explosions)
- Post-processing bloom pass
- Final mobile optimization

---

## Recently Completed (last 5 milestones)
1. **Selling System** — Complete implementation with coin tray, villagers, road, transactions
2. Coin tray with vertical jelly-stack animation (gold coins)
3. Villager NPC system with queue behavior, states, economy participation
4. Player-to-table meat transfer with bezier curve animations
5. Turret multi-owner firing integrated with CombatSystem

---

## Active Concerns / Tech Debt
- (None logged yet — agents should add items here as they discover them)

---

## New Files Added (Selling System)
- `src/entities/CoinTray.js` — Coin storage with stack animation
- `src/entities/MeatTable.js` — Table meat manager with transfer animations
- `src/entities/Villager.js` — NPC entity with queue states
- `src/entities/Road.js` — Paved stone road visual
- `src/systems/SellingSystem.js` — Player-to-table meat transfer
- `src/systems/VillagerSystem.js` — Villager spawn, queue, transactions
- `src/systems/CoinSystem.js` — Coin economy management
