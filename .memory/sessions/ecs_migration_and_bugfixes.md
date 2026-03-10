# Session: ECS Migration & Bugfixes

**Date**: 2026-03-10
**Goal**: Re-architect the monolithic classes into a Component-Based (ECS) framework and fix the resultant system integration bugs.

## Technical Tasks Accomplished
1. **ECS Framework Creation**:
   - `ECSManager.js` handles components, entities, and querying systems.
   - `EntityFactory.js` creates composite characters based on pure JSON configs.
2. **Component Standardization**:
   - Built standard `Component_Transform`, `Component_Movement`, `Component_Shooter`, `Component_InventoryStack`, and `Component_TransactionLogic`.
3. **Bugfixes & Bridging**:
   - Bridged the new Component-based player (`this.playerId`) with legacy systems by passing a `playerBridge` holding proxy methods to `.maxCapacity` and `.getCount()`.
   - Repaired `SellingSystem` crash removing array `.length` checks and stopping the game loop halt.
   - Restored `HarvestSystem` max-capacity checks to block infinite meat pickup.
   - Restored `CombatSystem` enemy-array looping to re-enable bullet collisions and damage.

## Lessons Learned
- **Architecture Transitions**: Phased architecture migrations mapping generic ECS components to legacy monolithic objects requires extremely strict proxy bridges (`playerBridge`, `mockStackSystem`). Any unmapped method (like `.popDisk` vs `.removeDisk`) immediately halts the update loop.
- **ThreeJS Object Physics**: Passing physics coordinates into separate standalone `ResourceTransfer` functions creates visual distortion if the target mesh is concurrently scaled, cloned, or disposed. We must ensure live `THREE.Mesh` objects are physically exchanged between systems rather than cloning visually.

## Next Steps for Future Agents
- Migrate the `VillagerSystem` and `CoinTray` into the `EntityFactory` system fully.
- Convert `UnlockZone` to use generic `TransactionLogic` instead of hardcoded spatial triggers.
- Scale down the `Coin` geometry to match the `ResourceDisk` visual scaling pattern (0.18 uniform dimension).
