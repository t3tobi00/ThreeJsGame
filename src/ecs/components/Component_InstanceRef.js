/**
 * Component_InstanceRef — Links an entity to its slot in an InstancedCharacterPool.
 *
 * Used by HealthSystem to call pool.release(index) on death instead of scene.remove().
 * Added automatically by EntityFactory when the entity uses an instanced pool.
 */
export class Component_InstanceRef {
    constructor(pool, index) {
        this.pool  = pool;   // InstancedCharacterPool reference
        this.index = index;  // slot index within the pool
    }
}
