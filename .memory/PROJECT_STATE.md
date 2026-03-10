# Project State — Base Defense Tycoon

> **Last Updated**: 2026-03-09 00:00:00 — selling_system_bugfix_and_utils
> **Current Phase**: Phase 4 IN PROGRESS → Selling System COMPLETE

---

## Phase Summary

| Phase | Name                        | Status      |
|-------|-----------------------------|-------------|
| 1     | Foundation (Movement/Input) | ✅ DONE     |
| 2     | Core Juice (Combat/Harvest) | ✅ DONE     |
| 3     | Base Building & Expansion   | ✅ DONE     |
| 4     | Selling System              | ✅ DONE     |
| 5     | ECS Migration & Polish      | ✅ DONE     |
| 6     | Level Progression & Final   | 🔧 PENDING  |

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

## Phase 6 — Planned (Not Started)
- Boss: Cylinder King
- Infinite wave generator
- Particle system (pooled explosions)
- Further ECS integration of UI/Level systems

---

## Recently Completed (last 5 milestones)
1. **ECS Bugfixes** — Fixed `SellingSystem` loop crash, missing `Projectile.update`, massive disk visuals, and infinite `HarvestSystem`.
2. **ECS Migration** — Introduced `ECSManager.js`, `EntityFactory`, and `Component_*` models to slowly port away from hardcoded entity classes.
3. **Selling System bugfixes** — 6 bugs fixed: road length, table position mismatch (3 sources→1), circular canBuy() dep, const/let, queue orientation, spawn/exit direction
4. **ResourceStack utility** — Reusable vertical spring-stack; replaces duplicate loops in StackSystem, CoinTray, MeatTable, Villager
5. **ResourceTransfer utility** — Reusable Bezier-arc flight; replaces MeatTable's manual inTransitMeat system

---

## Active Concerns / Tech Debt
- Needs full migration of Villagers and Coins to the new ECS `EntityFactory` system. Currently using legacy classes bridged by mock methods.
- The `UnlockZone` system and coin collection should ideally be merged into pure ECS logic.

---

## New Files Added (ECS Architecture)
- `src/ecs/ECSManager.js` — Core registry
- `src/ecs/components/` — `Component_Transform`, `Component_Movement`, `Component_InventoryStack`, `Component_Shooter`, `Component_TransactionLogic`
- `src/entities/EntityFactory.js` — Factory for composite entities
- `src/systems/TransactionSystem.js` — Universal resource logic

---

## New Files Added (Selling System)
- `src/entities/CoinTray.js` — Coin storage with stack animation
- `src/entities/MeatTable.js` — Table meat manager with transfer animations
- `src/entities/Villager.js` — NPC entity with queue states
- `src/entities/Road.js` — Paved stone road visual
- `src/systems/SellingSystem.js` — Player-to-table meat transfer
- `src/systems/VillagerSystem.js` — Villager spawn, queue, transactions
- `src/systems/CoinSystem.js` — Coin economy management

## New Utility Files (S002)
- `src/utils/ResourceStack.js` — Reusable vertical spring-stack for any resource type
- `src/utils/ResourceTransfer.js` — Reusable Bezier-arc flight animation
