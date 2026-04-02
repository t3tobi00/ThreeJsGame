/**
 * Component_SafeZone — Marks the safe zone entity.
 * Bounds use grid row/col integers and can grow irregularly in future.
 *
 * fenceGroup and fenceColliderIds are set externally in main.js after
 * SceneLoader returns them — they are not archetype-configurable.
 */
export class Component_SafeZone {
    constructor({ health = 100, maxHealth = 100, bounds = {} } = {}) {
        this.health    = health;
        this.maxHealth = maxHealth;
        this.bounds    = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, ...bounds };
        this.active    = true;

        // Set externally after level load
        this.fenceGroup       = null;  // THREE.Group — hidden when zone dies
        this.fenceColliderIds = [];    // ECS entity IDs of fence edge colliders
    }
}
