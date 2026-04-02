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

        // fenceColliderIds: ECS entity IDs of fence edge colliders — disabled on zone death.
        // Set by main.js after SceneLoader returns fence edge data.
        this.fenceColliderIds = [];

        // Note: fenceGroup (THREE.Group) is intentionally NOT stored here.
        // Rendering references don't belong in components. SafeZoneSystem holds it directly.
    }
}
